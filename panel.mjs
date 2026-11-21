// Run a Flashpoint synthetic panel (AI personas, not people) through the survey.
//   node panel.mjs start             builds the panel described in
//                                    briefs/05-panel.json and runs it through
//                                    the survey (costs $0.60)
//   node panel.mjs run <name> [id]   runs the saved panel (or the panel with
//                                    that id) through the survey again (costs
//                                    $0.10) and saves the reply to
//                                    replies/<name>.json
//   node panel.mjs status [job id]   asks how a run is going (free, never pays)
// The panel id and the latest run id are kept in replies/state.json.
import fs from "node:fs";
import { connect, callTool } from "./flashpoint.mjs";

const here = new URL("./", import.meta.url);
const command = process.argv[2];

const briefFile = new URL("briefs/05-panel.json", here);
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

// Sends one paid panel call and saves the reply. A reply counts as started
// when it carries a job id (still running) or a finished run.
async function paidCall(name, args) {
  const replyFile = new URL(`replies/${name}.json`, here);
  const errorFile = new URL(`replies/${name}.error.txt`, here);
  const lockFile = new URL(`replies/${name}.sending`, here);

  if (fs.existsSync(replyFile)) {
    console.log(`replies/${name}.json already exists, so this was already sent. Nothing was sent or paid.`);
    process.exit(1);
  }
  // The lock stops a second click from sending, and paying for, a second run.
  try {
    fs.writeFileSync(lockFile, new Date().toISOString(), { flag: "wx" });
  } catch {
    console.log(`This is already being sent (replies/${name}.sending exists). Nothing was sent or paid.`);
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
  const run = result?.run_result ?? result;
  const finished = run?.status === "completed" && run?.result?.responses_submitted !== undefined;
  if (!job_id && !finished) {
    // Nothing is running and nothing finished, so leave the way open to retry.
    fs.writeFileSync(errorFile, JSON.stringify({ sent: args, receipts, result }, null, 2));
    unlock();
    console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2).slice(0, 4000));
    console.log(`\nNo run came back. The reply is in replies/${name}.error.txt`);
    process.exit(1);
  }

  fs.writeFileSync(replyFile, JSON.stringify({ sent: args, receipts, result }, null, 2));
  const state = readState();
  const next = { ...state };
  // Flashpoint gives a panel more than one id. The one its own run used is the
  // one known to work for another run and for scoping the results.
  const scope = run?.result?.analytics_scope;
  const panel_id = scope?.panel_id ?? result?.panel_id ?? args.panel_id;
  if (panel_id) next.panel_id = panel_id;
  if (job_id) next.panel_job_id = job_id;
  if (scope?.run_id) next.panel_run_id = scope.run_id;
  fs.writeFileSync(stateFile, JSON.stringify(next, null, 2));
  unlock();

  if (finished) {
    const done = run.result;
    console.log(`Finished: ${done.responses_submitted} of ${done.total_personas} personas answered.`);
    console.log(`How their responses ended: ${JSON.stringify(done.status_breakdown)}`);
  } else {
    console.log(`Started job ${job_id}. Check on it with: node panel.mjs status`);
  }
  console.log(`Saved to replies/${name}.json`);
}

async function status() {
  const job_id = process.argv[3] ?? readState().panel_job_id;
  if (!job_id) {
    console.log("No panel job is waiting. A run that finished straight away has no job to check.");
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
    fs.writeFileSync(new URL(`replies/panel-job-${job_id}.json`, here), JSON.stringify({ job_id, result }, null, 2));
    console.log(`Saved to replies/panel-job-${job_id}.json`);
  }
}

if (command === "start") {
  const state = readState();
  if (!state.survey_id) {
    console.log("No survey id in replies/state.json. Nothing was sent or paid.");
    process.exit(1);
  }
  const brief = JSON.parse(fs.readFileSync(briefFile, "utf8"));
  await paidCall("05-panel", { action: "create_and_run", ...brief, survey_id: state.survey_id });
} else if (command === "run") {
  const name = process.argv[3];
  const state = readState();
  if (!name || !/^[\w-]+$/.test(name)) {
    console.log("usage: node panel.mjs run <name> [panel id]   (the reply is saved to replies/<name>.json)");
    process.exit(1);
  }
  const panel_id = process.argv[4] ?? state.panel_id;
  if (!panel_id || !state.survey_id) {
    console.log("No saved panel or survey id in replies/state.json. Nothing was sent or paid.");
    process.exit(1);
  }
  await paidCall(name, { action: "run", panel_id, survey_id: state.survey_id });
} else if (command === "status") {
  await status();
} else {
  console.log("usage: node panel.mjs start | run <name> | status [job id]");
  process.exit(1);
}
