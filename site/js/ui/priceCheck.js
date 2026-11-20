// The price check: a fill-in line (what, at what price, in how big a club),
// a guess, then the answer as a room of seats and a curve.
import { el, clear, sentence } from "./dom.js";
import { sharesAt, curve } from "../lib/curve.js";
import { money, pct, people } from "../lib/format.js";
import { renderCurve } from "./chart.js";

const PHRASES = { dues: "semester of dues", formal: "formal ticket", trip: "weekend trip" };
const START_PRICE = { dues: 30, formal: 45, trip: 180 };

export const phrase = (item) => PHRASES[item.id] ?? item.short.toLowerCase();
export const maxPriceOf = (item) => item.max - item.step;

function snap(value, item) {
  const number = Number.isFinite(value) ? value : 0;
  const stepped = Math.round(number / item.step) * item.step;
  return Math.min(maxPriceOf(item), Math.max(0, stepped));
}

export function mount(root, dataset, state) {
  const { items, rows, rules } = dataset;
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
    onchange: (event) => state.set({ price: snap(Number(event.target.value), itemOf(state.get().itemId)) }),
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

  const gatePrompt = el("p");
  const guessInput = el("input", { type: "number", inputMode: "numeric", min: 0, value: "", placeholder: "?", "aria-label": "Your guess" });
  const gate = el("form", {
    class: "gate",
    onsubmit: (event) => {
      event.preventDefault();
      const { itemId, price, size } = state.get();
      const count = Math.min(size, Math.max(0, Math.round(Number(guessInput.value) || 0)));
      justRevealed = true;
      state.set({ revealed: true, guess: { itemId, price, size, count } });
    },
  }, gatePrompt, guessInput, el("button", { class: "button", type: "submit", text: "Show the answer" }));

  const seats = el("div", { class: "seats", role: "img" });
  const key = el("ul", { class: "key" },
    el("li", {}, el("span", { class: "seat" }), "Would go"),
    el("li", {}, el("span", { class: "seat stretched" }), "Would go, but it's a stretch"),
    el("li", {}, el("span", { class: "seat out" }), "Would skip it and say something else"),
  );
  const verdict = el("p", { class: "verdict" });
  const detail = el("p");
  const stretchedNote = el("p");
  const guessNote = el("p");
  const chartRoot = el("div", { class: "chart" });
  const result = el("div", { hidden: true },
    el("div", { class: "result" },
      el("div", {}, seats, key),
      el("div", { "aria-live": "polite" }, verdict, detail, stretchedNote, guessNote),
    ),
    chartRoot,
  );
  const tooFew = el("p", { class: "empty", hidden: true });

  let justRevealed = false;
  const narrowScreen = window.matchMedia("(max-width: 40rem)");

  root.append(
    el("p", { class: "form-line" },
      "A ", el("span", { class: "pick" }, itemSizer, itemSelect), " at $", priceInput, " in a club of ", sizeInput, ".",
    ),
    el("div", { class: "price-slider" }, slider, el("div", { class: "ends" }, sliderLow, sliderHigh)),
    gate,
    tooFew,
    result,
  );

  function renderSeats(counts, size) {
    clear(seats);
    // Smaller seats for bigger clubs, so the room stays about the same size.
    let seatSize = "0.95rem";
    if (size <= 150) seatSize = "1.25rem";
    if (size <= 80) seatSize = "1.6rem";
    if (size <= 40) seatSize = "2rem";
    seats.style.setProperty("--seat", seatSize);
    let outIndex = 0;
    for (let seat = 0; seat < size; seat++) {
      let kind = "out";
      if (seat < counts.go) kind = "go";
      else if (seat < counts.go + counts.stretched) kind = "stretched";
      const node = el("span", { class: kind === "go" ? "seat" : `seat ${kind}` });
      if (kind === "out") node.style.setProperty("--i", outIndex++);
      seats.append(node);
    }
    seats.setAttribute(
      "aria-label",
      `${size} seats: ${counts.go} would go, ${counts.stretched} would go but feel stretched, ${counts.out} would skip it.`,
    );
    seats.classList.toggle("emptying", justRevealed);
    justRevealed = false;
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
    sliderHigh.textContent = money(maxPriceOf(item));
    guessInput.max = size;

    const shares = sharesAt(rows, item, price);
    const notEnough = shares.n < rules.minCell;
    tooFew.hidden = !notEnough;
    tooFew.textContent = `Not enough answers for this yet: ${shares.n} so far, and nothing is shown under ${rules.minCell}.`;
    gate.hidden = revealed || notEnough;
    result.hidden = !revealed || notEnough;
    clear(gatePrompt).append(...sentence("Before you look: how many of the ", [size], " would skip it and tell you something else?"));
    if (!revealed || notEnough) return;

    const out = people(shares.out, size);
    const stretched = Math.min(size - out, people(shares.stretched, size));
    renderSeats({ go: size - out - stretched, stretched, out }, size);

    if (out === 0) verdict.textContent = `At ${money(price)}, nobody surveyed would skip it.`;
    else verdict.textContent = `${out} of your ${size} would skip it and tell you something else.`;

    clear(detail).append(...sentence(
      "That is ", [pct(shares.out)], ` of the ${shares.n} students who answered. With a sample this size the true figure could be anywhere from ${pct(shares.outLow)} to ${pct(shares.outHigh)}.`,
    ));
    stretchedNote.textContent = stretched === 0
      ? "Nobody else said this price would be a stretch."
      : `Another ${stretched} would pay, but said it would be a stretch.`;

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
      narrow: narrowScreen.matches,
      guess: guess && guess.itemId === itemId ? { price: guess.price, share: guess.count / guess.size } : null,
      synthetic: dataset.synthetic
        ? { label: dataset.synthetic.label, points: curveOf(item, dataset.synthetic.rows, `synthetic-${item.id}`) }
        : null,
    });
  }

  state.subscribe(render);
  narrowScreen.addEventListener("change", () => render(state.get()));
  render(state.get());
}
