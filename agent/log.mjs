// Turns the agent's steps into the mission log (log.md) and the one-line
// notes printed while it runs. Nothing here decides anything.

const money = (amount) => `$${Number(amount).toFixed(2)}`;
const quote = (text) => `> ${String(text).split("\n").join("\n> ")}`;
const cell = (text) => String(text ?? "").replace(/\|/g, "/").replace(/\n+/g, " ");

// The receipt printed before every paid step.
function receipt(step, what) {
  return `| Receipt | |\n|---|---|\n| Paid for | ${what} |\n| Price | ${money(step.price)} |\n| Decision it could change | ${cell(step.couldChange || "(none given)")} |\n| Spent so far | ${money(step.spent)} |`;
}

const ACTIONS = { design: "write or change the survey", publish: "publish the survey", send: "email the survey", results: "read results", other: "a message" };

const PRACTICE_NOTE = {
  fake: " (practice run with a fake Flashpoint: no real survey, no real answers)",
  practice: " (practice run: an AI stand-in played Flashpoint and invented every answer. No real survey, no real people.)",
};

export function logHeader({ objective, people, cap, emailLimit, model, orders, mode = "real", practiceCommander, standInCommander, handsOff, memory = [], stamp }) {
  const lines = [
    `# Run log ${stamp}${PRACTICE_NOTE[mode] ?? ""}`,
    "",
    `**The objective, from the commander:** ${objective}`,
    "",
    `**People on the list:** ${people}. **Budget cap:** ${money(cap)}.${emailLimit ? ` **Most emails to any one person:** ${emailLimit}, reminders included.` : ""} **Model:** ${model}.`,
    "",
    "**Standing orders:**",
    "",
    ...orders.map((order) => `- ${order}`),
    "",
    handsOff ? "The commander handed this mission over and was away. No person approved a send: the code checked each survey before it went out, and the checks are listed where they were made.\n" : "",
    standInCommander ? "Nobody was at the keyboard, so an AI stand-in played the commander as well. Its replies and its sealed guesses below are invented, like everything else in a practice run. It approves every send.\n"
      : practiceCommander ? "Nobody was at the keyboard, so the commander's replies below are canned practice replies. The canned commander approves sends and makes no guesses.\n" : "",
    memory.length > 0 ? `**What the agent remembered from earlier missions:**\n\n${memory.map((lesson) => `- ${lesson}`).join("\n")}\n` : "",
    "The agent chose every step below. The commander speaks only where the log says so. The loop itself steps in at two points, both marked: no email goes out without the commander's yes, and if the agent stops after one round with a question still open, it is asked once to think again.",
    "",
    "---",
    "",
  ];
  return lines.join("\n");
}

export function logEntry(step) {
  const n = `### Step ${step.n}:`;
  switch (step.kind) {
    case "thinking":
      return `**Agent:** ${step.text}\n`;
    case "plan":
      return `${n} the agent's plan${step.first ? "" : ", updated"}\n\n*What it needs to find out:*\n\n${step.needToKnow.map((line) => `- ${line}`).join("\n")}\n\n*What it already suspects (a guess, not a finding):*\n\n${step.hunches.map((line) => `- ${line}`).join("\n")}\n\n*What would change its answer:* ${step.wouldChange}\n\n*The survey it has in mind:* ${step.surveyIdea}\n\n*Budget and emails:* ${step.budget}\n`;
    case "send-preapproved":
      return `${n} the code checked the round ${step.round} survey and let it go\n\nThe commander was away. This is email ${step.email} of the ${step.emailLimit} each person may get. The checks it passed:\n\n${step.checks.map((check) => `- ${check}`).join("\n")}\n`;
    case "send-held":
      return `${n} the code held back the round ${step.round} send\n\nThe commander was away, and the survey did not pass the send checks. Nothing was sent or charged.\n\n${step.problems.map((problem) => `- ${problem}`).join("\n")}\n`;
    case "flashpoint":
      return `${n} Flashpoint, ${ACTIONS[step.action] ?? "a message"} (round ${step.round})\n\n${receipt(step, "one message to Flashpoint's survey agent")}\n\n*Why:* ${step.why}\n\n*Sent:*\n\n${quote(step.message)}\n\n*Flashpoint replied:*\n\n${quote(step.reply)}\n${step.receipts.map((r) => `\n${r}`).join("")}\n`;
    case "flashpoint-failed":
      return `${n} a Flashpoint call failed (${step.charged ? "charged" : "not charged"})\n\n*Why:* ${step.why}\n\n${step.error}\n`;
    case "rehearsal":
      return `${n} dress rehearsal on AI personas (round ${step.round})\n\n${receipt(step, "a synthetic persona run")}\n\n*Why:* ${step.why}\n\n*Flashpoint replied (synthetic, not people):*\n\n${quote(step.reply)}\n${step.receipts.map((r) => `\n${r}`).join("")}\n`;
    case "rehearsal-failed":
      return `${n} the dress rehearsal failed (${step.charged ? "charged" : "not charged"})\n\n${step.error}\n\nThe agent was told to carry on without it.\n`;
    case "deck":
      return `${n} slide deck\n\n${receipt(step, "a slide deck")}\n\n*Why:* ${step.why}\n\n${quote(step.reply)}\n${step.receipts.map((r) => `\n${r}`).join("")}\n`;
    case "deck-failed":
      return `${n} the deck failed (${step.charged ? "charged" : "not charged"})\n\n${step.error}\n`;
    case "blocked":
      return `${n} stopped by the budget\n\nThe agent tried a paid step (${step.tool}) and the cap refused it.\n`;
    case "email-limit":
      return `${n} stopped by the email limit\n\nThe agent tried ${step.tried}, and the code refused: everyone on the list had already had every email they may get in this mission. Nothing was charged.\n`;
    case "sealed":
      return `${n} the round ${step.round} envelope is sealed\n\n*Why these questions:* ${step.why}\n\n${step.envelope.predictions.length} question${step.envelope.predictions.length === 1 ? "" : "s"} sealed. The commander sealed a guess on ${step.envelope.predictions.filter((p) => p.commander !== null).length}; the agent cannot see it.\n\nSHA-256 of \`envelope-round-${step.round}.json\`: \`${step.hash}\`\n\nThe hash lets this run check, when the envelope is opened, that no guess was changed after the answers came in. It is a check on the run's own files, not proof to an outsider.\n`;
    case "opened": {
      const rows = step.rows.map((row) => `| ${cell(row.question)} | ${cell(row.people_said)} | ${cell(row.agent)} | ${cell(row.personas ?? "no guess")} | ${cell(row.commander ?? "no guess")} |`);
      return `${n} the round ${step.round} envelope is opened\n\nThe envelope's hash ${step.intact ? "matches the one recorded when it was sealed" : "DOES NOT MATCH the one recorded when it was sealed"}.\n\n| Question | What people said | The agent guessed | AI personas guessed (synthetic) | The commander guessed |\n|---|---|---|---|---|\n${rows.join("\n")}\n`;
    }
    case "debrief":
      return `${n} what the round ${step.round} envelope taught the agent\n\n| Debrief | |\n|---|---|\n| Who was wrong | ${cell(step.whoWasWrong)} |\n| Biggest surprise | ${cell(step.surprise)} |\n| Still unknown | ${cell(step.stillUnknown)} |\n| Next move | ${step.nextMove === "another_round" ? "another round" : "finish"} |\n| Why | ${cell(step.reason)} |\n`;
    case "resumed":
      return `${n} the mission was resumed after ${step.away}\n\n${step.cutOff.length > 0 ? `It had been stopped during: ${step.cutOff.join(", ")}. The agent was told that step's outcome is not known, and its price was counted as spent to be safe.` : "It had been stopped between steps."}\n`;
    case "challenge":
      return `${n} the agent was asked to think again before stopping\n\nIt chose to finish after one round with budget left and this still unknown: ${step.stillUnknown}\n\nIts reason: ${step.reason}\n\nThe loop asks this once per mission. The decision stays the agent's.\n`;
    case "send-approved":
      return `${n} the commander approved the round ${step.round} send\n\n*Commander:* ${step.reply}\n`;
    case "send-refused":
      return `${n} the round ${step.round} send was refused\n\n*Commander:* ${step.reason}\n\nNothing was sent or charged.\n`;
    case "commander":
      return `${n} the agent went to the commander\n\n${step.order ? `*Standing order:* "${step.order}"\n\n` : ""}*Agent:*\n\n${quote(step.message)}\n\n*Commander:* ${step.reply === null ? "(nobody was at the desk)" : step.reply === "" ? "(no reply)" : step.reply}\n`;
    case "wait":
      return `${n} wait ${step.minutes} min\n\n*Why:* ${step.why}\n${step.said ? `\n*Commander, while waiting:* ${step.said}\n` : ""}`;
    case "finish": {
      const board = step.scoreboard.length === 0
        ? "No envelope was opened, so there is no scoreboard."
        : `| Round | Question | What people said | Agent | AI personas | Commander |\n|---|---|---|---|---|---|\n${step.scoreboard.map((row) => `| ${row.round} | ${cell(row.question)} | ${cell(row.people_said)} | ${row.agent} | ${row.personas} | ${row.commander} |`).join("\n")}`;
      const warning = step.unbacked.length > 0 ? `\n**Check these numbers.** They are in the answer but in nothing Flashpoint or the commander said: ${step.unbacked.join(", ")}.\n` : "";
      const marked = step.scoreboard.length === 0 ? "" : "\n\nThe agent marked right and wrong itself, its own guesses included. With this few people, the scoreboard shows the method, not who guesses better.";
      return `## Answer\n\n**Recommendation.** ${step.recommendation}\n\n**Evidence.** ${step.evidence}\n${warning}\n**Scoreboard.**\n\n${board}${marked}\n\n**What changed between rounds.** ${step.learned_between_rounds}\n\n**Limits.** ${step.limits}\n`;
    }
    default:
      return "";
  }
}

const PRICE_OF = { "flashpoint-failed": 0.5, "rehearsal-failed": 0.6, "deck-failed": 0.25 };

// What the run paid for, by kind.
export function tally(steps) {
  const lines = [
    ["Messages to Flashpoint's survey agent", steps.filter((s) => s.kind === "flashpoint" || (s.kind === "flashpoint-failed" && s.charged))],
    ["Persona rehearsals", steps.filter((s) => s.kind === "rehearsal" || (s.kind === "rehearsal-failed" && s.charged))],
    ["Slide decks", steps.filter((s) => s.kind === "deck" || (s.kind === "deck-failed" && s.charged))],
    ["Steps cut off by a stop, counted as paid to be safe", steps.filter((s) => s.kind === "resumed" && s.counted > 0)],
  ];
  return lines.filter(([, list]) => list.length > 0).map(([label, list]) => ({ label, count: list.length, cost: list.reduce((sum, s) => sum + (s.counted ?? s.price ?? PRICE_OF[s.kind] ?? 0), 0) }));
}

export function logFooter({ steps, cap, spent, wallet }) {
  const rows = tally(steps).map((row) => `| ${row.label} | ${row.count} | ${money(row.cost)} |`);
  const asked = steps.filter((s) => s.kind === "commander").length;
  const approvals = steps.filter((s) => s.kind === "send-approved" || s.kind === "send-refused").length;
  const checked = steps.filter((s) => s.kind === "send-preapproved" || s.kind === "send-held").length;
  const challenges = steps.filter((s) => s.kind === "challenge").length;
  return [
    "---",
    "",
    "## The bill",
    "",
    "| Paid for | How many | Cost |",
    "|---|---|---|",
    ...rows,
    `| **Spent** | | **${money(spent)}** |`,
    `| Handed back, of the ${money(cap)} cap | | ${money(Math.max(0, cap - spent))} |`,
    "",
    `The agent went to the commander ${asked} time${asked === 1 ? "" : "s"} and asked for ${approvals} send approval${approvals === 1 ? "" : "s"}. ${checked > 0 ? `The code checked ${checked} send${checked === 1 ? "" : "s"} in the commander's place. ` : ""}${challenges > 0 ? "The loop asked it once to think again before stopping. " : ""}Every other step was the agent's own choice.`,
    wallet ? `\n${wallet}` : "",
    "",
  ].join("\n");
}

// The one-line note printed while the agent works.
export function shortLine(step) {
  const tag = `[${String(step.n).padStart(2, " ")}]`;
  const paid = (step) => `${money(step.price)}, ${money(step.spent)} spent`;
  switch (step.kind) {
    case "thinking": return `${tag} Agent: ${step.text}`;
    case "plan": return `${tag} Plan${step.first ? "" : " updated"}\n${step.needToKnow.map((line) => `       needs: ${line}`).join("\n")}\n       would change its answer: ${step.wouldChange}`;
    case "send-preapproved": return `${tag} Send checked by the code and let go (email ${step.email} of ${step.emailLimit})`;
    case "send-held": return `${tag} Send held back by the code: ${step.problems.join(" ")}`;
    case "flashpoint": return `${tag} Flashpoint: ${ACTIONS[step.action] ?? "a message"} (${paid(step)})\n       could change: ${step.couldChange || "(none given)"}`;
    case "flashpoint-failed": return `${tag} Flashpoint failed, ${step.charged ? "charged" : "not charged"}: ${step.error}`;
    case "rehearsal": return `${tag} Dress rehearsal on AI personas (${paid(step)})\n       could change: ${step.couldChange || "(none given)"}`;
    case "rehearsal-failed": return `${tag} Dress rehearsal failed, carrying on: ${step.error}`;
    case "deck": return `${tag} Slide deck made (${paid(step)})`;
    case "deck-failed": return `${tag} Slide deck failed: ${step.error}`;
    case "blocked": return `${tag} The budget cap refused a paid step`;
    case "email-limit": return `${tag} The email limit refused ${step.tried}`;
    case "sealed": return `${tag} Envelope sealed for round ${step.round}: ${step.hash.slice(0, 16)}…`;
    case "opened": return `${tag} Envelope opened for round ${step.round}\n${step.rows.map((row) => `       ${row.question}\n         people:    ${row.people_said}\n         agent:     ${row.agent}\n         personas:  ${row.personas ?? "no guess"}\n         commander: ${row.commander ?? "no guess"}`).join("\n")}`;
    case "debrief": return `${tag} Debrief: ${step.nextMove === "another_round" ? "another round" : "finish"}, because ${step.reason}\n       wrong:     ${step.whoWasWrong}\n       surprise:  ${step.surprise}\n       unknown:   ${step.stillUnknown}`;
    case "resumed": return `${tag} Mission resumed after ${step.away}${step.cutOff.length > 0 ? ` (stopped during ${step.cutOff.join(", ")})` : ""}`;
    case "challenge": return `${tag} Asked to think again before stopping after one round`;
    case "send-approved": return `${tag} Send approved by the commander`;
    case "send-refused": return `${tag} Send refused: ${step.reason}`;
    case "commander": return `${tag} Commander replied: ${step.reply ?? "(nobody at the desk)"}`;
    case "wait": return `${tag} Waited up to ${step.minutes} min${step.said ? `; commander said: ${step.said}` : ""}`;
    case "finish": return `${tag} Finished`;
    default: return `${tag} ${step.kind}`;
  }
}
