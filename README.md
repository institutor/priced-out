# Priced Out

Students who can't afford a club's dues, formal or trip rarely say so. They say they're
busy, and stop showing up. The people setting the price never find out.

Priced Out asks students for the price at which that happens, and gives a club treasurer
the answer before the price is announced: at this price, in a club this size, about this
many members would quietly skip it.

Built by one person for the Flashpoint AI x Columbia AI Club hackathon (November 2026),
Engineering & Product track.

## What it does

One page, in the order a treasurer would use it.

1. **Price check.** Fill in the line "A *formal ticket* at $*45* in a club of *60*", guess
   how many would skip it, then see the answer: a room of seats that empties, the share of
   surveyed students behind it with a 95% interval, and the whole curve from $0 up.
2. **What it would take.** The highest price that loses no more than 1 in 10, and what a
   lower access price would bring back, in people and in dollars.
3. **The fix students said they'd use.** Six ways to offer a lower price (sliding scale,
   waiver on request, open waiver code, pay what you can, paid-forward tickets, discount
   draw), ranked by a trade-off question.
4. **Would members cover it themselves?** Many students say they'd add a few dollars to
   their own ticket, but only if enough others do. The page plays that out for your club and
   counts how many empty seats the pool pays for.
5. **The receipt for a year in your club.** Dues, formal and trip on one printable slip,
   with the share of students lost at each line and at any line.
6. **What they said instead.** What students who were priced out told people at the time,
   and how far everyone's guess was from the same students' own answers.
7. **How we know, and what we don't.** Who answered, and what the numbers can't tell you.

## Where the numbers come from

Every number on the site comes from one file, `site/data/dataset.json`, which is built from
the CSV that Flashpoint exports for the survey.

**Status on November 20:** the survey is drafted in Flashpoint and goes out overnight. Until
its answers are exported, the dataset is generated sample data, and the site says so in a
banner on every screen. Sample data is there to build and test against. It is not a finding
and is not reported as one anywhere.

## How it uses Flashpoint

Flashpoint is the research half of the project: the survey was designed, checked, hosted
and exported with Flashpoint's survey agent (`tool_survey`), paid per call from a wallet.
Every brief sent and every reply received is in this repository, with the payment receipt.

| Step | Sent | Flashpoint's reply | Cost |
|---|---|---|---|
| Design the survey | [`briefs/02-draft.txt`](briefs/02-draft.txt) | [`replies/02-draft.json`](replies/02-draft.json) | $0.50 |
| Fix the sliders, publish, describe the export | [`briefs/03-publish.txt`](briefs/03-publish.txt) | pending | $0.50 |

What Flashpoint built from the first brief (13 blocks, validated with 0 errors):

- a screening question that ends the survey for anyone who isn't a Columbia or Barnard
  student
- two **price sliders** for each of three items (where it starts to feel like a stretch,
  where you'd skip it and give another reason), in three blocks that **rotate** per
  respondent
- a **MaxDiff** question over the six fixes, with a design Flashpoint derived itself
- follow-up questions shown only when they apply (**display logic**)
- an **AI-moderated** closing question, limited to two follow-ups and told not to ask for
  anything identifying

What Flashpoint changed, and why it mattered:

- The first idea was to reuse its Van Westendorp pricing question with two custom price
  points. Flashpoint answered that the type needs exactly four points with fixed meanings,
  and used sliders instead. The site's "top of the scale" rule exists because of that: an
  answer at a slider's maximum means "this much or more" and never counts as priced out.
- The slider type can't show a dollar sign, so the question text carries "(in dollars)".
- A slider nobody touches must not be stored as $0, which would read as "would skip it even
  if it were free". The second brief asks Flashpoint to check this and swap in number inputs
  if needed.

The site itself never calls Flashpoint. It is static, so nothing costs money or can fail
while someone is looking at it.

## Run it

Needs Node 22 or newer. The site and the tests use no packages.

```bash
git clone <this repository>
cd priced-out
npm test
npm run dev
```

Then open http://localhost:4173.

`npm install` is only needed for the two scripts that talk to Flashpoint (`flashpoint.mjs`,
`ask.mjs`).

## Rebuild the data from a Flashpoint export

```bash
# 1. Export the survey's responses as CSV from Flashpoint into data/raw/ (git-ignored).
# 2. Tell the reader which column is which, once:
#      edit data/mapping.json so each entry names the real column header
# 3. Build the dataset the site reads:
npm run build-data -- data/raw/export.csv \
  --survey 0a4c06d5-1ea1-43dd-89d7-2458c955b58a \
  --from 2026-11-20 --to 2026-11-21
```

The script prints how many answers it found for each question and stops with a clear
message if a column is missing or an answer isn't one it knows.

To go back to sample data: `npm run sample`.

## Talking to Flashpoint

```bash
npm install
cp .env.example .env            # then fill in the wallet key
node flashpoint.mjs balance     # free
node flashpoint.mjs tools       # free
node ask.mjs 03-publish         # sends briefs/03-publish.txt, costs $0.50
```

`ask.mjs` saves each reply to `replies/`, keeps the conversation and survey ids in
`replies/state.json`, and refuses to send the same brief twice.

## Environment variables

| Name | Needed for | Example |
|---|---|---|
| `FLASHPOINT_WALLET_KEY` | Paid Flashpoint calls only | `0xYOUR_WALLET_PRIVATE_KEY` |
| `PORT` | Optional port for `npm run dev` (default 4173) | `4173` |

Copy `.env.example` to `.env`. `.env` is git-ignored. Nothing else in the project needs a
key.

## How the numbers are worked out

- **Priced out** at a price: the student's skip price is at or below it.
- **Stretched**: not priced out, and their stretch price is at or below it.
- An answer at the top of a slider means "this much or more". It never counts inside the
  range, and prices on the site stop one step below the top.
- A blank answer is missing, never zero. A student who gave no skip price for an item is
  left out of that item.
- A skip price of $0 is read as no answer. Skipping something that is free is not about
  the price, and a slider nobody touched can be stored the same way. The build prints how
  many it set aside.
- The figures on the receipt are all worked out over the same students: those who gave a
  price for every line that is ticked.
- Shares carry 95% Wilson intervals. Fix scores are best-minus-worst counts over times
  shown, with a bootstrap interval.
- Nothing is shown for fewer than 5 students. Fewer than 20 answers overall puts an
  "early results" banner on every screen.
- People are whole: "13 of your 60" is the share times the club size, rounded, and the
  dollar figures and pledge rounds are worked out from those whole people.
- Someone who opened the survey and answered nothing after the first question is not
  counted as a respondent.

The rules live in `site/js/lib/` and are covered by the tests in `test/`.

## Privacy

- The survey is an anonymous public link. It asks for no name, no email, and nothing about
  income or financial aid.
- The published dataset holds one row per student with only their price answers and pledge
  answer, sorted by content so the order says nothing about who answered when. Year in
  school, the officer question and anything typed are counted into totals or dropped before
  the file is written.
- Raw exports stay in `data/raw/`, which is git-ignored.

## Limits

- Students who open a link in a group chat are not a random sample of the campus.
- People were asked what they would do. What they actually do can differ.
- It is not a way to find the highest price people will tolerate, and it can't tell you why
  one particular member said they were busy.

## What's where

```
site/                 the page: index.html, css/, js/, data/dataset.json
site/js/lib/          the rules (curve, pledge cascade, intervals), shared with Node
site/js/ui/           one module per section of the page
scripts/              build-data (export to dataset), make-sample, dev server
scripts/lib/          CSV reader, Flashpoint export reader, MaxDiff scoring, aggregation
test/                 node:test suites
briefs/, replies/     everything sent to and received from Flashpoint
data/mapping.json     which export column is which survey question
docs/                 design, build plan, submission write-up
```

## AI tools used

- **Flashpoint** (primary): designed, validated, hosted and exported the survey, including
  the MaxDiff design and the AI-moderated follow-up question.
- **Claude Code** (Anthropic): wrote the code, tests and documents in this repository with
  me, and drafted the briefs I sent to Flashpoint.

No AI runs in the live site, and no AI-generated respondents are in the data. If a
simulated panel is ever shown for comparison, it is drawn as a separate dashed line and
labelled "AI-simulated students".
