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

export function logHeader({ objective, people, cap, model, orders, mode = "real", practiceCommander, stamp }) {
  const lines = [
    `# Mission log ${stamp}${PRACTICE_NOTE[mode] ?? ""}`,
    "",
    `**Mission from the commander:** ${objective}`,
    "",
    `**People on the list:** ${people}. **Budget cap:** ${money(cap)}. **Model:** ${model}.`,
    "",
    "**Standing orders:**",
    "",
    ...orders.map((order) => `- ${order}`),
    "",
    practiceCommander ? "Nobody was at the keyboard, so the commander's replies below are canned practice replies.\n" : "",
    "Every research decision below this line was made by the agent. The commander speaks only where the log says so.",
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
    case "sealed":
      return `${n} the round ${step.round} envelope is sealed\n\n*Why these questions:* ${step.why}\n\n${step.envelope.predictions.length} question${step.envelope.predictions.length === 1 ? "" : "s"} sealed. The commander sealed a guess on ${step.envelope.predictions.filter((p) => p.commander !== null).length}; the agent cannot see it.\n\nSHA-256 of \`envelope-round-${step.round}.json\`: \`${step.hash}\`\n`;
    case "opened": {
      const rows = step.rows.map((row) => `| ${cell(row.question)} | ${cell(row.people_said)} | ${cell(row.agent)} | ${cell(row.personas ?? "no guess")} | ${cell(row.commander ?? "no guess")} |`);
      return `${n} the round ${step.round} envelope is opened\n\nThe envelope's hash ${step.intact ? "matches the one recorded when it was sealed" : "DOES NOT MATCH the one recorded when it was sealed"}.\n\n| Question | What people said | The agent guessed | AI personas guessed (synthetic) | The commander guessed |\n|---|---|---|---|---|\n${rows.join("\n")}\n`;
    }
    case "debrief":
      return `${n} what the round ${step.round} envelope taught the agent\n\n| Debrief | |\n|---|---|\n| Who was wrong | ${cell(step.whoWasWrong)} |\n| Biggest surprise | ${cell(step.surprise)} |\n| Still unknown | ${cell(step.stillUnknown)} |\n| Next move | ${step.nextMove === "another_round" ? "another round" : "finish"} |\n| Why | ${cell(step.reason)} |\n`;
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
      return `## Answer\n\n**Recommendation.** ${step.recommendation}\n\n**Evidence.** ${step.evidence}\n${warning}\n**Scoreboard.**\n\n${board}\n\n**What changed between rounds.** ${step.learned_between_rounds}\n\n**Limits.** ${step.limits}\n`;
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
  ];
  return lines.filter(([, list]) => list.length > 0).map(([label, list]) => ({ label, count: list.length, cost: list.reduce((sum, s) => sum + (s.price ?? PRICE_OF[s.kind] ?? 0), 0) }));
}

export function logFooter({ steps, cap, spent, wallet }) {
  const rows = tally(steps).map((row) => `| ${row.label} | ${row.count} | ${money(row.cost)} |`);
  const asked = steps.filter((s) => s.kind === "commander").length;
  const approvals = steps.filter((s) => s.kind === "send-approved" || s.kind === "send-refused").length;
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
    `The agent went to the commander ${asked} time${asked === 1 ? "" : "s"} and asked for ${approvals} send approval${approvals === 1 ? "" : "s"}. Every other step was its own decision.`,
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
    case "flashpoint": return `${tag} Flashpoint: ${ACTIONS[step.action] ?? "a message"} (${paid(step)})\n       could change: ${step.couldChange || "(none given)"}`;
    case "flashpoint-failed": return `${tag} Flashpoint failed, ${step.charged ? "charged" : "not charged"}: ${step.error}`;
    case "rehearsal": return `${tag} Dress rehearsal on AI personas (${paid(step)})\n       could change: ${step.couldChange || "(none given)"}`;
    case "rehearsal-failed": return `${tag} Dress rehearsal failed, carrying on: ${step.error}`;
    case "deck": return `${tag} Slide deck made (${paid(step)})`;
    case "deck-failed": return `${tag} Slide deck failed: ${step.error}`;
    case "blocked": return `${tag} The budget cap refused a paid step`;
    case "sealed": return `${tag} Envelope sealed for round ${step.round}: ${step.hash.slice(0, 16)}…`;
    case "opened": return `${tag} Envelope opened for round ${step.round}\n${step.rows.map((row) => `       ${row.question}\n         people:    ${row.people_said}\n         agent:     ${row.agent}\n         personas:  ${row.personas ?? "no guess"}\n         commander: ${row.commander ?? "no guess"}`).join("\n")}`;
    case "debrief": return `${tag} Debrief: ${step.nextMove === "another_round" ? "another round" : "finish"}, because ${step.reason}\n       wrong:     ${step.whoWasWrong}\n       surprise:  ${step.surprise}\n       unknown:   ${step.stillUnknown}`;
    case "send-approved": return `${tag} Send approved by the commander`;
    case "send-refused": return `${tag} Send refused: ${step.reason}`;
    case "commander": return `${tag} Commander replied: ${step.reply ?? "(nobody at the desk)"}`;
    case "wait": return `${tag} Waited up to ${step.minutes} min${step.said ? `; commander said: ${step.said}` : ""}`;
    case "finish": return `${tag} Finished`;
    default: return `${tag} ${step.kind}`;
  }
}
