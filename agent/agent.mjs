// Give an AI agent a mission. It does the research through Flashpoint, and
// comes to you, the commander, only when your standing orders say so.
//
//   node agent/agent.mjs "<mission>"            real run: emails real people, spends credit
//   node agent/agent.mjs "<mission>" --practice practice run: an AI stand-in plays Flashpoint and
//                                               invents the answers. No emails, no credit.
//   node agent/agent.mjs "<mission>" --fake     the same with fixed canned replies (used by the tests)
//
//   --cap 8            most the run may spend on Flashpoint, in USDC (default 8)
//   --recipients file  who to survey, one "Name, email" per line (default agent/recipients.txt)
//   --orders file      your standing orders, one "- order" per line (default agent/orders.md)
//   --resume folder    carry on a real run that was stopped, from its folder under agent/runs/
//
// Needs FLASHPOINT_WALLET_KEY and ANTHROPIC_API_KEY in .env (see .env.example).
// Everything the agent decides is saved under agent/runs/<time>/, with emails removed.
import fs from "node:fs";
import readline from "node:readline";
import Anthropic from "@anthropic-ai/sdk";
import { runAgent, makeRedactor, DEFAULT_ORDERS } from "./loop.mjs";
import { fakeFlashpoint } from "./fake-flashpoint.mjs";
import { practiceWriter, PRACTICE_TAG } from "./practice-writer.mjs";
import { logEntry, logHeader, logFooter, shortLine } from "./log.mjs";

const root = new URL("../", import.meta.url);
const argv = process.argv.slice(2);
const valueFlags = ["--cap", "--recipients", "--orders", "--resume"];
const flag = (name) => {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
};
const mode = argv.includes("--practice") ? "practice" : argv.includes("--fake") ? "fake" : "real";
const fake = mode !== "real"; // nothing real is sent or paid
// A stopped real run can be carried on from its folder: the mission, the orders,
// the cap and everything the agent had learned come from there.
const resumeDir = flag("--resume") ? new URL(`${flag("--resume").replace(/\/?$/, "/")}`, `file://${process.cwd()}/`) : null;
let resumed = null;
if (resumeDir) {
  const stateFile = new URL("state.json", resumeDir);
  const stepsFile = new URL("steps.json", resumeDir);
  if (mode !== "real" || !fs.existsSync(stateFile) || !fs.existsSync(stepsFile)) {
    console.log("Only a real run can be resumed, from a folder that holds its state.json and steps.json. Nothing was sent or paid.");
    process.exit(1);
  }
  resumed = { state: JSON.parse(fs.readFileSync(stateFile, "utf8")), head: JSON.parse(fs.readFileSync(stepsFile, "utf8")) };
  if (resumed.head.steps.some((step) => step.kind === "finish")) {
    console.log("That run already finished. Nothing was sent or paid.");
    process.exit(1);
  }
}
const objective = resumed ? resumed.head.objective : argv.find((arg, i) => !arg.startsWith("--") && !valueFlags.includes(argv[i - 1]));
const cap = Number(flag("--cap") ?? resumed?.head.cap ?? 8);
const recipientsFile = flag("--recipients") ?? new URL("agent/recipients.txt", root);
const ordersFile = flag("--orders") ?? new URL("agent/orders.md", root);
const atDesk = Boolean(process.stdin.isTTY);

if (!objective || !(cap > 0)) {
  console.log('usage: node agent/agent.mjs "<mission>" [--practice | --fake] [--cap 8] [--recipients file] [--orders file]\n       node agent/agent.mjs --resume agent/runs/<folder>');
  process.exit(1);
}
if (!fake && !atDesk) {
  console.log("A real run needs a commander at the keyboard: no email goes out without your approval. Run it in a terminal. Nothing was sent or paid.");
  process.exit(1);
}

function readEnv(name) {
  if (process.env[name]) return process.env[name];
  const file = new URL(".env", root);
  if (!fs.existsSync(file)) return null;
  const match = fs.readFileSync(file, "utf8").match(new RegExp(`^${name}=(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

function readRecipients(file) {
  if (!fs.existsSync(file)) {
    console.log("No recipient list found. Copy agent/recipients.example.txt to agent/recipients.txt and put in people who agreed to be surveyed.");
    process.exit(1);
  }
  const people = [];
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (line.trim() === "" || line.trim().startsWith("#")) continue;
    const [name, email] = line.split(",").map((part) => part.trim());
    if (!name || !email || !email.includes("@")) {
      console.log(`Could not read this line of the recipient list: it should be "Name, email".`);
      process.exit(1);
    }
    people.push({ name, email });
  }
  if (people.length === 0) {
    console.log("The recipient list is empty.");
    process.exit(1);
  }
  return people;
}

// Standing orders are the lines that start with "- ".
function readOrders(file) {
  if (!fs.existsSync(file)) {
    if (flag("--orders")) {
      console.log("The orders file was not found.");
      process.exit(1);
    }
    return DEFAULT_ORDERS;
  }
  const orders = fs.readFileSync(file, "utf8").split("\n").filter((line) => line.startsWith("- ")).map((line) => line.slice(2).trim()).filter(Boolean);
  return orders.length > 0 ? orders : DEFAULT_ORDERS;
}

const recipients = readRecipients(recipientsFile);
const orders = resumed ? resumed.head.orders : readOrders(ordersFile);
const redact = makeRedactor(recipients);

const apiKey = readEnv("ANTHROPIC_API_KEY");
if (!apiKey) {
  console.log("ANTHROPIC_API_KEY is not set. Put it in .env (see .env.example).");
  process.exit(1);
}
const client = new Anthropic({ apiKey });
const model = process.env.AGENT_MODEL ?? "claude-sonnet-5-5";

async function llm({ system, tools, messages }) {
  return client.messages.create({
    model,
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system,
    tools,
    messages,
  });
}

const stamp = resumed ? resumed.head.stamp : new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const runDir = resumeDir ?? new URL(`agent/runs/${fake ? `${mode}-` : ""}${stamp}/`, root);
fs.mkdirSync(runDir, { recursive: true });
const logFile = new URL("log.md", runDir);

// The real Flashpoint. Imported only for a real run, so a practice run never
// touches the wallet.
async function connectReal() {
  const { connect, callTool, balance } = await import("../flashpoint.mjs");
  const { realFlashpoint } = await import("./real-flashpoint.mjs");
  // Every real reply is kept as it came, for working out what went wrong afterwards.
  // It can hold addresses, so the raw folder is git-ignored.
  let calls = 0;
  const keepRaw = (tool, reply) => {
    const dir = new URL("raw/", runDir);
    fs.mkdirSync(dir, { recursive: true });
    calls += 1;
    fs.writeFileSync(new URL(`${String(calls).padStart(2, "0")}-${tool}.json`, dir), JSON.stringify(reply, null, 2));
  };
  const saveFile = (name, bytes) => fs.writeFileSync(new URL(name, runDir), bytes);
  return { flashpoint: realFlashpoint({ connect, callTool, keepRaw, saveFile, label: stamp }), balance };
}

// ---- The commander's desk: everything typed at the keyboard goes through here. ----

// One typed line. Anything typed before the prompt appeared is thrown away, so a
// key pressed during a long step cannot answer a question nobody had read yet.
function typed(prompt, { timeoutMs = 0 } = {}) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const shown = Date.now();
    let finished = false;
    const done = (text) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      rl.close();
      resolve(text);
    };
    const timer = timeoutMs > 0 ? setTimeout(() => { console.log(""); done(""); }, timeoutMs) : null;
    rl.on("line", (text) => {
      if (Date.now() - shown < 400) { rl.prompt(); return; }
      done(text.trim());
    });
    rl.on("close", () => done("")); // Ctrl+D counts as an empty reply
    rl.setPrompt(prompt);
    rl.prompt();
  });
}

// A little colour when a person is watching; plain text when piped to a file.
const colour = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, text) => (colour ? `\x1b[${code}m${text}\x1b[0m` : text);
const bold = (text) => paint("1", text);
const dim = (text) => paint("2", text);
const rule = (label) => console.log(`\n${bold(`── ${label} ${"─".repeat(Math.max(3, 66 - label.length))}`)}`);
// The step number in cyan, the first line as it is, the lines under it dimmed.
const printStep = (text) => {
  const [first, ...rest] = text.split("\n");
  console.log([first.replace(/^\[[ \d]+\]/, (tag) => paint("36", tag)), ...rest.map(dim)].join("\n"));
};
const indent = (text) => String(text).split("\n").map((line) => `  ${line}`).join("\n");

function show(request) {
  if (request.kind === "ask") {
    rule("The agent has come to you");
    if (request.order) console.log(`  Your order: "${request.order}"\n`);
    console.log(indent(request.message));
  }
  if (request.kind === "approve_send") {
    rule(`Approve the round ${request.round} send?`);
    console.log(`  The agent wants to email this survey to ${request.people} ${request.people === 1 ? "person" : "people"}. It cannot be undone.\n`);
    console.log(indent(request.survey || "(Flashpoint has not shown a draft.)"));
    if (request.changes?.length > 0) console.log(`\n  Changes Flashpoint reported after that:\n\n${request.changes.map((change) => indent(change)).join("\n\n")}`);
  }
  if (request.kind === "guess") {
    rule(`Sealed envelope, round ${request.round}: your guess (${request.number} of ${request.of})`);
    if (request.number === 1) console.log("  The agent has written down its own guess. It cannot see yours until the results are in.\n");
    console.log(indent(request.question));
  }
}

// A practice run with nobody at the keyboard still needs a commander, so it gets canned replies.
const canned = { ask: "Understood. Your call, carry on.", approve_send: "yes", guess: "I think most will pick the cheapest option." };

async function commander(request) {
  show(request);
  if (!atDesk) {
    console.log(`\n  (practice commander, canned reply) ${canned[request.kind]}`);
    return canned[request.kind];
  }
  if (request.kind === "approve_send") return typed("\n  yes, or no and why > ");
  if (request.kind === "guess") return typed("\n  your guess (Enter to skip) > ");
  return typed("\n  you > ");
}

// Waits the given minutes, or until Enter. Anything typed is passed to the agent.
async function wait(minutes) {
  if (fake) return "";
  rule(`Waiting up to ${minutes} min for answers`);
  console.log("  Answer the survey in your inbox. Press Enter to go on, or type a note for the agent first.");
  if (mode === "real") console.log(`  To come back later, stop with Ctrl+C and run: node agent/agent.mjs --resume ${runFolder}`);
  return typed("\n  you > ", { timeoutMs: minutes * 60 * 1000 });
}

// ---- The log ----

const steps = resumed ? resumed.head.steps : [];
const runFolder = `agent/runs/${runDir.pathname.replace(/\/$/, "").split("/").pop()}`;
const head = { objective: redact(objective), model, mode, cap, orders, people: recipients.length, stamp, practiceCommander: !atDesk };

function record(step) {
  steps.push(step);
  fs.writeFileSync(new URL("steps.json", runDir), JSON.stringify({ ...head, steps }, null, 2));
  if (step.kind === "sealed") fs.writeFileSync(new URL(`envelope-round-${step.round}.json`, runDir), JSON.stringify(step.envelope));
  fs.appendFileSync(logFile, `${logEntry(step)}\n`);
  printStep(shortLine(step));
}

if (resumed) fs.appendFileSync(logFile, "---\n\n*The mission was stopped here and carried on later.*\n\n");
else fs.writeFileSync(logFile, logHeader(head));

// The whole state of the mission, saved after every step, so a stopped run can be resumed.
// It holds the full conversation, so it is git-ignored.
const save = (snapshot) => fs.writeFileSync(new URL("state.json", runDir), JSON.stringify(snapshot));

console.log(`Mission: ${objective}`);
console.log(`${recipients.length} people on the list. Cap $${cap.toFixed(2)}. ${{ real: "REAL RUN: this emails the people on the list and spends credit.", practice: "PRACTICE RUN: an AI stand-in plays Flashpoint and invents the answers. Nothing is sent or paid.", fake: "PRACTICE RUN: canned fake Flashpoint. Nothing is sent or paid." }[mode]}`);
console.log(`Standing orders:\n${orders.map((order) => `  - ${order}`).join("\n")}\n`);

let flashpoint;
let before = null;
let balanceOf = null;
if (mode === "fake") {
  flashpoint = fakeFlashpoint();
} else if (mode === "practice") {
  // A small, fast model plays Flashpoint and the people who answer.
  const ask = async (system, prompt) => {
    const reply = await client.messages.create({ model: process.env.PRACTICE_MODEL ?? "claude-haiku-5-5", max_tokens: 4000, system, messages: [{ role: "user", content: prompt }] });
    return reply.content.filter((block) => block.type === "text").map((block) => block.text).join("").trim();
  };
  flashpoint = fakeFlashpoint({ writer: practiceWriter({ ask }), tag: PRACTICE_TAG, scrub: redact });
} else {
  const real = await connectReal();
  flashpoint = real.flashpoint;
  balanceOf = real.balance;
  before = await balanceOf();
  if (before < 0.5) {
    console.log(`The wallet holds ${before} USDC, which is less than one step. Nothing was sent.`);
    process.exit(1);
  }
}

const { answer, spent } = await runAgent({ objective, recipients, cap, orders, llm, flashpoint, commander, wait, record, save, resume: resumed?.state ?? null });

let wallet = null;
if (balanceOf) {
  try {
    const after = await balanceOf();
    wallet = `Wallet: ${before} USDC before, ${after} USDC after, so this run cost ${(before - after).toFixed(2)} USDC.`;
  } catch {
    wallet = `Wallet: ${before} USDC before. The balance could not be read afterwards.`;
  }
  console.log(`\n${wallet}`);
}
fs.appendFileSync(logFile, logFooter({ steps, cap, spent, wallet }));

if (!answer) {
  console.log(`\nThe agent stopped without an answer after spending $${spent.toFixed(2)}. See ${logFile.pathname}`);
  process.exit(1);
}
rule("The agent's answer");
const board = answer.scoreboard.map((row) => `  Round ${row.round}: ${row.question}\n    people said: ${row.people_said}\n    agent ${row.agent}, AI personas ${row.personas}, commander ${row.commander}`).join("\n");
console.log(`\nRecommendation: ${answer.recommendation}\n\nEvidence: ${answer.evidence}\n\nScoreboard:\n${board || "  (no envelope was opened)"}\n\nBetween rounds: ${answer.learned_between_rounds}\n\nLimits: ${answer.limits}\n\nSpent $${spent.toFixed(2)} of $${cap.toFixed(2)}. Full log: ${logFile.pathname}`);
