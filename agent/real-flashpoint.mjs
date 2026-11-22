// The real Flashpoint, as the agent uses it: the survey agent, a persona
// rehearsal and a slide deck, each one paid call over MCP.
//
// The MCP client is passed in, so the tests can feed this file the replies the
// real service has given before, without a wallet or a network.
//
//   connect()                     -> a signed-in handle (free)
//   callTool(handle, name, args)  -> the tool's reply. It pays through handle.paidFetch
//                                    and prints the receipt link with console.error.
//   keepRaw(tool, reply)          -> called with every raw reply
//   saveFile(name, bytes)         -> saves a file into the run folder
//   label                         -> a short name for this run, used to name the persona panel

const findKey = (value, key) => {
  if (value === null || typeof value !== "object") return undefined;
  if (typeof value[key] === "string" && value[key] !== "") return value[key];
  for (const child of Object.values(value)) {
    const found = findKey(child, key);
    if (found) return found;
  }
  return undefined;
};

// The first object anywhere in a value that has the given key.
const findWith = (value, key) => {
  if (value === null || typeof value !== "object") return null;
  if (key in value) return value;
  for (const child of Object.values(value)) {
    const found = findWith(child, key);
    if (found) return found;
  }
  return null;
};

const failure = (message, charged) => Object.assign(new Error(message), { charged });
const errorText = (error) => (typeof error === "string" ? error : JSON.stringify(error));
const short = (value) => (typeof value === "string" ? value : JSON.stringify(value) ?? "").slice(0, 400);

export function realFlashpoint({ connect, callTool, keepRaw = () => {}, saveFile = () => {}, label = "run", sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), pollEveryMs = 30000, maxPolls = 16 }) {
  let ids = {};

  // One paid call. The client prints the payment receipt with console.error; keep it.
  // A receipt means the call was paid for, whatever happened afterwards.
  async function paid(tool, args) {
    const receipts = [];
    const printError = console.error;
    console.error = (...parts) => { receipts.push(parts.join(" ")); };
    try {
      // A session lasts an hour and a run can last longer, so sign in each time. Signing in is free.
      const result = await callTool(await connect(), tool, args);
      keepRaw(tool, { sent: args, result, receipts });
      return { result, receipts };
    } catch (err) {
      err.charged = receipts.length > 0;
      throw err;
    } finally {
      console.error = printError;
    }
  }

  async function survey({ message, newSurvey }) {
    if (newSurvey) ids = {};
    const { result, receipts } = await paid("tool_survey", { brief: message, ...ids });
    const charged = receipts.length > 0;
    if (result?.error) throw failure(errorText(result.error), charged);
    const inner = result?.result ?? {};
    // A reply with no text is not a survey step that worked, whatever else it holds.
    if (typeof inner.final_text !== "string" || inner.final_text.trim() === "") throw failure(`Flashpoint's reply had no text: ${short(result)}`, charged);
    const conversation_id = inner.conversation_id ?? result.conversation_id ?? ids.conversation_id;
    const survey_id = inner.survey_id ?? ids.survey_id;
    ids = { ...(conversation_id ? { conversation_id } : {}), ...(survey_id ? { survey_id } : {}) };
    return { text: inner.final_text, receipts };
  }

  // Makes a small panel of AI personas and runs them through the current survey.
  async function rehearse({ audience, howMany, objective }) {
    if (!ids.survey_id) throw failure("Flashpoint has not given this survey an id yet, so there is nothing to rehearse.", false);
    const { result, receipts } = await paid("panel", {
      action: "create_and_run",
      name: `Rehearsal ${label}`,
      num_respondents: howMany,
      research_objective: `A rehearsal with AI personas before a short survey goes to real people. The survey is for this mission: ${objective}. The personas' answers are synthetic and will be labelled so.`,
      context: audience,
      survey_id: ids.survey_id,
    });
    const charged = receipts.length > 0;
    if (result?.error) throw failure(errorText(result.error), charged);
    let summary = findWith(result, "status_breakdown");
    const job_id = findKey(result, "job_id");
    if (!summary && !job_id) throw failure(`Flashpoint started no persona run: ${short(result)}`, charged);
    // A run either comes back finished or as a job. Asking about a job is free:
    // a plain fetch stands in for the paying one, so it could not pay if asked.
    for (let polls = 0; !summary && polls < maxPolls; polls++) {
      await sleep(pollEveryMs);
      let status;
      try {
        const handle = await connect();
        status = await callTool({ ...handle, paidFetch: fetch }, "panel", { action: "status", job_id });
      } catch (err) {
        // The run was paid for when it started, whatever happens while asking about it.
        throw failure(`Could not check on the persona run: ${err?.message ?? err}`, true);
      }
      keepRaw("panel-status", { result: status });
      const state = findKey(status, "status");
      summary = findWith(status, "status_breakdown");
      if (!summary && ["failed", "interrupted"].includes(state)) throw failure(`The persona run ${state}.`, true);
    }
    if (!summary) throw failure(`The persona run did not finish in ${Math.round((maxPolls * pollEveryMs) / 60000)} minutes.`, true);

    const ended = summary.status_breakdown ?? {};
    const scope = summary.analytics_scope ?? {};
    const cutOff = ended.TERMINATED ?? 0;
    const lines = [
      `SYNTHETIC rehearsal: ${summary.responses_submitted} of ${summary.total_personas} AI personas responded. These are AI personas, not people.`,
      `How their responses ended: ${JSON.stringify(ended)}.`,
      cutOff > 0 ? `${cutOff} were cut off before the end, which usually means a screening or skip rule in the survey stops people early.` : "None was cut off.",
      summary.warning ? `Flashpoint warns: ${summary.warning}` : "",
      scope.panel_id ? `To read these answers, ask the survey agent for the results of this survey scoped to panel_id=${scope.panel_id}${scope.run_id ? ` and run_id=${scope.run_id}` : ""}, and say they are a synthetic rehearsal.` : (summary.analytics_note ?? ""),
    ];
    return { text: lines.filter(Boolean).join("\n"), receipts };
  }

  async function deck({ title, findings }) {
    const { result, receipts } = await paid("presentation", { title, data_context: findings, max_slides: 6 });
    const charged = receipts.length > 0;
    if (result?.error) throw failure(errorText(result.error), charged);
    const base64 = findKey(result, "pptx_base64");
    const url = findKey(result, "download_url");
    if (base64) {
      saveFile("deck.pptx", Buffer.from(base64, "base64"));
      return { text: "The deck was made and saved as deck.pptx in the run folder.", receipts, file: "deck.pptx" };
    }
    if (url) return { text: `The deck was made: ${url}`, receipts };
    throw failure(`Flashpoint returned no deck: ${short(result)}`, charged);
  }

  // Which conversation and survey the agent is in the middle of, so a stopped run can carry on.
  const state = () => ({ ...ids });
  const restore = (saved) => { ids = { ...(saved ?? {}) }; };

  return { survey, rehearse, deck, state, restore };
}
