// A one-page summary of a mission, made from the steps the run saved.
// It only counts and quotes what is in steps.json. It decides nothing.
//
//   node agent/summary.mjs agent/runs/<folder>     prints it and writes summary.md there

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { tally } from "./log.mjs";

const money = (amount) => `$${Number(amount).toFixed(2)}`;
const cell = (text) => String(text ?? "").replace(/\|/g, "/").replace(/\n+/g, " ");
const times = (count) => `${count} time${count === 1 ? "" : "s"}`;

const PRACTICE = {
  fake: "**This was a practice run with a fake Flashpoint. No survey was sent and no real person answered. Nothing below is a finding.**",
  practice: "**This was a practice run. An AI stand-in played Flashpoint and invented every answer. No survey was sent and no real person answered. Nothing below is a finding.**",
};

// How often each guesser was marked right, partly right or wrong.
// The marks are the agent's own: it judged its guesses and everyone else's.
export function score(scoreboard) {
  const count = (who) => {
    const marks = scoreboard.map((row) => String(row[who] ?? "").toLowerCase()).filter((mark) => ["right", "partly", "wrong"].includes(mark));
    return { right: marks.filter((m) => m === "right").length, partly: marks.filter((m) => m === "partly").length, wrong: marks.filter((m) => m === "wrong").length, guesses: marks.length };
  };
  return { agent: count("agent"), personas: count("personas"), commander: count("commander") };
}

// How much of the mission the agent did without a person.
export function autonomy(steps) {
  const ALONE = ["plan", "flashpoint", "rehearsal", "deck", "sealed", "opened", "debrief", "wait", "finish"];
  const approvals = steps.filter((s) => s.kind === "send-approved" || (s.kind === "send-refused" && !/^Nobody was at the desk/.test(s.reason ?? ""))).length;
  const told = steps.filter((s) => s.kind === "commander" && s.reply !== null);
  // A report one of the standing orders asked for is not a question the
  // agent chose to ask, so the two are counted apart.
  const ordered = told.filter((s) => Boolean(s.order)).length;
  const asked = told.length - ordered;
  return {
    alone: steps.filter((s) => ALONE.includes(s.kind)).length,
    approvals,
    ordered,
    asked,
    questions: told.length,
    person: approvals + told.length,
    codeStops: steps.filter((s) => ["blocked", "email-limit", "send-held"].includes(s.kind)).length,
    nudges: steps.filter((s) => s.kind === "challenge").length,
  };
}

// What happened in each round, in order.
export function rounds(steps) {
  const numbers = [...new Set(steps.filter((s) => s.round !== undefined).map((s) => s.round))].sort((a, b) => a - b);
  return numbers.map((round) => {
    const mine = steps.filter((s) => s.round === round);
    const sent = mine.filter((s) => s.kind === "flashpoint");
    const sealed = mine.find((s) => s.kind === "sealed");
    const debrief = mine.filter((s) => s.kind === "debrief").pop();
    return {
      round,
      messages: sent.length,
      designs: sent.filter((s) => s.action === "design").length,
      rehearsed: mine.some((s) => s.kind === "rehearsal"),
      sealed: sealed ? sealed.envelope.predictions.map((p) => p.question) : [],
      // Newer runs record the step on which the email went out. Older ones only have the label.
      preapproved: mine.some((s) => s.kind === "send-preapproved"),
      held: mine.filter((s) => s.kind === "send-held").length,
      emailed: sent.some((s) => (s.emailed === undefined ? s.action === "send" : s.emailed)) || mine.some((s) => s.kind === "commander" && /Did the survey go out/.test(s.message ?? "") && /^\W*y/i.test(s.reply ?? "")),
      refused: mine.filter((s) => s.kind === "send-refused").length,
      opened: mine.some((s) => s.kind === "opened"),
      challenged: mine.some((s) => s.kind === "challenge"),
      debrief: debrief ?? null,
    };
  });
}

export function summarize(run) {
  const { steps } = run;
  const finish = steps.find((s) => s.kind === "finish");
  const list = rounds(steps);
  const talks = steps.filter((s) => s.kind === "commander");
  const spent = steps.reduce((most, s) => Math.max(most, s.spent ?? 0), 0);
  const lines = [`# Run summary ${run.stamp}`, ""];
  if (PRACTICE[run.mode]) lines.push(PRACTICE[run.mode], "");
  lines.push(`**The objective:** ${run.objective}`, "");
  lines.push(`**Given to the agent:** ${run.people} people to ask, a ${money(run.cap)} budget cap, and ${run.orders.length} standing orders.${run.emailLimit ? ` Nobody could be emailed more than ${times(run.emailLimit)}, reminders included.` : ""} Model: ${run.model}.`, "");

  if (run.memory?.length > 0) lines.push("**What it remembered from earlier runs:**", "", ...run.memory.map((lesson) => `- ${lesson}`), "");

  const own = autonomy(steps);
  lines.push("## How much it did alone", "", `The agent took **${own.alone} steps on its own**. ${own.person === 0 ? "It did not stop for a person once." : `A person was needed ${times(own.person)}: ${own.approvals} send approval${own.approvals === 1 ? "" : "s"}, ${own.ordered} report${own.ordered === 1 ? "" : "s"} a standing order asked for, and ${own.asked} question${own.asked === 1 ? "" : "s"} of its own.`}${own.nudges > 0 ? " The code asked it once to think again before it stopped." : ""}${own.codeStops > 0 ? ` The code stopped it ${times(own.codeStops)}.` : ""}`, "");

  lines.push("## What the agent decided", "");
  const plan = steps.find((s) => s.kind === "plan");
  if (plan) {
    lines.push("**Its plan, before it spent anything.**", "");
    lines.push(`- It needed to find out: ${plan.needToKnow.map(cell).join("; ")}`);
    lines.push(`- It already suspected: ${plan.hunches.map(cell).join("; ")}`);
    lines.push(`- What would change its answer: ${cell(plan.wouldChange)}`, "");
  }
  if (list.length === 0) lines.push("The agent wrote no survey.", "");
  for (const r of list) {
    lines.push(`**Round ${r.round}.**`, "");
    lines.push(`- It sent Flashpoint ${r.messages} message${r.messages === 1 ? "" : "s"}, ${r.designs} of them to write or change the survey.`);
    if (r.rehearsed) lines.push("- It rehearsed the survey on AI personas first. Their answers are synthetic.");
    if (r.sealed.length > 0) lines.push(`- Before sending, it sealed guesses on: ${r.sealed.map((q) => `"${cell(q)}"`).join("; ")}.`);
    if (r.refused > 0) lines.push(`- The commander refused the send ${times(r.refused)}.`);
    if (r.held > 0) lines.push(`- The code held the send back ${times(r.held)}, because the survey did not pass its checks. The agent fixed the survey.`);
    lines.push(r.emailed ? (r.preapproved ? "- The code checked the survey in the commander's place, and it was emailed." : "- The commander approved, and the survey was emailed.") : "- The survey was not emailed, as far as the run can tell.");
    if (r.debrief) {
      lines.push(`- Who was wrong: ${cell(r.debrief.whoWasWrong)}`);
      lines.push(`- Biggest surprise: ${cell(r.debrief.surprise)}`);
      lines.push(`- Still unknown: ${cell(r.debrief.stillUnknown)}`);
      if (r.debrief.answerSoFar) lines.push(`- Its answer at this point: ${cell(r.debrief.answerSoFar)}`);
      if (r.challenged) lines.push("- It first chose to stop here. The loop asked it once to think again, because a question was still open and there was budget left.");
      lines.push(`- Its decision: **${r.debrief.nextMove === "another_round" ? "run another round" : "finish"}**. ${cell(r.debrief.reason)}`);
    } else if (r.opened) {
      lines.push("- It opened the envelope but did not debrief.");
    }
    lines.push("");
  }

  lines.push("## When it came to the commander", "");
  if (talks.length === 0) lines.push(run.handsOff ? "It did not." : "It did not, apart from send approvals.", "");
  for (const talk of talks) {
    lines.push(`- Step ${talk.n}${talk.order ? `, under the order "${cell(talk.order)}"` : ""}: ${cell(talk.message).slice(0, 300)}${cell(talk.message).length > 300 ? "…" : ""}`);
    lines.push(`  The commander said: ${talk.reply === null ? "(nobody was at the desk)" : talk.reply === "" ? "(no reply)" : cell(talk.reply)}`);
  }
  if (talks.length > 0) lines.push("");
  const stopped = steps.filter((s) => s.kind === "email-limit").length;
  if (stopped > 0) lines.push(`The email limit refused the agent ${times(stopped)}: it tried to email people who had already had every email they may get.`, "");
  if (run.handsOff) lines.push("The commander handed the objective over and was away, so nobody answered the agent and no person approved a send.", "");
  else if (run.standInCommander) lines.push("Nobody was at the keyboard for this run, so an AI stand-in played the commander. Its replies and guesses are invented.", "");
  else if (run.practiceCommander) lines.push("Nobody was at the keyboard for this run, so the commander's replies and approvals were canned.", "");

  lines.push("## The answer", "");
  if (!finish) {
    lines.push("The agent stopped without an answer.", "");
  } else {
    lines.push(`**Recommendation.** ${finish.recommendation}`, "", `**Evidence.** ${finish.evidence}`, "");
    if (finish.unbacked?.length > 0) lines.push(`**Check these numbers.** They are in the answer but in nothing Flashpoint or the commander said: ${finish.unbacked.join(", ")}.`, "");
    if (finish.scoreboard.length > 0) {
      const s = score(finish.scoreboard);
      const say = (name, c) => (c.guesses === 0 ? `${name} made no guess` : `${name}: ${c.right} right, ${c.partly} partly, ${c.wrong} wrong`);
      lines.push("**Who guessed better.**", "", "| Round | Question | What people said | Agent | AI personas | Commander |", "|---|---|---|---|---|---|");
      for (const row of finish.scoreboard) lines.push(`| ${row.round} | ${cell(row.question)} | ${cell(row.people_said)} | ${row.agent} | ${row.personas} | ${row.commander} |`);
      lines.push("", `${say("The agent", s.agent)}. ${say("The AI personas", s.personas)}. ${say("The commander", s.commander)}.`, "");
      lines.push(`The agent marked these itself, its own guesses included. With ${run.people} people asked, the scoreboard shows how the method works. It does not show who is the better guesser.`, "");
    }
    lines.push(`**What changed between rounds.** ${finish.learned_between_rounds}`, "", `**Limits.** ${finish.limits}`, "");
    if (finish.lessons?.length > 0) lines.push("**What it wrote down for its next run.**", "", ...finish.lessons.map((lesson) => `- ${lesson}`), "");
  }

  lines.push("## The bill", "", "| Paid for | How many | Cost |", "|---|---|---|");
  for (const row of tally(steps)) lines.push(`| ${row.label} | ${row.count} | ${money(row.cost)} |`);
  lines.push(`| **Spent** | | **${money(spent)}** of the ${money(run.cap)} cap |`, "");
  if (PRACTICE[run.mode]) lines.push("These are the prices a real run would have paid. This practice run paid nothing.", "");
  lines.push("The full log, with every message, reply and slip, is `log.md` in the same folder.", "");
  return lines.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const folder = process.argv[2];
  if (!folder || !fs.existsSync(`${folder}/steps.json`)) {
    console.log("Usage: node agent/summary.mjs agent/runs/<folder>");
    process.exit(1);
  }
  const text = summarize(JSON.parse(fs.readFileSync(`${folder}/steps.json`, "utf8")));
  fs.writeFileSync(`${folder}/summary.md`, text);
  console.log(text);
}
