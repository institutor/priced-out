// The walk up the price: a line of people along a ruler of prices, each
// standing where they said they would step out. This file is the geometry of
// that line and of the scroll that moves along it. Who stands where comes
// from walkAway() in curve.js.

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// Where each person stands. `spots` are the places they belong, in order
// along the ruler. Nobody may stand closer than `gap` to the next person, so
// people who belong at the same spot stand side by side around it, and a
// crowded stretch spreads out by as little as it can. (This is the least
// total movement that keeps the order and the gap: isotonic regression,
// pooling neighbours that would overlap.)
export function lineUp(spots, gap) {
  const blocks = [];
  spots.forEach((spot, index) => {
    // Taking each person's place in the queue off their spot turns "at least
    // a gap apart" into "not out of order".
    let block = { sum: spot - index * gap, count: 1 };
    while (blocks.length > 0 && blocks.at(-1).sum / blocks.at(-1).count > block.sum / block.count) {
      const before = blocks.pop();
      block = { sum: before.sum + block.sum, count: before.count + block.count };
    }
    blocks.push(block);
  });
  const places = [];
  for (const block of blocks) {
    for (let i = 0; i < block.count; i++) places.push(block.sum / block.count + places.length * gap);
  }
  return places;
}

// How far apart the labelled prices on a ruler should be: the smallest round
// amount whose labels have at least `room` between them, on a ruler that is
// `perUnit` long for each dollar.
export function tickEvery(perUnit, room, rounds = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500]) {
  for (const amount of rounds) {
    if (amount * perUnit >= room) return amount;
  }
  return rounds.at(-1);
}

// Where the walk has got to, from how far the page has scrolled past the
// point where the strip was pinned. The scroll is spent in order on: a short
// wait, a zoom in from the whole line to its start, the walk itself, a zoom
// back out, and another short wait. Returns the share of the walk done
// (`along`, 0 to 1) and how far zoomed in the view is (`zoom`, 0 for the
// whole line, 1 for close up).
export function walkStage(scrolled, { lead = 0, zoom = 0, pan = 1 }) {
  const ease = (t) => t * t * (3 - 2 * t);
  const part = (from, length) => (length > 0 ? clamp((scrolled - from) / length, 0, 1) : scrolled >= from ? 1 : 0);
  const zoomIn = part(lead, zoom);
  const along = part(lead + zoom, pan);
  const zoomOut = part(lead + zoom + pan, zoom);
  return { along, zoom: zoom > 0 ? ease(zoomIn) * (1 - ease(zoomOut)) : 1, leaving: zoomOut > 0 };
}

// How long the scroll for all of that is.
export function walkLength({ lead = 0, zoom = 0, pan = 1 }) {
  return lead * 2 + zoom * 2 + pan;
}
