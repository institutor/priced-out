// How numbers are written on the page.
export function money(amount) {
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export function pct(share) {
  if (share === null || share === undefined) return "–";
  return `${Math.round(share * 100)}%`;
}

// A share of a club, in whole people.
export function people(share, size) {
  if (share === null || share === undefined) return 0;
  return Math.round(share * size);
}
