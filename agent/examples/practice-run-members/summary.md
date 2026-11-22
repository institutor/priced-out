# Run summary 2026-11-22T09-24-20

**This was a practice run. An AI stand-in played Flashpoint and invented every answer. No survey was sent and no real person answered. Nothing below is a finding.**

**The objective:** Members come to one meeting and then stop. Find out why, and what one change would bring them back.

**Given to the agent:** 8 people to ask, a $9.00 budget cap, and 2 standing orders. Nobody could be emailed more than 2 times, reminders included. Model: claude-sonnet-5-5.

**What it remembered from earlier runs:**

- Rank questions gave a clearer signal than single choice, which split on 8 people.
- Offering cost-sharing in the options changed the preference order, so test price framing explicitly.
- My guesses and the commander's both missed; ask about barriers openly instead of assuming them.

## How much it did alone

The agent took **20 steps on its own**. It did not stop for a person once. The code asked it once to think again before it stopped.

## What the agent decided

**Its plan, before it spent anything.**

- It needed to find out: Why people stop after one meeting (barriers, open-ended); Which single change would most bring them back (ranked); Whether price/time/format/welcome matters most
- It already suspected: Feeling unwelcome or unclear value after first meeting, or timing conflicts; Guesses have missed before, so ask openly
- What would change its answer: If the open reasons point to something other than meeting content/welcome, e.g. scheduling or cost, I'd recommend that instead.

**Round 1.**

- It sent Flashpoint 5 messages, 1 of them to write or change the survey.
- Before sending, it sealed guesses on: "Main change most likely to bring you back (rank top)"; "Main reason for not returning (open)".
- The code checked the survey in the commander's place, and it was emailed.
- Who was wrong: Mostly right on direction; I missed the merchandise-pressure incident and dominating-members theme.
- Biggest surprise: One member reported merchandise pressure; nobody predicted it.
- Still unknown: Whether welcome or clarity matters more; whether others experienced pressure to buy.
- It first chose to stop here. The loop asked it once to think again, because a question was still open and there was budget left.
- Its decision: **run another round**. Short follow-up: if only one change, welcome buddy vs. a beginner-friendly opening explainer; plus whether anyone felt pressured to buy.

**Round 2.**

- It sent Flashpoint 5 messages, 1 of them to write or change the survey.
- Before sending, it sealed guesses on: "Top-ranked change to bring you back"; "Felt pressure to buy/join?".
- The code checked the survey in the commander's place, and it was emailed.
- Who was wrong: I was broadly right. I didn't predict a tie between greeter and intro.
- Biggest surprise: Reasons were scattered: each person gave a different one.
- Still unknown: Whether the fix works in practice; the pressure incident's scale.
- Its decision: **finish**. Every person has had 2 emails, so no further send is possible.

## When it came to the commander

It did not, apart from send approvals.

The commander handed the objective over and was away, so nobody answered the agent and no person approved a send.

## The answer

**Recommendation.** Make the first ten minutes newcomer-friendly. Open every meeting with a short plain-language beginners' intro that says newcomers are welcome and explains the terms. Pair that with a named person who greets newcomers and sits with them. Intro and greeter tied on average rank, but the intro got the most first places. Also say plainly that nothing is for sale. Changing the meeting time or adding hands-on activities ranked low.

**Evidence.** Both rounds had 8 of 8 respondents. Round 1 ranking (avg rank, lower is better): clearer plan 2.25, welcome 2.38 (4 first places), cost 3.13, time 3.38, shorter meeting 3.88, hands-on 6.0 (0 first places). Round 1 reasons were all different: cliquey or dominated discussion (2), lost or unsure beginners were welcome (2), schedule clash (1), already in other groups (1), bored (1), pressured to buy merchandise (1). Round 2 ranking: beginners' intro 2.13 (3 first places), greeter 2.13 (1), clear offer 2.63 (2), everyone gets a turn 3.75, shift-friendly time 4.38. Round 2 pressure to buy or join: Yes 1, No 7.

**Check these numbers.** They are in the answer but in nothing Flashpoint or the commander said: 6.0.

**Who guessed better.**

| Round | Question | What people said | Agent | AI personas | Commander |
|---|---|---|---|---|---|
| 1 | Which change would bring you back (ranking) | Welcome and clearer plan on top; hands-on last | right | no guess | no guess |
| 1 | Main reason for not returning (open) | Scattered; welcome and clarity themes; one merchandise pressure | partly | no guess | no guess |
| 2 | Top-ranked change | Beginners' intro and greeter tied at 2.13; intro had 3 first places | right | no guess | no guess |
| 2 | Felt pressure to buy/join? | Yes 1, No 7 | right | no guess | no guess |

The agent: 3 right, 1 partly, 0 wrong. The AI personas made no guess. The commander made no guess.

The agent marked these itself, its own guesses included. With 8 people asked, the scoreboard shows how the method works. It does not show who is the better guesser.

**What changed between rounds.** Round 1 showed scattered reasons and two top options, welcome and clarity, that were close together. I used round 2 to separate them, and they tied again on average rank. It also checked how widespread the merchandise pressure was: 1 of 8.

**Limits.** Only 8 people, so this is a direction and not a measurement. The tie between intro and greeter was not resolved. The pressure-to-buy report comes from one person. Every Flashpoint reply was labelled as a practice stand-in, so the results may be simulated. I did not run a persona rehearsal.

**What it wrote down for its next run.**

- Open-ended reasons from a small group scatter. Ranking plus 'what would bring you back' gave the usable signal.
- Two top options tied again when re-ranked. A different design, such as a forced trade-off, may be needed to split them.
- Ask openly about uncomfortable incidents. One surprise (pressure to buy) only came up because of the open question.

## The bill

| Paid for | How many | Cost |
|---|---|---|
| Messages to Flashpoint's survey agent | 10 | $5.00 |
| **Spent** | | **$5.00** of the $9.00 cap |

These are the prices a real run would have paid. This practice run paid nothing.

The full log, with every message, reply and receipt, is `log.md` in the same folder.
