// The view written into the page's address, so that it can be sent to
// someone: which item, at what price, in a club of what size, and whether
// the answer is showing. Whatever an address says is checked against what
// the page allows, so a mistyped or made-up address still opens a view that
// works.

const whole = (text) => (text !== null && /^-?\d+(\.\d+)?$/.test(text.trim()) ? Number(text) : null);

// `items` are the things that can be priced, `start` is the view the page
// opens with, and `prices` gives a starting price for each item, used when an
// address names an item and no price.
export function readLink(search, items, start, prices = {}) {
  const asked = new URLSearchParams(search);
  const item = items.find((candidate) => candidate.id === asked.get("item")) ?? items.find((candidate) => candidate.id === start.itemId);

  let price = whole(asked.get("price"));
  if (price === null) price = item.id === start.itemId ? start.price : prices[item.id] ?? start.price;
  const top = item.max - item.step;
  price = Math.min(top, Math.max(0, Math.round(price / item.step) * item.step));

  let size = whole(asked.get("club"));
  size = size === null ? start.size : Math.min(300, Math.max(5, Math.round(size)));

  return { itemId: item.id, price, size, revealed: asked.get("answer") === "1" ? true : start.revealed };
}

// The address for a view. The view the page opens with needs none.
export function writeLink(view, start) {
  const same = view.itemId === start.itemId && view.price === start.price && view.size === start.size && view.revealed === start.revealed;
  if (same) return "";
  const asked = new URLSearchParams({ item: view.itemId, price: view.price, club: view.size });
  if (view.revealed) asked.set("answer", "1");
  return `?${asked}`;
}
