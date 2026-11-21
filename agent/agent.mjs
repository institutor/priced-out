// Give an AI agent one objective. It does the research through Flashpoint.
//
//   node agent/agent.mjs "<objective>"            real run: emails real people, spends credit
//   node agent/agent.mjs "<objective>" --fake     practice run: no emails, no credit
//
//   --cap 8            most the run may spend on Flashpoint, in USDC (default 8)
//   --recipients file  who to survey, one "Name, email" per line (default agent/recipients.txt)
//
// Needs FLASHPOINT_WALLET_KEY and ANTHROPIC_API_KEY in .env (see .env.example).
// Everything the agent decides is saved under agent/runs/<time>/, with emails removed.
import fs from "node:fs";
import readline from "node:readline";
import Anthropic from "@anthropic-ai/sdk";
import { runAgent, makeRedactor, STEP_PRICE } from "./loop.mjs";
import { fakeFlashpoint } from "./fake-flashpoint.mjs";

const root = new URL("../", import.meta.url);
const argv = process.argv.slice(2);
const flag = (name) => {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
};
const fake = argv.includes("--fake");
const objective = argv.find((arg, i) => !arg.startsWith("--") && !["--cap", "--recipients"].includes(argv[i - 1]));
const cap = Number(flag("--cap") ?? 8);
const recipientsFile = flag("--recipients") ?? new URL("agent/recipients.txt", root);

if (!objective || !(cap > 0)) {
  console.log('usage: node agent/agent.mjs "<objective>" [--fake] [--cap 8] [--recipients file]');
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

const recipients = readRecipients(recipientsFile);
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

// The real Flashpoint. Imported only for a real run, so a practice run never
// touches the wallet.
async function realFlashpoint() {
  const { connect, callTool, balance } = await import("../flashpoint.mjs");
  let ids = {};
  const call = async ({ message, newSurvey }) => {
    if (newSurvey) ids = {};
    const receipts = [];
    const printError = console.error;
    console.error = (...parts) => { receipts.push(parts.join(" ")); };
    let result;
    try {
      // A session lasts an hour and a run can last longer, so sign in each time. Signing in is free.
      result = await callTool(await connect(), "tool_survey", { brief: message, ...ids });
    } finally {
      console.error = printError;
    }
    if (result?.error) throw new Error(typeof result.error === "string" ? result.error : JSON.stringify(result.error));
    const inner = result?.result ?? {};
    ids = {
      ...(inner.conversation_id ?? result?.conversation_id ? { conversation_id: inner.conversation_id ?? result.conversation_id } : {}),
      ...(inner.survey_id ? { survey_id: inner.survey_id } : {}),
    };
    const text = inner.final_text ?? (typeof result === "string" ? result : JSON.stringify(result));
    return { text, receipts };
  };
  return { call, balance };
}

// Waits the given minutes, or until Enter is pressed.
function wait(minutes) {
  if (fake) return Promise.resolve();
  console.log(`\n   Waiting up to ${minutes} min for answers. Answer the survey in your inbox, then press Enter to go on.\n`);
  return new Promise((resolve) => {
    const rl = process.stdin.isTTY ? readline.createInterface({ input: process.stdin }) : null;
    const done = () => { clearTimeout(timer); rl?.close(); resolve(); };
    const timer = setTimeout(done, minutes * 60 * 1000);
    rl?.once("line", done);
  });
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const runDir = new URL(`agent/runs/${fake ? "fake-" : ""}${stamp}/`, root);
fs.mkdirSync(runDir, { recursive: true });
const logFile = new URL("log.md", runDir);
const steps = [];

function record(step) {
  steps.push(step);
  fs.writeFileSync(new URL("steps.json", runDir), JSON.stringify({ objective: redact(objective), model, fake, cap, steps }, null, 2));
  let entry = "";
  if (step.kind === "thinking") entry = `**Agent:** ${step.text}\n`;
  if (step.kind === "flashpoint") entry = `### Step ${step.n}: to Flashpoint ($${STEP_PRICE.toFixed(2)}, $${step.spent.toFixed(2)} spent so far)\n\n*Why:* ${step.why}\n\n*Sent:*\n\n> ${step.message.split("\n").join("\n> ")}\n\n*Flashpoint replied:*\n\n> ${step.reply.split("\n").join("\n> ")}\n${step.receipts.map((r) => `\n${r}`).join("")}\n`;
  if (step.kind === "flashpoint-failed") entry = `### Step ${step.n}: Flashpoint call failed (not charged)\n\n*Why:* ${step.why}\n\n${step.error}\n`;
  if (step.kind === "blocked") entry = `### Step ${step.n}: stopped by the budget\n\nThe agent tried another Flashpoint step and the cap refused it.\n`;
  if (step.kind === "wait") entry = `### Step ${step.n}: wait ${step.minutes} min\n\n*Why:* ${step.why}\n`;
  if (step.kind === "finish") entry = `## Answer\n\n**Recommendation.** ${step.recommendation}\n\n**Evidence.** ${step.evidence}\n\n**What changed between rounds.** ${step.learned_between_rounds}\n\n**Limits.** ${step.limits}\n`;
  fs.appendFileSync(logFile, `${entry}\n`);
  const short = { thinking: step.text, flashpoint: `Flashpoint <- ${step.why}`, "flashpoint-failed": `Flashpoint failed: ${step.error}`, blocked: "Budget cap refused a step", wait: `wait ${step.minutes} min: ${step.why}`, finish: "finished" }[step.kind];
  console.log(`[${step.n}] ${short}`);
}

fs.writeFileSync(logFile, `# Agent run ${stamp}${fake ? " (practice run with a fake Flashpoint: no real survey, no real answers)" : ""}\n\n**Objective given:** ${redact(objective)}\n\n**People on the list:** ${recipients.length}. **Budget cap:** $${cap.toFixed(2)}. **Model:** ${model}.\n\nEverything below this line was decided by the agent.\n\n---\n\n`);

console.log(`Objective: ${objective}`);
console.log(`${recipients.length} people on the list. Cap $${cap.toFixed(2)}. ${fake ? "PRACTICE RUN: fake Flashpoint, nothing is sent or paid." : "REAL RUN: this emails the people on the list and spends credit."}\n`);

let flashpoint;
let before = null;
let balanceOf = null;
if (fake) {
  flashpoint = fakeFlashpoint();
} else {
  const real = await realFlashpoint();
  flashpoint = real.call;
  balanceOf = real.balance;
  before = await balanceOf();
  if (before < STEP_PRICE) {
    console.log(`The wallet holds ${before} USDC, which is less than one step. Nothing was sent.`);
    process.exit(1);
  }
}

const { answer, spent } = await runAgent({ objective, recipients, cap, llm, flashpoint, wait, record });

if (balanceOf) {
  const after = await balanceOf();
  const line = `Wallet: ${before} USDC before, ${after} USDC after, so this run cost ${(before - after).toFixed(2)} USDC.`;
  fs.appendFileSync(logFile, `---\n\n${line}\n`);
  console.log(`\n${line}`);
}

if (!answer) {
  console.log(`\nThe agent stopped without an answer after spending $${spent.toFixed(2)}. See ${logFile.pathname}`);
  process.exit(1);
}
console.log(`\nRecommendation: ${answer.recommendation}\n\nEvidence: ${answer.evidence}\n\nBetween rounds: ${answer.learned_between_rounds}\n\nLimits: ${answer.limits}\n\nFull log: ${logFile.pathname}`);
