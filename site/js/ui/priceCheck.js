// The price check: a fill-in line (what, at what price, in how big a club)
// and the club as a room of seats, every one of them taken. Then a guess,
// and the answer: the seats that empty are rubbed out, and the curve is drawn.
import { el, clear, sentence } from "./dom.js";
import { art, blank, button, drawWhenSeen, highlight, ink, path, seat, seedOf, shiverWhileSeen } from "./ink.js";
import { doodle } from "./doodles.js";
import * as sketch from "../lib/sketch.js";
import { sharesAt, curve } from "../lib/curve.js";
import { money, pct, people, phrase } from "../lib/format.js";
import { renderCurve } from "./chart.js";
import { voice } from "../lib/voice.js";

// The price each item opens at when it is picked.
export const START_PRICE = { dues: 30, formal: 45, trip: 180 };

export const maxPriceOf = (item) => item.max - item.step;

function snap(value, item) {
  const number = Number.isFinite(value) ? value : 0;
  const stepped = Math.round(number / item.step) * item.step;
  return Math.min(maxPriceOf(item), Math.max(0, stepped));
}

// `linkFor(view)` gives the address that opens the page on a view. With it,
// the answer comes with a way to send exactly what is on screen to someone.
export function mount(root, dataset, state, { linkFor = null } = {}) {
  const { items, rows, rules } = dataset;
  const say = voice(dataset.meta);
  const itemOf = (id) => items.find((item) => item.id === id);
  const curves = new Map();
  const curveOf = (item, source = rows, key = item.id) => {
    if (!curves.has(key)) curves.set(key, curve(source, item));
    return curves.get(key);
  };

  const itemSelect = el("select", {
    class: "blank",
    "aria-label": "What you are pricing",
    onchange: (event) => {
      const item = itemOf(event.target.value);
      state.set({ itemId: item.id, price: snap(START_PRICE[item.id] ?? item.max / 3, item) });
    },
  }, items.map((item) => el("option", { value: item.id, text: phrase(item) })));
  // A select is as wide as its longest option. This hidden copy of the chosen
  // text sets the width instead, so the blank fits what is written in it.
  const itemSizer = el("span", { class: "sizer", "aria-hidden": "true" });

  const priceInput = el("input", {
    class: "blank wide",
    type: "number",
    inputMode: "numeric",
    min: 0,
    "aria-label": "Price in dollars",
    onchange: (event) => {
      const price = snap(Number(event.target.value), itemOf(state.get().itemId));
      // Show the price actually used: 9999 becomes the top of the range, 47 becomes 45.
      event.target.value = price;
      state.set({ price });
    },
  });

  const sizeInput = el("input", {
    class: "blank wide",
    type: "number",
    inputMode: "numeric",
    min: 5,
    max: 300,
    "aria-label": "Number of people in the club",
    onchange: (event) => {
      const size = Math.min(300, Math.max(5, Math.round(Number(event.target.value) || 5)));
      event.target.value = size;
      state.set({ size });
    },
  });

  const slider = el("input", {
    type: "range",
    min: 0,
    "aria-label": "Price",
    oninput: (event) => state.set({ price: Number(event.target.value) }),
  });
  const sliderLow = el("span", { text: "$0" });
  const sliderHigh = el("span");
  // The real slider is still there and still does the work. What is seen is
  // a pen line for the rail and a drawn knob that follows it.
  const knob = el("span", { class: "knob", "aria-hidden": "true" }, art("knob-art", 28, 28,
    path(sketch.blob(4, 4, 20, 20, { seed: 21, rough: 1, round: 0.5 }), "knob-fill"),
    path(sketch.ellipse(14, 14, 10.5, 10.5, { seed: 22, rough: 0.9, steps: 12 }), "knob-line"),
  ));
  const rail = el("div", { class: "rail" }, slider, knob);
  ink(rail, (width, height) => {
    const seed = seedOf("rail");
    const middle = height / 2;
    return [
      path(sketch.line(5, middle, width - 5, middle, { seed, rough: 1.4, passes: 2 }), "rail-line"),
      path(sketch.line(5, middle - 7, 5, middle + 7, { seed: seed + 1, rough: 0.6, passes: 1 }), "rail-line"),
      path(sketch.line(width - 5, middle - 7, width - 5, middle + 7, { seed: seed + 2, rough: 0.6, passes: 1 }), "rail-line"),
    ];
  });

  const gatePrompt = el("p");
  const guessInput = el("input", { class: "blank", type: "number", inputMode: "numeric", min: 0, value: "", placeholder: "?", "aria-label": "Your guess" });
  const gate = el("form", {
    class: "gate",
    onsubmit: (event) => {
      event.preventDefault();
      const { itemId, price, size } = state.get();
      justRevealed = true;
      // The guess is optional: an empty box is no guess, not a guess of 0.
      if (guessInput.value.trim() === "") {
        state.set({ revealed: true, guess: null });
        return;
      }
      const count = Math.min(size, Math.max(0, Math.round(Number(guessInput.value) || 0)));
      state.set({ revealed: true, guess: { itemId, price, size, count } });
    },
  }, gatePrompt, blank(guessInput, "guess"), button({ type: "submit" }, "Show the answer"));

  const seats = el("div", { class: "seats", role: "img" });
  const key = el("ul", { class: "key" },
    el("li", {}, el("span", { class: "seat" }, seat("go", 11)), "Would go"),
    el("li", {}, el("span", { class: "seat stretched" }, seat("stretched", 12)), "Would go, but it's a stretch"),
    el("li", {}, el("span", { class: "seat out" }, seat("out", 13)), "Would skip it and say something else"),
  );
  const verdict = el("p", { class: "verdict" });
  const detail = el("p");
  const stretchedNote = el("p");
  const guessNote = el("p");
  const chartRoot = el("div", { class: "chart" });

  // A link to this exact view, for a treasurer to send to the rest of the
  // board. Where the browser will not copy for us, the address is written
  // out to be copied by hand.
  const copied = el("span", { class: "share-said", role: "status" });
  const share = el("p", { class: "share", hidden: !linkFor },
    el("button", {
      class: "text-button",
      type: "button",
      text: "Copy a link to this view",
      onclick: async () => {
        const address = linkFor(state.get());
        try {
          await navigator.clipboard.writeText(address);
          copied.textContent = "Link copied.";
        } catch {
          copied.textContent = address;
        }
      },
    }),
    copied,
  );
  const answer = el("div", { "aria-live": "polite" }, verdict, detail, stretchedNote, guessNote);
  const result = el("div", {},
    el("div", { class: "result" },
      el("div", {}, seats, key),
      el("div", {}, gate, answer, share),
    ),
    chartRoot,
  );
  const tooFew = el("p", { class: "empty", hidden: true });

  let justRevealed = false;
  const narrowScreen = window.matchMedia("(max-width: 40rem)");

  const opening = el("div", { class: "opening" },
    shiverWhileSeen(doodle("tag")),
    el("p", { class: "form-line" },
      "A ", highlight(el("span", { class: "pick" }, itemSizer, itemSelect), "item", { caret: true }),
      " at $", blank(priceInput, "price"), " in a club of ", blank(sizeInput, "size"), ".",
    ),
  );
  drawWhenSeen(opening);
  root.append(
    opening,
    el("div", { class: "price-slider" }, rail, el("div", { class: "ends" }, sliderLow, sliderHigh)),
    tooFew,
    result,
  );

  // The room is only drawn again when it would look different, so dragging
  // the price before the answer is shown leaves it alone.
  let drawnRoom = "";
  function renderSeats(counts, size, emptying) {
    const room = [size, counts.go, counts.stretched, counts.out].join(" ");
    if (room === drawnRoom && !emptying) return;
    drawnRoom = room;
    clear(seats);
    // Smaller seats for bigger clubs, so the room stays about the same size.
    let seatSize = "0.95rem";
    if (size <= 150) seatSize = "1.25rem";
    if (size <= 80) seatSize = "1.6rem";
    if (size <= 40) seatSize = "2rem";
    seats.style.setProperty("--seat", seatSize);
    // Each seat is drawn with its own seed, so no two are quite alike, and
    // the same seat is drawn the same way every time.
    let outIndex = 0;
    for (let index = 0; index < size; index++) {
      let kind = "out";
      if (index < counts.go) kind = "go";
      else if (index < counts.go + counts.stretched) kind = "stretched";
      const glyph = seat(kind, 700 + index, { emptying: emptying && kind === "out" });
      const node = el("span", { class: kind === "go" ? "seat" : `seat ${kind}` }, glyph);
      if (kind === "out") node.style.setProperty("--i", outIndex++);
      seats.append(node);
    }
    seats.classList.toggle("emptying", emptying);
  }

  function render({ itemId, price, size, revealed, guess }) {
    const item = itemOf(itemId);
    if (itemSelect.value !== itemId) itemSelect.value = itemId;
    itemSizer.textContent = phrase(item);
    priceInput.max = maxPriceOf(item);
    priceInput.step = item.step;
    if (document.activeElement !== priceInput) priceInput.value = price;
    if (document.activeElement !== sizeInput) sizeInput.value = size;
    slider.max = maxPriceOf(item);
    slider.step = item.step;
    slider.value = price;
    rail.style.setProperty("--at", maxPriceOf(item) > 0 ? price / maxPriceOf(item) : 0);
    sliderHigh.textContent = money(maxPriceOf(item));
    guessInput.max = size;

    const shares = sharesAt(rows, item, price);
    const notEnough = shares.n < rules.minCell;
    tooFew.hidden = !notEnough;
    tooFew.textContent = `Not enough answers for this yet: ${shares.n} so far, and nothing is shown under ${rules.minCell}.`;
    const answered = revealed && !notEnough;
    result.hidden = notEnough;
    gate.hidden = answered;
    answer.hidden = !answered;
    key.hidden = !answered;
    share.hidden = !answered || !linkFor;
    copied.textContent = "";
    chartRoot.hidden = !answered;
    clear(gatePrompt).append(...sentence("Before you look: how many of these ", [size], " would skip it and tell you something else?"));
    const revealing = justRevealed;
    justRevealed = false;
    if (notEnough) return;
    if (!answered) {
      // Until the answer is asked for, everyone has a seat.
      renderSeats({ go: size, stretched: 0, out: 0 }, size, false);
      seats.setAttribute("aria-label", `${size} seats, one for each member of the club. All of them are taken.`);
      return;
    }

    // The curve draws itself when the answer is first shown, and only then.
    result.classList.toggle("drawing", revealing);
    const out = people(shares.out, size);
    const stretched = Math.min(size - out, people(shares.stretched, size));
    renderSeats({ go: size - out - stretched, stretched, out }, size, revealing);
    seats.setAttribute(
      "aria-label",
      `${size} seats: ${size - out - stretched} would go, ${stretched} would go but feel stretched, ${out} would skip it.`,
    );

    // "Nobody" is only said when nobody surveyed gave that answer. A share
    // too small to make one whole person in this club is said as that.
    if (shares.outCount === 0) verdict.textContent = `At ${money(price)}, ${say.nobody} would skip it.`;
    else if (out === 0) verdict.textContent = `At ${money(price)}, fewer than 1 of your ${size} would skip it.`;
    else verdict.textContent = `${say.lead}${out} of your ${size} would skip it and tell you something else.`;

    clear(detail).append(...sentence(
      "That is ", [pct(shares.out)], ` of the ${shares.n} ${say.many} who answered. ${say.range(pct(shares.outLow), pct(shares.outHigh))}`,
    ));
    if (shares.stretchedCount === 0) stretchedNote.textContent = "Nobody else said this price would be a stretch.";
    else if (stretched === 0) stretchedNote.textContent = "Fewer than 1 more would pay but find it a stretch.";
    else stretchedNote.textContent = `Another ${stretched} would pay, but said it would be a stretch.`;

    const sameQuestion = guess && guess.itemId === itemId && guess.price === price && guess.size === size;
    guessNote.hidden = !sameQuestion;
    if (sameQuestion) {
      const difference = out - guess.count;
      let comparison = "Right on.";
      if (difference > 0) comparison = `That is ${difference} more than you expected.`;
      if (difference < 0) comparison = `That is ${-difference} fewer than you expected.`;
      guessNote.textContent = `You guessed ${guess.count}. ${comparison}`;
    }

    renderCurve(chartRoot, {
      points: curveOf(item),
      item,
      price,
      n: shares.n,
      people: say.many,
      narrow: narrowScreen.matches,
      guess: guess && guess.itemId === itemId ? { price: guess.price, share: guess.count / guess.size } : null,
      synthetic: dataset.synthetic
        ? { label: dataset.synthetic.label, points: curveOf(item, dataset.synthetic.rows, `synthetic-${item.id}`) }
        : null,
    });
  }

  state.subscribe(render);
  narrowScreen.addEventListener("change", () => {
    // The page can be laid out again for other answers. A price check that
    // has been taken off the page has nothing left to draw.
    if (root.isConnected) render(state.get());
  });
  render(state.get());
}
