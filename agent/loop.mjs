// The agent loop. It is given one objective and three tools, and it decides
// every step itself: what to ask, when to send, how long to wait, what to ask
// next, and when it has an answer.
//
// Nothing here talks to the network. The model, Flashpoint and the clock are
// passed in, so the tests can run the whole loop with stand-ins.

export const STEP_PRICE = 0.5; // what one Flashpoint survey-agent step costs, in USDC
const MAX_TURNS = 40;

export const TOOLS = [
  {
    name: "ask_flashpoint",
    description:
      "Send one message to the Flashpoint survey agent and get its reply. This is the only way to make a panel, write a survey, publish it, email it, read results or export them. Each call that works costs $0.50 from the budget. Flashpoint remembers the conversation, so later messages can say 'the survey' or 'confirm'. Put several requests in one message when you can, because each message is one paid step.",
    input_schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "What to tell the Flashpoint survey agent, in plain words. Write {{RECIPIENTS}} where the list of people to survey should go." },
        why: { type: "string", description: "One sentence: why this step, and what you expect back." },
        new_survey: { type: "boolean", description: "True to start a fresh conversation and a new survey, for example for a follow-up round." },
      },
      required: ["message", "why"],
      additionalProperties: false,
    },
  },
  {
    name: "wait_for_replies",
    description:
      "Wait for people to answer a survey that has been sent. Costs nothing. Use it after a send and before asking Flashpoint for results.",
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
    name: "finish",
    description: "End the run with your answer to the objective. Call this once, when you have results or the budget is spent.",
    input_schema: {
      type: "object",
      properties: {
        recommendation: { type: "string", description: "The answer to the objective, in two to four plain sentences." },
        evidence: { type: "string", description: "The survey results the answer rests on, with the counts." },
        learned_between_rounds: { type: "string", description: "What round one showed, and what you asked in the follow-up round because of it. Say 'no follow-up round' if there was none." },
        limits: { type: "string", description: "What this answer cannot tell the reader, including how few people answered." },
      },
      required: ["recommendation", "evidence", "learned_between_rounds", "limits"],
      additionalProperties: false,
    },
  },
];

export function systemPrompt({ people, cap }) {
  return `You are a research agent. A person gives you one objective, and you work it out by surveying real people through Flashpoint. Nobody will direct your steps. You decide what to ask, send it, read what comes back, decide what to ask next, and return an answer.

How Flashpoint works
You talk to Flashpoint's survey agent in plain words with the ask_flashpoint tool. It can make a first-party panel from a list of names and emails, write a survey from a brief, publish it, email it to the panel, report how many have answered, give results overall and by group, pull themes from open answers, and export. Publishing and sending each need a second message that says only "confirm"; you send that yourself when the reply asks for it and the reply matches what you intended. Sending emails real people and cannot be undone, so read the survey Flashpoint wrote before you confirm a send.

The people
There are ${people} people on the list. They have agreed to be surveyed. You never see their addresses: write {{RECIPIENTS}} in a message and the list is put in for you. Survey only these people.

Budget
You have $${cap.toFixed(2)}. Each ask_flashpoint call that works costs $${STEP_PRICE.toFixed(2)}. Every tool result tells you what is left. Keep enough to read the results of anything you send. When the budget is nearly gone, call finish with what you have.

How to do good research here
First decide what you would need to know to answer the objective, and what you could not answer without asking. Keep each survey short, since the same few people answer every round. After the first round, look at what the answers leave open, surprising or split, and run a second, shorter round that asks about exactly that. Do not repeat first-round questions. If nobody has answered yet, wait and check again rather than guessing.

Honesty
Report only what Flashpoint returned. Never fill in a number you did not get. With this few people the answer is a direction, not a measurement, and your limits should say so.

Before each tool call, say in a sentence or two what you are deciding and why. Those notes are kept as the run log.`;
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

// Runs the loop to the end. Returns { answer, spent, steps }.
//   llm({ system, tools, messages })        -> { content, stop_reason }
//   flashpoint({ message, newSurvey })      -> { text }   (throws if it failed; a failure is not charged)
//   wait(minutes)                           -> resolves when the wait is over
//   record(step)                            -> called for every step, already redacted
export async function runAgent({ objective, recipients, cap, llm, flashpoint, wait, record = () => {} }) {
  const redact = makeRedactor(recipients);
  const system = systemPrompt({ people: recipients.length, cap });
  const messages = [{ role: "user", content: `Objective: ${objective}` }];
  const steps = [];
  let spent = 0;
  let answer = null;
  let nudges = 0;

  const note = (step) => {
    const kept = { n: steps.length + 1, at: new Date().toISOString(), ...step };
    steps.push(kept);
    record(kept);
  };
  const left = () => `Budget left: $${(cap - spent).toFixed(2)} of $${cap.toFixed(2)}.`;

  async function useTool(name, input) {
    if (name === "ask_flashpoint") {
      if (typeof input.message !== "string" || input.message.trim() === "") return { text: "No message was given. Nothing was sent.", failed: true };
      if (spent + STEP_PRICE > cap + 1e-9) {
        note({ kind: "blocked", why: input.why, message: redact(input.message) });
        return { text: `Not sent: this would go over the budget. ${left()} Call finish with what you have.`, failed: true };
      }
      const message = input.message.split("{{RECIPIENTS}}").join(recipientLines(recipients));
      try {
        const reply = await flashpoint({ message, newSurvey: input.new_survey === true });
        spent += STEP_PRICE;
        const text = redact(reply.text);
        note({ kind: "flashpoint", why: input.why, message: redact(message), reply: text, receipts: reply.receipts ?? [], spent });
        return { text: `${text}\n\n${left()}` };
      } catch (err) {
        const text = redact(err?.message ?? err);
        note({ kind: "flashpoint-failed", why: input.why, message: redact(message), error: text });
        return { text: `Flashpoint did not complete this step, and it was not charged: ${text}\n\n${left()}`, failed: true };
      }
    }
    if (name === "wait_for_replies") {
      const minutes = Math.min(30, Math.max(1, Number(input.minutes) || 1));
      note({ kind: "wait", why: input.why, minutes });
      await wait(minutes);
      return { text: `Waited. ${left()}` };
    }
    if (name === "finish") {
      answer = {
        recommendation: redact(input.recommendation),
        evidence: redact(input.evidence),
        learned_between_rounds: redact(input.learned_between_rounds),
        limits: redact(input.limits),
      };
      note({ kind: "finish", ...answer, spent });
      return { text: "Done." };
    }
    return { text: `There is no tool called ${name}.`, failed: true };
  }

  for (let turn = 0; turn < MAX_TURNS && answer === null; turn++) {
    const response = await llm({ system, tools: TOOLS, messages });
    if (response.stop_reason === "refusal") throw new Error("The model declined to continue.");
    messages.push({ role: "assistant", content: response.content });

    for (const block of response.content) {
      if (block.type === "text" && block.text.trim() !== "") note({ kind: "thinking", text: redact(block.text.trim()) });
    }

    const calls = response.content.filter((block) => block.type === "tool_use");
    if (calls.length === 0) {
      nudges += 1;
      if (nudges > 2) break;
      messages.push({ role: "user", content: `Nobody is here to reply. Carry on with a tool, or call finish. ${left()}` });
      continue;
    }

    // One at a time and in order: these steps depend on each other and cost money.
    const results = [];
    for (const call of calls) {
      const skip = answer !== null;
      const result = skip ? { text: "Skipped: the run had already finished.", failed: true } : await useTool(call.name, call.input ?? {});
      results.push({ type: "tool_result", tool_use_id: call.id, content: result.text, ...(result.failed ? { is_error: true } : {}) });
    }
    messages.push({ role: "user", content: results });
  }

  return { answer, spent, steps };
}
