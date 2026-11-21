// How numbers, and the things being priced, are written on the page.
export function money(amount) {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function pct(share) {
  if (share === null || share === undefined) return "–";
  return `${Math.round(share * 100)}%`;
}

// What an item is called in the middle of a sentence: "a formal ticket".
const PHRASES = { dues: "semester of dues", formal: "formal ticket", trip: "weekend trip" };
export const phrase = (item) => PHRASES[item.id] ?? item.short.toLowerCase();

// A share of a club, in whole people.
export function people(share, size) {
  if (share === null || share === undefined) return 0;
  return Math.round(share * size);
}
