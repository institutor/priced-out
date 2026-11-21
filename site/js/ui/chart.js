// The price curve: share who would skip the item at each price, with its 95%
// interval, the chosen price, and the visitor's guess. It is drawn in pen:
// the curve gone over twice, the interval shaded with slanted lines, the
// guess marked with a cross. The points the pen passes through are the data.
import { el, svg, clear } from "./dom.js";
import { drawnIn, path, seedOf } from "./ink.js";
import { money, pct } from "../lib/format.js";
import * as sketch from "../lib/sketch.js";

const MARGIN = { top: 20, right: 24, bottom: 42, left: 46 };

// The drawing is scaled to the page, so a phone gets a narrower drawing
// rather than the wide one shrunk until its labels are unreadable.
function frame(narrow) {
  const width = narrow ? 380 : 720;
  const height = narrow ? 290 : 300;
  return {
    WIDTH: width,
    HEIGHT: height,
    INNER_WIDTH: width - MARGIN.left - MARGIN.right,
    INNER_HEIGHT: height - MARGIN.top - MARGIN.bottom,
  };
}

function priceTicks(max, count) {
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((multiple) => multiple * magnitude).find((candidate) => candidate >= rough);
  const ticks = [];
  for (let tick = 0; tick <= max + 1e-9; tick += step) ticks.push(tick);
  return ticks;
}

const pathOf = (points) => points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join("");

export function renderCurve(root, { points, item, price, guess, n, synthetic, narrow = false, people = "students" }) {
  clear(root);
  const { WIDTH, HEIGHT, INNER_WIDTH, INNER_HEIGHT } = frame(narrow);
  const maxPrice = points.at(-1).price;
  const x = (value) => MARGIN.left + (value / maxPrice) * INNER_WIDTH;
  const y = (share) => MARGIN.top + (1 - share) * INNER_HEIGHT;
  const at = (value) => points.reduce((best, point) => (Math.abs(point.price - value) < Math.abs(best.price - value) ? point : best));

  const seed = seedOf(`curve ${item.id} ${narrow}`);
  const chart = svg("svg", {
    class: "art",
    viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
    role: "img",
    "aria-label": `Share of ${people} who would skip ${item.label.toLowerCase()} at each price from ${money(0)} to ${money(maxPrice)}. The numbers are in the table below the chart.`,
  });

  [0, 0.25, 0.5, 0.75, 1].forEach((share, index) => {
    const rule = sketch.line(MARGIN.left, y(share), WIDTH - MARGIN.right, y(share), { seed: seed + index, rough: 1, passes: share === 0 ? 2 : 1 });
    chart.append(
      path(rule, share === 0 ? "axis-line" : "grid-line"),
      svg("text", { x: MARGIN.left - 8, y: y(share) + 4, "text-anchor": "end", text: share === 0 ? "0" : pct(share) }),
    );
  });
  for (const tick of priceTicks(maxPrice, narrow ? 4 : 6)) {
    chart.append(svg("text", { x: x(tick), y: HEIGHT - MARGIN.bottom + 18, "text-anchor": "middle", text: money(tick) }));
  }
  chart.append(svg("text", { x: WIDTH - MARGIN.right, y: HEIGHT - 4, "text-anchor": "end", text: "Price" }));

  const band = [
    ...points.map((point) => [x(point.price), y(point.outHigh)]),
    ...[...points].reverse().map((point) => [x(point.price), y(point.outLow)]),
  ];
  // The interval is shaded with one run of slanted pen lines, cut off at its
  // edges.
  const shade = drawnIn(
    sketch.hatch(MARGIN.left, MARGIN.top, INNER_WIDTH, INNER_HEIGHT, { seed: seed + 10, gap: 7, rough: 1, angle: -58 }),
    "band-hatch",
  );
  shade.forEach((stroke) => {
    stroke.setAttribute("clip-path", "url(#curve-band)");
    stroke.style.setProperty("--lasts", "1100ms");
  });
  chart.append(svg("clipPath", { id: "curve-band" }, svg("path", { d: `${pathOf(band)}Z` })), ...shade);

  if (synthetic) {
    const last = synthetic.points.at(-1);
    chart.append(
      path(sketch.polyline(synthetic.points.map((point) => [x(point.price), y(point.out)]), { seed: seed + 20, rough: 0.8, passes: 1 }), "synthetic-line"),
      svg("text", { x: x(last.price), y: y(last.out) - 8, "text-anchor": "end", text: "AI-simulated students" }),
    );
  }

  const line = drawnIn(
    sketch.polyline(points.map((point) => [x(point.price), y(point.out)]), { seed: seed + 30, rough: 0.9, passes: 2 }),
    "curve-line",
    { wait: 250 },
  );
  line.forEach((stroke) => stroke.style.setProperty("--lasts", "900ms"));
  chart.append(...line);

  const current = at(price);
  const labelOnRight = x(current.price) < WIDTH - (narrow ? 150 : 190);
  chart.append(
    path(sketch.line(x(current.price), MARGIN.top, x(current.price), HEIGHT - MARGIN.bottom, { seed: seed + 40, rough: 0.9, passes: 1 }), "marker-line"),
    path(`${sketch.ellipse(x(current.price), y(current.out), 6, 6, { seed: seed + 41, rough: 0.6, steps: 10 })}Z`, "marker-dot"),
    svg("text", {
      class: "label",
      x: x(current.price) + (labelOnRight ? 12 : -12),
      y: y(current.out) - 10,
      "text-anchor": labelOnRight ? "start" : "end",
      text: `${pct(current.out)} at ${money(current.price)}`,
    }),
  );

  if (guess) {
    const gx = x(guess.price);
    const gy = y(Math.min(1, Math.max(0, guess.share)));
    const guessOnRight = !labelOnRight || Math.abs(guess.price - current.price) > maxPrice * 0.12;
    chart.append(
      path(
        sketch.line(gx - 6, gy - 6, gx + 6, gy + 6, { seed: seed + 50, rough: 0.7, passes: 1 })
          + sketch.line(gx + 6, gy - 6, gx - 6, gy + 6, { seed: seed + 51, rough: 0.7, passes: 1 }),
        "guess-mark",
      ),
      svg("text", {
        class: "label",
        x: gx + (guessOnRight ? 12 : -12),
        y: gy + 4,
        "text-anchor": guessOnRight ? "start" : "end",
        text: `Your guess, ${pct(guess.share)}`,
      }),
    );
  }

  // Hover: a crosshair that snaps to the nearest surveyed price, and a readout.
  const crosshair = svg("line", { class: "cross-line", y1: MARGIN.top, y2: HEIGHT - MARGIN.bottom, visibility: "hidden" });
  const hoverDot = svg("circle", { class: "marker-dot", r: 4, visibility: "hidden" });
  const tooltip = el("div", { class: "tooltip", hidden: true });
  const overlay = svg("rect", { x: MARGIN.left, y: MARGIN.top, width: INNER_WIDTH, height: INNER_HEIGHT, fill: "transparent" });

  const hide = () => {
    crosshair.setAttribute("visibility", "hidden");
    hoverDot.setAttribute("visibility", "hidden");
    tooltip.hidden = true;
  };
  overlay.addEventListener("pointerleave", hide);
  overlay.addEventListener("pointermove", (event) => {
    const box = chart.getBoundingClientRect();
    const scale = WIDTH / box.width;
    const value = (((event.clientX - box.left) * scale - MARGIN.left) / INNER_WIDTH) * maxPrice;
    const point = at(value);
    crosshair.setAttribute("x1", x(point.price));
    crosshair.setAttribute("x2", x(point.price));
    crosshair.setAttribute("visibility", "visible");
    hoverDot.setAttribute("cx", x(point.price));
    hoverDot.setAttribute("cy", y(point.out));
    hoverDot.setAttribute("visibility", "visible");
    clear(tooltip).append(
      el("strong", { text: `${pct(point.out)} would skip it` }),
      `at ${money(point.price)} (interval ${pct(point.outLow)} to ${pct(point.outHigh)})`,
    );
    tooltip.hidden = false;
    tooltip.style.left = `${Math.min(Math.max(x(point.price) / scale, 90), box.width - 90)}px`;
    tooltip.style.top = `${chart.offsetTop + y(point.out) / scale}px`;
  });
  chart.append(crosshair, hoverDot, overlay);

  const table = el("table", {},
    el("thead", {}, el("tr", {}, el("th", { text: "Price" }), el("th", { text: "Would skip" }), el("th", { text: "Interval, low" }), el("th", { text: "Interval, high" }))),
    el("tbody", {}, points.map((point) =>
      el("tr", {}, el("td", { text: money(point.price) }), el("td", { text: pct(point.out) }), el("td", { text: pct(point.outLow) }), el("td", { text: pct(point.outHigh) })),
    )),
  );

  root.append(
    el("p", { class: "chart-title", text: "Share who would skip it, by price" }),
    el("p", { class: "chart-note", text: `${n} ${people} answered for this item. The shaded band is the 95% interval.` }),
    chart,
    tooltip,
    el("details", { class: "table-view" }, el("summary", { text: "Show these numbers as a table" }), table),
  );
}
