// Runs the remaining Flashpoint steps in order, so they cannot be run out of
// order by hand.
//   1. briefs/13-fix.txt      the survey agent fixes the survey          $0.50
//   2. briefs/14-confirm.txt  only if its reply asks for a confirmation  $0.50
//   3. panel run              the saved synthetic panel, once more       $0.10
//   4. briefs/16-export.txt   that run's answers, or why there are none  $0.50
// A step whose reply is already in replies/ is not sent again, so the command
// can be run again after a failure without paying twice.
//   node go.mjs          run the steps
//   node go.mjs --dry    say what would be sent, and send nothing
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = new URL("./", import.meta.url);
const dry = process.argv.includes("--dry");

const replyFile = (name) => new URL(`replies/${name}.json`, here);
const has = (name) => fs.existsSync(replyFile(name));

// True when Flashpoint's reply stops to ask for a "confirm" before acting.
export function asksToConfirm(reply) {
  return /reply\s+\*{0,2}["'`]?confirm/i.test(JSON.stringify(reply));
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
  if (has("13-fix")) console.log("The fix was already sent.");
  else if (run("Fix the survey ($0.50)", ["ask.mjs", "13-fix"]) !== 0) stop("the fix request failed.");

  if (!dry || has("13-fix")) {
    const fix = JSON.parse(fs.readFileSync(replyFile("13-fix"), "utf8"));
    if (!asksToConfirm(fix.result)) console.log("\nFlashpoint did not ask for a confirmation, so none is sent.");
    else if (has("14-confirm")) console.log("The confirmation was already sent.");
    else if (run("Confirm the publish ($0.50)", ["ask.mjs", "14-confirm"]) !== 0) stop("the confirmation failed.");
  }

  if (has("15-panel-run")) console.log("The panel was already run.");
  else {
    // The panel runner ends with code 2 when a run holds no answers. The next
    // step asks Flashpoint why, so it goes ahead either way.
    const code = run("Run the simulated panel again ($0.10)", ["panel.mjs", "run", "15-panel-run"]);
    if (code !== 0 && code !== 2) stop("the panel run failed.");
  }

  if (has("16-export")) console.log("The answers were already asked for.");
  else if (run("Ask for the answers ($0.50)", ["ask.mjs", "16-export"]) !== 0) stop("the export request failed.");

  console.log("\nAll steps done.");
}
