// Send one brief to the Flashpoint survey agent and save the reply to a file.
//   node ask.mjs <name>         sends briefs/<name>.txt (each call costs $0.50)
//   node ask.mjs <name> --new   same, but starts a new conversation
// A brief may contain {{name}} for an id kept in replies/state.json.
// The reply is saved to replies/<name>.json. The conversation id and survey id
// are kept in replies/state.json and passed along on the next call.
import fs from "node:fs";
import { connect, callTool } from "./flashpoint.mjs";

const here = new URL("./", import.meta.url);
const name = process.argv[2];
const fresh = process.argv.includes("--new");

if (!name) {
  console.log("usage: node ask.mjs <name> [--new]");
  process.exit(1);
}

const briefFile = new URL(`briefs/${name}.txt`, here);
const replyFile = new URL(`replies/${name}.json`, here);
const errorFile = new URL(`replies/${name}.error.txt`, here);
const stateFile = new URL("replies/state.json", here);

if (!fs.existsSync(briefFile)) {
  console.log(`No brief found at briefs/${name}.txt`);
  process.exit(1);
}
if (fs.existsSync(replyFile)) {
  console.log(`replies/${name}.json already exists, so this brief was already sent. Nothing was sent or paid.`);
  process.exit(1);
}
// A reply can take several minutes. The lock stops a second click from
// sending, and paying for, the same brief while the first is still running.
const lockFile = new URL(`replies/${name}.sending`, here);
fs.mkdirSync(new URL("replies/", here), { recursive: true });
try {
  fs.writeFileSync(lockFile, new Date().toISOString(), { flag: "wx" });
} catch {
  console.log(`This brief is already being sent (replies/${name}.sending exists). Wait for it to finish. Nothing was sent or paid.`);
  process.exit(1);
}
const unlock = () => fs.rmSync(lockFile, { force: true });

function findKey(value, key) {
  if (value === null || typeof value !== "object") return undefined;
  if (typeof value[key] === "string" && value[key] !== "") return value[key];
  for (const child of Object.values(value)) {
    const found = findKey(child, key);
    if (found) return found;
  }
  return undefined;
}

function findInText(text, key) {
  const match = text.match(new RegExp(`${key}["'\\\\\\s:=]+([A-Za-z0-9_-]{6,})`));
  if (match) return match[1];
  return undefined;
}

// flashpoint.mjs prints the payment receipt link with console.error; keep a copy.
const receipts = [];
const printError = console.error;
console.error = (...parts) => {
  receipts.push(parts.join(" "));
  printError(...parts);
};

let state = {};
if (!fresh && fs.existsSync(stateFile)) {
  state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
}

// A brief can refer to an id kept in replies/state.json as {{name}}, for
// example {{panel_run_id}}. Nothing is sent if one of them is missing.
let brief = fs.readFileSync(briefFile, "utf8").trim();
for (const [whole, key] of brief.matchAll(/\{\{(\w+)\}\}/g)) {
  if (typeof state[key] !== "string") {
    unlock();
    console.log(`The brief needs ${whole}, which is not in replies/state.json. Nothing was sent or paid.`);
    process.exit(1);
  }
  brief = brief.replaceAll(whole, state[key]);
}

const args = { brief };
if (state.conversation_id) args.conversation_id = state.conversation_id;
if (state.survey_id) args.survey_id = state.survey_id;

let result;
try {
  result = await callTool(await connect(), "tool_survey", args);
} catch (err) {
  fs.writeFileSync(errorFile, `${receipts.join("\n")}\n${err?.stack ?? err}\n`);
  unlock();
  printError(`Failed: ${err?.message ?? err}`);
  process.exit(1);
}

// Save the reply first, so nothing below can lose it.
fs.writeFileSync(replyFile, JSON.stringify({ sent: args, receipts, result }, null, 2));
unlock();

const asText = typeof result === "string" ? result : JSON.stringify(result);
const conversation_id = findKey(result, "conversation_id") ?? findInText(asText, "conversation_id") ?? state.conversation_id;
const survey_id = findKey(result, "survey_id") ?? findInText(asText, "survey_id") ?? state.survey_id;
fs.writeFileSync(stateFile, JSON.stringify({ ...state, conversation_id, survey_id }, null, 2));

console.log(typeof result === "string" ? result : JSON.stringify(result, null, 2));
console.log(`\nSaved to replies/${name}.json`);
