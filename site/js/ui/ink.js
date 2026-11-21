// Puts hand-drawn SVG behind, over and inside parts of the page, using the
// geometry in lib/sketch.js. A drawing sized to an element is redrawn when
// the element changes size, with the same seed, so the hand stays the same.
import { el, svg } from "./dom.js";
import * as sketch from "../lib/sketch.js";

// A seed from a name, so each thing on the page gets its own hand.
export function seedOf(name) {
  let hash = 2166136261;
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export const path = (d, className = "", attrs = {}) => svg("path", { d, class: className, ...attrs });

// One path per pen stroke. Inside a part of the page that is being drawn for
// the first time (class "drawing"), the strokes appear one after another.
export function drawnIn(d, className = "", { from = 0, wait = 0 } = {}) {
  return sketch.strokes(d).map((stroke, index) => {
    const node = svg("path", { d: stroke, class: `draw ${className}`.trim(), pathLength: 1 });
    node.style.setProperty("--i", from + index);
    if (wait) node.style.setProperty("--wait", `${wait}ms`);
    return node;
  });
}

// A free-standing drawing with its own coordinate box.
export function art(className, width, height, ...children) {
  return svg("svg", {
    class: `art ${className}`.trim(),
    viewBox: `0 0 ${width} ${height}`,
    "aria-hidden": "true",
    focusable: "false",
  }, children);
}

const redraws = new WeakMap();
const sizes = typeof ResizeObserver === "undefined"
  ? null
  : new ResizeObserver((entries) => {
    for (const entry of entries) {
      for (const redraw of redraws.get(entry.target) ?? []) redraw();
    }
  });

// Lays a drawing under an element (or over it), sized to the element.
// `draw(width, height)` returns SVG nodes.
export function ink(node, draw, { over = false } = {}) {
  const layer = svg("svg", { class: over ? "ink over" : "ink", "aria-hidden": "true", focusable: "false" });
  node.classList.add("inked");
  if (over) node.append(layer);
  else node.prepend(layer);

  let drawnWidth = -1;
  let drawnHeight = -1;
  const redraw = (again = false) => {
    const width = node.offsetWidth;
    const height = node.offsetHeight;
    if (width === 0 || height === 0) return;
    if (!again && width === drawnWidth && height === drawnHeight) return;
    drawnWidth = width;
    drawnHeight = height;
    layer.setAttribute("viewBox", `0 0 ${width} ${height}`);
    layer.replaceChildren(...[draw(width, height)].flat(Infinity).filter(Boolean));
  };
  redraws.set(node, [...(redraws.get(node) ?? []), redraw]);
  sizes?.observe(node);
  redraw();
  return layer;
}

// Draws everything again at its present size. Lettering that arrives late
// moves the words, and a drawing that follows the words has to follow.
export function redrawAll(root = document) {
  for (const node of root.querySelectorAll(".inked")) {
    for (const redraw of redraws.get(node) ?? []) redraw(true);
  }
}

// Empties a part of the page that is about to be rebuilt, and stops watching
// the drawings that were in it.
export function wipe(root) {
  if (sizes) {
    for (const node of root.querySelectorAll(".inked")) sizes.unobserve(node);
  }
  root.textContent = "";
  return root;
}

// Lets a part of the page draw itself in the first time it scrolls into view.
// The class comes off again afterwards, so later redraws just appear.
export function drawWhenSeen(node, { lasts = 2600 } = {}) {
  if (typeof IntersectionObserver === "undefined") return;
  const watcher = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    watcher.disconnect();
    node.classList.add("drawing");
    window.setTimeout(() => node.classList.remove("drawing"), lasts);
  }, { threshold: 0.15 });
  watcher.observe(node);
}

// Keeps a small drawing shivering, like frames of a hand-drawn film, for as
// long as it is on screen.
export function shiverWhileSeen(node) {
  if (typeof IntersectionObserver === "undefined") return node;
  new IntersectionObserver((entries) => {
    for (const entry of entries) node.classList.toggle("shiver", entry.isIntersecting);
  }).observe(node);
  return node;
}

// One seat in the room. "go" is coloured in, "stretched" is highlighted,
// "out" is an empty dashed outline. An emptying seat starts coloured in and
// has its colour rubbed out.
export function seat(kind = "go", seed = 1, { emptying = false } = {}) {
  const outline = sketch.blob(2.6, 2.6, 18.8, 18.8, { seed, rough: 0.9, round: 0.22 });
  const scribble = () => sketch.hatch(3.4, 3.4, 17.2, 17.2, { seed, gap: 3, rough: 0.7, angle: -48 + (seed % 5) * 4 });
  const parts = [];
  if (kind === "go") parts.push(path(scribble(), "seat-fill", { pathLength: 1 }), path(outline, "seat-line"));
  if (kind === "stretched") parts.push(path(outline, "seat-wash"), path(outline, "seat-line"));
  if (kind === "out") {
    if (emptying) {
      parts.push(path(scribble(), "seat-fill seat-erase", { pathLength: 1 }), path(outline, "seat-line seat-fade"));
    }
    parts.push(path(outline, "seat-gap"));
  }
  return art(`seat-art ${kind}`, 24, 24, parts);
}

// A highlighter swipe and an inked rule under a blank that can be filled in.
// A blank that opens a list also gets a small arrowhead.
export function highlight(node, name, { caret = false } = {}) {
  const seed = seedOf(`blank ${name}`);
  ink(node, (width, height) => {
    const parts = [
      path(sketch.blob(-3, height * 0.44, width + 6, height * 0.48, { seed, rough: 1.6, round: 0.3 }), "hl-fill"),
      path(sketch.line(-2, height * 0.94, width + 2, height * 0.94, { seed: seed + 1, rough: 1.1, passes: 2 }), "hl-rule"),
    ];
    if (caret) {
      const size = height * 0.13;
      const x = width - height * 0.2;
      const y = height * 0.62;
      parts.push(path(
        sketch.polygon([[x - size, y - size * 0.6], [x, y + size * 0.6], [x + size, y - size * 0.6]], { seed: seed + 2, rough: 0.5, close: false }),
        "hl-caret",
      ));
    }
    return parts;
  });
  return node;
}

// A highlighter swipe over a few words, with no rule under it.
export function marked(node, name) {
  const seed = seedOf(`marked ${name}`);
  node.classList.add("marked");
  ink(node, (width, height) => path(
    sketch.blob(-5, height * 0.2, width + 10, height * 0.72, { seed, rough: 1.5, round: 0.3 }),
    "hl-fill",
  ));
  return node;
}

// A text input inside a highlighted blank.
export function blank(input, name) {
  return highlight(el("span", { class: "blank-wrap" }, input), name);
}

// A text input with only a pen line under it.
export function underlined(input, name) {
  const seed = seedOf(`line ${name}`);
  const wrap = el("span", { class: "blank-wrap" }, input);
  ink(wrap, (width, height) => path(sketch.line(0, height - 1.5, width, height - 1.5, { seed, rough: 0.7, passes: 1 }), "hl-rule"));
  return wrap;
}

// A button coloured in with marker, with a loose outline round it.
export function inkButton(node, name = node.textContent) {
  const seed = seedOf(`button ${name}`);
  ink(node, (width, height) => [
    path(sketch.blob(1.5, 1.5, width - 3, height - 3, { seed, rough: 1.5, round: 0.2 }), "btn-fill"),
    path(sketch.rect(3, 3, width - 6, height - 6, { seed: seed + 1, rough: 1.8, passes: 1, over: 4 }), "btn-line"),
  ]);
  return node;
}

export function button(props, text) {
  return inkButton(el("button", { class: "button", type: "button", ...props }, el("span", { text })), text);
}

// A loop round a figure, like a number circled in pen.
export function circled(node, name) {
  const seed = seedOf(`circle ${name}`);
  ink(node, (width, height) => drawnIn(
    sketch.ellipse(width / 2, height / 2, width / 2 + 12, height / 2 + 7, { seed, rough: 1.8 }),
    "circle-line",
  ), { over: true });
  return node;
}

// A torn-off line across the top of a section.
export function perforation(node, name) {
  const seed = seedOf(`perforation ${name}`);
  ink(node, (width, height) => path(sketch.dashes(0, height / 2, width, height / 2, { seed, dash: 13, gap: 9, rough: 0.9 }), "perf"));
  return node;
}

// Underlines the last line of a heading in pen. The words go in a wrapper so
// that the line can be measured wherever the heading wraps.
export function underlineLastLine(node, name) {
  const seed = seedOf(`heading ${name}`);
  const words = el("span", { class: "h-text" }, [...node.childNodes]);
  node.replaceChildren(words);
  ink(node, () => {
    const lines = words.getClientRects();
    if (lines.length === 0) return [];
    const box = node.getBoundingClientRect();
    const last = lines[lines.length - 1];
    return drawnIn(
      sketch.underline(last.left - box.left, last.bottom - box.top + 2, last.right - box.left, { seed, rough: 1.4 }),
      "h-rule",
      { wait: 450 },
    );
  }, { over: true });
  return node;
}
