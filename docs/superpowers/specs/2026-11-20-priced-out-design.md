# Priced Out: design

Date: 2026-11-20. Deadline: submissions close Saturday 2026-11-21, 1:00pm ET.
Entry: Flashpoint AI x Columbia AI Club hackathon, Engineering & Product track, also aiming
at Best Social Impact. One person, software only.

## Why

Club dues, formals and trips quietly exclude students who can't afford them. They give a
different reason and stop showing up, so the people setting prices never see it. Priced Out
measures the price at which that happens and gives a club treasurer a number to act on
before the price is announced.

## Who it is for

- **Treasurers and event chairs** pricing dues, a formal or a trip. They are the users.
- **Students who get priced out.** They are who it is meant to help, and they are the
  survey respondents.

## Goals

- A survey of real Columbia and Barnard students, fielded through Flashpoint by public link.
- A calculator that turns the answers into a decision: enter an item and a price, see the
  share of surveyed students who would skip it, with the sample size and an interval.
- Show a fix, not only a problem: the fix students rated least awkward, what an access
  price would bring back, and whether members' own pledges would cover the gap.
- Every number in the product comes from the Flashpoint export.

## Not goals

- No accounts, payments or real ticketing.
- No claims about subgroups too small to report.
- No Flashpoint calls from the live site. The site is static.

## Anti-goals

- A lie detector. The survey says what priced-out students said, never how likely one
  member's excuse is to be about money. Totals only.
- A price maximiser. The tool reports who is lost at a price; it never recommends the
  highest price people will tolerate.
- Invented or unlabelled data. Development uses generated sample data that the site labels
  on every screen. Synthetic respondents, if shown, are labelled wherever they appear.

## Constraints

- About 18 hours, one person. Answers must arrive overnight, so the survey goes out first
  and the product is built against sample data, then switched to the real export.
- Public anonymous link only: no names, no emails, no question on aid or income.
- The public site ships no free text and no demographics per respondent.
- Each Flashpoint survey-agent step costs $0.50 from a 24.5 USDC wallet. Paid calls are run
  by the owner.
- The exact shape of Flashpoint's CSV export is unknown until a survey exists, so everything
  format-specific sits in one adapter.

## Approaches considered

Research:
1. One survey with a price question run backwards, a trade-off (MaxDiff) question over
   fixes, and a pledge question. **Chosen**: works with any sample size and the curve is the
   product.
2. Conjoint over event designs. Dropped: needs far more answers than one night gives.
3. Two-version experiment on waiver wording. Dropped: halves an already small sample.

Product:
1. Static site with the data baked in as one JSON file, served by GitHub Pages. **Chosen**:
   nothing to break during judging, no keys on a server, a judge opens one link.
2. A server that queries Flashpoint live. Dropped: costs money per view and puts a wallet
   key on a server.
3. A written report with charts. Dropped: weak on product execution, and a treasurer can't
   enter their own price.

## The survey (approved by the owner on 2026-11-20)

About 3 minutes, in this order. Exact wording is in `briefs/02-draft.txt`.

1. Year (screens out non Columbia/Barnard students).
2. Ever helped plan a paid event or set dues (officer or not).
3. Two prices for each of three items: where it starts to feel like a stretch, and where
   you would skip it and give a different reason.
4. Out of 100 Columbia students, how many would skip a $40 formal because of the price.
5. Ever skipped a club event or not joined a club mainly because of cost.
6. What you said at the time (multi-select, only if 5 is yes).
7. MaxDiff over six fixes.
8. Would you add to your own ticket to cover someone, how much, and only if how many
   others did.
9. Optional follow-up on the last time cost kept you out (AI-moderated or open text).

Assistant's calls, not confirmed by the owner: the $40 figure and the price ranges.

### Fixed vocabulary

Items (id, label, slider max, step):

| id | label | max | step |
|---|---|---|---|
| `dues` | One semester of club dues | 100 | 5 |
| `formal` | A ticket to the club formal | 150 | 5 |
| `trip` | A weekend trip with the club | 400 | 10 |

Fixes (id, label): `sliding` Sliding scale, `request` Waiver on request, `open` Open waiver
code, `pwyc` Pay what you can, `forward` Paid-forward tickets, `draw` Discount draw.

What you said (id): `truth` (it cost too much), `busy`, `exam` (work or an exam), `plans`,
`uninterested`, `silent` (said nothing), `other`.

Pledge: amount in {0, 1, 2, 3, 5, 10}; threshold in {0, 5, 10, 20, "most"}, where 0 means
"I would do it anyway".

## The product

One page, six parts, in the order a treasurer would use them.

1. **Price check.** Pick an item, set a price and a club size. Before the result shows, the
   visitor guesses the share who would skip. Then: the share priced out with a 95% interval
   and the sample size, the share who would pay but feel stretched, the same in people
   ("about 19 of your 60"), and a curve of both shares across the price range with the
   chosen price and the visitor's guess marked.
2. **What it would take.** The highest price that loses no more than 1 in 10, and an access
   price: the price at which no more than 1 in 20 are lost. Shows how many people an access
   tier brings back and what they would add in revenue, since at the full price they paid
   nothing.
3. **The fix students prefer.** The six fixes ranked by MaxDiff score with intervals.
4. **Would pledges cover it?** A threshold cascade from the pledge answers: who gives
   regardless, who joins once enough others have, how much that raises, and how many of the
   priced-out seats it covers.
5. **The real receipt.** Add the year's items with their prices; the page prints a receipt
   with the share lost at each line, the total cost of belonging, and the share priced out
   of at least one line.
6. **What people said, and how we know.** What priced-out students said at the time, the
   guess gap at $40 (all respondents, and officers if there are enough), then method and
   limits.

### Rules the numbers follow

- Priced out at price p: the respondent's skip price is at or below p.
- Stretched at p: not priced out, and the stretch price is at or below p.
- An answer at the top of a slider means "this much or more". It never counts as priced
  out or stretched inside the range, and prices are limited to max minus one step.
- A stretch price above the skip price is treated as equal to the skip price. A missing
  stretch price is treated the same way. A missing skip price leaves the respondent out of
  that item.
- A blank answer is missing, never zero.
- Intervals for shares are 95% Wilson intervals. MaxDiff scores are best-minus-worst counts
  over times shown, with a 95% bootstrap interval over respondents.
- Any figure based on fewer than 5 respondents is not shown.
- Fewer than 20 respondents overall shows a pilot warning.

### Data on the site

`site/data/dataset.json`, built by a script. It holds a `meta` block (kind `sample` or
`real`, n, dates, source), the item list, one row per respondent with only the price pairs
and the pledge answer (shuffled, no year, no officer flag, no free text), and aggregates for
the fixes, what people said, the skipped question and the guesses. An optional `synthetic`
block has the same rows for Flashpoint's synthetic respondents.

When `meta.kind` is not `real`, a banner on every screen says the data is generated sample
data and not real responses.

## How Flashpoint is used

- The survey is designed, checked, published and distributed with the Flashpoint survey
  agent. Every brief sent and every reply is kept in `briefs/` and `replies/`, with the
  payment receipt links.
- MaxDiff and the optional AI-moderated question are Flashpoint question types.
- Results come from Flashpoint's CSV export; its own summary is quoted in the write-up.
- Optional: a labelled synthetic-respondent run for comparison.

Other AI tools are disclosed in the README: Claude Code wrote the code and drafted the
survey brief.

## Left to the builder

Visual design, module layout, test cases beyond those the plan names, and the mapping from
Flashpoint's real export columns once one is available.
