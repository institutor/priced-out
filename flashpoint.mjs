// Flashpoint MCP starter: wallet + paid tool calls over x402 (USDC on Base).
//   node flashpoint.mjs wallet                 create your wallet (once) and show its address
//   node flashpoint.mjs balance                show your USDC balance
//   node flashpoint.mjs tools                  list the tools (free)
//   node flashpoint.mjs call <tool> '<json>'   call a tool; pays automatically
// In your own code: import { connect, callTool } from "./flashpoint.mjs"
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { createPublicClient, http, erc20Abi, formatUnits } from "viem";
import { base } from "viem/chains";
import { Agent, setGlobalDispatcher } from "undici";

const BASE = process.env.FLASHPOINT_MCP_BASE ?? "https://api.flashpoint.ai";
const PV = "2025-06-18";
const USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ENV = new URL("./.env", import.meta.url);

// Panel runs can take 30+ minutes before any response arrives.
setGlobalDispatcher(new Agent({ headersTimeout: 0, bodyTimeout: 0 }));

function loadKey() {
  if (process.env.FLASHPOINT_WALLET_KEY) return process.env.FLASHPOINT_WALLET_KEY;
  if (!fs.existsSync(ENV)) return null;
  const m = fs.readFileSync(ENV, "utf8").match(/^FLASHPOINT_WALLET_KEY=(0x[0-9a-fA-F]{64})$/m);
  return m ? m[1] : null;
}

export function wallet() {
  let key = loadKey();
  if (!key) {
    key = generatePrivateKey();
    fs.appendFileSync(ENV, `FLASHPOINT_WALLET_KEY=${key}\n`, { mode: 0o600 });
  }
  return privateKeyToAccount(key);
}

export async function balance() {
  const client = createPublicClient({ chain: base, transport: http() });
  const raw = await client.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [wallet().address] });
  return Number(formatUnits(raw, 6));
}

const post = (url, body, headers = {}, f = fetch) =>
  f(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

// Sign in with the wallet and open an MCP session. The session lasts 1 hour.
export async function connect() {
  const account = wallet();
  const ch = await (await post(`${BASE}/auth/wallet/challenge`)).json();
  const signature = await account.signMessage({ message: ch.message_to_sign });
  const res = await post(`${BASE}/auth/wallet/token`, { address: account.address, nonce: ch.nonce, signature });
  if (res.status !== 200) throw new Error(`sign-in failed: HTTP ${res.status} ${await res.text()}`);
  const { token } = await res.json();
  const h = { Authorization: `Bearer ${token}`, Accept: "application/json, text/event-stream", "MCP-Protocol-Version": PV };
  const init = await post(`${BASE}/mcp`, { jsonrpc: "2.0", id: 1, method: "initialize",
    params: { protocolVersion: PV, capabilities: {}, clientInfo: { name: "flashpoint-starter", version: "1" } } }, h);
  await init.text();
  h["Mcp-Session-Id"] = init.headers.get("mcp-session-id");
  await (await post(`${BASE}/mcp`, { jsonrpc: "2.0", method: "notifications/initialized" }, h)).text();
  h.paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
    schemes: [{ network: "eip155:*", client: new ExactEvmScheme(account) }],
  });
  return h;
}

async function rpc(h, method, params, f = fetch) {
  const { paidFetch, ...headers } = h;
  const res = await post(`${BASE}/mcp`, { jsonrpc: "2.0", id: Date.now(), method, params }, headers, f);
  const receipt = res.headers.get("payment-response");
  if (receipt) {
    const { transaction, network } = JSON.parse(Buffer.from(receipt, "base64").toString());
    const scan = network === "eip155:84532" ? "https://sepolia.basescan.org" : "https://basescan.org";
    console.error(`paid: ${scan}/tx/${transaction}`);
  }
  const text = await res.text();
  if (res.status === 402) throw new Error(`payment failed: ${JSON.parse(text).error}`);
  const line = text.split("\n").filter((l) => l.startsWith("data:")).pop();
  const msg = JSON.parse(line ? line.slice(5) : text);
  if (msg.error) throw new Error(msg.error.message ?? JSON.stringify(msg.error));
  return msg.result ?? msg;
}

// Call a tool. A paid tool is paid for automatically, then retried.
// Returns the tool's result, parsed from JSON when it is JSON.
export async function callTool(h, name, args = {}) {
  const result = await rpc(h, "tools/call", { name, arguments: args }, h.paidFetch);
  const text = result?.content?.[0]?.text;
  if (text === undefined) return result;
  try { return JSON.parse(text); } catch { return text; }
}

export async function listTools(h) {
  return (await rpc(h, "tools/list", {})).tools;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, tool, args = "{}"] = process.argv.slice(2);
  if (cmd === "wallet") {
    console.log(`Your wallet address: ${wallet().address}`);
    console.log("Send this address (never the key in .env) to the organizers to get credit.");
  } else if (cmd === "balance") {
    console.log(`${wallet().address}: ${await balance()} USDC on Base`);
  } else if (cmd === "tools") {
    for (const t of await listTools(await connect())) console.log(`${t.name}: ${(t.description ?? "").trim().split("\n")[0]}`);
  } else if (cmd === "call" && tool) {
    console.log(JSON.stringify(await callTool(await connect(), tool, JSON.parse(args)), null, 2));
  } else {
    console.log("usage: node flashpoint.mjs wallet | balance | tools | call <tool> '<json args>'");
  }
}
