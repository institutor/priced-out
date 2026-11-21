// The fixed vocabulary of the survey. Ids here are the only names the rest of
// the code uses; the wording respondents saw is in briefs/02-draft.txt.

export const ITEMS = [
  { id: "dues", label: "One semester of club dues", short: "Club dues", max: 100, step: 5 },
  { id: "formal", label: "A ticket to the club formal", short: "Formal ticket", max: 150, step: 5 },
  { id: "trip", label: "A weekend trip with the club", short: "Weekend trip", max: 400, step: 10 },
];

export const FIXES = [
  { id: "sliding", label: "Sliding scale", detail: "You privately pick your price from a few levels." },
  { id: "request", label: "Waiver on request", detail: "You message the treasurer for a discount code." },
  { id: "open", label: "Open waiver code", detail: "A discount code is sent to every member, no questions asked." },
  { id: "pwyc", label: "Pay what you can", detail: "You enter any amount, even $0." },
  { id: "forward", label: "Paid-forward tickets", detail: "Other members chip in extra, and anyone can claim a covered ticket." },
  { id: "draw", label: "Discount draw", detail: "Every buyer gets a random discount, so nobody can tell who needed one." },
];

export const SAID = [
  { id: "truth", label: "Said it cost too much" },
  { id: "busy", label: "Said they were busy" },
  { id: "exam", label: "Said they had work or an exam" },
  { id: "plans", label: "Said they had other plans" },
  { id: "uninterested", label: "Said they weren't interested" },
  { id: "silent", label: "Said nothing and didn't go" },
  { id: "other", label: "Something else" },
];

export const PLEDGE_AMOUNTS = [0, 1, 2, 3, 5, 10];
export const PLEDGE_THRESHOLDS = [0, 5, 10, 20, "most"];

// Any figure based on fewer respondents than this is not shown.
export const MIN_CELL = 5;
// Fewer respondents than this overall and the site shows a pilot warning.
export const PILOT_N = 20;
// The fixed price respondents were asked to guess about.
export const GUESS = { item: "formal", price: 40 };
