# The research agent

Built for the Flashpoint MCP Challenge.

## What it does

You give it **one objective** and a list of people who agreed to be surveyed. The agent
then does the research through the Flashpoint MCP, with nobody directing the steps:

1. It decides what it needs to know and writes a survey brief.
2. It has Flashpoint make a panel from the list, write the survey, publish it and email it.
3. It waits for answers and asks Flashpoint for the results.
4. It reads the results, works out what they leave open, and writes **follow-up questions**.
5. It runs a second round on those questions.
6. It returns a recommendation, the evidence, what changed between rounds, and the limits.

## How to run it

```bash
npm install
cp .env.example .env                               # then fill in the two keys
cp agent/recipients.example.txt agent/recipients.txt   # then put in your people
```

A practice run. It uses a fake Flashpoint, so it sends no email and spends no credit:

```bash
node agent/agent.mjs "Find the ticket price for our spring formal that keeps the most members coming." --fake
```

A real run. It emails the people on the list and spends Flashpoint credit:

```bash
node agent/agent.mjs "Find the ticket price for our spring formal that keeps the most members coming."
```

| Option | What it does | Default |
|---|---|---|
| `--fake` | Practice run with a made-up Flashpoint | off |
| `--cap 8` | The most the run may spend on Flashpoint, in USDC | 8 |
| `--recipients file` | Who to survey, one `Name, email` per line | `agent/recipients.txt` |

While the agent waits for answers, answer the survey in your inbox and press Enter. It
also goes on by itself when the wait ends.

## How it is built

| File | What it is |
|---|---|
| `agent.mjs` | The command. Reads the keys and the list, connects the parts, writes the log. |
| `loop.mjs` | The agent loop, its three tools, its instructions, the budget cap and the email redaction. |
| `fake-flashpoint.mjs` | The stand-in Flashpoint for practice runs and tests. |
| `../flashpoint.mjs` | The organizers' starter client: wallet sign-in, MCP calls, x402 payment. |
| `../test/agent.test.mjs` | Seven tests of the loop. |

The agent is Claude Sonnet 5.5 with three tools:

- **`ask_flashpoint`** sends one message to Flashpoint's `tool_survey` over MCP. This is
  the only way the agent can make a panel, write, publish, send or read a survey.
- **`wait_for_replies`** waits for people to answer.
- **`finish`** ends the run with the answer.

The agent's instructions say what Flashpoint can do and what a step costs. They do not
say what to ask, how many questions, or what the follow-up round should be about. Those
are the agent's decisions, and it writes down its reason before every step.

## Safeguards

- **A hard budget cap.** Each Flashpoint step costs $0.50. The code refuses any step that
  would pass the cap, whatever the model asks for. A call that fails is not counted.
- **The model never sees an email address.** It writes `{{RECIPIENTS}}` and the code puts
  the list in. Addresses are also removed from Flashpoint's replies before the model or
  the log sees them. Only Flashpoint receives them.
- **Only the people on the list are surveyed**, and the list is git-ignored.
- **Every step is logged** to `agent/runs/<time>/log.md` and `steps.json`, with the
  payment receipt for each paid step.

## The objective and what the agent decided

The objective given:

> Find the ticket price for our spring formal that keeps the most members coming.

Run logs are in `agent/runs/`. A folder that starts with `fake-` is a practice run and
holds no real answers.

## Limits

- The people surveyed here are a few test addresses, so an answer is a direction and not
  a measurement. The agent is told to say so.
- Flashpoint's guide says to allow about a day for replies. A short wait works here only
  because the testers answer straight away.
- The agent reads Flashpoint's written summary of the results, not the raw export.
