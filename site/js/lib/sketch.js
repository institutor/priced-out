// Hand-drawn geometry: lines that bow, boxes whose corners overshoot, fills
// that are scribbled in. Every function returns SVG path data. The same seed
// always gives the same drawing, so nothing twitches when the page redraws,
// and a different seed gives the same shape drawn by the same hand again.

export function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// One decimal is finer than a pen. It also never prints "-0".
const num = (value) => String(Math.round(value * 10) / 10 || 0);
const pt = (x, y) => `${num(x)},${num(y)}`;
const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

// One pen stroke from a to b. The ends land a little off and the line bows.
// Short strokes wander less than long ones, as a hand does.
function penStroke(random, x1, y1, x2, y2, rough) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  const wander = rough * Math.min(1, 0.4 + length / 180);
  const off = () => (random() * 2 - 1) * wander;
  const ax = x1 + off();
  const ay = y1 + off();
  const bx = x2 + off();
  const by = y2 + off();
  let nx = 0;
  let ny = 0;
  if (length > 0) {
    nx = -(y2 - y1) / length;
    ny = (x2 - x1) / length;
  }
  const bow1 = off() * 1.4;
  const bow2 = off() * 1.4;
  const t1 = 0.28 + random() * 0.16;
  const t2 = 0.58 + random() * 0.16;
  const c1 = pt(ax + (bx - ax) * t1 + nx * bow1, ay + (by - ay) * t1 + ny * bow1);
  const c2 = pt(ax + (bx - ax) * t2 + nx * bow2, ay + (by - ay) * t2 + ny * bow2);
  return `M${pt(ax, ay)}C${c1} ${c2} ${pt(bx, by)}`;
}

// A smooth curve through points (Catmull-Rom, written as cubic Béziers).
function curveThrough(points) {
  if (points.length === 0) return "";
  const [first] = points;
  if (points.length === 1) return `M${pt(first[0], first[1])}L${pt(first[0], first[1])}`;
  let d = `M${pt(first[0], first[1])}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = pt(p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6);
    const c2 = pt(p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6);
    d += `C${c1} ${c2} ${pt(p2[0], p2[1])}`;
  }
  return d;
}

// Splits path data into its separate pen strokes, so each can be animated.
export function strokes(d) {
  return d.match(/M[^M]*/g) ?? [];
}

// A straight line, gone over `passes` times.
export function line(x1, y1, x2, y2, { seed = 1, rough = 1.2, passes = 2 } = {}) {
  const random = makeRandom(seed);
  let d = "";
  for (let pass = 0; pass < passes; pass++) d += penStroke(random, x1, y1, x2, y2, rough);
  return d;
}

// A dashed line: short separate strokes, none quite the same length.
export function dashes(x1, y1, x2, y2, { seed = 1, dash = 9, gap = 7, rough = 0.6 } = {}) {
  const length = Math.hypot(x2 - x1, y2 - y1);
  if (length === 0) return "";
  const random = makeRandom(seed);
  const ux = (x2 - x1) / length;
  const uy = (y2 - y1) / length;
  const count = Math.max(1, Math.round((length + gap) / (dash + gap)));
  let d = "";
  for (let i = 0; i < count; i++) {
    const start = clamp(i * (dash + gap) + (random() - 0.5) * gap * 0.3, 0, length);
    const end = clamp(start + dash * (0.85 + random() * 0.3), 0, length);
    d += penStroke(random, x1 + ux * start, y1 + uy * start, x1 + ux * end, y1 + uy * end, rough);
  }
  return d;
}

// A box drawn as four strokes. Each runs a little past its corners.
export function rect(x, y, width, height, { seed = 1, rough = 1.2, passes = 2, over = 2 } = {}) {
  const random = makeRandom(seed);
  const past = () => random() * over;
  let d = "";
  for (let pass = 0; pass < passes; pass++) {
    d += penStroke(random, x - past(), y, x + width + past(), y, rough);
    d += penStroke(random, x + width, y - past(), x + width, y + height + past(), rough);
    d += penStroke(random, x + width + past(), y + height, x - past(), y + height, rough);
    d += penStroke(random, x, y + height + past(), x, y - past(), rough);
  }
  return d;
}

// A shape with straight sides, each side its own stroke. `close` joins the
// last point back to the first.
export function polygon(points, { seed = 1, rough = 1, passes = 1, close = true } = {}) {
  const random = makeRandom(seed);
  const last = close ? points.length : points.length - 1;
  let d = "";
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < last; i++) {
      const from = points[i];
      const to = points[(i + 1) % points.length];
      d += penStroke(random, from[0], from[1], to[0], to[1], rough);
    }
  }
  return d;
}

// A closed, slightly lopsided box with soft corners, for anything coloured in.
export function blob(x, y, width, height, { seed = 1, rough = 1.2, round = 0.25 } = {}) {
  const random = makeRandom(seed);
  const off = () => (random() * 2 - 1) * rough;
  const corners = [
    [x + off(), y + off()],
    [x + width + off(), y + off()],
    [x + width + off(), y + height + off()],
    [x + off(), y + height + off()],
  ];
  const radius = Math.min(width, height) * round;
  const edges = corners.map((from, index) => {
    const to = corners[(index + 1) % 4];
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const ux = length > 0 ? (to[0] - from[0]) / length : 0;
    const uy = length > 0 ? (to[1] - from[1]) / length : 0;
    const r = Math.min(radius, length / 2);
    const bow = off() * 1.6;
    return {
      start: [from[0] + ux * r, from[1] + uy * r],
      end: [to[0] - ux * r, to[1] - uy * r],
      middle: [(from[0] + to[0]) / 2 - uy * bow, (from[1] + to[1]) / 2 + ux * bow],
      corner: to,
    };
  });
  let d = `M${pt(edges[0].start[0], edges[0].start[1])}`;
  edges.forEach((edge, index) => {
    const next = edges[(index + 1) % 4];
    d += `Q${pt(edge.middle[0], edge.middle[1])} ${pt(edge.end[0], edge.end[1])}`;
    d += `Q${pt(edge.corner[0], edge.corner[1])} ${pt(next.start[0], next.start[1])}`;
  });
  return `${d}Z`;
}

// Scribbled shading: one unbroken zigzag across the box, pen never lifted.
export function hatch(x, y, width, height, { seed = 1, gap = 5, angle = -45, rough = 0.8 } = {}) {
  if (!(width > 0) || !(height > 0) || !(gap > 0)) return "";
  const random = makeRandom(seed);
  const radians = (angle * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const nx = -dy;
  const ny = dx;
  const across = [[x, y], [x + width, y], [x + width, y + height], [x, y + height]].map(([cx, cy]) => cx * nx + cy * ny);
  const from = Math.min(...across);
  const to = Math.max(...across);
  const off = () => (random() * 2 - 1) * rough;

  // Where the line at distance t from the origin crosses the box.
  const span = (t) => {
    let low = -Infinity;
    let high = Infinity;
    for (const [origin, step, min, max] of [[nx * t, dx, x, x + width], [ny * t, dy, y, y + height]]) {
      if (Math.abs(step) < 1e-9) {
        if (origin < min || origin > max) return null;
        continue;
      }
      const a = (min - origin) / step;
      const b = (max - origin) / step;
      low = Math.max(low, Math.min(a, b));
      high = Math.min(high, Math.max(a, b));
    }
    return high > low ? [low, high] : null;
  };

  const points = [];
  let forward = true;
  for (let t = from + gap * 0.5; t < to; t += gap * (0.82 + random() * 0.36)) {
    const range = span(t);
    if (!range) continue;
    const ends = range.map((s) => [
      clamp(nx * t + dx * s + off(), x, x + width),
      clamp(ny * t + dy * s + off(), y, y + height),
    ]);
    if (!forward) ends.reverse();
    points.push(...ends);
    forward = !forward;
  }
  if (points.length === 0) return "";
  return points.map(([px, py], index) => `${index === 0 ? "M" : "L"}${pt(px, py)}`).join("");
}

// A loop drawn round something, like a number someone circled. It is left
// open: the pen runs a little past where it started and drifts outward.
export function ellipse(cx, cy, rx, ry, { seed = 1, rough = 1, overlap = 0.14, steps = 16 } = {}) {
  const random = makeRandom(seed);
  const start = -2.4 + (random() - 0.5) * 0.8;
  const sweep = Math.PI * 2 * (1 + overlap);
  const points = [];
  for (let i = 0; i <= steps; i++) {
    const turn = i / steps;
    const angle = start + sweep * turn;
    const drift = 0.97 + turn * 0.07;
    points.push([
      cx + Math.cos(angle) * rx * drift + (random() * 2 - 1) * rough * 0.6,
      cy + Math.sin(angle) * ry * drift + (random() * 2 - 1) * rough * 0.6,
    ]);
  }
  return curveThrough(points);
}

// A line through points, for charts. The first and last points are kept
// close; the ones between wander a little more.
export function polyline(points, { seed = 1, rough = 1, passes = 2 } = {}) {
  const random = makeRandom(seed);
  let d = "";
  for (let pass = 0; pass < passes; pass++) {
    const moved = points.map(([px, py], index) => {
      const end = index === 0 || index === points.length - 1;
      const wander = end ? rough * 0.5 : rough;
      return [px + (random() * 2 - 1) * wander, py + (random() * 2 - 1) * wander];
    });
    d += curveThrough(moved);
  }
  return d;
}

// The points of a torn edge running from x1 to x2.
function teeth(random, x1, y, x2, tooth, depth, rough) {
  const width = Math.abs(x2 - x1);
  const count = Math.max(2, Math.round(width / tooth) * 2);
  const points = [];
  for (let i = 0; i <= count; i++) {
    const px = x1 + ((x2 - x1) * i) / count;
    const py = y + (i % 2 === 0 ? 0 : depth);
    points.push([px + (random() * 2 - 1) * rough, py + (random() * 2 - 1) * rough]);
  }
  return points;
}

// A torn edge, like the end of a till receipt.
export function zigzag(x1, y, x2, { seed = 1, tooth = 12, depth = 7, rough = 0.8 } = {}) {
  const random = makeRandom(seed);
  return teeth(random, x1, y, x2, tooth, depth, rough)
    .map(([px, py], index) => `${index === 0 ? "M" : "L"}${pt(px, py)}`)
    .join("");
}

// A slip of paper: straight sides, torn top and bottom.
export function slip(x, y, width, height, { seed = 1, tooth = 14, depth = 7, rough = 0.9 } = {}) {
  const random = makeRandom(seed);
  const top = teeth(random, x, y, x + width, tooth, depth, rough);
  const bottom = teeth(random, x + width, y + height, x, tooth, -depth, rough);
  return `${[...top, ...bottom].map(([px, py], index) => `${index === 0 ? "M" : "L"}${pt(px, py)}`).join("")}Z`;
}

// An arrow: a bent shaft and two strokes for the head.
export function arrow(x1, y1, x2, y2, { seed = 1, head = 10, rough = 1, bend = 0.18 } = {}) {
  const random = makeRandom(seed);
  const off = () => (random() * 2 - 1) * rough;
  const length = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = -(y2 - y1) / length;
  const ny = (x2 - x1) / length;
  const control = [(x1 + x2) / 2 + nx * length * bend + off(), (y1 + y2) / 2 + ny * length * bend + off()];
  const tip = [x2 + off() * 0.5, y2 + off() * 0.5];
  const heading = Math.atan2(tip[1] - control[1], tip[0] - control[0]);
  const barb = (turn) => {
    const angle = heading + Math.PI + turn + off() * 0.04;
    return `M${pt(tip[0] + Math.cos(angle) * head + off(), tip[1] + Math.sin(angle) * head + off())}L${pt(tip[0], tip[1])}`;
  };
  return `M${pt(x1 + off(), y1 + off())}Q${pt(control[0], control[1])} ${pt(tip[0], tip[1])}${barb(0.5)}${barb(-0.5)}`;
}

// A tick, as in a ticked box.
export function check(x, y, size, { seed = 1, rough = 0.6 } = {}) {
  const random = makeRandom(seed);
  const off = () => (random() * 2 - 1) * rough;
  const at = (fx, fy) => pt(x + size * fx + off(), y + size * fy + off());
  return `M${at(0.14, 0.52)}L${at(0.4, 0.84)}L${at(0.94, 0.12)}`;
}

// An underline: one stroke across and a shorter one back beneath it.
export function underline(x1, y, x2, { seed = 1, rough = 1.2 } = {}) {
  const random = makeRandom(seed);
  const width = x2 - x1;
  return penStroke(random, x1, y, x2, y - 1 + random() * 2, rough)
    + penStroke(random, x2 - width * (0.04 + random() * 0.08), y + 3.5, x1 + width * (0.18 + random() * 0.2), y + 4.5, rough);
}
