# Priced Out

During my time in high school, I found myself often faced with times where I couldn't
exactly afford to pay for certain club dues, and I wish I could have done something about
it. For instance, my school's Science Olympiad competitions often cost hundreds of dollars
for just travel and hotels alone, a cost that I could not afford to pay at all.

Priced Out is the idea I dreamt up that I wish the people setting those costs had had. It
could have shown them, before the price went out, how many of us it would leave behind and
which way of offering a lower price we would have used, without anyone having to say they
couldn't pay. Because, you know, if thirty students pay twenty dollars for an event,
that's actually more money netted than fifteen students paying thirty dollars.

Students who can't afford a club's dues, formal or trip rarely say so. They say they're
busy, and stop showing up. The people setting the price never find out. Published work
on both points is listed under [Sources](#sources).

Priced Out is a calculator for club treasurers. It takes a survey that asks students for
the price at which that happens, and gives the treasurer the answer before the price is
announced: at this price, in a club this size, about this many members would skip it.

Built by one person for the Flashpoint AI x Columbia AI Club hackathon (November 2026),
Engineering & Product track.

**Try it: https://institutor.github.io/priced-out/** · [Write-up](docs/submission/write-up.md) ·
[The survey](https://flashpointopinions.com/0a4c06d5-1ea1-43dd-89d7-2458c955b58a)

![The title page: a drawing of stick figures in which two club officers call out “Come to our formal! $45 a ticket.”, members cheer, and one says “Sorry, can't make it.” with a note beside them reading “(can't afford it)”. Under it, the question “What if you could see that before you set the price?” and the words Priced Out, with a banner saying the numbers come from simulated students](docs/screenshot.jpg)

![The price check: a formal ticket at $45 in a club of 60, drawn as a room of seats, 19 of them empty](docs/screenshot-answer.jpg)

## Read this first: the numbers are simulated

**No real student has answered the survey.** Every number on the site comes from a
Flashpoint synthetic panel: 120 AI personas that Flashpoint generated to resemble Columbia
and Barnard undergraduates, each answered by a language model (`gpt-5.4-mini`). Flashpoint
itself marks the panel `uncalibrated`, meaning it has not been checked against real
answers.

**Why I did not survey students.** Three reasons.

- **Only a club can survey a club.** Getting a whole club to answer takes someone its
  members listen to, which means its own officers. I could not have done that for one club
  from the outside, let alone for every club that might use this.
- **Every club is different.** The price where members drop out depends on the club and on
  who is in it. One club's answers would not carry over to the next, and a survey of
  whichever students I could reach would have described no club in particular.
- **The point is that any club can use it.** Priced Out is the instrument: a three-minute
  survey and the page that reads it, for a club to run on its own members. So here 120 AI
  personas stand in for one club, and show it working from end to end.

So the site is a working product on simulated input, not a finding about students. It says
so in a banner on every screen, in every sentence that quotes a number, on the printed
receipt and in the note it writes for a club's board. The survey is live, and the page reads
a club's own answers as soon as there are any: a treasurer loads the export in the browser
and every number becomes their members' (see [Run it for your own club](#run-it-for-your-own-club)).

## Try it yourself, in a few minutes

Nothing to install. Open **https://institutor.github.io/priced-out/** and:

1. **Guess first.** The page opens on "A formal ticket at $45 in a club of 60". Type how
   many of the 60 you think would skip it, and press **Show the answer**. The simulated
   panel says 19, and the page tells you how far off you were.
2. **Move the price.** Drag the slider down to $30. Seats fill back up, the answer drops
   to 6 of 60, and the next section tells you $30 is the most a formal ticket can cost and
   still lose no more than 1 in 10.
3. **Make it your club.** Change the item to a weekend trip, or the 60 to your own club's
   size. Every section below follows: what a lower access price brings back, which fix
   won, and how many empty seats members' own pledges would pay for. The address follows
   what you set, so any view can be sent as a link, like
   [a formal at $30](https://institutor.github.io/priced-out/?item=formal&price=30&club=60&answer=1).
4. **Build a year.** In the receipt, change a price or untick a line and watch "priced out
   of at least one line" move. **Print this receipt** gives a member's copy.
5. **Take it to the board.** "What to take to your board" puts the answer on one card with
   a button that copies it. Under it is the same decision as a message for members, worded
   for the fix that came out on top.
6. **Load a club.** Under "Run it for your own club", press **Load a made-up club**. Every
   number on the page changes to those of 36 invented members, the banner says so, and a
   different fix wins. This is what a treasurer sees after loading their own export.
7. **See the survey.** [Open it](https://flashpointopinions.com/0a4c06d5-1ea1-43dd-89d7-2458c955b58a)
   to read the questions the personas were asked. It is the survey Flashpoint built and
   hosts.

A **Contents** tab in the corner of the screen jumps between the parts of the page.

To check the working instead of the page:

- `npm test` runs the 178 tests on the rules behind every number ([Run it](#run-it)).
- `node scripts/evaluate.mjs` runs the page's rules on 2,000 made-up clubs whose true
  answer is known ([Checked against a known answer](#checked-against-a-known-answer)).
- [`briefs/`](briefs) and [`replies/`](replies) hold everything sent to and received from
  Flashpoint, each paid reply with its payment receipt.

## What it does

One page, in the order a treasurer would use it.

1. **Price check.** Fill in the line "A *formal ticket* at $*45* in a club of *60*", guess
   how many would skip it, then see the answer: a room of seats that empties, the share
   behind it with a 95% interval, and the whole curve from $0 up.
2. **What it would take.** The highest price that loses no more than 1 in 10, what a lower
   access price would bring back, in people and in dollars, and one small table of the
   same thing priced three ways: as it is, one lower price for everyone, and two prices.
3. **The fix they picked.** Six ways to offer a lower price (sliding scale, waiver on
   request, open waiver code, pay what you can, paid-forward tickets, discount draw),
   ranked by a trade-off question.
4. **Would members cover it themselves?** Many say they'd add a few dollars to their own
   ticket, but only if enough others do. The page plays that out for your club and counts
   how many empty seats the pool pays for.
5. **The receipt for a year in your club.** Dues, formal and trip on one printable slip,
   with the share lost at each line and at any line.
6. **What to take to your board.** The answer in five lines on a card that can be copied,
   which says under its title and in its last line whose answers it rests on. Under it,
   the same decision as a message a treasurer can send to members.
7. **What these numbers are, and what they are not.** Who answered, and what the numbers
   can't tell you.
8. **Run it for your own club.** Send the survey, export the answers, load the file. The
   page reads the export in the browser and uploads nothing. The survey's nine questions
   can be read in place, a made-up club is there to try it with, and a table says how many
   answers are enough.
9. **Why this exists.** The story at the top of this file, and four published findings
   about real students and families.
10. **How the survey was made.** What Flashpoint built, what it corrected, the four runs
    that came back empty, and what each call cost.

One more section, what priced-out students said at the time, is built and tested but is
shown only when the answers are not from AI personas. An invented person's excuse is not
evidence.

## How it uses Flashpoint

Flashpoint did all of the research work: it designed, checked, hosted and published the
survey, built the MaxDiff design, generated the panel, ran it and exported the answers. I
reached it over MCP, paying per call in USDC from a wallet ([`flashpoint.mjs`](flashpoint.mjs)).

Everything sent and everything that came back is in this repository, with the payment
receipt inside each reply. Sixteen paid calls, $6.50 in total.

| # | What I asked | Tool | Sent | Reply | Cost |
|---|---|---|---|---|---|
| 02 | Design the survey from my brief | `tool_survey` | [brief](briefs/02-draft.txt) | [reply](replies/02-draft.json) | $0.50 |
| 03 | Check whether an untouched slider is stored as $0, and get ready to publish | `tool_survey` | [brief](briefs/03-publish.txt) | [reply](replies/03-publish.json) | $0.50 |
| 05 | Generate 120 personas and run them through the survey | `panel` | [brief](briefs/05-panel.json) | [reply](replies/05-panel.json) | $0.60 |
| 06 | Every persona stopped after the first question. Why? | `tool_survey` | [brief](briefs/06-diagnose.txt) | [reply](replies/06-diagnose.json) | $0.50 |
| 07, 08 | Publish the survey | `tool_survey` | [07](briefs/07-publish.txt), [08](briefs/08-confirm.txt) | [07](replies/07-publish.json), [08](replies/08-confirm.json) | $1.00 |
| 09, 11 | Run the panel again | `panel` | | [09](replies/09-panel-run.json), [11](replies/11-panel-run.json) | $0.20 |
| 13 | It still stops. Find the real cause in the responses and fix it | `tool_survey` | [brief](briefs/13-fix.txt) | [reply](replies/13-fix.json) | $0.50 |
| 14 | Confirm the corrected survey | `tool_survey` | [brief](briefs/14-confirm.txt) | [reply](replies/14-confirm.json) | $0.50 |
| 15, 16 | Run and export (the corrected survey turned out not to be live yet) | `panel`, `tool_survey` | [16](briefs/16-export.txt) | [15](replies/15-panel-run.json), [16](replies/16-export.json) | $0.60 |
| 17, 18 | Confirm until the corrected survey is live | `tool_survey` | [17](briefs/17-confirm.txt), [18](briefs/18-confirm.txt) | [17](replies/17-confirm.json), [18](replies/18-confirm.json) | $1.00 |
| 20 | Run the panel: **120 of 120 completed** | `panel` | | [reply](replies/20-panel-run.json) | $0.10 |
| 21 | Export that run, with the MaxDiff design and the answer codes | `tool_survey` | [brief](briefs/21-export.txt) | [reply](replies/21-export.json) | $0.50 |

### What Flashpoint built

From one written brief, a 13-block survey that validated with no errors:

- two **price questions** for each of three items (the price where it starts to feel like
  a stretch, the price where you'd skip it and give another reason), in three blocks that
  **rotate** per respondent
- a **MaxDiff** question over the six fixes: six screens of four, in ten designs that
  Flashpoint derived itself so that every fix is shown four times
- follow-up questions shown only when they apply (**display logic**)
- an **AI-moderated** closing question, limited to two follow-ups and told not to ask for
  anything identifying
- a **synthetic panel** of 120 personas. Its split by gender follows the US adult
  population. Age, race, education and income were invented by the generator, with no
  correlation modelled between them. Flashpoint states all of this itself in
  [its reply](replies/05-panel.json).

### What Flashpoint changed in my design

- I planned to reuse its Van Westendorp pricing question with two custom price points.
  Flashpoint answered that the type needs exactly four points with fixed meanings, and
  built two price sliders per item instead, each ending in "this much or more". The site's
  rule for the top of a price range comes from that: an answer at the maximum never counts
  as priced out.
- I asked whether a slider nobody touches is stored as $0, which would read as "would skip
  it even if it were free". Flashpoint checked, found that it is, and replaced all six
  sliders with number inputs that start empty.

### What I found out about the synthetic panel runner

The first four panel runs each returned 120 responses, and every one of them ended at the
first question: 480 responses with nothing in them to use.

Flashpoint's first explanation was that the survey was still a draft. Publishing it
changed nothing. Asked to look at the responses themselves, it found the real cause: **the
synthetic panel runner walks the survey's pages in document order and does not evaluate
skip rules or terminate blocks first.** My screener sent non-students to a "thank you,
this survey is for students" page, which sat directly after the first question. A person
in a browser never sees that page unless the rule sends them there. Every persona walked
straight into it.

The fix was to delete that page. "I am not a Columbia or Barnard student" is now an
ordinary answer, and my reader drops those rows instead. The next run completed 120 of
120. One thing I checked afterwards: the two follow-up questions with display conditions
were answered only by the personas they applied to (88 and 97 of 120), so display
conditions did hold in the completed run.

Two smaller things worth knowing if you build on this: a publish needs a reply of the bare
word `confirm`, sometimes twice, and a confirm with any other text in it starts the
publish over. [`go.mjs`](go.mjs) handles both.

The site itself never calls Flashpoint. It is static, so nothing costs money or can fail
while someone is looking at it.

## What the simulated panel answered

These are the panel's answers, quoted to show the whole pipeline working. They are not
evidence about students and no price should be set from them.

- A $45 formal ticket: 37 of the 118 personas who gave a price would skip it (31%), and
  another 23 called it a stretch. $30 dues: 57 of 118 (48%). A $200 trip: 71 of 118 (60%).
- The highest price that loses no more than 1 in 10: $10 for dues, $30 for the formal, $70
  for the trip.
- Of the six fixes, **open waiver code** scored highest (+0.29) and **waiver on request**
  lowest (−0.33). Having to ask is the thing the personas avoided.
- 97 of 120 said they would add something to their own ticket to cover someone else. 66 of
  those said only if enough other members did the same.

## Checked against a known answer

The simulated panel cannot show that the page's arithmetic is right, because nobody knows
what the right answer for that panel is. So the page was also run on clubs whose answer is
known. [`scripts/evaluate.mjs`](scripts/evaluate.mjs) writes 2,000 made-up clubs, drawn
from a made-up population of 20,000 members whose true share priced out is known exactly.
Each club's file goes through the same code that reads a real export, and what the page
would say is set against the truth.

| Members who answer | Half the clubs were within | Nine in ten were within | 95% interval held the truth | Nine-in-ten price within one step |
|---|---|---|---|---|
| 10 | 10 points | 27 points | 94% | 69% |
| 20 | 8 points | 18 points | 96% | 82% |
| 40 | 5 points | 12 points | 97% | 93% |
| 80 | 4 points | 10 points | 94% | 98% |
| 160 | 3 points | 7 points | 95% | 99% |

The distances are in percentage points, between the share the page said would skip at a
price and the true share. A step is one notch of the price slider, $5 or $10. So 20
answers give a rough picture and 80 a close one, and the page says so under "How many
answers are enough?".

This checks the reading of a file, the counting, the intervals and the rule for the
nine-in-ten price. It cannot check whether what people say in a survey is what they later
do, or whether AI personas resemble students. A test reruns the whole check and fails if
the figures the page shows no longer match ([`test/evaluate.test.mjs`](test/evaluate.test.mjs)).

## Run it for your own club

The page reads a Flashpoint export itself. Under **Run it for your own club**:

1. Send your members [the survey](https://flashpointopinions.com/0a4c06d5-1ea1-43dd-89d7-2458c955b58a).
2. Export the answers from Flashpoint as one CSV file.
3. Press **Choose your file**.

The file is read on that device by [`site/js/ingest/club.js`](site/js/ingest/club.js) and
is not uploaded. The page is laid out again on the club's answers, and the banner, every
sentence and the note for the board say whose answers they are.

- It reads a file that a spreadsheet has saved again: semicolons or tabs between cells, a
  `sep=` first line, other line ends, one heading row instead of two.
- A row from an AI persona is never counted as a member, and a file with only persona rows
  is labelled simulated.
- When it can't read a file it says which column or which row is the problem, and nothing
  on the page changes.
- While a club's file is loaded the address names no view. A link could not carry the
  file, so whoever opened it would see the simulated students at the club's price.

No export to hand? **Load a made-up club** reads
[`site/data/example-club.csv`](site/data/example-club.csv): 36 invented members, written
by [`scripts/make-example.mjs`](scripts/make-example.mjs), with every number labelled as
made up.

What a club can't do alone yet is step 2. The live survey sits in my Flashpoint account,
so I run the export (see [Limits](#limits)).

## Run it

Needs Node 22 or newer. The site and the tests use no packages.

```bash
git clone https://github.com/institutor/priced-out.git
cd priced-out
npm test
npm run dev
```

Then open http://localhost:4173.

`npm install` is only needed for the scripts that talk to Flashpoint (`flashpoint.mjs`,
`ask.mjs`, `panel.mjs`, `go.mjs`).

## Rebuild the data from a Flashpoint export

Every number on the site comes from one file, `site/data/dataset.json`, built from the CSV
that Flashpoint exports. Raw exports go in `data/raw/`, which is git-ignored.

```bash
# A synthetic panel run. This is the command that built the dataset in this repository.
npm run build-data -- data/raw/panel-run-20.csv \
  --panel replies/20-panel-run.json \
  --survey 0a4c06d5-1ea1-43dd-89d7-2458c955b58a \
  --from 2026-11-20 --to 2026-11-20

# A survey of people: the same, without --panel.
npm run build-data -- data/raw/export.csv \
  --survey 0a4c06d5-1ea1-43dd-89d7-2458c955b58a \
  --from 2026-11-21 --to 2026-11-28
```

One export can hold both people and personas. The two are never mixed: with `--panel` only
the synthetic rows are read and the dataset is marked `simulated`; without it only the rows
from people are read. The script prints how many rows it set aside and why, and stops with
a clear message if a column is missing, an answer isn't one it knows, or a MaxDiff pick
isn't on the screen its design says was shown.

[`site/data/mapping.json`](site/data/mapping.json) says which export column is which question, and
holds the ten MaxDiff designs.

To go back to generated sample data: `npm run sample`.

## Talking to Flashpoint

```bash
npm install
cp .env.example .env            # then fill in the wallet key
node flashpoint.mjs balance     # free
node flashpoint.mjs tools       # free
node ask.mjs <name>             # sends briefs/<name>.txt to the survey agent, $0.50
node panel.mjs run <name>       # runs the saved panel through the survey again, $0.10
node go.mjs --dry               # shows the remaining scripted steps and sends nothing
```

Each script saves the reply to `replies/`, keeps the survey, conversation and panel ids in
`replies/state.json`, and refuses to send, and pay for, the same thing twice.

## Environment variables

| Name | Needed for | Example |
|---|---|---|
| `FLASHPOINT_WALLET_KEY` | Paid Flashpoint calls only | `0xYOUR_WALLET_PRIVATE_KEY` |
| `PORT` | Optional port for `npm run dev` (default 4173) | `4173` |

Copy `.env.example` to `.env`. `.env` is git-ignored. The site, the tests and the data
build need no key.

## How the numbers are worked out

- **Priced out** at a price: the skip price is at or below it.
- **Stretched**: not priced out, and the stretch price is at or below it.
- An answer at the top of a price range means "this much or more". It never counts inside
  the range, and prices on the site stop one step below the top.
- A blank answer is missing, never zero. Someone who gave no skip price for an item is left
  out of that item.
- A skip price of $0 is read as no answer: skipping something that is free is not about
  the price. The build prints how many it set aside.
- The figures on the receipt are all worked out over the same respondents: those who gave
  a price for every line that is ticked.
- Shares carry 95% Wilson intervals. For a simulated panel the page says what that interval
  is: how much a panel this size moves by chance, and nothing about how close it is to real
  students.
- Fix scores are best-minus-worst counts over times shown, with a bootstrap interval.
- Nothing is shown for fewer than 5 respondents. Fewer than 20 real answers overall puts
  an "early results" banner on every screen.
- People are whole: "19 of your 60" is the share times the club size, rounded, and the
  dollar figures and pledge rounds are worked out from those whole people.
- The note for the board and the message for members add no figure of their own. Each
  repeats what the page works out above it, and tests check that they agree at every price.
- A tie is never reported as a winner. Where two fixes share the top score, both are
  named and the page does not pick one.

The rules live in `site/js/lib/` and are covered by the tests in `test/` (178 tests).

## Privacy

- The survey is an anonymous public link. It asks for no name, no email, and nothing about
  income or financial aid.
- The published dataset holds one row per respondent with only their price answers and
  pledge answer, sorted by content so the order says nothing about who answered when. Year
  in school, the officer question, anything typed and the AI chat transcript are counted
  into totals or dropped before the file is written. A test checks the published file for
  exactly this.
- Raw exports stay in `data/raw/`, which is git-ignored.
- A file a club loads into the page stays on that device. The page keeps each row's prices
  and pledge, with nothing beside them to say whose they are, and forgets them when it is
  closed or reloaded.

## Limits

- The numbers are simulated. A language model's idea of a student on a tight budget is not
  a student on a tight budget.
- With real answers, students who open a link in a group chat would still not be a random
  sample of the campus, and what people say they would do can differ from what they do.
- A club can't yet run it fully alone. The page reads a club's export in the browser, but
  the live survey sits in my Flashpoint account, so I still have to run that export and
  send the club its file. A copy of the survey for each club is the next thing to build.
- The check against made-up clubs tests the page's counting. It says nothing about
  whether people do what they say they would.
- It is not a way to find the highest price people will tolerate, and it can't tell you
  why one particular member said they were busy.

## Sources

Published work behind the claims this project makes. None of it is data from this
project: every number on the site comes from the simulated panel. The sources were found
and checked with Claude Code's web search on November 21. For the journal articles and
the thesis that check covered the abstract only, apart from the school meals study, and
the two method papers at the end are listed from their records.

**Cost keeps students out of activities.**

- C.S. Mott Children's Hospital National Poll on Children's Health,
  [*Pay-to-Participate: Limiting School Activities for Lower-Income Students*](https://www.mottpoll.org/sites/default/files/documents/101716_paytoparticipate_0.pdf),
  vol. 27, issue 5, October 17, 2016. A national poll of parents. In households earning
  under $60,000, 27% said cost had cut their child's participation, against 12% of
  households earning more. 24% of students from those lower-income households were in no
  sport, arts group or club at all, against 11%.
- Snellman, Silva, Frederick and Putnam,
  ["The Engagement Gap: Social Mobility and Extracurricular Participation among American Youth"](https://doi.org/10.1177/0002716214548398),
  *ANNALS of the American Academy of Political and Social Science* 657(1), 2015, pp.
  194–207. Four national surveys of high school students show the gap between social
  classes in clubs and sports widening since the 1970s. The authors name pay-to-play
  fees among the causes.
- Lasch,
  [*Money Matters: Financial Constraints among Low-Income Students at Selective Colleges and Universities*](https://knowledge.uchicago.edu/record/13554),
  MA thesis, University of Chicago, 2018. From a survey and interviews: even students on
  generous financial aid said money affected which clubs and activities they took part in.
- The Hope Center for Student Basic Needs, Temple University,
  [*2023–2024 Student Basic Needs Survey Report*](https://hope.temple.edu/2023-2024-student-basic-needs-survey-report),
  February 2025. Of 74,350 students at 91 colleges in 16 states, 59% faced food or
  housing insecurity in at least one form. It covers the colleges that took part, not a
  national sample.

**Students who can't pay rarely say so.**

- Zelizer and Gaydosh,
  ["Class on Campus"](https://paw.princeton.edu/article/essay-class-campus),
  *Princeton Alumni Weekly*, January 9, 2019. From interviews with 59 Princeton students:
  low-income students often turned down dinners and trips they couldn't afford, and some
  gave another reason, such as being tired or having work to do.
- Chin, Jeffries and Thompson,
  ["The Impact of Downward Classism on Social Class Concealment among College Students Who Are Low-Income"](https://doi.org/10.1353/csd.2024.a929245),
  *Journal of College Student Development* 65(3), 2024, pp. 316–320. A daily diary study
  of how often low-income students hide their class background from higher-status peers.

**What it costs, at Columbia and in Science Olympiad.**

- Daffey,
  ["The Room Where It Happens"](https://www.theblueandwhite.org/post/the-room-where-it-happens),
  *The Blue and White* (Columbia's undergraduate magazine), May 19, 2025. On club sports
  at Columbia: membership costs up to $925 a semester on one team, regionals and
  nationals are often paid out of pocket, and the governing board can set aside only
  $2,000 of $19,000 for first-generation and low-income students.
- Mihelich,
  ["Maryland high school makes first trip to National Science Olympiad Tournament"](https://www.aaas.org/membership/stemedu/maryland-high-school-makes-first-trip-national-science-olympiad-tournament),
  AAAS, June 11, 2012. One team's costs: $1,500 for a trip to Philadelphia and about
  $9,000 for nationals. The coach says families in that area could absorb the travel,
  and that he isn't sure how the team would manage otherwise.

**Asking for help is the hard part.**

- C.S. Mott Children's Hospital National Poll on Children's Health,
  [*Pay-to-Participate: Impact on School Activities*](https://www.mottpoll.org/sites/default/files/documents/031819_PayToParticipate.pdf),
  vol. 33, issue 5, March 18, 2019. 29% of parents said school activities cost more than
  they expected, but only 7% had ever asked for a waiver or scholarship. 19% didn't know
  how to ask, and 5% were not comfortable asking. It bears on the fix that came last in
  the simulated panel, a waiver you have to ask the treasurer for.
- Zuercher and eight others,
  ["The Benefits and Challenges of Providing School Meals during the First Year of California's Universal School Meal Policy as Reported by School Foodservice Professionals"](https://doi.org/10.3390/nu16121812),
  *Nutrients* 16(12), 2024, article 1812. A comparison from school meals, not club fees.
  After California made meals free for every student, 64% of the 430 school food
  services surveyed reported more students eating them, and 31% reported less stigma.

**"I will if you will."**

- Fischbacher, Gächter and Fehr,
  ["Are People Conditionally Cooperative? Evidence from a Public Goods Experiment"](https://doi.org/10.1016/S0165-1765%2801%2900394-9),
  *Economics Letters* 71(3), 2001, pp. 397–404. In an experiment about paying into a
  shared pot, half the participants gave more the more others gave, and about a third
  gave nothing. That is the behaviour the pledge section asks about.

**Why every number here is labelled simulated.**

- Bisbee, Clinton, Dorff, Kenkel and Larson,
  ["Synthetic Replacements for Human Survey Data? The Perils of Large Language Models"](https://doi.org/10.1017/pan.2024.5),
  *Political Analysis* 32(4), 2024, pp. 401–416. A language model answering as survey
  respondents came close to the real averages, but its answers varied less than real
  ones, led to different statistical conclusions, and shifted with small changes in
  wording and over three months.
- Pew Research Center,
  ["Can AI Stand In for Human Survey-Takers? Not Really"](https://www.pewresearch.org/data-labs/2026/09/30/can-ai-stand-in-for-human-survey-takers-not-really/),
  September 30, 2026. AI respondents built to mirror real panel members were off by 12
  percentage points on average across nearly 300 questions. On nearly half the questions
  at least one answer was never chosen by any of them.
- Murphy, Allen, Stevens and Weatherhead,
  ["A Meta-analysis of Hypothetical Bias in Stated Preference Valuation"](https://doi.org/10.1007/s10640-004-3332-z),
  *Environmental and Resource Economics* 30(3), 2005, pp. 313–325. Across 28 studies,
  what people said they would pay ran above what they actually paid, with a median ratio
  of 1.35. Real members' answers would carry this problem too.

**Methods.**

- Wilson,
  ["Probable Inference, the Law of Succession, and Statistical Inference"](https://doi.org/10.1080/01621459.1927.10502953),
  *Journal of the American Statistical Association* 22(158), 1927, pp. 209–212. The 95%
  interval shown beside each share.
- Finn and Louviere,
  ["Determining the Appropriate Response to Evidence of Public Concern: The Case of Food Safety"](https://doi.org/10.1177/074391569201100202),
  *Journal of Public Policy & Marketing* 11(2), 1992, pp. 12–25. An early paper on
  best-worst scaling, the kind of trade-off question (MaxDiff) used to rank the six
  fixes.

## What's where

```
site/                 the page: index.html, css/, js/, data/dataset.json
site/js/lib/          the rules (curve, pledge cascade, intervals, wording, the note for the
                      board in plan.js, the message for members in announce.js, the view
                      in the address in link.js), shared with Node, and sketch.js and
                      figure.js, the geometry every drawing is made from
site/js/ui/           one module per section of the page, plus the title page (cover.js and
                      scene.js, its strip of stick figures), the contents tab and the pen
                      that draws under and over the page (ink.js, doodles.js)
site/js/ingest/       CSV reader, Flashpoint export reader, MaxDiff scoring, aggregation:
                      the page and the build script both read an export with these.
                      club.js is the reader the page uses for a club's own file
scripts/              build-data (export to dataset), evaluate (the check against made-up
                      clubs), make-example (the made-up club), make-sample, dev server
site/data/            dataset.json (the published answers), evaluation.json (what the check
                      found), example-club.csv (the made-up club)
test/                 node:test suites
briefs/, replies/     everything sent to and received from Flashpoint
flashpoint.mjs        the MCP client that pays per call (the organizers' starter, unchanged)
ask.mjs, panel.mjs    send one brief to the survey agent, run the synthetic panel
go.mjs                the publish, run and export steps in order
site/data/mapping.json  which export column is which question, and the MaxDiff designs
docs/                 design, build plan, submission write-up
```

## Build week, day by day

The build period ran from November 13 to 21, 2026. Nothing in this repository is older
than that: its first file dates from November 18 and its first commit from November 20.
Times are Eastern.

- **Sun Nov 15.** Read the participant guide and the organizers' emails. Decided to work
  alone, on software only, in the Engineering & Product track with Best Social Impact as
  a second aim. Went through about twenty candidate problems with Claude Code and compared
  them against both rubrics. Priced Out came out on top.
- **Mon Nov 16.** Read the organizers' follow-up emails and listed what still had to be
  set up before Flashpoint could be called.
- **Wed Nov 18.** Set up the connection to Flashpoint: the organizers' starter client
  ([`flashpoint.mjs`](flashpoint.mjs), copied unchanged from the hackathon setup manual),
  its packages, and the wallet it pays from.
- **Fri Nov 20.** Nearly all of the build, in one day (59 commits, throughout the day).
  - Went back over the ideas and settled on Priced Out. Wrote the brief, and Flashpoint
    drafted the survey from it.
  - Wrote the design and the build plan, then the rules behind the numbers with their
    tests, then the page section by section, the README and the first write-up.
  - Flashpoint published the survey. I decided not to send it to real students, and had
    Flashpoint generate a synthetic panel to answer it.
  - The panel's runs kept ending at the first question. Finding out why, fixing the
    survey and getting a complete run took about forty minutes and most of the paid
    calls ([what I found](#what-i-found-out-about-the-synthetic-panel-runner)).
  - Loaded the panel's answers into the site, rewrote the README and write-up to say the
    numbers are simulated, and put the site online.
  - Redrew the whole page by hand: a drawing library, the pen that draws under and over
    the page, and a title page.
- **Sat Nov 21.** In the early morning, redrew the title page as a strip of stick figures
  drawn a stroke at a time. Tried a zoom on the title page and a section that scrolled
  sideways, and took both out again within the hour; those commits are still in the
  history. Added the step-by-step guide for judges and this log. Looked up published
  sources for the claims the project makes and listed them under Sources.

  From about 5:20am, on my instruction to keep improving every part of the site, Claude
  Code worked for several hours without me at the keyboard. In that stretch the page
  learned to read a club's own export in the browser, with a made-up club to try it on.
  The item, price and club size went into the address, so a view can be shared. "What it
  would take" got its table of one thing priced three ways. The page gained the note for
  the board, the message for members, the parts on why this exists and how the survey was
  made, the check against 2,000 made-up clubs, and the contents tab. The changes were then
  read through again for mistakes, and the ones found were fixed.

## Outside resources

Nothing in this repository existed before the build period. What came from outside:

- **The organizers' starter client.** [`flashpoint.mjs`](flashpoint.mjs) is copied
  unchanged from the hackathon setup manual. It needs four npm packages: `@x402/evm`,
  `@x402/fetch`, `undici` and `viem`. Nothing else in the repository is installed
  from outside: the site uses no library or framework, and the tests use Node's own
  test runner.
- **Typefaces.** The site loads four from Google Fonts: Atkinson Hyperlegible, Atkinson
  Hyperlegible Mono, Londrina Solid and Londrina Sketch.
- **Published sources**, listed under [Sources](#sources).
- **Flashpoint and Claude Code**, described below.

## AI tools used

- **Flashpoint** (primary): designed, validated, hosted and published the survey, built
  the MaxDiff design, generated and ran the synthetic panel, and exported its answers.
  The panel's answers were written by `gpt-5.4-mini`, the model Flashpoint ran it on.
- **Claude Code** (Anthropic): wrote the code, tests and documents in this repository with
  me, as well as assisting in co-writing the briefs I sent to Flashpoint.

No AI runs in the live site. Every respondent in the data is AI-generated, and the site
says so wherever a number appears.
