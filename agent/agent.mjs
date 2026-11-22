// Give an AI agent a mission. It does the research through Flashpoint, and
// comes to you, the commander, only when your standing orders say so.
//
//   node agent/agent.mjs "<mission>"            real run: emails real people, spends credit
//   node agent/agent.mjs "<mission>" --practice practice run: an AI stand-in plays Flashpoint and
//                                               invents the answers. No emails, no credit.
//   node agent/agent.mjs "<mission>" --fake     the same with fixed canned replies (used by the tests)
//
//   --cap 9            most the run may spend on Flashpoint, in USDC (default 9)
//   --emails 2         most emails anyone on the list may get, reminders included (default 2)
//   --recipients file  who to survey, one "Name, email" per line (default agent/recipients.txt)
//   --orders file      your standing orders, one "- order" per line (default agent/orders.md)
//   --resume folder    carry on a real run that was stopped, from its folder under agent/runs/
//   --hands-off        hand the mission over and walk away: the agent sends without asking you,
//                      as long as the survey passes the code's send checks
//
// Needs FLASHPOINT_WALLET_KEY and ANTHROPIC_API_KEY in .env (see .env.example).
// Everything the agent decides is saved under agent/runs/<time>/, with emails removed.
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import Anthropic from "@anthropic-ai/sdk";
import { runAgent, makeRedactor, DEFAULT_ORDERS, HANDS_OFF_ORDERS, SEND_CHECKS, EMAIL_LIMIT } from "./loop.mjs";
import { readLessons, writeLessons } from "./memory.mjs";
import { fakeFlashpoint } from "./fake-flashpoint.mjs";
import { practiceWriter, PRACTICE_TAG } from "./practice-writer.mjs";
import { summarize } from "./summary.mjs";
import { logEntry, logHeader, logFooter, shortLine } from "./log.mjs";

const root = new URL("../", import.meta.url);
const argv = process.argv.slice(2);
const valueFlags = ["--cap", "--emails", "--recipients", "--orders", "--resume", "--quiet"];
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
  if (mode === "practice" || !fs.existsSync(stateFile) || !fs.existsSync(stepsFile)) {
    console.log("Only a real run can be resumed, from a folder that holds its state.json and steps.json. Nothing was sent or paid.");
    process.exit(1);
  }
  resumed = { state: JSON.parse(fs.readFileSync(stateFile, "utf8")), head: JSON.parse(fs.readFileSync(stepsFile, "utf8")) };
  // A run is carried on as what it was. A practice folder must never become a real run.
  if (resumed.head.mode !== mode) {
    console.log(`That folder holds a ${resumed.head.mode === "real" ? "real" : "practice"} run, so it cannot be carried on as a ${mode === "real" ? "real" : "practice"} one. Nothing was sent or paid.`);
    process.exit(1);
  }
  if (resumed.head.steps.some((step) => step.kind === "finish")) {
    console.log("That run already finished. Nothing was sent or paid.");
    process.exit(1);
  }
}
const objective = resumed ? resumed.head.objective : argv.find((arg, i) => !arg.startsWith("--") && !valueFlags.includes(argv[i - 1]));
const cap = Number(flag("--cap") ?? resumed?.head.cap ?? 9);
// A resumed run keeps the limit it started with: it is a promise to the people on the list.
const emailLimit = Number(resumed ? resumed.head.emailLimit ?? EMAIL_LIMIT : flag("--emails") ?? EMAIL_LIMIT);
// A resumed run reads the list it started with, unless told otherwise.
const recipientsFile = flag("--recipients") ?? resumed?.state.list?.file ?? new URL("agent/recipients.txt", root);
const ordersFile = flag("--orders") ?? new URL("agent/orders.md", root);
const atDesk = Boolean(process.stdin.isTTY);
// Handed over: the commander approves the limits once, at the start, and is then away.
const handsOff = resumed ? resumed.head.handsOff === true : argv.includes("--hands-off");

if (!objective || !(cap > 0) || !Number.isInteger(emailLimit) || emailLimit < 1) {
  console.log('usage: node agent/agent.mjs "<mission>" [--practice | --fake] [--cap 9] [--emails 2] [--hands-off] [--recipients file] [--orders file]\n       node agent/agent.mjs --resume agent/runs/<folder>');
  process.exit(1);
}
if (!fake && !atDesk) {
  console.log("A real run starts at a keyboard: no email goes out without your approval, or without you handing the mission over yourself. Run it in a terminal. Nothing was sent or paid.");
  process.exit(1);
}

function readEnv(name) {
  if (process.env[name]) return process.env[name];
  const file = new URL(".env", root);
  if (!fs.existsSync(file)) return null;
  const match = fs.readFileSync(file, "utf8").match(new RegExp(`^${name}=(.+)$`, "m"));
  return match ? match[1].trim() : null;
}

// A practice run emails nobody, so it can run from a fresh copy of the
// repository with a list of stand-ins.
const STAND_INS = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"].map((n, index) => ({ name: `Practice ${n}`, email: `practice${index + 1}@example.com` }));

function readRecipients(file) {
  if (!fs.existsSync(file) && fake && !flag("--recipients")) {
    console.log("No agent/recipients.txt, so this practice run uses 8 stand-in people. Nobody is emailed.\n");
    return STAND_INS;
  }
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
// The saved conversation calls people "[recipient 1]", "[recipient 2]" and so on. If the list
// changed while the run was stopped, those would now point at different people.
const list = {
  file: typeof recipientsFile === "string" ? path.resolve(recipientsFile) : fileURLToPath(recipientsFile),
  mark: createHash("sha256").update(recipients.map((person) => `${person.name}\n${person.email}`).join("\n")).digest("hex"),
};
if (resumed && resumed.state.list && resumed.state.list.mark !== list.mark) {
  console.log("The recipient list is not the one this run started with, so it cannot be carried on. Nothing was sent or paid.");
  process.exit(1);
}
const orders = resumed ? resumed.head.orders : handsOff && !flag("--orders") ? HANDS_OFF_ORDERS : readOrders(ordersFile);
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
    // Ctrl+C at a prompt stops the run. Without this, readline would close the prompt
    // and the run would carry on as if Enter had been pressed.
    rl.on("SIGINT", stopNow);
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
    console.log(`  The agent wants to email this survey to ${request.people} ${request.people === 1 ? "person" : "people"}. It cannot be undone.`);
    if (request.emailLimit) console.log(`  This would be email ${request.email} of the ${request.emailLimit} each person may get in this mission.${request.email === request.emailLimit ? " After it, nothing more can be sent to them." : ""}`);
    console.log("");
    console.log(indent(request.survey || "(Flashpoint has not shown a draft.)"));
    if (request.changes?.length > 0) console.log(`\n  Changes Flashpoint reported after that:\n\n${request.changes.map((change) => indent(change)).join("\n\n")}`);
  }
  if (request.kind === "guess") {
    rule(`Sealed envelope, round ${request.round}: your guess (${request.number} of ${request.of})`);
    if (request.number === 1) console.log("  The agent has written down its own guess. It cannot see yours until the results are in.\n");
    console.log(indent(request.question));
  }
}

// A practice run with nobody at the keyboard still needs a commander. In a --practice run an
// AI stand-in plays one, as it plays Flashpoint: it answers the agent's questions and seals a
// guess, and the log says that every word of it is invented. A --fake run gets canned replies:
// it approves sends and makes no guess.
const canned = { ask: "Nobody is at the keyboard for this practice run. Use your own judgement and carry on.", approve_send: "yes", guess: "" };
const standIn = mode === "practice" && !atDesk && !handsOff;
const STAND_IN = "You are standing in for a club officer in a practice run of a research tool. You run a student club of about 60 members and you gave an AI research agent a mission. Answer as that officer would: from what an officer plausibly knows, briefly, in plain words, in one to three sentences. Do not tell the agent what to do next; that is its job. Never mention that you are an AI model or that this is practice.";
let askStandIn = null; // set once the practice model is ready

async function commander(request) {
  show(request);
  if (!atDesk) {
    let reply = canned[request.kind];
    if (standIn && askStandIn && request.kind === "ask") reply = await askStandIn(STAND_IN, `Your mission to the agent was: ${objective}\n\nThe agent now says to you:\n${request.message}\n\nYour reply:`);
    if (standIn && askStandIn && request.kind === "guess") reply = await askStandIn(STAND_IN, `Your mission to the agent was: ${objective}\n\nBefore the survey goes out, you are asked to guess what most members will answer to this question. Give your honest guess in one short line, with one reason.\n\nQuestion: ${request.question}\n\nYour guess:`);
    console.log(`\n  (practice commander, ${standIn ? "AI stand-in" : "canned reply"}) ${reply || "(no guess)"}`);
    return reply;
  }
  if (request.kind === "approve_send") return typed("\n  yes, or no and why > ");
  if (request.kind === "guess") return typed("\n  your guess (Enter to skip) > ");
  return typed("\n  you > ");
}

// Waits the given minutes, or until Enter. Anything typed is passed to the agent.
async function wait(minutes) {
  if (fake) return "";
  rule(`Waiting up to ${minutes} min for answers`);
  console.log(handsOff ? "  The agent is waiting for people to answer. Press Enter to make it look now." : "  Answer the survey in your inbox. Press Enter to go on, or type a note for the agent first.");
  if (mode === "real") console.log(`  To come back later, stop with Ctrl+C and run: node agent/agent.mjs --resume ${runFolder}`);
  return typed("\n  you > ", { timeoutMs: minutes * 60 * 1000 });
}

// ---- The log ----

const steps = resumed ? resumed.head.steps : [];
const runFolder = `agent/runs/${runDir.pathname.replace(/\/$/, "").split("/").pop()}`;
// What the agent wrote down at the end of earlier missions. A fake run has no memory.
const memory = mode === "fake" ? [] : readLessons(mode);
const head = { objective: redact(objective), model, mode, cap, emailLimit, orders, people: recipients.length, stamp, practiceCommander: !atDesk && !handsOff, standInCommander: standIn, handsOff, memory: resumed ? resumed.head.memory ?? [] : memory };

// Ctrl+C. It is handled between steps, never in the middle of saving one, so the
// saved state always matches the log.
function stopNow() {
  console.log("\n\nStopped. Nothing more will be sent or paid.");
  if (mode !== "practice") console.log(`To carry on: node agent/agent.mjs ${mode === "fake" ? "--fake " : ""}--resume ${runFolder}`);
  process.exit(130);
}
process.on("SIGINT", stopNow);

function record(step) {
  steps.push(step);
  // Written to one side and moved into place, so a stop cannot leave half a file.
  fs.writeFileSync(new URL("steps.json.next", runDir), JSON.stringify({ ...head, steps }, null, 2));
  fs.renameSync(new URL("steps.json.next", runDir), new URL("steps.json", runDir));
  if (step.kind === "sealed") fs.writeFileSync(new URL(`envelope-round-${step.round}.json`, runDir), JSON.stringify(step.envelope));
  fs.appendFileSync(logFile, `${logEntry(step)}\n`);
  printStep(shortLine(step));
}

if (resumed) fs.appendFileSync(logFile, "---\n\n*The mission was stopped here and carried on later.*\n\n");
else fs.writeFileSync(logFile, logHeader(head));

// The whole state of the mission, saved after every step, so a stopped run can be resumed.
// It holds the full conversation, so it is git-ignored.
// It is written to a second file and then moved into place, so a stop in the middle of
// writing cannot leave half a file behind.
const save = (snapshot) => {
  const file = new URL("state.json", runDir);
  const next = new URL("state.json.next", runDir);
  fs.writeFileSync(next, JSON.stringify({ ...snapshot, list }));
  fs.renameSync(next, file);
};

console.log(`Mission: ${objective}`);
console.log(`${recipients.length} people on the list. Cap $${cap.toFixed(2)}. Nobody gets more than ${emailLimit} email${emailLimit === 1 ? "" : "s"}. ${{ real: "REAL RUN: this emails the people on the list and spends credit.", practice: "PRACTICE RUN: an AI stand-in plays Flashpoint and invents the answers. Nothing is sent or paid.", fake: "PRACTICE RUN: canned fake Flashpoint. Nothing is sent or paid." }[mode]}`);
console.log(`Standing orders:\n${orders.map((order) => `  - ${order}`).join("\n")}\n`);
if (head.memory.length > 0) console.log(`From earlier missions, the agent remembers:\n${head.memory.map((lesson) => `  - ${lesson}`).join("\n")}\n`);

// Handing over a real run is a decision, so it is typed out once, here, before anything is paid.
if (handsOff && mode === "real" && !resumed) {
  rule("Hand the mission over?");
  console.log(`  The agent will email the ${recipients.length} ${recipients.length === 1 ? "person" : "people"} on your list WITHOUT showing you the survey first.`);
  console.log(`  The code will still hold it to these checks before every send:\n${SEND_CHECKS.map((check) => `    - ${check}`).join("\n")}`);
  console.log(`  It can send each person ${emailLimit} email${emailLimit === 1 ? "" : "s"} at most and spend $${cap.toFixed(2)} at most.`);
  const consent = await typed("\n  Type yes to hand it over, or anything else to stop > ");
  if (!/^\W*(y|yes)\W*$/i.test(consent)) {
    console.log("Stopped. Nothing was sent or paid. Run it without --hands-off to approve each send yourself.");
    process.exit(0);
  }
}

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
  flashpoint = fakeFlashpoint({ writer: practiceWriter({ ask, quiet: Math.max(0, Number(flag("--quiet") ?? 0) || 0) }), tag: PRACTICE_TAG, scrub: redact });
  askStandIn = ask;
} else {
  const real = await connectReal();
  flashpoint = real.flashpoint;
  balanceOf = real.balance;
  before = await balanceOf();
  if (before < 0.5) {
    console.log(`The wallet holds ${before} USDC, which is less than one step. Nothing was sent.`);
    process.exit(1);
  }
  if (before < cap) console.log(`Note: the wallet holds ${before} USDC, less than the $${cap.toFixed(2)} cap. The run stops when the wallet is empty.\n`);
}

const { answer, spent } = await runAgent({ objective, recipients, cap, orders, emailLimit, handsOff, planFirst: true, memory: head.memory, roundCost: mode === "real" ? 3.5 : 2.5, llm, flashpoint, commander: handsOff ? null : commander, wait, record, save, resume: resumed ? { ...resumed.state, steps: resumed.head.steps.length } : null });

let wallet = null;
if (balanceOf) {
  try {
    const after = await balanceOf();
    wallet = `Wallet: ${before} USDC before, ${after} USDC after, so ${resumed ? "this run, since it was carried on, cost" : "this run cost"} ${(before - after).toFixed(2)} USDC.`;
  } catch {
    wallet = `Wallet: ${before} USDC before. The balance could not be read afterwards.`;
  }
  console.log(`\n${wallet}`);
}
fs.appendFileSync(logFile, logFooter({ steps, cap, spent, wallet }));
// The agent's own lessons go into its notebook for the next mission.
if (answer?.lessons?.length > 0 && mode !== "fake") writeLessons(mode, { stamp, objective: redact(objective), lessons: answer.lessons });
// One page on what the agent decided, made from the saved steps.
fs.writeFileSync(new URL("summary.md", runDir), summarize({ ...head, steps }));

if (!answer) {
  console.log(`\nThe agent stopped without an answer after spending $${spent.toFixed(2)}. See ${logFile.pathname}`);
  process.exit(1);
}
rule("The agent's answer");
const board = answer.scoreboard.map((row) => `  Round ${row.round}: ${row.question}\n    people said: ${row.people_said}\n    agent ${row.agent}, AI personas ${row.personas}, commander ${row.commander}`).join("\n");
console.log(`\nRecommendation: ${answer.recommendation}\n\nEvidence: ${answer.evidence}\n\nScoreboard:\n${board || "  (no envelope was opened)"}\n\nBetween rounds: ${answer.learned_between_rounds}\n\nLimits: ${answer.limits}${answer.lessons?.length > 0 ? `\n\nLessons it kept for next time:\n${answer.lessons.map((lesson) => `  - ${lesson}`).join("\n")}` : ""}\n\nSpent $${spent.toFixed(2)} of $${cap.toFixed(2)}. Full log: ${logFile.pathname}\nOne-page summary: ${new URL("summary.md", runDir).pathname}`);
