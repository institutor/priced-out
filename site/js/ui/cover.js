// The title page. A row of seats is coloured in, the title is pencilled a
// letter at a time and inked over, and as "Out" goes down the last seats in
// the row are rubbed out. A note in the other pen says what the people who
// had them said. Everything it draws is decoration: the heading, the note
// and the link are plain HTML and are there without it.
import { el, svg } from "./dom.js";
import { art, drawnIn, inkButton, seat } from "./ink.js";
import * as sketch from "../lib/sketch.js";

const SEATS = 12;
const LEAVING = 4;

// When each part of the drawing starts, in milliseconds.
const AT = { seats: 150, title: 650, out: 1650, leave: 2350, rule: 2700, excuse: 2950, note: 3000, go: 3250, settled: 4300 };

// What the empty seats said.
const EXCUSE = "“busy that night”";

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

const wait = (node, ms) => {
  node.style.setProperty("--wait", `${ms}ms`);
  return node;
};

function drawRoom(room) {
  for (let index = 0; index < SEATS; index++) {
    const leaving = index >= SEATS - LEAVING;
    const glyph = seat(leaving ? "out" : "go", 300 + index, { emptying: leaving });
    const holder = el("span", { class: leaving ? "seat out leaving" : "seat" }, glyph);
    wait(holder, AT.seats + index * 55);
    if (leaving) holder.style.setProperty("--leave", `${AT.leave + (index - (SEATS - LEAVING)) * 130}ms`);
    room.append(holder);
  }
}

// The excuse is written above the seats that empty, with an arrow down to
// them.
function drawExcuse(seats) {
  const pointer = art("excuse-arrow", 44, 46, drawnIn(sketch.arrow(6, 5, 30, 41, { seed: 31, head: 11, rough: 1.1, bend: -0.3 }), ""));
  pointer.querySelectorAll("path").forEach((stroke, index) => wait(stroke, AT.excuse + 350 + index * 200));
  const words = wait(el("span", { class: "excuse-words", text: EXCUSE }), AT.excuse);
  const note = el("p", { class: "excuse" }, words, pointer);
  seats.prepend(note);
  return note;
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
  const seats = root.querySelector(".cover-seats");
  const room = root.querySelector(".cover-room");
  const title = root.querySelector(".title");
  const note = root.querySelector(".cover-note");
  const go = root.querySelector(".cover-go");
  if (!room || !title) return;

  await lettersReady();
  drawRoom(room);
  const excuse = seats ? drawExcuse(seats) : null;
  const stage = drawTitle(title);

  if (note) wait(note, AT.note);
  if (go) {
    wait(go, AT.go);
    const link = go.querySelector("a");
    if (link) inkButton(link, "cover");
    const pointer = art("cover-arrow", 56, 84, drawnIn(sketch.arrow(14, 6, 30, 76, { seed: 12, head: 14, rough: 1.4, bend: -0.22 }), ""));
    pointer.querySelectorAll("path").forEach((stroke, index) => wait(stroke, AT.go + 350 + index * 220));
    go.append(pointer);
  }

  root.classList.add("play");

  // Once the drawing is done the lines keep a slight wobble, like frames of
  // a hand-drawn film. It stops while the title page is off screen.
  window.setTimeout(() => {
    stage.classList.add("boil");
    room.classList.add("boil");
    excuse?.classList.add("shiver");
  }, AT.settled);
  if (typeof IntersectionObserver !== "undefined") {
    new IntersectionObserver((entries) => {
      for (const entry of entries) root.classList.toggle("offstage", !entry.isIntersecting);
    }).observe(root);
  }
}
