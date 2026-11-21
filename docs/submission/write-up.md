# Priced Out

*Submission write-up, Engineering & Product track. Draft of November 20: every figure
marked PENDING is filled in from the survey export on November 21 and nowhere else.*

## The problem

A club sets its dues at $30 and its formal at $45 because that is what it cost last year.
Some members can't pay that. Almost none of them say so. They say they have an exam, or
other plans, and after the second or third time they stop coming. The treasurer sees a
slightly smaller turnout and no reason for it.

So the price that decides who gets to belong is set by the people least able to see what it
does. That is the gap Priced Out fills: it measures where students quietly drop out, and
puts the number in front of the person choosing the price, before they choose it.

## What I built

A one-page calculator for club treasurers, built on a survey of Columbia and Barnard
students.

You fill in one line, "A formal ticket at $45 in a club of 60", and guess how many members
would skip it. Then the page shows you: a room of 60 seats, the ones that empty, the share
of surveyed students behind that with its 95% interval, and the full curve from $0 up.

Below it, the page turns the problem into a decision:

- the highest price that loses no more than 1 in 10 students
- what a lower access price would bring back, in people and in dollars (people who were
  paying nothing now pay something, so the club usually comes out ahead)
- which way of offering a lower price students said they would actually use
- whether members' own "I will if you will" pledges would cover the empty seats
- a printable receipt for a whole year in the club, with the share lost at each line

The site is static: plain HTML, CSS and JavaScript modules, no framework and no build step,
reading one JSON file. The rules behind the numbers are small pure functions with tests.

## How Flashpoint was used

Flashpoint did the research. I wrote a brief describing the nine questions I wanted and the
reasons for each, and Flashpoint's survey agent built the survey: screening, two price
sliders for each of three items in rotating blocks, a MaxDiff question over six fixes,
follow-ups shown only when they apply, and an AI-moderated closing question. It validated
the survey, hosted it on a public anonymous link, and exported the answers as CSV. Each
brief I sent and each reply I got back is in the repository, with the payment receipts.

Flashpoint also corrected my design. I had planned to reuse its Van Westendorp pricing
question with two custom price points. It told me that question type needs exactly four
points with fixed meanings, and proposed sliders. That one answer shaped a rule that runs
through the whole product: an answer at the top of a slider means "this much or more", so
it never counts as priced out, and the calculator stops one step short of the top.

The MaxDiff question is the part I could not have done by hand in a night. Asking students
to rate six fixes gets you six polite "sounds fine" answers. Making them choose the best
and worst from four at a time gets you a ranking.

## What the students said

PENDING: number of students, and the dates the survey was open.

PENDING: share who would skip a $45 formal, with interval; the same for $30 dues.

PENDING: the fix ranked first and the fix ranked last.

PENDING: how many said they had skipped something over cost, and how many of those said
so at the time.

PENDING: the typical guess for a $40 formal against the students' own answers.

## What it can't tell you

The students who answered opened a link in a group chat. They are not a random sample of
the campus, and they were asked what they would do, which is not the same as what they do.
The site says this on the page, shows an interval beside every share, and shows nothing at
all for fewer than five students.

It is also deliberately not two things. It is not a lie detector: it reports what
priced-out students said, in total, and says nothing about why any one member is busy. And
it is not a price maximiser: it shows who a price leaves out, never the most a club could
get away with charging.

## What I would do next

Give any club its own survey link, so the curve is its own members' and not the campus's.
And run the fix that wins as an experiment at one real event, to see whether what students
said they would use is what they use.

## Links

- Site: PENDING
- Code: https://github.com/institutor/priced-out
- Survey: PENDING
