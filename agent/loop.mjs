// The agent loop. A commander gives it a mission and a few standing orders. The
// agent decides every research step itself: what to ask, whether to rehearse on
// AI personas, what it expects people to say, when to send, how long to wait,
// what to ask next, and when it has an answer. It comes to the commander only
// when an order says so.
//
// Nothing here talks to the network or the keyboard. The model, Flashpoint, the
// commander and the clock are passed in, so the tests run the whole loop with
// stand-ins.
import { createHash } from "node:crypto";

// What one call of each kind costs, in USDC.
export const PRICES = { survey: 0.5, rehearsal: 0.6, deck: 0.25 };
export const STEP_PRICE = PRICES.survey;
const MAX_TURNS = 60;

export const DEFAULT_ORDERS = [
  "Check with me before any email goes out.",
  "Come to me if the answers split evenly and you cannot call it.",
  "Tell me what you learned before you start a second round.",
];

const receipt = { type: "string", description: "The receipt: which decision of yours this step could change. One sentence." };

export const TOOLS = [
  {
    name: "ask_flashpoint",
    description:
      "Send one message to the Flashpoint survey agent and get its reply. This is the only way to make a panel, write or change a survey, publish it, email it, and read results (from real people or from a persona rehearsal). Each call that works costs $0.50. Flashpoint remembers the conversation, so later messages can say 'the survey' or 'confirm'. Put several requests in one message when you can, because each message is one paid step.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "What to tell the Flashpoint survey agent, in plain words. Write {{RECIPIENTS}} where the list of people to survey should go." },
        action: { type: "string", enum: ["design", "publish", "send", "results", "other"], description: "What this message is for. Use 'send' for any message that emails the survey to people, including the confirm that does it." },
        why: { type: "string", description: "One sentence: why this step, and what you expect back." },
        could_change: receipt,
        new_survey: { type: "boolean", description: "True to start a fresh conversation and a new survey, for a new round." },
      },
      required: ["message", "action", "why", "could_change"],
      additionalProperties: false,
    },
  },
  {
    name: "rehearse_on_personas",
    description:
      "Run the survey you have drafted on a small panel of AI personas before any real person sees it. Costs $0.60. Use it to catch broken or confusing questions and to get the personas' own answers. The answers are synthetic: they are a rehearsal and a guess, never a finding. After it finishes, ask Flashpoint for the rehearsal results with ask_flashpoint. If it fails, carry on without it.",
    input_schema: {
      type: "object",
      properties: {
        audience: { type: "string", description: "Who the personas should be, in two or three sentences." },
        how_many: { type: "number", description: "How many personas, from 5 to 30." },
        why: { type: "string", description: "One sentence on what you want the rehearsal to show." },
        could_change: receipt,
      },
      required: ["audience", "how_many", "why", "could_change"],
      additionalProperties: false,
    },
  },
  {
    name: "seal_predictions",
    description:
      "Before a survey is sent, write down what you expect people to answer, and seal it. The commander is asked for their own guess at the same time; you cannot see it until the envelope is opened. Free. A send is refused until this is done for the round.",
    input_schema: {
      type: "object",
      properties: {
        predictions: {
          type: "array",
          description: "One to three of the survey's main questions.",
          items: {
            type: "object",
            properties: {
              question: { type: "string", description: "The question, worded so the commander can guess at it too." },
              agent_guess: { type: "string", description: "What you expect most people to answer, and one reason." },
              personas_guess: { type: "string", description: "What the AI personas answered in the rehearsal, if there was one. Leave out if there was none." },
            },
            required: ["question", "agent_guess"],
            additionalProperties: false,
          },
        },
        why: { type: "string", description: "One sentence on why these questions are the ones worth betting on." },
      },
      required: ["predictions", "why"],
      additionalProperties: false,
    },
  },
  {
    name: "open_envelope",
    description:
      "After you have read the real results of a round, open that round's sealed envelope. You give what people really said; you get back every sealed guess, the commander's included. Free. What was guessed wrong is where there is something to learn.",
    input_schema: {
      type: "object",
      properties: {
        results: {
          type: "array",
          items: {
            type: "object",
            properties: {
              question: { type: "string" },
              people_said: { type: "string", description: "What the real answers were, with the counts Flashpoint gave." },
            },
            required: ["question", "people_said"],
            additionalProperties: false,
          },
        },
      },
      required: ["results"],
      additionalProperties: false,
    },
  },
  {
    name: "debrief",
    description:
      "Right after opening an envelope, write down what it taught you. Free. A new round and finish are both refused until this is done, because this is where the next step gets decided.",
    input_schema: {
      type: "object",
      properties: {
        who_was_wrong: { type: "string", description: "Who guessed wrong on what, yourself first. Say so plainly." },
        biggest_surprise: { type: "string", description: "The one thing in the real answers that nobody sealed a guess for, or that every guess missed. Say 'none' if there was none." },
        still_unknown: { type: "string", description: "What you would still need to know for the mission's answer to be one the commander can act on." },
        next_move: { type: "string", enum: ["another_round", "finish"] },
        reason: { type: "string", description: "Why that move. For another round: the one thing it will ask about. For finish: why no affordable step could change the answer." },
      },
      required: ["who_was_wrong", "biggest_surprise", "still_unknown", "next_move", "reason"],
      additionalProperties: false,
    },
  },
  {
    name: "ask_commander",
    description:
      "Speak to the commander and wait for their reply. Free. Use it when a standing order says to, or when something only they can know or decide would change what you do next. Do not use it to ask what to do next: that is your job. Do not ask for their guess: seal_predictions does that.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "What to tell or ask the commander, in plain words. Lead with what you found or decided." },
        order: { type: "string", description: "The standing order that brought you here, quoted. Leave out if none did." },
        why: { type: "string", description: "One sentence on what their reply would change." },
      },
      required: ["message", "why"],
      additionalProperties: false,
    },
  },
  {
    name: "wait_for_replies",
    description: "Wait for people to answer a survey that has been sent. Free. Use it after a send and before asking Flashpoint for results.",
    input_schema: {
      type: "object",
      properties: {
        minutes: { type: "number", description: "How long to wait, from 1 to 30." },
        why: { type: "string", description: "One sentence on why this long." },
      },
      required: ["minutes", "why"],
      additionalProperties: false,
    },
  },
  {
    name: "make_deck",
    description:
      "Have Flashpoint make a short slide deck of the findings for the commander to keep. Costs $0.25. Optional, and only worth it at the end, when there are real results to show.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        findings: { type: "string", description: "Everything the deck should show: the mission, the results with counts, the scoreboard, the recommendation and the limits. Say which numbers are from real people and which are synthetic." },
        why: { type: "string" },
        could_change: receipt,
      },
      required: ["title", "findings", "why", "could_change"],
      additionalProperties: false,
    },
  },
  {
    name: "finish",
    description: "End the mission with your answer. Call this once, when you have results, when no further step could change the answer, or when the budget is spent.",
    input_schema: {
      type: "object",
      properties: {
        recommendation: { type: "string", description: "The answer to the mission, in two to four plain sentences." },
        evidence: { type: "string", description: "The real survey results the answer rests on, with the counts. Keep synthetic persona answers out, or label them synthetic." },
        scoreboard: {
          type: "array",
          description: "One row for every sealed question in every round.",
          items: {
            type: "object",
            properties: {
              round: { type: "number" },
              question: { type: "string" },
              people_said: { type: "string" },
              agent: { type: "string", enum: ["right", "partly", "wrong"] },
              personas: { type: "string", enum: ["right", "partly", "wrong", "no guess"] },
              commander: { type: "string", enum: ["right", "partly", "wrong", "no guess"] },
            },
            required: ["round", "question", "people_said", "agent", "personas", "commander"],
            additionalProperties: false,
          },
        },
        learned_between_rounds: { type: "string", description: "What the first envelope got wrong or left open, and what you asked next because of it. Say 'no second round' and why if there was none." },
        limits: { type: "string", description: "What this answer cannot tell the reader, including how few people answered." },
      },
      required: ["recommendation", "evidence", "scoreboard", "learned_between_rounds", "limits"],
      additionalProperties: false,
    },
  },
];

export function systemPrompt({ people, cap, orders = DEFAULT_ORDERS, canRehearse = true, canDeck = true }) {
  const tools = [
    `- ask_flashpoint ($${PRICES.survey.toFixed(2)} a message): Flashpoint's survey agent. In plain words it can make a first-party panel from a list of names and emails, write a survey from a brief, change it, publish it, email it to the panel, report how many have answered, and give results. Publishing and sending each need a second message that says only "confirm"; you send it yourself when the reply asks for it and matches what you intended.`,
    canRehearse ? `- rehearse_on_personas ($${PRICES.rehearsal.toFixed(2)}): runs your draft on AI personas first. It can catch a question that confuses or cuts people off, and it gives the personas a guess of their own for the envelope. It is slow (a few minutes) and can fail; the mission does not depend on it.` : null,
    "- seal_predictions, open_envelope and debrief (free): the sealed envelope, explained below.",
    "- ask_commander (free): the commander is at the desk.",
    "- wait_for_replies (free).",
    canDeck ? `- make_deck ($${PRICES.deck.toFixed(2)}): an optional slide deck at the end.` : null,
    "- finish.",
  ].filter(Boolean).join("\n");

  return `You are a research agent working with a commander. They give you a mission and a few standing orders. You do the research yourself through Flashpoint, a research platform: you decide what needs asking, have surveys made and sent to real people, read what comes back, decide what to ask next, and return an answer. The commander is your partner, not your supervisor. They know the club and the people; you do the legwork and make the research calls.

Your tools
${tools}

The commander's standing orders
${orders.map((order) => `- ${order}`).join("\n")}
These are rules, not steps. Between them, every decision is yours: do not ask the commander what to do next. When an order applies, go to them with ask_commander, quote the order, say what you found or decided, and ask only what you need. One order is also enforced by the system: before the first email of each survey goes out, the commander is shown the survey and must approve it. That screen is the check for the order about emails, so do not also ask permission to send with ask_commander. If they refuse, their reason comes back to you.

The sealed envelope
Before each survey is sent, call seal_predictions with what you expect people to answer on its main questions. If you rehearsed on personas, put their answers in as the personas' guess. The commander seals a guess too, and you cannot see it. After the real results are in, call open_envelope, then debrief: who was wrong (yourself first), what surprised everyone, what is still unknown, and your next move. A wrong guess or a surprise is the most useful thing a round can give you. It marks what nobody understood yet, and that is what the next round should ask about. Often the surprise is that the thing you asked about is not what decides the matter; then the next round asks about the thing that does.

The people
There are ${people} people on the list. They have agreed to be surveyed. You never see their addresses: write {{RECIPIENTS}} in a message to Flashpoint and the list is put in for you. Survey only these people. Emailing them cannot be undone, so have Flashpoint draft first (tell it "do not publish or send yet"), and read the survey it wrote before you ask to send it. The commander approves from the last full list of questions Flashpoint showed, so if you change the survey, ask Flashpoint to show the full survey again.

Budget and receipts
You have $${cap.toFixed(2)}. Every tool result tells you what is left. Each paid step needs a receipt: the decision of yours that it could change. If you cannot name one, the step is not worth its price, so skip it. Keep enough budget to read the results of anything you send. The budget is there to be used on steps that could change the answer: finishing with an open question you could have afforded to ask is a worse result than spending the money. Stop when no step you can afford could change your answer, and say that is why you stopped; what is left then goes back to the commander.

How to do good research here
First work out what you would need to know to answer the mission, and what the commander may already know (it is free to ask them once, early, if local knowledge would change the survey). Keep each survey short, since the same few people answer every round. Avoid screening and skip rules: they are what breaks a survey. You can email these people only a few times, so a question that turns out confusing wastes a round; a rehearsal on personas is the cheap way to find that out first. One round rarely settles a mission: expect to run a second. It should be shorter than the first and ask only about what the first envelope got wrong or left open; never repeat a first-round question. A few people can still tell you why, even when they are too few to count. If nobody has answered yet, wait and check again rather than guessing.

Honesty
Report only what Flashpoint returned. Never fill in a number you did not get. Persona answers are synthetic: use them to fix the survey and to place a guess, and never count them as evidence. With this few people the answer is a direction, not a measurement, and your limits must say so.

Before each tool call, say in a sentence or two what you are deciding and why. Those notes are kept as the mission log.`;
}

// Emails never go to the model or into the log.
export function makeRedactor(recipients) {
  const known = recipients.map((r) => r.email).filter(Boolean);
  return (text) => {
    let out = String(text ?? "");
    known.forEach((email, i) => { out = out.split(email).join(`[recipient ${i + 1}]`); });
    return out.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]");
  };
}

export function recipientLines(recipients) {
  return recipients.map((r) => `${r.name} <${r.email}>`).join("\n");
}

// The fingerprint of an envelope. Anyone can recompute it from the envelope file.
export function envelopeHash(envelope) {
  return createHash("sha256").update(JSON.stringify(envelope)).digest("hex");
}

// Numbers in the answer that appear in nothing the agent was given.
export function unbackedNumbers(text, sources) {
  const seen = new Set(sources.join(" ").match(/\d+(?:\.\d+)?/g) ?? []);
  const found = String(text).match(/\d+(?:\.\d+)?/g) ?? [];
  return [...new Set(found.filter((number) => !seen.has(number)))];
}

const saysYes = (text) => /^\W*(y|yes|yep|yeah|ok|okay|approve|approved|go|go ahead|send|send it|do it)\b/i.test(String(text ?? ""));
const listsQuestions = (text) => text.length > 200 && (text.match(/\?/g) ?? []).length >= 2;
const isConfirm = (text) => /^\W*confirm\W*$/i.test(text);
// True when a message tells Flashpoint to email people now. "Names and emails" and
// "do not send yet" do not count.
export function asksToSend(message) {
  const text = String(message).replace(/\b(do not|don't|not|never|without|before|until)\s+(yet\s+)?(publish(ing)?\s+(or|and)\s+)?(send|e-?mail|distribut|invit)\w*/gi, "");
  return /\b(send|sending|distribute|distributing|invite)\b/i.test(text) || /\be-?mail\s+(it|this|them|everyone|the survey|the panel|to|out)\b/i.test(text);
}

// Runs the mission to the end. Returns { answer, spent, steps }.
//   llm({ system, tools, messages })   -> { content, stop_reason }
//   flashpoint                         -> { survey({ message, newSurvey }), rehearse?({ audience, howMany, objective }), deck?({ title, findings }) }
//                                         each returns { text, receipts? } and throws if it failed. A failure is not
//                                         charged unless the error has charged === true. A bare function is taken as survey.
//   commander({ kind, ... })           -> the commander's typed reply. Kinds: "ask", "approve_send", "guess".
//                                         Leave it out and nobody is at the desk: questions go unanswered and no email is sent.
//   wait(minutes)                      -> resolves when the wait is over, with anything the commander typed meanwhile
//   record(step)                       -> called for every step, already redacted
export async function runAgent({ objective, recipients, cap, orders = DEFAULT_ORDERS, llm, flashpoint, commander = null, wait, record = () => {} }) {
  const fp = typeof flashpoint === "function" ? { survey: flashpoint } : flashpoint;
  const redact = makeRedactor(recipients);
  const tools = TOOLS.filter((tool) => (tool.name !== "rehearse_on_personas" || fp.rehearse) && (tool.name !== "make_deck" || fp.deck));
  const system = systemPrompt({ people: recipients.length, cap, orders, canRehearse: Boolean(fp.rehearse), canDeck: Boolean(fp.deck) });
  const messages = [{ role: "user", content: `Mission from the commander: ${redact(objective)}` }];
  const steps = [];
  const given = [objective]; // everything the agent was told, for the number check
  let spent = 0;
  let answer = null;
  let nudges = 0;

  // The state of the current round's survey.
  let round = 1;
  let started = false; // a Flashpoint step has happened in this round
  let draft = ""; // the latest reply in which Flashpoint showed the survey's questions
  let changes = []; // what Flashpoint said it changed since then
  let lastReply = "";
  let approved = false; // the commander approved emailing this survey
  let sent = false;
  let readAfterSend = false;
  let envelope = null; // { hash, content }
  let opened = false;
  let debriefed = false;
  const owesDebrief = () => opened && !debriefed;
  const DEBRIEF_FIRST = "Not yet: you opened an envelope and have not debriefed it. Call debrief first.";

  const note = (step) => {
    const kept = { n: steps.length + 1, at: new Date().toISOString(), ...step };
    steps.push(kept);
    record(kept);
  };
  const left = () => `Budget left: $${(cap - spent).toFixed(2)} of $${cap.toFixed(2)}.`;
  const overBudget = (price) => spent + price > cap + 1e-9;
  const hear = async (request) => redact((await commander(request)) ?? "").trim();

  // The one order the code enforces itself: no email without a sealed envelope and the commander's yes.
  async function sendGate(input) {
    if (approved) return null;
    if (!envelope) return "Not sent: this message would email people, and the round's envelope is not sealed yet. Seal your predictions first, with seal_predictions. If you did not mean to email anyone, reword the message and say 'do not send yet'. Nothing was charged.";
    if (!commander) {
      note({ kind: "send-refused", round, reason: "Nobody was at the desk to approve the send." });
      return "Not sent: nobody is at the desk to approve the send, so no email can go out. Nothing was charged. Call finish with what you have.";
    }
    const reply = await hear({ kind: "approve_send", round, people: recipients.length, survey: draft, changes, why: redact(input.why) });
    given.push(reply);
    if (!saysYes(reply)) {
      note({ kind: "send-refused", round, reason: reply || "(no reason given)" });
      return `Not sent: the commander did not approve this send. They said: "${reply || "no"}". Nothing was charged. Change the survey or talk to them, then try again.`;
    }
    approved = true;
    note({ kind: "send-approved", round, reply });
    return null;
  }

  async function askFlashpoint(input) {
    if (typeof input.message !== "string" || input.message.trim() === "") return { text: "No message was given. Nothing was sent.", failed: true };
    if (overBudget(PRICES.survey)) {
      note({ kind: "blocked", tool: "ask_flashpoint", why: input.why });
      return { text: `Not sent: this would go over the budget. ${left()} Call finish with what you have.`, failed: true };
    }
    const newSurvey = input.new_survey === true;
    if (newSurvey && owesDebrief()) return { text: DEBRIEF_FIRST, failed: true };
    if (newSurvey && started) {
      round += 1;
      started = false; draft = ""; changes = []; lastReply = ""; approved = false; sent = false; readAfterSend = false; envelope = null; opened = false; debriefed = false;
    }
    // A bare "confirm" does whatever Flashpoint last offered. Unless that was plainly
    // publishing and nothing else, treat it as a send, whatever the model called it.
    const onlyPublishes = /publish/i.test(lastReply) && !/\b(send|sent|sending|e-?mail|invit|distribut)/i.test(lastReply);
    const sending = input.action === "send" || asksToSend(input.message) || (isConfirm(input.message) && !onlyPublishes);
    if (sending) {
      const refusal = await sendGate(input);
      if (refusal) return { text: `${refusal}\n\n${left()}`, failed: true };
    }
    const message = input.message.split("{{RECIPIENTS}}").join(recipientLines(recipients));
    try {
      const reply = await fp.survey({ message, newSurvey });
      spent += PRICES.survey;
      started = true;
      const text = redact(reply.text);
      given.push(text);
      lastReply = text;
      if (!sending && input.action !== "results") {
        if (draft === "" || listsQuestions(text)) { draft = text; changes = []; }
        else if (input.action === "design" && !/\breply\b.*\bconfirm\b/i.test(text.slice(-200)) ) changes.push(text);
      }
      if (sending) sent = true;
      else if (sent) readAfterSend = true;
      note({ kind: "flashpoint", round, action: input.action ?? "other", why: input.why, couldChange: input.could_change ?? "", message: redact(message), reply: text, receipts: reply.receipts ?? [], price: PRICES.survey, spent });
      return { text: `${text}\n\n${left()}` };
    } catch (err) {
      const text = redact(err?.message ?? err);
      note({ kind: "flashpoint-failed", round, why: input.why, message: redact(message), error: text });
      return { text: `Flashpoint did not complete this step, and it was not charged: ${text}\n\n${left()}`, failed: true };
    }
  }

  // The rehearsal and the deck are extras. If one fails the mission carries on.
  async function paidExtra({ kind, tool, price, input, run, unavailable }) {
    if (!run) return { text: unavailable, failed: true };
    if (overBudget(price)) {
      note({ kind: "blocked", tool, why: input.why });
      return { text: `Not run: this would go over the budget. ${left()}`, failed: true };
    }
    try {
      const reply = await run();
      spent += price;
      const text = redact(reply.text);
      given.push(text);
      note({ kind, round, why: input.why, couldChange: input.could_change ?? "", reply: text, receipts: reply.receipts ?? [], price, spent, ...(reply.file ? { file: reply.file } : {}) });
      return { text: `${text}\n\n${left()}` };
    } catch (err) {
      if (err?.charged === true) spent += price;
      const text = redact(err?.message ?? err);
      note({ kind: `${kind}-failed`, round, why: input.why, error: text, charged: err?.charged === true, spent });
      return { text: `This did not work${err?.charged === true ? " (it was charged)" : ", and it was not charged"}: ${text}\nCarry on without it.\n\n${left()}`, failed: true };
    }
  }

  async function sealPredictions(input) {
    const list = Array.isArray(input.predictions) ? input.predictions.filter((p) => p && p.question && p.agent_guess).slice(0, 3) : [];
    if (list.length === 0) return { text: "Nothing to seal: give at least one question with your guess.", failed: true };
    if (sent) return { text: "Too late: this round's survey has already been sent, so a guess now would not be a prediction.", failed: true };
    const predictions = [];
    for (const item of list) {
      const question = redact(item.question);
      const guess = commander ? await hear({ kind: "guess", round, question, number: predictions.length + 1, of: list.length }) : "";
      predictions.push({ question, agent: redact(item.agent_guess), personas: item.personas_guess ? redact(item.personas_guess) : null, commander: guess === "" ? null : guess });
    }
    const content = { round, sealed_at: new Date().toISOString(), predictions };
    envelope = { hash: envelopeHash(content), content };
    opened = false;
    debriefed = false;
    const fromCommander = predictions.filter((p) => p.commander !== null).length;
    note({ kind: "sealed", round, why: input.why, hash: envelope.hash, envelope: content });
    return { text: `Sealed the round ${round} envelope with ${predictions.length} question${predictions.length === 1 ? "" : "s"}. SHA-256 ${envelope.hash}. The commander sealed a guess on ${fromCommander} of them; you cannot see it until you open the envelope.` };
  }

  function openEnvelope(input) {
    if (!envelope) return { text: "There is no sealed envelope for this round.", failed: true };
    if (!sent || !readAfterSend) return { text: "Not yet: the envelope opens after this round's survey has been sent and you have read its results from Flashpoint.", failed: true };
    const results = Array.isArray(input.results) ? input.results : [];
    const intact = envelopeHash(envelope.content) === envelope.hash;
    const rows = envelope.content.predictions.map((p, i) => {
      const match = results.find((r) => r && r.question === p.question) ?? results[i];
      return { question: p.question, people_said: redact(match?.people_said ?? "(not given)"), agent: p.agent, personas: p.personas, commander: p.commander };
    });
    for (const row of rows) given.push(row.commander ?? "");
    opened = true;
    note({ kind: "opened", round, hash: envelope.hash, intact, rows });
    const lines = rows.map((row, i) => `Question ${i + 1}: ${row.question}\n  People said: ${row.people_said}\n  You guessed: ${row.agent}\n  Personas guessed (synthetic): ${row.personas ?? "no guess"}\n  Commander guessed: ${row.commander ?? "no guess"}`);
    return { text: `The round ${round} envelope is open${intact ? " and its hash matches" : ", BUT ITS HASH DOES NOT MATCH"}.\n\n${lines.join("\n\n")}\n\nNow call debrief: say plainly who was wrong, what surprised everyone, what is still unknown, and your next move. Mind the standing orders.` };
  }

  async function useTool(name, input) {
    if (name === "ask_flashpoint") return askFlashpoint(input);
    if (name === "rehearse_on_personas") {
      if (draft === "") return { text: "There is no drafted survey to rehearse yet. Have Flashpoint write one first.", failed: true };
      const howMany = Math.min(30, Math.max(5, Math.round(Number(input.how_many) || 10)));
      return paidExtra({
        kind: "rehearsal", tool: name, price: PRICES.rehearsal, input,
        run: fp.rehearse && (() => fp.rehearse({ audience: String(input.audience ?? ""), howMany, objective })),
        unavailable: "Persona rehearsals are not available in this run. Carry on without one.",
      });
    }
    if (name === "make_deck") {
      return paidExtra({
        kind: "deck", tool: name, price: PRICES.deck, input,
        run: fp.deck && (() => fp.deck({ title: redact(input.title), findings: redact(input.findings) })),
        unavailable: "Decks are not available in this run.",
      });
    }
    if (name === "seal_predictions") return sealPredictions(input);
    if (name === "open_envelope") return openEnvelope(input);
    if (name === "debrief") {
      if (!opened) return { text: "There is no opened envelope to debrief.", failed: true };
      debriefed = true;
      const move = input.next_move === "another_round" ? "another_round" : "finish";
      note({ kind: "debrief", round, whoWasWrong: redact(input.who_was_wrong), surprise: redact(input.biggest_surprise), stillUnknown: redact(input.still_unknown), nextMove: move, reason: redact(input.reason) });
      return { text: `Debrief recorded. ${move === "another_round" ? "Start the next round with new_survey: true when you are ready." : "Call finish when you are ready."} Mind the standing orders. ${left()}` };
    }
    if (name === "ask_commander") {
      const message = redact(input.message);
      if (!commander) {
        note({ kind: "commander", order: input.order ?? null, message, reply: null });
        return { text: "Nobody is at the desk. Use your own judgment and carry on." };
      }
      const reply = await hear({ kind: "ask", message, order: input.order ?? null });
      given.push(reply);
      note({ kind: "commander", order: input.order ? redact(input.order) : null, why: input.why, message, reply });
      return { text: `The commander replied: "${reply === "" ? "(nothing; carry on with your own judgment)" : reply}"` };
    }
    if (name === "wait_for_replies") {
      const minutes = Math.min(30, Math.max(1, Number(input.minutes) || 1));
      const typed = redact((await wait(minutes)) ?? "").trim();
      if (typed !== "") given.push(typed);
      note({ kind: "wait", why: input.why, minutes, ...(typed !== "" ? { said: typed } : {}) });
      return { text: `Waited.${typed !== "" ? ` While you waited, the commander said: "${typed}"` : ""} ${left()}` };
    }
    if (name === "finish") {
      if (owesDebrief()) return { text: DEBRIEF_FIRST, failed: true };
      answer = {
        recommendation: redact(input.recommendation),
        evidence: redact(input.evidence),
        scoreboard: (Array.isArray(input.scoreboard) ? input.scoreboard : []).map((row) => ({ ...row, question: redact(row.question), people_said: redact(row.people_said) })),
        learned_between_rounds: redact(input.learned_between_rounds),
        limits: redact(input.limits),
      };
      const unbacked = unbackedNumbers(`${answer.recommendation} ${answer.evidence}`, given);
      note({ kind: "finish", ...answer, unbacked, spent, handedBack: Math.max(0, cap - spent) });
      return { text: "Done." };
    }
    return { text: `There is no tool called ${name}.`, failed: true };
  }

  for (let turn = 0; turn < MAX_TURNS && answer === null; turn++) {
    const response = await llm({ system, tools, messages });
    if (response.stop_reason === "refusal") throw new Error("The model declined to continue.");
    messages.push({ role: "assistant", content: response.content });

    for (const block of response.content) {
      if (block.type === "text" && block.text.trim() !== "") note({ kind: "thinking", text: redact(block.text.trim()) });
    }

    const calls = response.content.filter((block) => block.type === "tool_use");
    if (calls.length === 0) {
      nudges += 1;
      if (nudges > 2) break;
      messages.push({ role: "user", content: `Nothing happens until you use a tool. To speak to the commander use ask_commander; to end the mission call finish. ${left()}` });
      continue;
    }

    // One at a time and in order: these steps depend on each other and cost money.
    const results = [];
    for (const call of calls) {
      const skip = answer !== null;
      const result = skip ? { text: "Skipped: the mission had already finished.", failed: true } : await useTool(call.name, call.input ?? {});
      results.push({ type: "tool_result", tool_use_id: call.id, content: result.text, ...(result.failed ? { is_error: true } : {}) });
    }
    messages.push({ role: "user", content: results });
  }

  return { answer, spent, steps };
}
