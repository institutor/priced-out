// The agent's page. It reads one saved run (site/data/agent-run.json, written
// by agent/publish-run.mjs) and tells it as a story in parts: the plan, then
// for each round the survey, the sealed guess, the send, the opened envelope
// and the decision, and at the end the answer. Every raw step is still there,
// folded under the part it belongs to. Everything from the run is put on the
// page as text, never as markup.
import { el } from "../js/ui/dom.js";
import { circled, drawWhenSeen, inkButton, marked, perforation, redrawAll, shiverWhileSeen, underlineLastLine } from "../js/ui/ink.js";
import { bullet, doodle } from "../js/ui/doodles.js";
import { strip } from "../js/ui/banner.js";
import * as contents from "../js/ui/contents.js";
import * as cover from "../js/ui/cover.js";
import * as scene from "./scene.js";
import { aboutRun, autonomy, lastOf, money, partsOf, roundsIn, runFor } from "./story.js";
import { card, envelope, meter, numbered, slip, stamp, verdict } from "./draw.js";
import * as present from "./present.js";
import { vignette } from "./vignette.js";

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const words = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const inWords = (count) => words[count] ?? String(count);

// Small pieces ---------------------------------------------------------------

// Fills a part of the page. Lists of pieces are laid out flat, and a piece
// that is not there is left out.
const put = (node, ...children) => node.replaceChildren(...children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));

const fold = (title, text) => el("details", { class: "m-fold" }, el("summary", { text: title }), el("pre", { class: "m-pre", text }));
const quote = (text, who = "") => el("p", { class: `m-said ${who}`.trim(), text });
const pairs = (rows) => el("dl", { class: "m-pairs" }, rows.filter(([, value]) => value !== undefined && value !== null && value !== "").map(([term, value]) => [
  el("dt", { text: term }),
  el("dd", {}, value),
]));
const points = (items, seed = 300) => el("ul", { class: "m-points" }, items.map((item, index) => el("li", {}, bullet(seed + index), item)));

function table(head, rows) {
  return el("div", { class: "m-table-wrap" }, el("table", { class: "m-table" },
    el("thead", {}, el("tr", {}, head.map((text) => el("th", { scope: "col", text })))),
    el("tbody", {}, rows.map((cells) => el("tr", {}, cells.map((cell, index) => {
      const td = cell instanceof Node && cell.tagName === "TD" ? cell : el("td", {}, cell ?? "");
      td.setAttribute("data-label", head[index]);
      return td;
    })))),
  ));
}

// What each paid step in a part cost, on a pink slip, with the running total.
const PAID_FOR = {
  design: "Write the survey",
  publish: "Publish the survey",
  send: "Email the survey",
  results: "Read the results",
  other: "A message to Flashpoint",
};

function paidSlip(part, run, name) {
  const paid = part.steps.filter((step) => step.price !== undefined && ["flashpoint", "rehearsal", "deck"].includes(step.kind));
  if (paid.length === 0) return null;
  const label = (step) => (step.kind === "rehearsal" ? "Rehearse on AI personas" : step.kind === "deck" ? "Make a slide deck" : PAID_FOR[step.action] ?? PAID_FOR.other);
  return slip(el("div", { class: "m-paid" },
    el("p", { class: "m-paid-head", text: run.mode === "real" ? "Paid to Flashpoint" : "What a real run would pay" }),
    el("ul", {}, paid.map((step) => el("li", {}, el("span", { text: label(step) }), el("span", { text: money(step.price) })))),
    el("p", { class: "m-paid-total" }, el("span", { text: "So far" }), el("span", { text: `${money(part.spent)} of ${money(run.cap)}` })),
  ), name);
}

// One raw step: who acted, what happened, and the details ---------------------

const ACTIONS = {
  design: "asked Flashpoint to write or change the survey",
  publish: "asked Flashpoint to publish the survey",
  send: "asked Flashpoint to email the survey",
  results: "asked Flashpoint for the results",
  other: "sent Flashpoint a message",
};

const priced = (step) => el("p", { class: "m-priced", text: `${money(step.price)}. It could change: ${step.couldChange || "(none given)"}. Spent so far: ${money(step.spent)}.` });

function describe(step) {
  switch (step.kind) {
    case "thinking":
      return { who: "The agent", what: step.text, extra: [] };
    case "plan":
      return { who: "The agent", what: step.first ? "It wrote its plan before spending anything." : "It changed its plan.", extra: [el("p", { text: step.surveyIdea })] };
    case "flashpoint":
      return {
        who: `The agent, round ${step.round}`, what: `It ${ACTIONS[step.action] ?? ACTIONS.other}.`,
        extra: [priced(step), el("p", { text: `Why: ${step.why}` }), fold("What it sent", step.message), fold("What Flashpoint replied", step.reply),
          ...(step.receipts ?? []).filter((line) => /^paid: https:\/\//.test(line)).map((line) => el("p", {}, el("a", { href: line.slice(6), target: "_blank", rel: "noopener", text: "Payment receipt on the Base chain" })))],
      };
    case "flashpoint-failed":
      return { who: "Flashpoint", what: `A step failed (${step.charged ? "charged" : "not charged"}).`, extra: [el("p", { text: step.error })] };
    case "rehearsal":
      return { who: `The agent, round ${step.round}`, what: "It rehearsed the survey on AI personas before any person saw it.", extra: [priced(step), el("p", { text: `Why: ${step.why}` }), fold("What came back (synthetic, not people)", step.reply)] };
    case "rehearsal-failed":
      return { who: "Flashpoint", what: "The persona rehearsal failed. The agent carried on without it.", extra: [el("p", { text: step.error })] };
    case "deck":
      return { who: "The agent", what: "It had Flashpoint make a slide deck of the findings.", extra: [priced(step), el("p", { text: `Why: ${step.why}` })] };
    case "deck-failed":
      return { who: "Flashpoint", what: "The slide deck failed.", extra: [el("p", { text: step.error })] };
    case "blocked":
      return { who: "The budget", what: "The agent tried a paid step and the code refused it: it would have gone over the budget.", extra: [] };
    case "email-limit":
      return { who: "The email limit", what: `The agent tried ${step.tried}, and the code refused. Everyone on the list had already had every email they may get.`, extra: [] };
    case "sealed":
      return { who: `Round ${step.round}`, what: `The envelope was sealed, with guesses on ${plural(step.questions.length, "question")}.`, extra: [el("p", { class: "m-hash", text: `SHA-256 ${step.hash}` })] };
    case "opened":
      return { who: `Round ${step.round}`, what: "The answers were in, and the envelope was opened.", extra: [el("p", { text: step.intact ? "Its fingerprint matched the one recorded when it was sealed." : "Its fingerprint did not match the one recorded when it was sealed." })] };
    case "challenge":
      return { who: "The code", what: "The agent chose to stop after one round. It was asked once to think again.", extra: [pairs([["Still unknown", step.stillUnknown], ["Its reason", step.reason]])] };
    case "debrief":
      return { who: `The agent, round ${step.round}`, what: `It said what the envelope taught it, and chose to ${step.nextMove === "another_round" ? "run another round" : "finish"}.`, extra: [] };
    case "send-approved":
      return { who: "The commander", what: `Approved sending the round ${step.round} survey.`, extra: [quote(step.reply, "commander")] };
    case "send-preapproved":
      return { who: "The code", what: `Checked the round ${step.round} survey and let it go. Nobody was at the keyboard.`, extra: [points(step.checks ?? [], 520)] };
    case "send-held":
      return { who: "The code", what: `Held the round ${step.round} survey. Nothing was sent or charged.`, extra: [points(step.problems ?? [], 540)] };
    case "send-refused":
      return { who: "The commander", what: `Refused sending the round ${step.round} survey. Nothing was sent or charged.`, extra: [quote(step.reason, "commander")] };
    case "commander":
      return {
        who: "The agent went to the commander", what: step.order ? `Standing order: “${step.order}”` : "It had a question.",
        extra: [quote(step.message), quote(step.reply === null ? "(nobody was at the keyboard)" : step.reply === "" ? "(no reply)" : step.reply, "commander")],
      };
    case "wait":
      return { who: "The agent", what: `It waited up to ${step.minutes} minutes for people to answer.`, extra: [el("p", { text: `Why: ${step.why}` }), step.said ? quote(step.said, "commander") : null] };
    case "resumed":
      return { who: "The run", what: `It was stopped and carried on after ${step.away}.`, extra: [] };
    case "finish":
      return { who: "The agent", what: "It finished and gave its answer.", extra: [] };
    default:
      return { who: step.kind, what: "", extra: [] };
  }
}

function rawSteps(steps) {
  return el("details", { class: "m-steps" },
    el("summary", { text: steps.length === 1 ? "The one step in this part" : `All ${inWords(steps.length)} steps in this part` }),
    el("ol", { class: "m-raw" }, steps.map((step) => {
      const { who, what, extra } = describe(step);
      return el("li", {}, el("span", { class: "m-n", text: String(step.n).padStart(2, "0") }), el("div", {}, el("p", { class: "m-who", text: who }), el("p", { class: "m-what", text: what }), extra));
    })),
  );
}

// The parts of the story ------------------------------------------------------

const commanderName = (run) => (run.standInCommander ? "The commander (an AI stand-in)" : "The commander");

const TELL = {
  plan(part) {
    const plan = part.steps.find((step) => step.kind === "plan");
    return {
      doodle: "plan",
      when: "Before the first survey",
      title: "It plans before it spends",
      body: [
        el("p", { text: "Before it spent anything, the agent wrote down what it needed to find out, what it expected, and what would change its mind." }),
        pairs([
          ["It needs to know", points(plan.needToKnow ?? [], 310)],
          ["Its hunch", points(plan.hunches ?? [], 320)],
          ["What would change its answer", plan.wouldChange],
          ["The survey it had in mind", plan.surveyIdea],
          ["How it would use the budget", plan.budget],
        ]),
      ],
      side: vignette("plan", ["First: what do I", "need to find out?"], 21),
    };
  },

  write(part, run) {
    const designs = part.steps.filter((step) => step.kind === "flashpoint" && step.action === "design");
    const rehearsed = part.steps.some((step) => step.kind === "rehearsal");
    const draft = designs[designs.length - 1];
    const first = part.round === 1;
    return {
      doodle: "pencil",
      title: first ? "It decides what to ask" : "It writes a short follow-up",
      body: [
        el("p", { text: `${first ? "The agent chose the questions itself" : "The agent wrote the follow-up from what round " + (part.round - 1) + " left open"} and had Flashpoint build the survey through the MCP${rehearsed ? ", then rehearsed it on AI personas before any person saw it" : ""}.` }),
        draft?.why ? el("p", { class: "m-why", text: `Its reason: ${draft.why}.`.replace(/\.\.$/, ".") }) : null,
        draft ? fold("Read the survey Flashpoint drafted", draft.reply) : null,
      ],
      side: [vignette("write", first ? ["I'll ask them this."] : ["A short follow-up,", "on what surprised us."], 30 + part.round), paidSlip(part, run, `write ${part.round}`)],
    };
  },

  seal(part, run) {
    const sealed = part.steps.find((step) => step.kind === "sealed");
    const count = sealed.questions.length;
    return {
      doodle: "envelope",
      title: "It seals its guess",
      body: [
        el("p", { text: `Before anyone answered, the agent wrote down what it expected people to say on ${plural(count, "question")}, and sealed it.` }),
        points(sealed.questions, 330 + part.round * 10),
        el("p", { text: sealed.commanderGuessed > 0 ? `${commanderName(run)} sealed a guess on ${sealed.commanderGuessed === count ? (count === 1 ? "it" : "each") : sealed.commanderGuessed} too. The agent cannot see that guess until the envelope is opened.` : "The commander made no guess this round." }),
        el("p", { class: "m-foot", text: `The envelope gets a fingerprint when it is sealed (SHA-256 ${sealed.hash.slice(0, 12)}…), so no guess can be changed after the answers come in.` }),
      ],
      side: envelope({ seed: 7 + part.round }),
    };
  },

  send(part, run, story) {
    const approved = part.steps.find((step) => step.kind === "send-approved");
    const checked = part.steps.find((step) => step.kind === "send-preapproved");
    const held = part.steps.filter((step) => step.kind === "send-held");
    const refused = part.steps.find((step) => step.kind === "send-refused");
    const emailed = part.steps.some((step) => step.kind === "flashpoint" && step.emailed);
    const wait = part.steps.find((step) => step.kind === "wait");
    const before = story.slice(0, story.indexOf(part)).flatMap((other) => other.steps).filter((step) => step.kind === "flashpoint" && step.emailed).length;
    const body = [];
    if (held.length > 0) body.push(el("p", { text: `The code held the send ${held.length === 1 ? "once" : `${held.length} times`} until the survey passed its checks.` }));
    if (approved) body.push(el("p", {}, stamp("Approved", `approved ${part.round}`), ` ${commanderName(run)} read the survey and typed “${approved.reply}”. No email goes out without that.`));
    if (checked) body.push(el("p", {}, stamp("Checked", `checked ${part.round}`), " Nobody was at the keyboard, so the code checked the survey against fixed rules before it let it go."), points(checked.checks ?? [], 560));
    if (refused) body.push(el("p", {}, stamp("Refused", `refused ${part.round}`), " The commander refused the send. Nothing was sent or charged."), quote(refused.reason, "commander"));
    if (emailed) {
      body.push(el("p", { text: `Flashpoint emailed the survey to all ${run.people} people on the list.${run.emailLimit ? ` That was email ${before + 1} of the ${run.emailLimit} each of them may get.` : ""}` }));
    }
    if (wait) body.push(el("p", { text: `Then the agent chose to wait up to ${wait.minutes} minutes for answers.${run.mode === "real" ? "" : " A practice run does not really wait: the invented answers come straight back."}` }));
    return { doodle: "plane", title: "The survey goes out", body, side: [emailed ? vignette("send", run.emailLimit ? [`Email ${before + 1} of ${run.emailLimit}.`, "Off it goes."] : ["Off it goes."], 40 + part.round) : null, paidSlip(part, run, `send ${part.round}`)] };
  },

  open(part, run) {
    const opened = part.steps.find((step) => step.kind === "opened");
    if (!opened) {
      return { doodle: "opened", title: "The answers come back", body: [el("p", { text: "The agent asked Flashpoint for the results." })], side: paidSlip(part, run, `open ${part.round}`) };
    }
    const personas = opened.rows.some((row) => row.personas);
    const commander = opened.rows.some((row) => row.commander);
    const head = ["Question", "What people said", "The agent guessed", personas ? "AI personas guessed" : null, commander ? `${commanderName(run)} guessed` : null].filter(Boolean);
    return {
      doodle: "opened",
      title: "The answers come back, and the envelope is opened",
      body: [
        el("p", { text: `The agent read the results through Flashpoint. Only then was the envelope opened, and each guess laid beside what people really said.${opened.intact ? " Its fingerprint matched, so no guess was changed." : " Its fingerprint did not match the one recorded when it was sealed."}` }),
        table(head, opened.rows.map((row) => [row.question, el("td", { class: "m-people", text: row.people_said }), row.agent ?? "no guess", personas ? row.personas ?? "no guess" : null, commander ? row.commander ?? "no guess" : null].filter((cell) => cell !== null))),
      ],
      side: [envelope({ open: true, slips: ["agent", personas ? "personas" : null, commander ? "commander" : null].filter(Boolean), seed: 17 + part.round }), paidSlip(part, run, `open ${part.round}`)],
    };
  },

  decide(part) {
    const debrief = lastOf(part.steps, "debrief");
    const challenge = part.steps.find((step) => step.kind === "challenge");
    const told = part.steps.filter((step) => step.kind === "commander");
    const again = debrief?.nextMove === "another_round";
    const body = [];
    if (challenge) body.push(el("p", { text: "The agent first chose to stop here. The code asked it, once, to think again about what was still unknown. The choice stayed the agent's." }));
    if (debrief) {
      body.push(pairs([
        ["Who was wrong", debrief.whoWasWrong],
        ["Biggest surprise", debrief.surprise],
        ["Still unknown", debrief.stillUnknown],
      ]));
      body.push(el("p", { class: "m-move" }, "Its next move: ", circled(el("strong", { text: again ? "another round" : "finish" }), `move ${part.round}`)));
      body.push(el("p", { class: "m-why", text: debrief.reason }));
    }
    for (const step of told) {
      body.push(el("p", { class: "m-foot", text: step.order ? `A standing order applied here: “${step.order}” So the agent told the commander what it had learned.` : "The agent went to the commander with a question." }));
      if (step.reply) body.push(quote(step.reply, "commander"));
    }
    return { doodle: "glass", title: again ? "It learns, and chooses another round" : "It learns, and chooses to stop", body, side: debrief ? vignette("decide", again ? ["One more round,", "on what we got wrong."] : ["That is enough", "to answer."], 50 + part.round) : null };
  },

  answer(part, run) {
    const finish = part.steps.find((step) => step.kind === "finish");
    const spent = finish?.spent ?? part.spent;
    return {
      doodle: "star",
      when: "The end",
      title: "It gives its answer",
      body: [
        el("p", { text: `The agent stopped and wrote its recommendation, the evidence for it, and its limits. It spent ${money(spent)} of its ${money(run.cap)} budget and handed back ${money(Math.max(0, run.cap - spent))}.` }),
        el("p", {}, el("a", { href: "#answer", class: "m-jump", text: "Read the answer" })),
      ],
      side: vignette("answer", ["Here is what", "I would do."], 61),
    };
  },
};

function partCard(part, run, story, index) {
  const tell = TELL[part.part](part, run, story);
  const when = tell.when ?? `Round ${part.round}`;
  const item = el("li", { class: `m-beat ${part.part}`, id: `part-${index + 1}` },
    el("div", { class: "m-beat-head" },
      shiverWhileSeen(doodle(tell.doodle)),
      el("div", {}, el("p", { class: "m-when", text: when }), el("h3", { class: "sub", text: tell.title })),
    ),
    el("div", { class: tell.side ? "m-beat-body two" : "m-beat-body" },
      el("div", { class: "m-beat-main" }, tell.body),
      tell.side ? el("div", { class: "m-beat-side" }, tell.side) : null,
    ),
    rawSteps(part.steps),
  );
  item.dataset.slide = `${when}: ${tell.title.charAt(0).toLowerCase()}${tell.title.slice(1)}`;
  item.dataset.spent = String(part.spent);
  return item;
}

// The sections ---------------------------------------------------------------

// The other runs that have been published: the same agent, given other
// objectives. Choosing one loads the page again with that run.
function otherRuns(list, showing) {
  if (list.length < 2) return null;
  return [
    el("h3", { class: "sub", text: "The same agent, other objectives" }),
    el("p", { text: "Nothing in the agent says what to ask. Give it another objective and it writes another survey." }),
    el("ul", { class: "m-runs" }, list.map((entry, index) => {
      const now = entry.file === showing.file;
      const words = `“${entry.objective}”`;
      return el("li", { class: now ? "now" : "" },
        bullet(600 + index),
        now ? el("strong", { text: words }) : el("a", { href: entry.name ? `?run=${entry.name}#objective` : "./#objective", text: words }),
        el("span", { class: "m-foot", text: ` ${now ? "Showing now: " : ""}${aboutRun(entry)}.` }),
      );
    })),
  ];
}

function drawObjective(body, run, list, showing) {
  const count = autonomy(run.steps);
  const finish = run.steps.find((step) => step.kind === "finish");
  const spent = finish?.spent ?? run.steps.reduce((most, step) => Math.max(most, step.spent ?? 0), 0);
  put(body, 
    el("p", { class: "m-objective" }, marked(el("span", { text: `“${run.objective}”` }), "objective")),
    el("p", { text: `That one sentence is all the agent was given, with a list of ${run.people} people to email and a budget of ${money(run.cap)}. What to ask, when to ask again and when to stop were its own decisions.` }),
    el("dl", { class: "m-tally" },
      el("div", {}, el("dt", { text: "steps the agent took alone" }), el("dd", { text: String(count.alone) })),
      el("div", {}, el("dt", { text: count.person === 0 ? "times it went to a person" : `times it went to the commander: ${[count.approvals > 0 ? plural(count.approvals, "approval to send", "approvals to send") : null, count.ordered > 0 ? `${plural(count.ordered, "report")} a standing order asked for` : null, count.asked > 0 ? `${plural(count.asked, "question")} of its own` : null].filter(Boolean).join(", ")}` }), el("dd", { text: String(count.person) })),
      el("div", {}, el("dt", { text: count.codeStops + count.nudges === 0 ? "times the code stepped in" : `times the code stepped in: ${[count.nudges > 0 ? "it asked the agent once to think again before stopping" : null, count.codeStops > 0 ? `it refused ${plural(count.codeStops, "step")}` : null].filter(Boolean).join(", ")}` }), el("dd", { text: String(count.codeStops + count.nudges) })),
      el("div", {}, el("dt", { text: `${roundsIn(run.steps) === 1 ? "round" : "rounds"}, for ${money(spent)} of the ${money(run.cap)}` }), el("dd", { text: String(roundsIn(run.steps)) })),
    ),
    el("h3", { class: "sub", text: "Standing orders from the commander" }),
    el("p", { text: `The commander is the person who gave the objective.${run.standInCommander ? " Nobody was at the keyboard for this practice run, so an AI stand-in played the commander. It is labelled wherever it speaks." : run.practiceCommander ? " Nobody was at the keyboard for this practice run, so the commander's replies are canned." : ""}${run.handsOff ? " This run was hands-off: the code checked each survey before it was sent, in place of a person." : ""}` }),
    points(run.orders, 400),
    el("p", { class: "m-foot", text: `${run.emailLimit ? `Nobody on the list gets more than ${inWords(run.emailLimit)} ${run.emailLimit === 1 ? "email" : "emails"} in a run. ` : ""}The agent's model was ${run.model}.` }),
    run.memory?.length > 0 ? [
      el("h3", { class: "sub", text: "What it remembered from earlier runs" }),
      el("p", { text: "At the end of every run the agent writes down what it learned about doing the research. It read these before it planned this one." }),
      points(run.memory, 420),
    ] : null,
    otherRuns(list, showing),
  );
}

function drawAnswer(body, run) {
  const finish = run.steps.find((step) => step.kind === "finish");
  if (!finish) {
    put(body, el("p", { class: "empty", text: "The agent stopped without an answer." }));
    return;
  }
  const spent = finish.spent ?? 0;
  const bar = meter("answer spend");
  const anyPersonas = finish.scoreboard.some((row) => row.personas && row.personas !== "no guess");
  put(body, 
    run.mode !== "real" ? el("p", { class: "m-warn" }, marked(el("strong", { text: "A practice answer." }), "practice answer"), " It comes from invented answers, so it is not a finding. It shows how the agent reasons.") : null,
    el("p", { class: "m-recommendation", text: finish.recommendation }),
    pairs([["The evidence", finish.evidence], ["What changed between rounds", finish.learned_between_rounds], ["Its limits", finish.limits]]),
    finish.unbacked?.length > 0 ? el("p", { class: "m-warn", text: `Check these numbers. They are in the answer but in nothing Flashpoint or the commander said: ${finish.unbacked.join(", ")}.` }) : null,
    finish.scoreboard.length > 0 ? [
      el("h3", { class: "sub", text: "Who guessed better" }),
      table(["Round", "Question", "What people said", "The agent", anyPersonas ? "AI personas" : null, commanderName(run)].filter(Boolean),
        finish.scoreboard.map((row, index) => [String(row.round), row.question, el("td", { class: "m-people", text: row.people_said }), verdict(row.agent, 700 + index), anyPersonas ? verdict(row.personas, 720 + index) : null, verdict(row.commander, 740 + index)].filter((cell) => cell !== null))),
      el("p", { class: "m-foot", text: `The agent marked these itself, its own guesses included. With ${run.people} people asked, the scoreboard shows how the method works. It does not show who is the better guesser.` }),
    ] : null,
    finish.lessons?.length > 0 ? [
      el("h3", { class: "sub", text: "What it will remember next time" }),
      points(finish.lessons, 440),
      el("p", { class: "m-foot", text: "These go in a notebook file. The next run reads it before it plans." }),
    ] : null,
    el("p", { class: "m-spend" }, bar, el("span", { text: `${money(spent)} of ${money(run.cap)} spent, ${money(Math.max(0, run.cap - spent))} handed back.${run.mode === "real" ? "" : " Those are the prices a real run would pay. This practice run paid nothing."}` })),
  );
  bar.set(run.cap > 0 ? spent / run.cap : 0);
}

function drawHow(body, run) {
  const limit = run.emailLimit ?? 2;
  const steps = [
    ["You give one objective", "And a list of people to email, a budget, and any standing orders, such as “check with me before any email goes out”."],
    ["The agent plans, then writes the survey", "It decides what to ask and has Flashpoint build the survey through the MCP. It can rehearse it on AI personas first."],
    ["Guesses go in the envelope", "The agent writes down what it expects people to say. You can seal a guess too. The agent cannot see yours."],
    ["The survey goes out", "Flashpoint emails your list. First you approve it, or in hands-off mode the code checks it against fixed rules."],
    ["The envelope is opened", "Each guess is laid beside the real answers, and the agent says who was wrong, itself first."],
    ["The agent decides the next move", `A short follow-up survey on whatever surprised everyone, or the answer. Nobody gets more than ${inWords(limit)} ${limit === 1 ? "email" : "emails"}.`],
  ];
  put(body, 
    el("ol", { class: "steps" }, steps.map(([title, text], index) => el("li", { class: "step" }, numbered(index + 1), el("div", { class: "step-body" }, el("h3", { class: "sub", text: title }), el("p", { text }))))),
    el("p", { class: "m-foot", text: "Every paid step prints a slip first: what it costs, and the decision it could change." }),
  );
}

function drawRules(body, run) {
  const limit = run.emailLimit ?? 2;
  const agent = [
    "What to ask, and how to word it",
    "Whether to rehearse on AI personas first",
    "What it expects people to answer",
    "Who was wrong, and what that means",
    "Whether to run another round, and on what",
    "When to stop, and the final recommendation",
  ];
  const code = [
    "No email goes out until the commander has typed yes, or, hands-off, until the survey passes fixed checks",
    "A budget. A paid step that would go over it is refused",
    `Nobody gets more than ${inWords(limit)} ${limit === 1 ? "email" : "emails"} in a run, reminders included`,
    "The commander's guess stays hidden from the agent until the envelope is opened",
    "A guess cannot be sealed or changed after the survey is sent",
    "Addresses never reach the model or the logs, and names on the list are taken out",
    "Every paid step is logged with its price and the decision it could change",
  ];
  put(body, 
    el("div", { class: "m-two" },
      card(el("div", {}, el("h3", { class: "sub", text: "The agent decides" }), points(agent, 460)), "agent decides"),
      card(el("div", {}, el("h3", { class: "sub", text: "The code holds, whatever the agent says" }), points(code, 480)), "code holds"),
    ),
  );
}

// The whole page -------------------------------------------------------------

// Each section gets a torn line above it, a small drawing and a pen line
// under its heading, the same as on the Priced Out page.
function dress() {
  for (const section of document.querySelectorAll("main > section")) {
    section.prepend(perforation(el("div", { class: "tear" }), section.id));
    const heading = section.querySelector("h2");
    if (heading) {
      underlineLastLine(heading, section.id);
      if (heading.dataset.doodle) heading.prepend(shiverWhileSeen(doodle(heading.dataset.doodle)));
      drawWhenSeen(heading);
    }
  }
  const footer = document.querySelector(".colophon");
  const sign = footer.querySelector(".colophon-mark");
  sign.append(doodle("envelope"), el("span", { class: "wordmark" }, "The Sealed ", el("span", { class: "out", text: "Envelope" })));
  footer.prepend(perforation(el("div", { class: "tear" }), "footer"));
  drawWhenSeen(sign);
}

function drawWatch(body, run) {
  const story = partsOf(run.steps);
  const items = story.map((part, index) => partCard(part, run, story, index));
  const bar = meter("replay spend");
  const where = el("span", { class: "m-where" });
  const spentText = el("span", { class: "m-spent" });
  const make = (text, onclick, extra = "") => inkButton(el("button", { class: `button m-small ${extra}`.trim(), type: "button", onclick }, el("span", { text })), `replay ${text}`);
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let shown = items.length;
  let timer = 0;

  const stop = () => {
    window.clearInterval(timer);
    timer = 0;
  };
  const again = make("Replay from the start", () => { stop(); shown = 0; step(); nextButton.focus(); });
  const nextButton = make("Next part", () => { stop(); step(); });
  const playButton = make("Play", () => { if (timer) stop(); else timer = window.setInterval(step, 2600); update(); });
  const allButton = make("Show it all", () => { stop(); shown = items.length; update(); });

  function update() {
    items.forEach((item, index) => { item.hidden = index >= shown; });
    const replaying = shown < items.length;
    document.documentElement.classList.toggle("replaying", replaying);
    const spent = shown > 0 ? story[shown - 1].spent : 0;
    where.textContent = `Part ${shown} of ${items.length}`;
    spentText.textContent = `${money(spent)} of ${money(run.cap)}`;
    bar.set(run.cap > 0 ? spent / run.cap : 0);
    nextButton.hidden = !replaying;
    playButton.hidden = !replaying;
    allButton.hidden = !replaying;
    playButton.querySelector("span").textContent = timer ? "Pause" : "Play";
  }
  function step() {
    if (shown >= items.length) return;
    shown += 1;
    if (shown >= items.length) stop();
    update();
    const item = items[shown - 1];
    redrawAll(item);
    item.classList.add("drawing");
    window.setTimeout(() => item.classList.remove("drawing"), 2600);
    item.scrollIntoView({ block: "start", behavior: calm ? "auto" : "smooth" });
  }

  put(body, 
    el("p", { class: "m-watch-intro", text: `The run in ${inWords(items.length)} parts. Under each part you can open every message the agent sent to Flashpoint, and every reply.` }),
    el("div", { class: "m-controls" },
      el("div", { class: "m-buttons" }, again, nextButton, playButton, allButton),
      el("p", { class: "m-progress", "aria-live": "polite" }, where, bar, spentText),
    ),
    el("ol", { class: "m-beats" }, items),
  );
  update();
  return { showAll: () => { stop(); shown = items.length; update(); } };
}

async function start() {
  const root = document.getElementById("top");
  cover.mount(root, { scene, solidWords: 2 }).catch(() => {}).finally(() => root.classList.add("play"));

  const section = (id) => document.querySelector(`#${id} .section-body`);
  // The list of published runs, if there is one, and the run the address
  // asks for.
  let list = [];
  try {
    const reply = await fetch("../data/agent-runs.json");
    if (reply.ok) list = await reply.json();
  } catch {
    // No list: the page shows the one run it always has.
  }
  const showing = runFor(list, new URLSearchParams(window.location.search).get("run"));
  let run;
  try {
    const reply = await fetch(`../data/${showing.file}`);
    if (!reply.ok) throw new Error(String(reply.status));
    run = await reply.json();
  } catch {
    document.getElementById("status").textContent = "No run has been published to this page yet. Run one, then: node agent/publish-run.mjs agent/runs/<folder>";
    for (const id of ["watch", "answer"]) document.getElementById(id).hidden = true;
    drawHow(section("how"), {});
    drawRules(section("rules"), {});
    dress();
    return;
  }

  const banner = document.getElementById("banner");
  if (run.mode !== "real") {
    banner.append(strip("banner", "A practice run. ", "An AI stand-in played Flashpoint and invented every answer. No survey was sent, no real person answered and no credit was spent. Nothing here is a finding.", "Invented answers. Nothing here is a finding."));
  } else {
    banner.append(strip("banner pilot", "A real run. ", `${run.people} people were emailed through Flashpoint and paid steps were charged. With so few people, read the answer as a direction, not a measurement.`, `${run.people} real people asked. A direction, not a measurement.`));
  }

  drawObjective(section("objective"), run, Array.isArray(list) ? list : [], showing);
  const watch = drawWatch(section("watch"), run);
  drawAnswer(section("answer"), run);
  drawHow(section("how"), run);
  drawRules(section("rules"), run);
  dress();
  contents.mount(document.getElementById("contents"));

  // Present mode: from the button on the title page, the P key, or an
  // address that asks for it.
  const stage = present.mount(document.getElementById("present-bar"), {
    before: watch.showAll,
    note: (slide) => (slide.dataset.spent ? `${money(slide.dataset.spent)} of ${money(run.cap)} spent` : ""),
  });
  document.getElementById("present-open").addEventListener("click", () => stage.open(0));
  if (new URLSearchParams(window.location.search).has("present")) stage.open(present.screenIn(window.location.hash, stage.count()));

  // The hand lettering can arrive after the first drawing. When it does the
  // words move, and the lines drawn under them are drawn again.
  document.fonts?.ready?.then(() => redrawAll());

  // How far down the page you are, for the line the banner draws along its
  // bottom edge.
  let waiting = false;
  const progress = () => {
    waiting = false;
    const room = document.documentElement.scrollHeight - window.innerHeight;
    document.documentElement.style.setProperty("--read", room > 0 ? Math.min(1, window.scrollY / room).toFixed(4) : 0);
  };
  window.addEventListener("scroll", () => {
    if (waiting) return;
    waiting = true;
    window.requestAnimationFrame(progress);
  }, { passive: true });
  progress();
}

start();
