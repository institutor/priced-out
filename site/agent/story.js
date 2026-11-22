// Turns the steps of one saved run into the parts of its story. Nothing here
// touches the page, so it can be tested without a browser.

export const money = (amount) => `$${Number(amount).toFixed(2)}`;

// The parts of a round, in the order they happen.
const PART_OF = {
  plan: "plan",
  rehearsal: "write",
  "rehearsal-failed": "write",
  sealed: "seal",
  "send-approved": "send",
  "send-refused": "send",
  "send-preapproved": "send",
  "send-held": "send",
  opened: "open",
  challenge: "decide",
  debrief: "decide",
  finish: "answer",
};

// Which part a step starts, or null when it belongs with whatever came
// before it. Publishing happens twice: once to write the survey, and once
// more, after the envelope is sealed, on the way to sending it.
export function partOf(step, sealed) {
  // A plan changed part way through belongs with what it was changed during.
  if (step.kind === "plan" && step.first === false) return null;
  if (step.kind !== "flashpoint") return PART_OF[step.kind] ?? null;
  if (step.action === "design") return "write";
  if (step.action === "send") return "send";
  if (step.action === "results") return "open";
  if (step.action === "publish") return sealed.has(step.round) ? "send" : "write";
  return null;
}

// Groups the steps into parts. Each part has its round, its steps, and what
// had been spent by the time it ended.
export function partsOf(steps) {
  const parts = [];
  const sealed = new Set();
  let round = 0;
  let spent = 0;
  // Anything said before the first part begins is kept for that part.
  let before = [];
  for (const step of steps) {
    if (step.round !== undefined) round = step.round;
    if (step.kind === "sealed") sealed.add(step.round);
    const part = partOf(step, sealed);
    const last = parts[parts.length - 1];
    // A part that began before the first survey had a round takes the round.
    const early = last && part === "write" && last.part === "write" && last.round === 0;
    const same = last && (part === null || early || (part === last.part && round === last.round));
    spent = Math.max(spent, step.spent ?? 0);
    if (!last && part === null) {
      before.push(step);
      continue;
    }
    if (same) {
      last.steps.push(step);
      last.spent = spent;
      if (early) last.round = round;
    } else {
      const starts = part ?? "write";
      parts.push({ part: starts, round: starts === "plan" || starts === "answer" ? 0 : round, steps: [...before, step], spent });
      before = [];
    }
  }
  // A run that never got as far as a part is told as one, so nothing is lost.
  if (before.length > 0) parts.push({ part: "write", round: Math.max(1, round), steps: before, spent });
  return parts;
}

// How much the agent did alone, how often it went to the commander, and how
// often the code stopped it. The same count as the run's one-page summary.
export function autonomy(steps) {
  const ALONE = ["plan", "flashpoint", "rehearsal", "deck", "sealed", "opened", "debrief", "wait", "finish"];
  const approvals = steps.filter((step) => step.kind === "send-approved" || step.kind === "send-refused").length;
  const told = steps.filter((step) => step.kind === "commander" && step.reply !== null);
  // A report one of the standing orders asked for is not a question the
  // agent chose to ask, so the two are counted apart.
  const ordered = told.filter((step) => Boolean(step.order)).length;
  const asked = told.length - ordered;
  return {
    alone: steps.filter((step) => ALONE.includes(step.kind)).length,
    approvals,
    ordered,
    asked,
    questions: told.length,
    person: approvals + told.length,
    codeStops: steps.filter((step) => ["blocked", "email-limit", "send-held"].includes(step.kind)).length,
    nudges: steps.filter((step) => step.kind === "challenge").length,
  };
}

// Which published run an address asks for. `list` is the list of published
// runs, and `wanted` the name in the address. An unknown name, or none, gets
// the run the page opens with. The file name is checked, since it is fetched.
export function runFor(list, wanted) {
  const safe = (entry) => entry && /^agent-run(-[a-z0-9-]+)?\.json$/.test(entry.file ?? "");
  const found = (list ?? []).find((entry) => entry.name === wanted && wanted);
  if (safe(found)) return found;
  const first = (list ?? []).find((entry) => entry.name === "");
  return safe(first) ? first : { name: "", file: "agent-run.json" };
}

// A few words about a published run, for the list of them.
export function aboutRun(entry) {
  const parts = [entry.mode === "real" ? "a real run" : "a practice run"];
  if (entry.handsOff) parts.push("hands-off: nobody approved the sends");
  else parts.push("the commander approved each send");
  if (entry.remembered > 0) parts.push(`started with ${entry.remembered} ${entry.remembered === 1 ? "lesson" : "lessons"} from earlier runs`);
  parts.push(`${entry.rounds} ${entry.rounds === 1 ? "round" : "rounds"}`);
  parts.push(`${money(entry.spent)} spent`);
  return parts.join(", ");
}

// The last step of a kind in a list, or undefined.
export const lastOf = (steps, kind, test = () => true) => steps.filter((step) => step.kind === kind && test(step)).pop();

// How many rounds the run had.
export const roundsIn = (steps) => new Set(steps.filter((step) => step.round !== undefined).map((step) => step.round)).size;

// A long line cut at a word, so it fits on a card.
export function short(text, most = 120) {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= most) return clean;
  const cut = clean.slice(0, most);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), most - 20)).replace(/[\s,;:.]+$/, "")}…`;
}

// The run in one look: for each round, the first thing the agent guessed,
// what people said, how the guess was marked, and what the agent chose next.
// `part` is which part of the story to go to for the whole round.
export function glance(steps) {
  const parts = partsOf(steps);
  const finish = steps.find((step) => step.kind === "finish");
  const rounds = [];
  for (const opened of steps.filter((step) => step.kind === "opened")) {
    const row = opened.rows?.[0];
    if (!row) continue;
    const debrief = lastOf(steps, "debrief", (step) => step.round === opened.round);
    const marked = (finish?.scoreboard ?? []).find((mark) => mark.round === opened.round);
    rounds.push({
      round: opened.round,
      question: row.question,
      guess: row.agent ?? null,
      said: row.people_said,
      verdict: marked?.agent ?? null,
      move: debrief ? (debrief.nextMove === "another_round" ? "another round" : "to stop") : null,
      why: debrief?.reason ?? null,
      part: parts.findIndex((part) => part.part === "write" && part.round === opened.round) + 1,
    });
  }
  return { rounds, answer: finish?.recommendation ?? null };
}
