# The Sealed Envelope: an agent that does the research

Built for the Flashpoint MCP Challenge.

## In 60 seconds

**One objective in, an answer out.** You give the agent one sentence, a list of people to
email, and a budget. Through the Flashpoint MCP it decides what survey to make, sends it
to the list, reads the answers, runs a follow-up round on what it learned, and comes back
with a recommendation.

| | In the example run |
|---|---|
| **The objective given** | "Figure out the best event to put on for our club next spring." |
| **Survey 1, the agent's choice** | Rank five kinds of event, pick a day and time, the most you would pay, and one open question. Sent to all 8 people. |
| **What it guessed, sealed before sending** | A social evening or a picnic would lead, and most people would pay up to $10. |
| **What surprised it** | The social evening came last. Money worries came up again and again, and one person proposed skipping the event. |
| **Survey 2, on that surprise** | Three questions: a free picnic, a club-subsidised day trip, a small event plus an aid fund, or no event? What would stop you coming? |
| **The recommendation** | A free or very cheap Saturday daytime outdoor event with kids welcome. Picnic is the safe choice; a subsidised day trip is close behind. |
| **How much it did alone** | 20 steps on its own. It went to a person 4 times: 2 approvals to send, 2 updates its standing orders asked for. |
| **Cost** | $5.00 of a $9.00 budget, at the prices a real run pays. |

**That example is a practice run.** An AI stand-in played Flashpoint and invented every
answer, so it is not a finding. It shows what the agent decides and how. No real run has
been made yet.

- **Watch it, part by part:** <https://institutor.github.io/priced-out/agent/>
  (press **P** on that page for present mode)
- **What the agent decided, on one page:** [examples/practice-run/summary.md](examples/practice-run/summary.md)
- **Every message, reply and decision:** [examples/practice-run/log.md](examples/practice-run/log.md)

## What it does

A run goes like this. The agent makes every research decision itself.

1. **You give one objective**, a list of people to email, a budget, and any standing
   orders.
2. **The agent plans.** Before it spends anything it writes down what it needs to find
   out, what it expects, and what would change its answer. The code will not let it
   message Flashpoint until it has.
3. **It writes the survey.** It decides what to ask and has Flashpoint build a panel from
   your list and write the survey. It may rehearse the survey on AI personas first.
4. **It seals its guess.** It writes down what it expects people to answer. You can seal
   a guess too, and the agent cannot see yours. If it rehearsed on personas, their
   answers go in as a third guess.
5. **The survey goes out.** Flashpoint emails the list. Before that, either you read the
   survey and type yes, or, in hands-off mode, the code checks it against fixed rules.
6. **The envelope is opened.** The agent reads the results and lays each guess beside
   what people really said. It writes a debrief: who was wrong, what surprised everyone,
   and what is still unknown.
7. **It decides the next move.** Whatever was guessed wrong is what nobody understood
   yet, so that is what a second, shorter survey asks about. Or it stops.
8. **It answers.** A recommendation, the evidence, a scoreboard of the guesses, the
   limits, and up to three lessons it keeps for its next run.

The sealed envelope is what makes the second round worth sending. A follow-up is only
useful if it asks about something the first round got wrong, and the envelope is a
record, made before the answers came in, of what everyone expected.

## How to run it

```bash
npm install
cp .env.example .env                                   # then fill in the two keys
cp agent/recipients.example.txt agent/recipients.txt   # then put in your people
```

**A practice run.** An AI stand-in plays Flashpoint and invents the answers, so it sends
no email and spends no Flashpoint credit. It needs only `ANTHROPIC_API_KEY`:

```bash
node agent/agent.mjs "Figure out the best event to put on for our club next spring." --practice
```

**Before a real run**, check that everything is ready. The check is free: it signs in to
Flashpoint, reads the wallet balance and asks the model one word. It sends nothing and
never prints a key or an address:

```bash
node agent/check.mjs
```

**A real run.** It emails the people on the list and spends Flashpoint credit:

```bash
node agent/agent.mjs "Figure out the best event to put on for our club next spring."
```

**A real run, hands-off.** You give the objective and walk away. The agent sends without
asking you, as long as the survey passes the code's send checks (see Safeguards):

```bash
node agent/agent.mjs "Figure out the best event to put on for our club next spring." --hands-off
```

| Option | What it does | Default |
|---|---|---|
| `--practice` | Practice run. An AI stand-in plays Flashpoint and invents the answers. | off |
| `--fake` | Practice run with fixed canned replies. This is what the tests use. | off |
| `--hands-off` | Nobody approves each send. The code checks every survey before it goes out. You agree to this once, at the start. | off |
| `--cap 9` | The most the run may spend on Flashpoint, in USDC | 9 |
| `--emails 2` | The most emails anyone on the list may get, reminders included | 2 |
| `--recipients file` | Who to survey, one `Name, email` per line | `agent/recipients.txt` |
| `--orders file` | Your standing orders, one `- order` per line | `agent/orders.md` |
| `--resume folder` | Carry on a real run that was stopped | off |

**What a round costs.** Each message to Flashpoint's survey tool is $0.50. A real round
is about seven messages (write, publish, email, a confirm or two on the way, read the
results), so about $3.50. The default budget of $9 covers two rounds. The agent will not
start a round it cannot pay for, and it will not send a survey if it would have no money
left to read the answers.

While the agent waits for answers, press Enter to make it look now. You can type a note
first, and the agent will read it. The wait ends by itself too.

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
twice. A run can only be carried on with the same recipient list it started with, and a
practice run can never be carried on as a real one.

## Standing orders

You are the commander: the person who gave the objective. Orders are rules, not steps.
They are in [`orders.md`](orders.md), and you can change them:

```
- Check with me before any email goes out.
- Come to me if the answers split evenly and you cannot call it.
- Tell me what you learned before you start a second round.
```

When an order applies, the agent stops, quotes the order, says what it found, and waits
for your reply. Between orders it does not ask what to do next. With `--hands-off` the
orders become "I am away. Every decision is yours", unless you give your own file.

## It learns from one run to the next

At the end of a run the agent writes down up to three lessons about how to do the
research better, such as "rank questions gave a clearer signal than single choice on 8
people". They are saved to `agent/memory/lessons.md`. The next run reads the newest
lessons before it plans, and its log says which ones it was given. Practice runs keep
their own notebook, which is not in the repository, so an invented answer can never
teach a real run anything.

## The agent's tools

The agent is Claude Sonnet 5.5 in a loop. Each turn it reads everything so far, picks one
tool, and writes down why.

| Tool | What it does | Cost |
|---|---|---|
| `plan` | Writes down what it needs to know, its hunches, and what would change its answer. Required before the first paid step. | free |
| `ask_flashpoint` | One message to Flashpoint's `tool_survey` over MCP: make the panel, write or change the survey, publish, email, read results | $0.50 |
| `rehearse_on_personas` | Runs the draft on AI personas with Flashpoint's `panel` tool | $0.60 |
| `seal_predictions` | Seals the agent's, the personas' and the commander's guesses | free |
| `open_envelope` | Opens the envelope once the real results are in | free |
| `debrief` | Records what the envelope taught the agent and its next move | free |
| `ask_commander` | Speaks to the commander and waits for a reply | free |
| `wait_for_replies` | Waits for people to answer | free |
| `make_deck` | A short slide deck from Flashpoint's `presentation` tool | $0.25 |
| `finish` | Ends the run with the answer, the scoreboard and the lessons | free |

The agent's instructions say what Flashpoint can do and what a step costs. They do not
say what to ask, how many questions, whether to rehearse, or what a second round should
be about. Those are the agent's decisions.

**One challenge.** If the agent chooses to stop after a single round while it still names
something unknown and has the budget for a short second round, the code asks it once to
think again. The decision stays the agent's, and the log shows the challenge. In the
example run this is exactly what happened: it chose to stop, was asked once, and then
chose a three-question follow-up.

**Slips.** Every paid step carries a slip: the price, and the decision of the agent's
that the step could change. If it cannot name one, it is told to skip the step.

## Safeguards

These are rules in the code. They hold whatever the model says.

- **No email without a yes, or a check.** The code refuses any send until the envelope is
  sealed and you have seen the survey and typed yes. In hands-off mode the code checks
  the survey itself instead, and holds the send if any check fails:
  - Flashpoint showed the whole survey, and nothing changed after that.
  - It is short: about 10 questions at most, and about 5 for a follow-up.
  - It does not ask for a name, a contact detail, income, financial aid or anything else
    personal.
  - The round's envelope is sealed.
  - Nobody has had more emails than the limit, and the budget covers it.
- **A limit on emails.** A follow-up round is a second email to the same people, who are
  doing you a favour. The code counts every send and refuses one that would pass the
  limit: two emails each by default, reminders included (`--emails 1` allows a single
  survey and no follow-up). The agent is also told to say in the first survey that one
  short follow-up may come, and to keep a follow-up to three questions at most. That
  part is an instruction to the agent and not a rule in the code, so check it when you
  approve.
- **A hard budget.** The code refuses any paid step that would pass the budget. A call
  that fails is not counted.
- **The envelope is honest.** Your guess is kept from the model until the envelope opens.
  A guess cannot be sealed after the survey is sent.[^hash]
- **The model never sees a name or an email address.** It writes `{{RECIPIENTS}}` and the
  code puts the list in. Names and addresses are also removed from Flashpoint's replies
  and from anything you type before the model or the log sees them. Only Flashpoint
  receives them.
- **Invented numbers are flagged.** A number in the final answer that appears in nothing
  Flashpoint or the commander said is listed in the log under "Check these numbers".
- **Synthetic stays synthetic.** Persona answers are labelled synthetic everywhere and the
  agent is told never to count them as evidence.
- **Every step is logged** to `agent/runs/<time>/log.md` and `steps.json`, with the
  payment receipt link for each paid step and a bill at the end. A real run also keeps
  Flashpoint's raw replies in a `raw/` folder that is git-ignored, since they can hold
  addresses.

[^hash]: The envelope's SHA-256 fingerprint is written to the log when it is sealed and
    checked when it is opened, so a guess changed afterwards would show.

## The objective given, and what the agent decided

**No real run has been made yet.** The example is a practice run: an AI stand-in played
Flashpoint and invented every answer, and another AI stand-in played the commander
because nobody was at the keyboard. Both are labelled wherever they speak. Nothing in it
is a finding.

The objective given:

> Figure out the best event to put on for our club next spring.

What the agent decided:

- **The plan.** It needed to know which kind of event members prefer, what would make
  them come (timing, cost, format), and anything only the commander would know. Its
  hunch was a social outdoor event.
- **Survey 1.** One survey to all 8 people: rank five kinds of event, pick a day and
  time, the most you would pay, and an open question. Its opening line said one short
  follow-up might come.
- **The envelope.** It guessed a social evening or a picnic would lead and most people
  would pay up to $10. The commander guessed a skills workshop.
- **What came back.** The picnic ranked first, a day trip second, and the social evening
  last. All 8 chose Saturday daytime. On price people split, and money worries came up
  again and again. One person proposed skipping the event. The agent wrote "I was wrong",
  and that the commander was too.
- **Stop or go on?** It first chose to stop. The code asked it once to think again, and
  it chose a follow-up. A standing order says to report before a second round, so it
  told the commander what it had learned first.
- **Survey 2.** Three questions on what round 1 left open: a free picnic, a subsidised
  day trip, a small event plus an aid fund, or no event, and what would stop you coming.
- **What came back.** A split: trip 3, picnic 2, small event plus aid 2, no event 1.
  Cost was the top barrier. The split set off the order "Come to me if the answers split
  evenly", so it went to the commander with its own call.
- **Stopping.** Everyone had had their two emails, so there could be no third survey. It
  said so.
- **The recommendation.** A free or very cheap Saturday daytime outdoor event with kids
  welcome. A picnic is the safe choice. A subsidised day trip is a close second if the
  treasurer confirms the money. It said plainly that 8 people give a direction, not a
  measurement.
- **Its lessons for next time.** Rank questions gave a clearer signal than single choice.
  Offering cost-sharing changed the order, so test price wording on purpose. Ask about
  barriers openly instead of assuming them.
- **The bill.** Ten messages to Flashpoint: $5.00 of a $9.00 budget, at the prices a real
  run pays.

The whole run is in [examples/practice-run/](examples/practice-run/): the
[one-page summary](examples/practice-run/summary.md) and the
[log](examples/practice-run/log.md), with every message, reply, slip, envelope and
debrief. The same run is on the page at <https://institutor.github.io/priced-out/agent/>.

### What a run leaves behind

Every run writes three things into its folder under `agent/runs/`: `log.md` (every
message, reply and receipt), `summary.md` (one page on what the agent decided, and how
much it did alone), and `steps.json` (the same steps as data). A folder that starts with
`practice-` or `fake-` is a practice run. It holds no real answers and is not in the
repository.

```bash
node agent/summary.mjs agent/runs/<folder>        # remake the summary
node agent/publish-run.mjs agent/runs/<folder>    # put the run on the page
```

The page is `site/agent/`. It reads `site/data/agent-run.json`, which `publish-run.mjs`
writes. A run that still holds an email address is refused, and a practice run is
labelled as one above everything else on the page.

## How it is built

| File | What it is |
|---|---|
| `agent.mjs` | The command. Reads the keys, the list and the orders, runs the commander's prompts at the keyboard, and talks to the real Flashpoint. |
| `loop.mjs` | The agent loop: its tools, its instructions, the send gate and send checks, the envelope, the budget, the email limit and the redaction. It touches no network and no keyboard. |
| `memory.mjs` | The lessons notebook: reads the newest lessons before a run and writes new ones after it. |
| `log.mjs` | Turns the steps into the run's log. |
| `summary.mjs` | Turns the steps into a one-page summary of what the agent decided. |
| `check.mjs` | The free check before a real run. |
| `publish-run.mjs` | Puts one run on the page, `../site/agent/`. |
| `real-flashpoint.mjs` | Talks to the real Flashpoint over MCP and pays for each call. |
| `fake-flashpoint.mjs` | The stand-in Flashpoint: the same draft, confirm, send, results steps as the real one. |
| `practice-writer.mjs` | For `--practice`: a small AI model writes the stand-in's survey text and invents the answers. |
| `orders.md` | The standing orders. |
| `../flashpoint.mjs` | The organizers' starter client: wallet sign-in, MCP calls, x402 payment. |
| `../test/agent*.test.mjs` | Tests of the loop, the log, the summary, the notebook and the page's story, run with `npm test`. |

## Limits

- The people surveyed here are a few test addresses, so an answer is a direction and not
  a measurement, and the scoreboard shows the method working, not a finding. The agent is
  told to say so.
- The commander's guess is only a fair bet when other people answer the survey. If you are
  answering it yourself from test addresses, press Enter to skip your guess.
- Flashpoint's guide says to allow about a day for replies. A short wait works here only
  because the testers answer straight away.
- The agent reads Flashpoint's written summary of the results, not the raw export.
- A persona rehearsal is slow and can fail. The run carries on without it, and the
  personas then have no guess in the envelope.
- A real send has not been made yet. The code was tested against replies saved from
  earlier real Flashpoint calls and against the stand-in.
