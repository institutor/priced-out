// A free check before a real run: are the keys, the list, the model and Flashpoint
// all ready? It sends no email and spends no Flashpoint credit.
//
//   node agent/check.mjs [--cap 8] [--recipients file] [--orders file]
//
// It never prints a key or an address.

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { PRICES } from "./loop.mjs";

// What is wrong with a recipient list, if anything. Says which line, never what is on it.
export function listProblems(text) {
  const problems = [];
  const seen = new Set();
  let people = 0;
  text.split("\n").forEach((line, i) => {
    if (line.trim() === "" || line.trim().startsWith("#")) return;
    const parts = line.split(",").map((part) => part.trim());
    const [name, email] = parts;
    if (parts.length !== 2 || !name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email ?? "")) {
      problems.push(`Line ${i + 1} is not "Name, email".`);
      return;
    }
    if (seen.has(email.toLowerCase())) problems.push(`Line ${i + 1} repeats an address from an earlier line.`);
    seen.add(email.toLowerCase());
    people += 1;
  });
  if (people === 0 && problems.length === 0) problems.push("The list is empty.");
  return { people, problems };
}

// What a budget cap pays for. A round is a survey written, published, sent and read.
// A real round is about seven messages: write the survey, publish it (the
// real Flashpoint asks for a confirm or two on the way), email it, confirm,
// and read the results.
export const REAL_ROUND = 7 * PRICES.survey;

export function whatCapBuys(cap) {
  const round = REAL_ROUND;
  return { rounds: Math.floor(cap / round), withRehearsal: Math.floor((cap - PRICES.rehearsal - PRICES.survey) / round) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const root = new URL("../", import.meta.url);
  const argv = process.argv.slice(2);
  const flag = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined);
  const cap = Number(flag("--cap") ?? 9);
  const recipientsFile = flag("--recipients") ?? new URL("agent/recipients.txt", root);
  const ordersFile = flag("--orders") ?? new URL("agent/orders.md", root);

  let failed = 0;
  const ok = (text) => console.log(`  ok    ${text}`);
  const warn = (text) => console.log(`  note  ${text}`);
  const bad = (text) => { failed += 1; console.log(`  FIX   ${text}`); };

  const envFile = new URL(".env", root);
  const env = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : "";
  const has = (name, shape) => Boolean(process.env[name]) || new RegExp(`^${name}=${shape}$`, "m").test(env);

  console.log("Checking that a real run is ready. Nothing is sent and no Flashpoint credit is spent.\n");

  console.log("Keys");
  const walletKey = has("FLASHPOINT_WALLET_KEY", "0x[0-9a-fA-F]{64}");
  const modelKey = has("ANTHROPIC_API_KEY", "\\S+");
  if (walletKey) ok("The wallet key is set."); else bad("FLASHPOINT_WALLET_KEY is missing from .env, or is not a 0x key of 64 hex digits.");
  if (modelKey) ok("The model key is set."); else bad("ANTHROPIC_API_KEY is missing from .env.");

  console.log("\nPeople to survey");
  if (!fs.existsSync(recipientsFile)) {
    bad("No recipient list. Copy agent/recipients.example.txt to agent/recipients.txt and put in people who agreed to be surveyed.");
  } else {
    const { people, problems } = listProblems(fs.readFileSync(recipientsFile, "utf8"));
    for (const problem of problems) bad(problem);
    if (problems.length === 0) ok(`${people} ${people === 1 ? "person" : "people"} on the list.`);
    if (people > 0 && people < 3) warn("With fewer than 3 people, a split answer tells the agent very little.");
  }

  console.log("\nStanding orders");
  if (fs.existsSync(ordersFile)) {
    const orders = fs.readFileSync(ordersFile, "utf8").split("\n").filter((line) => line.startsWith("- "));
    if (orders.length > 0) ok(`${orders.length} order${orders.length === 1 ? "" : "s"} will be given to the agent.`);
    else warn('No line in the orders file starts with "- ", so the three default orders will be used.');
  } else if (flag("--orders")) bad("The orders file was not found.");
  else warn("No orders file, so the three default orders will be used.");

  console.log("\nThe model");
  if (!modelKey) bad("Not checked: there is no model key.");
  else {
    try {
      const { default: Anthropic } = await import("@anthropic-ai/sdk");
      const key = process.env.ANTHROPIC_API_KEY ?? env.match(/^ANTHROPIC_API_KEY=(.+)$/m)[1].trim();
      const model = process.env.AGENT_MODEL ?? "claude-sonnet-5-5";
      const reply = await new Anthropic({ apiKey: key }).messages.create({ model, max_tokens: 16, messages: [{ role: "user", content: "Reply with the word ready." }] });
      if (reply.content.some((block) => block.type === "text")) ok(`${model} answered.`);
      else bad(`${model} gave no text.`);
    } catch (err) {
      bad(`The model could not be reached: ${String(err?.message ?? err).slice(0, 200)}`);
    }
  }

  console.log("\nFlashpoint");
  if (!walletKey) bad("Not checked: there is no wallet key.");
  else {
    try {
      const { connect, listTools, balance } = await import("../flashpoint.mjs");
      const tools = (await listTools(await connect())).map((tool) => tool.name);
      ok("Signed in.");
      for (const [name, use] of [["tool_survey", "writing, sending and reading surveys"], ["panel", "the persona rehearsal"], ["presentation", "the slide deck"]]) {
        if (tools.includes(name)) ok(`The ${name} tool is there (${use}).`);
        else if (name === "tool_survey") bad("The tool_survey tool is missing, so no survey can be made.");
        else warn(`The ${name} tool is missing, so the agent goes without ${use}.`);
      }
      const usdc = await balance();
      const buys = whatCapBuys(Math.min(cap, usdc));
      if (usdc < PRICES.survey) bad(`The wallet holds ${usdc} USDC, which is less than one step.`);
      else if (usdc < cap) warn(`The wallet holds ${usdc} USDC, which is less than the $${cap.toFixed(2)} cap. The run would stop when the wallet is empty.`);
      else ok(`The wallet holds ${usdc} USDC. This run may spend up to $${cap.toFixed(2)} of it.`);
      if (buys.rounds < 1) warn(`That is not enough for one full round (write, publish, send, read: about $${REAL_ROUND.toFixed(2)}).`);
      else ok(`That is enough for about ${buys.rounds} round${buys.rounds === 1 ? "" : "s"}${buys.withRehearsal >= 1 ? `, or ${buys.withRehearsal} with a persona rehearsal` : ""}. A round is about $${REAL_ROUND.toFixed(2)}, and a follow-up round needs the same again.`);
    } catch (err) {
      bad(`Flashpoint could not be reached: ${String(err?.message ?? err).slice(0, 200)}`);
    }
  }

  console.log("\nThe keyboard");
  if (process.stdin.isTTY) ok("You are at a terminal, so you can approve sends.");
  else warn("This is not a terminal. A real run must be started in one, because no email goes out without your yes.");

  console.log(failed === 0 ? "\nReady. Nothing was sent and no Flashpoint credit was spent." : `\n${failed} thing${failed === 1 ? "" : "s"} to fix first. Nothing was sent and no Flashpoint credit was spent.`);
  process.exit(failed === 0 ? 0 : 1);
}
