# Priced Out

**Every number here and on the site comes from 120 AI personas in a Flashpoint synthetic
panel. No real student was surveyed. The numbers show the product working; they are not
findings about students.**

## The problem

A club sets its dues at $30 and its formal at $45 because that is what it cost last year.
Some members can't pay that. Almost none of them say so. They say they have an exam, or
other plans, and after the second or third time they stop coming. The treasurer sees a
slightly smaller turnout and no reason for it.

So the price that decides who gets to belong is set by the people least able to see what it
does. Priced Out measures where students quietly drop out, and puts the number in front of
the person choosing the price, before they choose it.

## What I built

A one-page calculator for club treasurers, fed by a survey made and run in Flashpoint
(Engineering & Product track).

You fill in one line, "A formal ticket at $45 in a club of 60", and guess how many members
would skip it. Then the page shows you a room of 60 seats, the ones that empty, and the
full curve from $0 up. Below that, it turns the problem into a decision:

- the highest price that loses no more than 1 in 10
- what a lower access price would bring back, in people and in dollars
- which way of offering a lower price respondents picked over the others
- whether members' own "I will if you will" pledges would cover the empty seats
- a printable receipt for a whole year in the club, with the share lost at each line

The site is static: plain HTML, CSS and JavaScript reading one JSON file. The rules behind
the numbers are small pure functions with 119 tests.

## How Flashpoint was used

Flashpoint did the research, end to end, over MCP: sixteen paid calls, $6.50, every brief
and reply saved in the repository with its payment receipt.

**It built the survey from a written brief.** Two price questions for each of three items
in rotating blocks, follow-ups shown only when they apply, an AI-moderated closing
question, and a MaxDiff question over six fixes in ten designs it derived itself. Rating
six fixes gets six polite "sounds fine" answers. Choosing the best and worst of four at a
time gets a ranking.

**It corrected my design twice.** I had planned to reuse its Van Westendorp question with
two custom price points. It told me that type needs exactly four, with fixed meanings, and
built two price questions per item instead. Later I asked whether a slider nobody touches
is stored as $0, which would read as "would skip it even if it were free". It is, so
Flashpoint replaced the sliders with empty number inputs.

**It generated and ran the respondents.** Flashpoint generated 120 personas meant to
resemble Columbia and Barnard undergraduates, and a language model answered the survey as
each one.

**That run is where I learned the most.** The first four runs came back with all 480
responses ended at the first question. Flashpoint's first diagnosis, an unpublished draft,
was wrong. Asked to read the responses themselves, it found the cause: the synthetic
runner walks pages in document order without evaluating skip rules, so every persona
walked into the "this survey is for students" page that sat after the screener. A person
in a browser would never have seen it. Flashpoint deleted the page, my reader took over
the screening, and the fifth run completed 120 of 120.

## What the simulated panel answered

Simulated, on November 20, 2026. 120 personas; 118 gave a price for each item.

- **A $45 formal:** 37 of 118 would skip it and say something else (31%), and 23 more
  called it a stretch. In a club of 60 that is 19 empty seats. **$30 dues:** 57 of 118
  (48%).
- **The highest price that loses no more than 1 in 10:** $10 for dues, $30 for the formal,
  $70 for a weekend trip.
- **The fix that won** was an open waiver code sent to every member, no questions asked
  (+0.29 on a scale from −1 to +1). **The fix that lost** was a waiver you have to ask the
  treasurer for (−0.33).
- **Pledges:** 97 of 120 would add to their own ticket to cover someone else, 66 of them
  only if enough others did. At a $45 formal in a club of 60 that pays for 3 of the 19
  empty seats.

## What it can't tell you

Whether any of this is true of students. A language model's idea of a student on a tight
budget is not that student. Flashpoint marks the panel uncalibrated, and the site says so
on every screen: a banner, the word "simulated" in every sentence with a number in it, and
a line on the printed receipt. The survey also asks what people said when they skipped
something. An invented person's excuse is not evidence, so the site leaves that out.

The product is deliberately not two things. It is not a lie detector: it says nothing about
why any one member is busy. And it is not a price maximiser: it shows who a price leaves
out, never the most a club could get away with charging.

## What I would do next

Put the survey in front of one real club. The link is live and the same code reads the
answers, never mixing people with personas. Then run the winning fix at one real event, to
see whether what people say they would use is what they use.

## Links

- Site: https://institutor.github.io/priced-out/
- Code: https://github.com/institutor/priced-out
- Survey: https://flashpointopinions.com/0a4c06d5-1ea1-43dd-89d7-2458c955b58a
