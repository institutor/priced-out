// Runs the remaining Flashpoint steps in order, so they cannot be run out of
// order by hand.
//
// Where things stand: the survey agent has removed the page that cut every
// synthetic respondent off, but the corrected survey (v2) is saved and not yet
// live. Flashpoint asks for a bare "confirm" before each thing it publishes,
// sometimes twice.
//   1. briefs/17-confirm.txt   push v2 live                              $0.50
//      briefs/18- and 19-      only while the reply asks to confirm again $0.50 each
//   2. panel run               the saved synthetic panel, once more       $0.10
//   3. briefs/21-export.txt    that run's answers, or why there are none  $0.50
// A step whose reply is already in replies/ is not sent again, so the command
// can be run again after a failure without paying twice.
//   node go.mjs          run the steps
//   node go.mjs --dry    say what would be sent, and send nothing
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = new URL("./", import.meta.url);
const dry = process.argv.includes("--dry");

const CONFIRMS = ["17-confirm", "18-confirm", "19-confirm"];
const PANEL_RUN = "20-panel-run";
const EXPORT = "21-export";

const replyFile = (name) => new URL(`replies/${name}.json`, here);
const has = (name) => fs.existsSync(replyFile(name));

// True when Flashpoint's reply stops to ask for a "confirm" before acting.
export function asksToConfirm(reply) {
  return /(reply|say|type|send|respond)\s+(with\s+)?\*{0,2}["'`]?confirm/i.test(JSON.stringify(reply));
}

// Runs one of the project's own scripts and returns its exit code.
function run(label, args) {
  console.log(`\n== ${label} ==`);
  if (dry) {
    console.log(`(dry run) node ${args.join(" ")}`);
    return 0;
  }
  return spawnSync(process.execPath, args, { cwd: fileURLToPath(here), stdio: "inherit" }).status;
}

function stop(message) {
  console.log(`\nStopped: ${message}`);
  process.exit(1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // Confirm until Flashpoint stops asking, three times at most.
  let stillAsking = true;
  for (const name of CONFIRMS) {
    if (has(name)) console.log(`${name} was already sent.`);
    else if (run(`Confirm the publish ($0.50): ${name}`, ["ask.mjs", name]) !== 0) stop("the confirmation failed.");
    if (dry && !has(name)) {
      console.log("(dry run) another confirm is sent only if the reply asks for one.");
      stillAsking = false;
      break;
    }
    const reply = JSON.parse(fs.readFileSync(replyFile(name), "utf8"));
    if (!asksToConfirm(reply.result)) {
      stillAsking = false;
      break;
    }
    console.log("\nFlashpoint asked to confirm once more.");
  }
  if (stillAsking) stop("Flashpoint asked for a confirmation three times running. Nothing else was sent.");

  if (has(PANEL_RUN)) console.log("The panel was already run.");
  else {
    // The panel runner ends with code 2 when a run holds no answers. The next
    // step asks Flashpoint why, so it goes ahead either way.
    const code = run("Run the simulated panel again ($0.10)", ["panel.mjs", "run", PANEL_RUN]);
    if (code !== 0 && code !== 2) stop("the panel run failed.");
  }

  if (has(EXPORT)) console.log("The answers were already asked for.");
  else if (run("Ask for the answers ($0.50)", ["ask.mjs", EXPORT]) !== 0) stop("the export request failed.");

  console.log("\nAll steps done.");
}
