// Draws one saved mission as a log you can replay step by step.
// The mission is site/data/agent-run.json, written by agent/publish-run.mjs.
// Everything from the run is put on the page as text, never as markup.

const money = (amount) => `$${Number(amount).toFixed(2)}`;

function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === "text") node.textContent = value;
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) if (child) node.append(child);
  return node;
}

const SVG = "http://www.w3.org/2000/svg";
function svg(tag, attrs = {}) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

// The envelope, sealed or open. Open, its three slips stand up out of it.
function envelope(open, label) {
  const root = svg("svg", { class: "envelope", viewBox: "0 0 240 170", role: "img", "aria-label": label });
  if (open) {
    root.append(svg("path", { class: "env-flap", d: "M6 56 L120 4 L234 56" }));
    for (const [x, y] of [[46, 22], [98, 12], [150, 22]]) root.append(svg("rect", { class: "env-slip", x, y, width: 44, height: 70, rx: 2 }));
  }
  root.append(svg("rect", { class: "env-body", x: 6, y: 50, width: 228, height: 114, rx: 6 }));
  root.append(svg("path", { class: "env-line", d: open ? "M6 164 L120 100 L234 164" : "M6 56 L120 124 L234 56" }));
  if (!open) root.append(svg("circle", { class: "env-seal", cx: 120, cy: 120, r: 13 }));
  return root;
}

function receipt(step, what) {
  return el("dl", { class: "receipt" }, [
    el("dt", { text: "Paid for" }), el("dd", { text: what }),
    el("dt", { text: "Price" }), el("dd", { text: money(step.price) }),
    el("dt", { text: "Could change" }), el("dd", { text: step.couldChange || "(none given)" }),
    el("dt", { text: "Spent so far" }), el("dd", { text: money(step.spent) }),
  ]);
}

const fold = (title, text) => el("details", {}, [el("summary", { text: title }), el("pre", { text })]);
const said = (text, who = "") => el("div", { class: `said ${who}`.trim(), text });
const pairs = (rows) => el("dl", { class: "pairs" }, rows.flatMap(([term, value]) => [el("dt", { text: term }), value instanceof Node ? el("dd", {}, value) : el("dd", { text: value })]));

function table(head, rows) {
  return el("div", { class: "table-wrap" }, el("table", { class: "stack" }, [
    el("thead", {}, el("tr", {}, head.map((text) => el("th", { scope: "col", text })))),
    el("tbody", {}, rows.map((cells) => el("tr", {}, cells.map((cell, i) => {
      const td = cell instanceof Node ? cell : el("td", { text: cell ?? "" });
      td.setAttribute("data-label", head[i]);
      return td;
    })))),
  ]));
}

const ACTIONS = {
  design: "asked Flashpoint to write or change the survey",
  publish: "asked Flashpoint to publish the survey",
  send: "asked Flashpoint to email the survey",
  results: "asked Flashpoint for the results",
  other: "sent Flashpoint a message",
};

const mark = (text) => el("td", { class: text === "right" ? "mark-right" : text === "wrong" ? "mark-wrong" : "", text });

// One step of the run: who acted, what happened, and the details.
function describe(step) {
  switch (step.kind) {
    case "thinking":
      return { who: "The agent", what: step.text, extra: [] };
    case "flashpoint":
      return {
        who: `The agent, round ${step.round}`, what: `It ${ACTIONS[step.action] ?? ACTIONS.other}.`,
        extra: [receipt(step, "one message to Flashpoint's survey agent"), el("p", { text: `Why: ${step.why}` }), fold("What it sent", step.message), fold("What Flashpoint replied", step.reply),
          ...(step.receipts ?? []).filter((line) => /^paid: https:\/\//.test(line)).map((line) => el("p", { class: "soft" }, el("a", { href: line.slice(6), text: "Payment receipt on the Base chain" })))],
      };
    case "flashpoint-failed":
      return { who: "Flashpoint", what: `A step failed (${step.charged ? "charged" : "not charged"}).`, extra: [el("p", { text: step.error })] };
    case "rehearsal":
      return { who: `The agent, round ${step.round}`, what: "It rehearsed the survey on AI personas before any person saw it.", extra: [receipt(step, "a synthetic persona run"), el("p", { text: `Why: ${step.why}` }), fold("What came back (synthetic, not people)", step.reply)] };
    case "rehearsal-failed":
      return { who: "Flashpoint", what: "The persona rehearsal failed. The agent carried on without it.", extra: [el("p", { text: step.error })] };
    case "deck":
      return { who: "The agent", what: "It had Flashpoint make a slide deck of the findings.", extra: [receipt(step, "a slide deck"), el("p", { text: `Why: ${step.why}` })] };
    case "deck-failed":
      return { who: "Flashpoint", what: "The slide deck failed.", extra: [el("p", { text: step.error })] };
    case "blocked":
      return { who: "The budget cap", what: "The agent tried a paid step and the cap refused it.", extra: [] };
    case "sealed": {
      const count = step.questions.length;
      return {
        who: `Round ${step.round}`, what: `The envelope is sealed, with guesses on ${count} question${count === 1 ? "" : "s"}.`,
        extra: [el("div", { class: "sealed-row" }, [
          envelope(false, "A sealed envelope"),
          el("div", {}, [
            el("ul", {}, step.questions.map((question) => el("li", { text: question }))),
            el("p", { text: step.commanderGuessed > 0 ? `The commander sealed a guess on ${step.commanderGuessed}. The agent cannot see it until the envelope is opened.` : "The commander made no guess this round." }),
            el("p", { class: "hash", text: `SHA-256 ${step.hash}` }),
          ]),
        ])],
      };
    }
    case "opened":
      return {
        who: `Round ${step.round}`, what: "The answers are in, and the envelope is opened.",
        extra: [el("div", { class: "opened-row" }, [
          envelope(true, "An open envelope with three slips"),
          el("p", { class: "soft", text: step.intact ? "The envelope's hash matches the one recorded when it was sealed, so no guess was changed after the answers came in." : "The envelope's hash does not match the one recorded when it was sealed." }),
        ]),
        table(["Question", "What people said", "The agent guessed", "AI personas guessed", "The commander guessed"],
          step.rows.map((row) => [row.question, el("td", { class: "people", text: row.people_said }), row.agent, row.personas ?? "no guess", row.commander ?? "no guess"]))],
      };
    case "challenge":
      return { who: "The loop", what: "The agent chose to stop after one round. It was asked once to think again.", extra: [pairs([["Still unknown", step.stillUnknown], ["Its reason", step.reason]]), el("p", { class: "soft", text: "The loop asks this once per mission. The decision stays the agent's." })] };
    case "debrief":
      return {
        who: `The agent, round ${step.round}`, what: "What the envelope taught it.",
        extra: [pairs([["Who was wrong", step.whoWasWrong], ["Biggest surprise", step.surprise], ["Still unknown", step.stillUnknown],
          ["Next move", el("span", { class: "decision", text: step.nextMove === "another_round" ? "another round" : "finish" })], ["Why", step.reason]])],
      };
    case "send-approved":
      return { who: "The commander", what: `Approved the round ${step.round} send.`, extra: [el("div", { class: "stamp", text: "APPROVED" }), said(step.reply, "commander")] };
    case "send-refused":
      return { who: "The commander", what: `Refused the round ${step.round} send. Nothing was sent or charged.`, extra: [said(step.reason, "commander")] };
    case "commander":
      return {
        who: "The agent went to the commander", what: step.order ? `Standing order: “${step.order}”` : "It had a question.",
        extra: [said(step.message), el("p", { class: "who", text: "The commander" }), said(step.reply === null ? "(nobody was at the desk)" : step.reply === "" ? "(no reply)" : step.reply, "commander")],
      };
    case "wait":
      return { who: "The agent", what: `It waited up to ${step.minutes} minutes for people to answer.`, extra: [el("p", { text: `Why: ${step.why}` }), step.said ? said(step.said, "commander") : null] };
    case "resumed":
      return { who: "The mission", what: `It was stopped and carried on after ${step.away}.`, extra: [] };
    case "finish":
      return { who: "The agent", what: "It finished and gave its answer, below.", extra: [] };
    default:
      return { who: step.kind, what: "", extra: [] };
  }
}

function drawAnswer(run, finish) {
  const body = document.getElementById("answer-body");
  if (!finish) {
    body.append(el("p", { text: "The agent stopped without an answer." }));
    return;
  }
  if (run.mode !== "real") body.append(el("p", { class: "practice", text: "This answer comes from a practice run with invented answers. It is not a finding." }));
  body.append(el("p", { class: "recommendation", text: finish.recommendation }));
  body.append(pairs([["Evidence", finish.evidence], ["Between rounds", finish.learned_between_rounds], ["Limits", finish.limits]]));
  if (finish.unbacked?.length > 0) body.append(el("p", { text: `Check these numbers. They are in the answer but in nothing Flashpoint or the commander said: ${finish.unbacked.join(", ")}.` }));
  if (finish.scoreboard.length > 0) {
    body.append(el("h3", { text: "Who guessed better" }));
    body.append(table(["Round", "Question", "What people said", "Agent", "AI personas", "Commander"],
      finish.scoreboard.map((row) => [String(row.round), row.question, el("td", { class: "people", text: row.people_said }), mark(row.agent), mark(row.personas), mark(row.commander)])));
    body.append(el("p", { class: "soft", text: `The agent marked these itself, its own guesses included. With ${run.people} people asked, the scoreboard shows how the method works. It does not show who is the better guesser.` }));
  }
  const spent = finish.spent ?? 0;
  body.append(el("p", { text: `It spent ${money(spent)} of its ${money(run.cap)} cap and handed back ${money(Math.max(0, run.cap - spent))}.${run.mode === "real" ? "" : " Those are the prices a real run would have paid. This practice run paid nothing."}` }));
}

async function start() {
  const status = document.getElementById("status");
  let run;
  try {
    const reply = await fetch("../data/agent-run.json");
    if (!reply.ok) throw new Error(String(reply.status));
    run = await reply.json();
  } catch {
    status.textContent = "No mission has been published to this page yet. Run one, then: node agent/publish-run.mjs agent/runs/<folder>";
    return;
  }
  status.hidden = true;

  if (run.mode !== "real") {
    const practice = document.getElementById("practice");
    practice.textContent = "This is a practice run. An AI stand-in played Flashpoint and invented every answer. No survey was sent, no real person answered, and no credit was spent. It shows how the agent works. Nothing in it is a finding.";
    practice.hidden = false;
  }

  const brief = document.getElementById("brief");
  brief.append(
    el("span", { class: "label", text: "Mission from the commander" }),
    el("p", { class: "mission", text: run.objective }),
    el("span", { class: "label", text: "Standing orders" }),
    el("ul", {}, run.orders.map((order) => el("li", { text: order }))),
    el("p", { text: `${run.people} people to ask. Budget cap ${money(run.cap)}. Model: ${run.model}.${run.practiceCommander ? " Nobody was at the keyboard, so the commander's replies are canned and the commander makes no guesses." : ""}` }),
  );
  brief.hidden = false;

  const log = document.getElementById("log");
  const items = run.steps.map((step) => {
    const { who, what, extra } = describe(step);
    const item = el("li", { class: `step ${step.kind}` }, [
      el("span", { class: "num", text: String(step.n).padStart(2, "0") }),
      el("div", {}, [el("p", { class: "who", text: who }), el("p", { class: "what", text: what }), ...extra]),
    ]);
    log.append(item);
    return item;
  });

  const finish = run.steps.find((step) => step.kind === "finish");
  drawAnswer(run, finish);
  const answer = document.getElementById("answer");
  answer.hidden = false;

  // The replay: show the steps one at a time.
  const button = (id) => document.getElementById(id);
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let shown = items.length;
  let timer = null;

  const spentAt = (count) => run.steps.slice(0, count).reduce((most, step) => Math.max(most, step.spent ?? 0), 0);
  function update() {
    items.forEach((item, i) => { item.hidden = i >= shown; });
    const replaying = shown < items.length;
    answer.hidden = replaying;
    button("where").textContent = `Step ${shown} of ${items.length}`;
    button("spent").textContent = `${money(spentAt(shown))} of ${money(run.cap)}`;
    button("fill").style.width = `${Math.min(100, (spentAt(shown) / run.cap) * 100)}%`;
    button("next").hidden = !replaying;
    button("play").hidden = !replaying;
    button("all").hidden = !replaying;
    button("play").textContent = timer ? "Pause" : "Play";
  }
  function stop() {
    clearInterval(timer);
    timer = null;
  }
  function step() {
    if (shown >= items.length) return;
    shown += 1;
    const item = items[shown - 1];
    item.classList.add("fresh");
    update();
    item.scrollIntoView({ block: "center", behavior: calm ? "auto" : "smooth" });
    if (shown >= items.length) stop();
    update();
  }
  button("replay").addEventListener("click", () => { stop(); shown = 0; update(); step(); button("next").focus(); });
  button("next").addEventListener("click", () => { stop(); step(); });
  button("play").addEventListener("click", () => { if (timer) stop(); else timer = setInterval(step, 1800); update(); });
  button("all").addEventListener("click", () => { stop(); shown = items.length; update(); });
  document.getElementById("controls").hidden = false;
  update();
}

start();
