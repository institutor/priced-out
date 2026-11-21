// The title page. A strip of stick figures is drawn first (scene.js): a
// price is called out, and one member says they can't make it. Under it the
// question the page is for is written a word at a time, and then the title
// is pencilled a letter at a time and inked over. A click, a tap or a key
// finishes the drawing at once. Everything drawn here is decoration: what
// the figures say, the question, the heading, the note and the link are
// plain HTML and are there without it.
//
// Scrolling away from the title page does not move it. It stays where it is
// and the view closes in on the one who can't come, while the rest of the
// page slides up over it like the next sheet of paper.
import { el, svg } from "./dom.js";
import { drawnIn, inkButton } from "./ink.js";
import * as sketch from "../lib/sketch.js";
import * as scene from "./scene.js";
import { follow, stillPreferred } from "./scroll.js";

// When each part of the drawing starts, in milliseconds. The strip of
// figures goes first, and everything else follows from when it ends.
const SCENE = 250;
const AFTER = SCENE + scene.LASTS;
const AT = {
  scene: SCENE,
  ask: AFTER + 200,
  title: AFTER + 750,
  out: AFTER + 1500,
  rule: AFTER + 2100,
  note: AFTER + 1500,
  go: AFTER + 1800,
  settled: AFTER + 3200,
};

// The lettering needs its two typefaces before it can be measured. If they
// never arrive the title is drawn in whatever the browser falls back to.
function lettersReady() {
  if (!document.fonts?.load) return Promise.resolve();
  const wanted = Promise.all([
    document.fonts.load("400 100px 'Londrina Solid'"),
    document.fonts.load("400 100px 'Londrina Sketch'"),
  ]);
  const giveUp = new Promise((resolve) => window.setTimeout(resolve, 1800));
  return Promise.race([wanted, giveUp]).catch(() => {});
}

// How much closer the view is by the time the title page is covered.
const CLOSER = 1.5;

const wait = (node, ms) => {
  node.style.setProperty("--wait", `${ms}ms`);
  return node;
};

// The question is written out a word at a time.
function writeOut(node, starts) {
  const words = node.textContent.trim().split(/\s+/);
  node.replaceChildren();
  words.forEach((word, index) => {
    if (index > 0) node.append(" ");
    node.append(wait(el("span", { class: "word", text: word }), starts + index * 80));
  });
}

// Each letter is its own piece of text, so each can be drawn in turn. The
// first word is pencilled and then inked solid. The second is left as the
// pencil drawing: it is the one that is out.
function drawTitle(title) {
  const text = title.textContent.trim();
  const stage = svg("svg", { class: "art title-art", "aria-hidden": "true", focusable: "false" });
  const inkProbe = svg("text", { class: "t-solid", x: 0, y: 0, text });
  const pencilProbe = svg("text", { class: "t-sketch", x: 0, y: 0, text });
  stage.append(inkProbe, pencilProbe);
  title.replaceChildren(el("span", { class: "visually-hidden", text }), stage);

  const firstWordEnds = text.indexOf(" ") === -1 ? text.length : text.indexOf(" ");
  const pencilled = [];
  const inked = [];
  let drawn = 0;
  for (let index = 0; index < text.length; index++) {
    if (text[index] === " ") continue;
    const x = inkProbe.getStartPositionOfChar(index).x;
    const advance = inkProbe.getSubStringLength(index, 1);
    const pencilAdvance = pencilProbe.getSubStringLength(index, 1);
    const pencilX = x + (advance - pencilAdvance) / 2;
    const out = index > firstWordEnds;
    const starts = out ? AT.out + (index - firstWordEnds - 1) * 170 : AT.title + drawn * 120;
    pencilled.push(wait(svg("text", { class: out ? "t-sketch t-out" : "t-sketch", x: pencilX.toFixed(1), y: 0, text: text[index] }), starts));
    if (!out) inked.push(wait(svg("text", { class: "t-solid", x: x.toFixed(1), y: 0, text: text[index] }), starts));
    drawn += 1;
  }

  const box = inkProbe.getBBox();
  inkProbe.remove();
  pencilProbe.remove();
  const rule = drawnIn(sketch.underline(box.x + 2, 15, box.x + box.width - 2, { seed: 77, rough: 2.2 }), "title-rule");
  rule.forEach((stroke, index) => wait(stroke, AT.rule + index * 260));
  stage.setAttribute("viewBox", `${(box.x - 8).toFixed(1)} ${(box.y - 6).toFixed(1)} ${(box.width + 16).toFixed(1)} ${(box.height + 34).toFixed(1)}`);
  stage.append(...pencilled, ...inked, ...rule);
  return stage;
}

export async function mount(root) {
  const strip = root.querySelector(".scene");
  const ask = root.querySelector(".cover-ask");
  const title = root.querySelector(".title");
  const note = root.querySelector(".cover-note");
  const go = root.querySelector(".cover-go");
  if (!title) return;

  await lettersReady();
  const narrow = typeof window.matchMedia === "function" ? window.matchMedia(scene.NARROW) : null;
  const drawStrip = () => scene.draw(strip, { start: AT.scene, narrow: Boolean(narrow?.matches) });
  let lines = strip ? drawStrip() : null;
  if (ask) writeOut(ask, AT.ask);
  const stage = drawTitle(title);
  if (note) wait(note, AT.note);
  if (go) {
    wait(go, AT.go);
    const link = go.querySelector("a");
    if (link) inkButton(link, "cover");
  }

  // Once the drawing is done it is simply there ("drawn" in place of
  // "play"), and its lines keep a slight wobble, like frames of a hand-drawn
  // film: the big letters of the title a slow one, the small figures a finer
  // one. What the figures say holds still, so it stays easy to read. The
  // wobble stops while the title page is off screen.
  let timer = 0;
  const settle = () => {
    window.clearTimeout(timer);
    root.classList.remove("play");
    root.classList.add("drawn");
    stage.classList.add("boil");
    lines?.classList.add("shiver");
  };
  const play = () => {
    window.clearTimeout(timer);
    stage.classList.remove("boil");
    lines?.classList.remove("shiver");
    root.classList.remove("play", "drawn");
    // Looking at the size makes the browser notice the class went, so the
    // strokes start again when it comes back.
    root.getBoundingClientRect();
    root.classList.add("play");
    timer = window.setTimeout(settle, AT.settled);
  };
  play();

  // Anyone who would rather not watch can finish it with a click, a tap or
  // a key. A key held for something else, such as Shift, does not count.
  root.addEventListener("pointerdown", settle);
  document.addEventListener("keydown", (event) => {
    if (!["Shift", "Control", "Alt", "Meta"].includes(event.key)) settle();
  });

  if (strip) {
    strip.append(el("button", { class: "again", type: "button", text: "Draw it again", onclick: play }));
    // A page that becomes narrow, or wide, gets the strip drawn for its new
    // shape, already finished.
    narrow?.addEventListener?.("change", () => {
      lines = drawStrip();
      settle();
    });
  }
  if (typeof IntersectionObserver !== "undefined") {
    new IntersectionObserver((entries) => {
      for (const entry of entries) root.classList.toggle("offstage", !entry.isIntersecting);
    }).observe(root);
  }

  // The zoom on the way out. It needs the title page to fit on the screen
  // (a page taller than the screen has to scroll), a browser that can cut
  // off what grows past the edge, and a reader who has not asked for less
  // motion.
  const runner = root.closest(".cover-run");
  const canClip = typeof CSS !== "undefined" && CSS.supports?.("overflow", "clip");
  if (!runner || !strip || !canClip || stillPreferred()) return;
  let gone = 0;
  let focusDown = 0;
  follow(() => {
    const banner = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--banner")) || 0;
    const height = root.offsetHeight;
    const pins = height <= window.innerHeight - banner + 2;
    runner.classList.toggle("pins", pins);
    runner.style.setProperty("--cover-h", `${height}px`);
    const next = pins ? Math.min(1, Math.max(0, window.scrollY / height)) : 0;
    if (next === gone) return;
    if (gone === 0) {
      // The point the view closes in on, found while nothing is enlarged.
      const art = strip.querySelector(".scene-art").getBoundingClientRect();
      const frame = root.getBoundingClientRect();
      const [across, down] = scene.focus(Boolean(narrow?.matches));
      focusDown = art.top - frame.top + down * art.height;
      root.style.transformOrigin = `${(art.left - frame.left + across * art.width).toFixed(1)}px ${focusDown.toFixed(1)}px`;
    }
    gone = next;
    // What is left showing of the title page is the band between the strip
    // at the top and the sheet coming up. As the band narrows, the point the
    // view is closing in on is kept in the middle of it.
    const middle = Math.min(focusDown, (height * (1 - gone)) / 2);
    const settled = Math.min(1, gone * 2);
    const rise = (middle - focusDown) * settled * settled * (3 - 2 * settled);
    const scale = 1 + CLOSER * gone ** 1.6;
    root.style.transform = gone === 0 ? "" : `translate3d(0,${rise.toFixed(1)}px,0) scale(${scale.toFixed(4)})`;
    // Enlarged, the wobble would cost more than it is worth.
    root.classList.toggle("zooming", scale > 1.01);
  });
}
