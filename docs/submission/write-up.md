# Priced Out

**Every number here and on the site comes from 120 AI personas in a Flashpoint synthetic
panel. No real student was surveyed. The numbers show the product working; they are not
findings about students.**

## The problem

During my time in high school, I found myself often faced with times where I couldn't
exactly afford to pay for certain club dues, and I wish I could have done something about
it. For instance, my school's Science Olympiad competitions often cost hundreds of dollars
for just travel and hotels alone, a cost that I could not afford to pay at all.

Priced Out is the idea I dreamt up that I wish the people setting those costs had had. It
could have shown them, before the price went out, how many of us it would leave behind and
which way of offering a lower price we would have used, without anyone having to say they
couldn't pay. Because, you know, if thirty students pay twenty dollars for an event,
that's actually more money netted than fifteen students paying thirty dollars.

Students who can't pay rarely say so. They say they're busy and stop coming. In interviews
at Princeton, low-income students turned down dinners, some giving other reasons; in a
national poll, only 7% of parents had ever requested a fee waiver or scholarship.

## What I built

A one-page calculator for club treasurers, fed by a survey made and run in Flashpoint.
The survey is an anonymous link. It asks for no name, no email, and nothing about income
or financial aid.

**Why AI personas, not a student survey.** Only a club's own officers can get its members
to answer, so I could not have surveyed a whole club, let alone every club. The answer is
also different for each club. And the point is that any club can run this on its own
members. So 120 AI personas stand in for one club and show it working.

You fill in one line, "A formal ticket at $45 in a club of 60", and guess how many members
would skip it. Then the page shows a room of 60 seats, the ones that empty, and the curve
from $0 up. Below that:

- the highest price that loses no more than 1 in 10
- what a lower access price would bring back
- which way of offering a lower price respondents picked
- whether members' own pledges would cover the empty seats
- a printable receipt for a year in the club
- a note for the board and a message for members

The site is static, with 208 tests. Run on 2,000 made-up clubs with known answers, its 95%
interval held the truth in 94% to 97%.

## How Flashpoint was used

Flashpoint did the research over MCP: sixteen paid calls, $6.50, every brief and reply
saved with its receipt.

**It built the survey from a written brief.** Two price questions for each of three items
in rotating blocks, follow-ups shown only when they apply, an AI-moderated closing
question, and a MaxDiff question over six fixes in ten designs it derived itself.

**It corrected my design twice.** I had planned to reuse its Van Westendorp question with
two custom price points. It told me that type needs exactly four, with fixed meanings, and
built two price questions per item instead. Later I asked whether a slider nobody touches
is stored as $0, which would read as "would skip it even if it were free". It is, so
Flashpoint replaced the sliders with empty number inputs.

**It generated and ran the respondents:** 120 personas meant to resemble Columbia and
Barnard undergraduates, each answered by a language model.

**That run is where I learned the most.** The first four runs came back with all 480
responses ended at the first question. Flashpoint's first diagnosis was wrong. Asked to
read the responses themselves, it found the cause: the synthetic runner walks pages in
document order without evaluating skip rules, so every persona walked into the "this
survey is for students" page that sat after the screener. Flashpoint deleted the page, my
reader took over the screening, and the fifth run completed 120 of 120.

**What it changed, kept and ruled out.** Changed: the price questions and the sliders.
Kept: the six fixes and the trade-off question between them. Ruled out: showing
what personas said when they skipped, since an invented excuse is not evidence.

## What the simulated panel answered

Simulated, on November 20, 2026. 120 personas; 118 gave a price for each item.

- **A $45 formal:** 37 of 118 would skip it and say something else (31%), and 23 more
  called it a stretch. In a club of 60 that is 19 empty seats.
- **A $20 access price for that formal** brings back about 16 of the 60. At $45 they were
  paying nothing, so that is about $320 more for the club, not less.
- **The highest price that loses no more than 1 in 10:** $10 for dues, $30 for the formal,
  $70 for a weekend trip.
- **The fix that won** was an open waiver code sent to every member, no questions asked
  (+0.29 on a scale from −1 to +1). **The fix that lost** was a waiver you have to ask the
  treasurer for (−0.33).
- **Pledges:** 97 of 120 would add to their own ticket to cover someone else, 66 of them
  only if enough others did. At a $45 formal in a club of 60 that pays for 3 of the 19
  empty seats.

## Limits and what I would do next

Swap the stand-in for a real club: the link is live and the page reads a club's export in
the browser, though I still run that export. Then try the winning fix at one event, to see
whether people use what they said they would.

## Links

- Site: https://institutor.github.io/priced-out/
- Code and sources: https://github.com/institutor/priced-out
- Survey: https://flashpointopinions.com/0a4c06d5-1ea1-43dd-89d7-2458c955b58a
