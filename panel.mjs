// Run a Flashpoint synthetic panel (AI personas, not people) through the survey.
//   node panel.mjs start             builds the panel described in
//                                    briefs/05-panel.json and starts it on the
//                                    survey (costs $0.60)
//   node panel.mjs status [job id]   asks how the run is going (free, never pays)
// The reply to "start" is saved to replies/05-panel.json and the job id to
// replies/state.json. The finished result is saved to
// replies/05-panel-result.json.
import fs from "node:fs";
import { connect, callTool } from "./flashpoint.mjs";

const here = new URL("./", import.meta.url);
const command = process.argv[2];

const briefFile = new URL("briefs/05-panel.json", here);
const startFile = new URL("replies/05-panel.json", here);
const resultFile = new URL("replies/05-panel-result.json", here);
const errorFile = new URL("replies/05-panel.error.txt", here);
const lockFile = new URL("replies/05-panel.sending", here);
const stateFile = new URL("replies/state.json", here);

function findKey(value, key) {
  if (value === null || typeof value !== "object") return undefined;
  if (typeof value[key] === "string" && value[key] !== "") return value[key];
  for (const child of Object.values(value)) {
    const found = findKey(child, key);
    if (found) return found;
  }
  return undefined;
}

function readState() {
  if (!fs.existsSync(stateFile)) return {};
  return JSON.parse(fs.readFileSync(stateFile, "utf8"));
}

async function start() {
  if (fs.existsSync(startFile)) {
    console.log("replies/05-panel.json already exists, so the panel was already started. Nothing was sent or paid.");
    console.log("Check on it with: node panel.mjs status");
    process.exit(1);
  }
  const state = readState();
  if (!state.survey_id) {
    console.log("No survey id in replies/state.json. Nothing was sent or paid.");
    process.exit(1);
  }
  // The lock stops a second click from starting, and paying for, a second panel.
  try {
    fs.writeFileSync(lockFile, new Date().toISOString(), { flag: "wx" });
  } catch {
    console.log("The panel is already being started (replies/05-panel.sending exists). Nothing was sent or paid.");
    process.exit(1);
  }
  const unlock = () => fs.rmSync(lockFile, { force: true });

  // flashpoint.mjs prints the payment receipt link with console.error; keep a copy.
  const receipts = [];
  const printError = console.error;
  console.error = (...parts) => {
    receipts.push(parts.join(" "));
    printError(...parts);
  };

  const brief = JSON.parse(fs.readFileSync(briefFile, "utf8"));
  const args = { action: "create_and_run", ...brief, survey_id: state.survey_id };

  let result;
  try {
    result = await callTool(await connect(), "panel", args);
  } catch (err) {
    fs.writeFileSync(errorFile, `${receipts.join("\n")}\n${err?.stack ?? err}\n`);
    unlock();
    printError(`Failed: ${err?.message ?? err}`);
    process.exit(1);
  }

  const job_id = findKey(result, "job_id");
  console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
  if (!job_id) {
    // No job means nothing is running, so leave the way open for another try.
    fs.writeFileSync(errorFile, JSON.stringify({ sent: args, receipts, result }, null, 2));
    unlock();
    console.log("\nNo job id came back, so the panel did not start. The reply is in replies/05-panel.error.txt");
    process.exit(1);
  }
  fs.writeFileSync(startFile, JSON.stringify({ sent: args, receipts, result }, null, 2));
  fs.writeFileSync(stateFile, JSON.stringify({ ...state, panel_job_id: job_id }, null, 2));
  unlock();
  console.log(`\nStarted job ${job_id}. Saved to replies/05-panel.json`);
  console.log("Check on it with: node panel.mjs status");
}

async function status() {
  const job_id = process.argv[3] ?? readState().panel_job_id;
  if (!job_id) {
    console.log("No panel has been started yet.");
    process.exit(1);
  }
  const handle = await connect();
  // A plain fetch stands in for the paying one, so this call can never spend
  // money: if Flashpoint asked for payment it would fail instead.
  const result = await callTool({ ...handle, paidFetch: fetch }, "panel", { action: "status", job_id });
  const state = findKey(result, "status") ?? "unknown";
  const parts = [`status: ${state}`];
  for (const key of ["stage", "progress", "message", "error"]) {
    if (result && result[key] !== undefined && result[key] !== null) parts.push(`${key}: ${JSON.stringify(result[key])}`);
  }
  console.log(parts.join(" | "));
  if (["completed", "failed", "interrupted"].includes(state)) {
    fs.writeFileSync(resultFile, JSON.stringify({ job_id, result }, null, 2));
    console.log("Saved to replies/05-panel-result.json");
  }
}

if (command === "start") {
  await start();
} else if (command === "status") {
  await status();
} else {
  console.log("usage: node panel.mjs start | status [job id]");
  process.exit(1);
}
