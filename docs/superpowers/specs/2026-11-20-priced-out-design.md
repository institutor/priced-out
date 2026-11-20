# Priced Out: short design

Date: 2026-11-20. Deadline: submissions close Saturday 2026-11-21, 1:00pm ET.

## Why

Club dues, formals and trips quietly exclude students who can't afford them. They give a
different reason and stop showing up, so the people setting prices never see it. Priced Out
measures the price at which that happens and gives club treasurers a number to act on.

Entry: Flashpoint AI x Columbia AI Club hackathon, Engineering & Product track, also aiming
at Best Social Impact. Solo, software only.

## Goals

- A survey of real Columbia and Barnard students, fielded tonight through Flashpoint.
- A calculator: a treasurer enters an event type and a price and sees the share of surveyed
  students priced out (with the number of respondents shown) and the fix students prefer.
- Every number in the product comes from the Flashpoint export.

## Not goals

- No accounts, payments or real ticketing.
- No claims about subgroups too small to report (for example students on aid).
- No Flashpoint calls from the live product.

## Anti-goals

- Anything that reads as a lie detector for one member's excuse. Totals only.
- A tool tuned to find the highest price people will tolerate.
- Invented or unlabelled data. Synthetic respondents, if used, are labelled wherever shown.

## Constraints

- About 19 hours, one person. Answers must arrive overnight, so the survey goes out first.
- Public anonymous link only: no names, no emails, no question on aid or income.
- Each Flashpoint survey-agent step costs $0.50 from a 24.5 USDC wallet. Paid calls are run
  by the owner, not by the assistant.
- Provided Anthropic key works only with claude-haiku-5-5 and claude-sonnet-5-5 (untested).

## Approaches considered for the research

1. One survey with a price question run backwards, a trade-off (MaxDiff) question over fixes,
   and a pledge question. Chosen: it works with any sample size and the curve is the product.
2. Conjoint over event designs. Dropped: needs far more answers than one night gives.
3. Two-version experiment on waiver wording. Dropped: halves an already small sample.

## Decided (approved by the owner on 2026-11-20)

Survey, about 3 minutes, in this order: year; ever helped price a club event; two price
points (stretch, skip) for dues, a formal ticket and a weekend trip; guess how many of 100
students would skip a $40 formal; ever skipped for cost; what you said at the time; MaxDiff
over six fixes (sliding scale, waiver on request, open waiver code, pay what you can,
paid-forward tickets, discount draw); pledge amount and threshold; optional AI follow-up.
Exact wording is in `briefs/02-draft.txt`.

Assistant's calls, not yet confirmed by the owner: the $40 figure and the price ranges
($0-100 dues, $0-150 formal, $0-400 trip).

## Still open

- Whether Flashpoint has a price sensitivity question type that takes this wording; sliders
  are the fallback.
- The calculator's design (static page from the exported CSV is the working assumption),
  the submission format, and whether to add a labelled synthetic-respondent comparison.
