# The research agent

Built for the Flashpoint MCP Challenge.

## What it does

You are the commander. You give the agent **a mission** and a few **standing orders**.
The agent then does the research through the Flashpoint MCP. It makes every research
decision itself, and comes to you only when one of your orders says so.

What makes it different is the **sealed envelope**. Before any survey goes out, the agent
writes down what it expects people to answer. You write down your own guess, which the
agent cannot see. If the agent rehearsed the survey on AI personas, their answers go in as
a third guess. The guesses are sealed. When the real answers come back, the envelope is
opened, and **whatever was guessed wrong is what the next round asks about**.

So a mission goes like this:

1. You type the mission.
2. The agent works out what it needs to know. It may ask you one thing only you would
   know. It has Flashpoint build a panel from your list and write a short survey.
3. It may rehearse the survey on AI personas first, to catch a broken question before a
   real person sees it.
4. It seals the envelope: its guess, the personas' guess, and yours.
5. It shows you the survey. No email goes out until you type yes.
6. Flashpoint emails the survey. The agent waits, then reads the results.
7. It opens the envelope and writes a debrief: who was wrong, what surprised everyone,
   what is still unknown, and its next move.
8. If something is still open and the budget allows, it runs a second, shorter round on
   exactly that, with a new envelope.
9. It returns a recommendation, the evidence, a scoreboard of the guesses, and the limits.

## How to run it

```bash
npm install
cp .env.example .env                                   # then fill in the two keys
cp agent/recipients.example.txt agent/recipients.txt   # then put in your people
```

A practice run. An AI stand-in plays Flashpoint and invents the answers, so it sends no
email and spends no Flashpoint credit. It needs only `ANTHROPIC_API_KEY`:

```bash
node agent/agent.mjs "Find the ticket price for our spring formal that keeps the most members coming." --practice
```

Before a real run, check that everything is ready. The check is free: it signs in to
Flashpoint, reads the wallet balance and asks the model one word. It sends nothing and
never prints a key or an address:

```bash
node agent/check.mjs
```

A real run. It emails the people on the list and spends Flashpoint credit:

```bash
node agent/agent.mjs "Find the ticket price for our spring formal that keeps the most members coming."
```

| Option | What it does | Default |
|---|---|---|
| `--practice` | Practice run. An AI stand-in plays Flashpoint and invents the answers. | off |
| `--fake` | Practice run with fixed canned replies. This is what the tests use. | off |
| `--cap 8` | The most the run may spend on Flashpoint, in USDC | 8 |
| `--recipients file` | Who to survey, one `Name, email` per line | `agent/recipients.txt` |
| `--orders file` | Your standing orders, one `- order` per line | `agent/orders.md` |
| `--resume folder` | Carry on a real run that was stopped | off |

While the agent waits for answers, answer the survey in your inbox and press Enter. You
can also type a note first, and the agent will read it. The wait ends by itself too.

### Stopping and coming back

People can take hours to answer. You do not have to keep the agent running. Stop it with
Ctrl+C at any point, and carry on later from the run's folder:

```bash
node agent/agent.mjs --resume agent/runs/<folder>
```

The agent picks up with everything it knew: the survey, the sealed envelope, your
guesses, and what it has spent. The log gets a "resumed" step. If it was stopped in the
middle of a paid step, that step is counted as paid to be safe, and the agent is told to
ask Flashpoint where the survey stands before it repeats anything, so nobody is emailed
twice. Only real runs can be resumed.

## Standing orders

Orders are rules, not steps. They are in [`orders.md`](orders.md), and you can change them:

```
- Check with me before any email goes out.
- Come to me if the answers split evenly and you cannot call it.
- Tell me what you learned before you start a second round.
```

When an order applies, the agent stops, quotes the order, says what it found, and waits
for your reply. Between orders it does not ask what to do next.

The first order is also enforced by the code, whatever the model does. See Safeguards.

## The agent's tools

The agent is Claude Sonnet 5.5 in a loop. Each turn it reads everything so far, picks one
tool, and writes down why.

| Tool | What it does | Cost |
|---|---|---|
| `ask_flashpoint` | One message to Flashpoint's `tool_survey` over MCP: make the panel, write or change the survey, publish, email, read results | $0.50 |
| `rehearse_on_personas` | Runs the draft on AI personas with Flashpoint's `panel` tool | $0.60 |
| `seal_predictions` | Seals the agent's, the personas' and the commander's guesses | free |
| `open_envelope` | Opens the envelope once the real results are in | free |
| `debrief` | Records what the envelope taught the agent and its next move | free |
| `ask_commander` | Speaks to the commander and waits for a reply | free |
| `wait_for_replies` | Waits for people to answer | free |
| `make_deck` | A short slide deck from Flashpoint's `presentation` tool | $0.25 |
| `finish` | Ends the mission with the answer and the scoreboard | free |

The agent's instructions say what Flashpoint can do and what a step costs. They do not
say what to ask, how many questions, whether to rehearse, or what a second round should
be about. Those are the agent's decisions.

**One challenge.** If the agent chooses to stop after a single round while it still names
something unknown and has the budget for a short second round, the loop asks it once to
think again. The decision stays the agent's, and the log shows the challenge.

**Receipts.** Every paid step carries a receipt: the price, and the decision of the
agent's that the step could change. If it cannot name one, it is told to skip the step.

## Safeguards

- **No email without your yes.** The code refuses any send until the envelope is sealed
  and you have seen the survey and typed yes. A bare "confirm" is treated as a send unless
  Flashpoint's last reply was plainly about publishing only, so the model cannot slip one
  past by calling it something else. A real run will not start without a keyboard.
- **The envelope is honest.** Your guess is kept from the model until the envelope opens.
  A guess cannot be sealed after the survey is sent. The envelope's SHA-256 is written to
  the log when it is sealed and checked when it is opened.
- **A hard budget cap.** The code refuses any paid step that would pass the cap. A call
  that fails is not counted.
- **The model never sees a name or an email address.** It writes `{{RECIPIENTS}}` and the
  code puts the list in. Names and addresses are also removed from Flashpoint's replies and from anything you
  type before the model or the log sees them. Only Flashpoint receives them.
- **Invented numbers are flagged.** A number in the final answer that appears in nothing
  Flashpoint or the commander said is listed in the log under "Check these numbers".
- **Synthetic stays synthetic.** Persona answers are labelled synthetic everywhere and the
  agent is told never to count them as evidence.
- **Every step is logged** to `agent/runs/<time>/log.md` and `steps.json`, with the
  payment receipt link for each paid step and a bill at the end. A real run also keeps
  Flashpoint's raw replies in a `raw/` folder that is git-ignored, since they can hold
  addresses.

## How it is built

| File | What it is |
|---|---|
| `agent.mjs` | The command. Reads the keys, the list and the orders, runs the commander's desk at the keyboard, and talks to the real Flashpoint. |
| `loop.mjs` | The agent loop: its tools, its instructions, the send gate, the envelope, the budget cap and the email redaction. It touches no network and no keyboard. |
| `log.mjs` | Turns the steps into the mission log. |
| `summary.mjs` | Turns the steps into a one-page summary of what the agent decided. |
| `check.mjs` | The free check before a real run. |
| `fake-flashpoint.mjs` | The stand-in Flashpoint: the same draft, confirm, send, results steps as the real one. |
| `practice-writer.mjs` | For `--practice`: a small AI model writes the stand-in's survey text and invents the answers. |
| `orders.md` | The standing orders. |
| `../flashpoint.mjs` | The organizers' starter client: wallet sign-in, MCP calls, x402 payment. |
| `../test/agent.test.mjs`, `../test/agent-log.test.mjs` | Tests of the loop and the log, run with `npm test`. |

## The mission and what the agent decided

The mission given:

> Find the ticket price for our spring formal that keeps the most members coming.

Every run writes three things into its folder under `agent/runs/`: `log.md` (every
message, reply and receipt), `summary.md` (one page on what the agent decided), and
`steps.json` (the same steps as data). To remake a summary:

```bash
node agent/summary.mjs agent/runs/<folder>
```

Run logs are in `agent/runs/`. A folder that starts with `practice-` or `fake-` is a
practice run. It holds no real answers and is not in the repository.

## Limits

- The people surveyed here are a few test addresses, so an answer is a direction and not
  a measurement, and the scoreboard shows the method working, not a finding. The agent is
  told to say so.
- The commander's guess is only a fair bet when other people answer the survey. If you are
  answering it yourself from test addresses, press Enter to skip your guess.
- Flashpoint's guide says to allow about a day for replies. A short wait works here only
  because the testers answer straight away.
- The agent reads Flashpoint's written summary of the results, not the raw export.
- A persona rehearsal is slow and can fail. The mission carries on without it, and the
  personas then have no guess in the envelope.
