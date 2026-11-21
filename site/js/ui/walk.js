// The walk up the price. Twenty stick figures stand along a ruler of prices,
// each at the price where one in twenty of the respondents said they would
// skip it. While the strip is on screen it is pinned, and scrolling walks a
// marker up the ruler instead of moving the page: first the whole line is
// seen at once, then the view closes in on its start and travels along it,
// and everyone the marker passes steps out of line. At the far end the view
// pulls back to the whole line again.
//
// Where the strip cannot be pinned (less motion was asked for, or the screen
// is too short to hold it) it is a strip to scroll sideways, with the marker
// at the price set in the price check.
import { el, sentence, svg } from "./dom.js";
import { drawnIn, marked, path } from "./ink.js";
import * as sketch from "../lib/sketch.js";
import { figure } from "../lib/figure.js";
import { maxPriceFor, sharesAt, walkAway } from "../lib/curve.js";
import { lineUp, tickEvery, walkLength, walkStage } from "../lib/walk.js";
import { money, people } from "../lib/format.js";
import { voice } from "../lib/voice.js";
import { phrase } from "./priceCheck.js";
import { follow, stillPreferred } from "./scroll.js";

// How many figures stand in the line. Twenty makes each of them 1 in 20,
// the share the access price is worked out from.
const PEOPLE = 20;

// How someone still in line stands, and how someone who has stepped out does.
const STANDING = [
  { left: "down", right: "down" },
  { left: "pocket", right: "down" },
  { left: "down", right: "wave" },
  { left: "down", right: "pocket" },
  { left: "pocket", right: "pocket" },
];
const STEPPED_OUT = { left: "pocket", right: "down", lean: 0.03, slump: 0.05, look: 0.4, down: 0.14, mouth: "frown", brows: "worried", stance: 0.05 };
const CHEERING = [
  { left: "up", right: "up", mouth: "open" },
  { left: "down", right: "wave" },
  { left: "wave", right: "down", mouth: "open" },
  { left: "up", right: "down" },
];
// Nobody in a line is quite the same height.
const TALLER = [1, 0.94, 1.05, 0.97, 1.02, 0.92, 1.06];

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const mix = (from, to, share) => from + (to - from) * share;

export function mount(section, dataset, state) {
  const { items, rows, rules } = dataset;
  const say = voice(dataset.meta);
  const run = section.querySelector(".walk-run");
  const stage = section.querySelector(".walk-stage");
  const body = section.querySelector(".section-body");
  if (!run || !stage || !body) return;

  const intro = el("p", { class: "walk-intro" });
  const priceNow = el("span", { class: "walk-price" });
  const countNow = el("p", { class: "walk-count" });
  const view = el("div", { class: "walk-view" });
  // The marker: a dashed line in the other pen, down to the ruler.
  const hand = el("div", { class: "walk-hand", "aria-hidden": "true" });
  // The same thing in words, for anyone who cannot see the strip.
  const inWords = el("ul", { class: "visually-hidden" });
  body.append(intro, el("div", { class: "walk-read" }, marked(priceNow, "walk price"), countNow), view, inWords);

  const canClip = typeof CSS !== "undefined" && CSS.supports?.("overflow", "clip");
  let model = null;
  let pinned = false;
  let spend = { lead: 0, zoom: 0, pan: 1 };
  let stuckAt = 0;
  let shown = null;
  let screenTall = 0;

  // Everything about the strip that depends on the item and on how wide the
  // page is: the ruler, who stands where, and the drawing of it all.
  function build(item, width) {
    const top = item.max - item.step;
    const small = width < 520;
    // On a wide page the figures are as tall as the screen has room for.
    const height = small ? 76 : clamp(Math.round(window.innerHeight * 0.17), 92, 140);
    const gap = height * 0.27;
    const ground = height + 120;
    const tall = ground + 40;
    const pan = clamp(width * 1.7, 1100, 1900);
    const per = pan / top;
    const x = (price) => 40 + price * per;

    const line = walkAway(rows, item, PEOPLE);
    const inside = line.filter((skip) => skip <= top);
    const spots = lineUp(inside.map(x), gap);
    const crowdFrom = Math.max(x(top) + 90, (spots.at(-1) ?? 0) + gap * 2.5);
    const staying = line.length - inside.length;
    const wide = crowdFrom + Math.max(1, staying) * gap + 60;

    const track = svg("svg", {
      class: "art walk-track",
      width: wide.toFixed(0),
      height: tall,
      viewBox: `0 0 ${wide.toFixed(0)} ${tall}`,
      "aria-hidden": "true",
      focusable: "false",
    });
    track.style.setProperty("--ground", `${ground}px`);

    // The ruler: a ground line, a small tick at every price that can be
    // picked, and a longer one with the price under it every round amount.
    const floor = [];
    for (let at = x(0) - 26; at < wide - 10; at += 160) floor.push([at, ground]);
    floor.push([wide - 10, ground]);
    track.append(path(sketch.polyline(floor, { seed: 510, rough: 1.3, passes: 1 }), "walk-ground"));
    const every = tickEvery(per, small ? 64 : 84);
    let ticks = "";
    for (let price = 0; price <= top; price += item.step) {
      const round = price % every === 0;
      if (!round && item.step * per < 12) continue;
      ticks += `M${x(price).toFixed(1)},${ground + 1}L${x(price).toFixed(1)},${ground + (round ? 11 : 5)}`;
      if (round) track.append(svg("text", { class: "walk-label", x: x(price).toFixed(1), y: ground + 29, "text-anchor": "middle", text: money(price) }));
    }
    track.append(path(ticks, "walk-tick"));

    // Flags planted at the prices the next section is about, and one at the
    // price set in the price check. A flag near another is planted lower.
    const flag = (kind, title, note) => {
      const node = svg("g", { class: `walk-flag ${kind}` });
      node.append(
        path("", "flag-pole"),
        path("", "pennant"),
        svg("text", { class: "flag-title", x: 22, text: title }),
        svg("text", { class: "flag-note", x: 22, text: note }),
      );
      return node;
    };
    const plant = (node, price, level, seed) => {
      const at = x(price);
      const topOf = 14 + level * 34;
      const [pole, pennant, title, note] = node.children;
      pole.setAttribute("d", sketch.line(0, ground, 0, topOf, { seed, rough: 0.8, passes: 1 }));
      pennant.setAttribute("d", `M0,${topOf}L${15 + (seed % 3)},${topOf + 6.5}L0.5,${topOf + 12.5}Z`);
      title.setAttribute("y", topOf + 9);
      note.setAttribute("y", topOf + 25);
      node.setAttribute("transform", `translate(${at.toFixed(1)} 0)`);
    };
    const gentle = maxPriceFor(rows, item, 0.1);
    const access = maxPriceFor(rows, item, 0.05);
    const planted = [];
    if (access !== null) planted.push({ price: access, node: flag("rule", money(access), "keeps 19 in 20") });
    if (gentle !== null && gentle !== access) planted.push({ price: gentle, node: flag("rule", money(gentle), "keeps 9 in 10") });
    planted.forEach((entry, index) => {
      plant(entry.node, entry.price, 1 + index, 520 + index * 4);
      track.append(entry.node);
    });
    const yours = flag("yours", "your price", "");
    track.append(yours);
    const plantYours = (price) => {
      yours.children[3].textContent = money(price);
      plant(yours, clamp(price, 0, top), 0, 540);
    };

    // The line itself. Everyone is drawn twice in the same place: standing,
    // and stepped out. Which one shows is a matter of the price.
    const walkers = inside.map((skip, index) => {
      const spec = { x: spots[index], ground, height: height * TALLER[index % TALLER.length], look: 0.6, seed: 600 + index * 13 };
      const standing = figure({ ...spec, ...STANDING[index % STANDING.length] });
      const gone = figure({ ...spec, ...STEPPED_OUT });
      const node = svg("g", { class: "walker" },
        svg("g", { class: "walker-in" }, standing.strokes.map((d, stroke) => drawnIn(d, "", { from: index * 1.1 + stroke * 0.3 }))),
        svg("g", { class: "walker-out" }, gone.strokes.map((d) => path(d))),
      );
      track.append(node);
      return { skip, node };
    });
    // The ones still in at the top price wait past the end of the ruler.
    for (let index = 0; index < staying; index++) {
      const spec = { x: crowdFrom + index * gap, ground, height: height * TALLER[(index + 3) % TALLER.length], look: -0.6, seed: 900 + index * 13 };
      const drawn = figure({ ...spec, ...CHEERING[index % CHEERING.length] });
      track.append(svg("g", { class: "walker" }, drawn.strokes.map((d, stroke) => drawnIn(d, "", { from: (inside.length + index) * 1.1 + stroke * 0.3 }))));
    }
    if (staying > 0) {
      track.append(svg("text", {
        class: "walk-note",
        x: (crowdFrom + ((staying - 1) * gap) / 2).toFixed(1),
        y: ground - height - 34,
        "text-anchor": "middle",
        text: `still in at ${money(top)}`,
      }));
    }

    // The marker's line, drawn once, as tall as the strip.
    const line2 = svg("svg", { class: "art", width: 20, height: tall, viewBox: `-10 0 20 ${tall}` },
      path(sketch.dashes(0, 6, 0, ground - 4, { seed: 560, dash: 7, gap: 6, rough: 0.5 })),
      path(sketch.ellipse(0, ground, 3.2, 3.2, { seed: 561, rough: 0.3, steps: 8 })),
    );
    hand.replaceChildren(line2);

    view.replaceChildren(track, hand);
    view.style.height = `${tall}px`;
    return { item, width, top, x, pan, wide, ground, track, walkers, plantYours, every, far: (width - 16) / wide, small };
  }

  // What the strip shows at one price: the price, how many of the club have
  // stepped out, and who in the line has.
  function show(price) {
    if (!model || price === shown) return;
    shown = price;
    const { size } = state.get();
    const out = people(sharesAt(rows, model.item, price).out, size);
    priceNow.textContent = money(price);
    countNow.replaceChildren(...sentence(say.lead, [out], ` of your ${size} ${out === 1 ? "has" : "have"} stepped out of line.`));
    for (const walker of model.walkers) walker.node.classList.toggle("out", price >= walker.skip);
  }

  function describe() {
    const { size, price } = state.get();
    const { item, top, every } = model;
    intro.textContent = `Each figure is 1 in 20 of the ${say.many}, standing at the price where they said they would skip a ${phrase(item)} and give another reason. ${pinned ? "Scroll to raise the price." : `The marker is at ${money(price)}, the price set above. Scroll the strip sideways to see the rest.`}`;
    inWords.replaceChildren();
    for (let at = 0; at <= top; at += every) {
      const out = people(sharesAt(rows, item, at).out, size);
      inWords.append(el("li", { text: `At ${money(at)}, ${out} of your ${size} ${out === 1 ? "has" : "have"} stepped out.` }));
    }
  }

  // Follows the scroll: how far in the view is, how far along, and so what
  // price the marker is at.
  function update() {
    if (!model || !pinned) return;
    const scrolled = stuckAt - run.getBoundingClientRect().top;
    const { along, zoom } = walkStage(scrolled, spend);
    const at = model.x(along * model.top);
    const scale = mix(model.far, 1, zoom);
    const shift = mix(8, view.clientWidth * (model.small ? 0.3 : 0.24) - at, zoom);
    model.track.style.transform = `translate3d(${shift.toFixed(1)}px,0,0) scale(${scale.toFixed(4)})`;
    model.track.style.setProperty("--zoom", scale.toFixed(4));
    hand.style.transform = `translate3d(${(shift + scale * at).toFixed(1)}px,0,0)`;
    show(Math.round(along * model.top));
  }

  // Decides whether the strip can be pinned at this size, and sets it up
  // either way. The strip is drawn again when the item changes or the page
  // becomes a different width.
  function layout(again = false) {
    const width = view.clientWidth;
    if (width === 0) return;
    const { itemId, price } = state.get();
    const item = items.find((candidate) => candidate.id === itemId);
    if (sharesAt(rows, item, price).n < rules.minCell) {
      model = null;
      section.classList.remove("pinned");
      run.style.height = "";
      view.style.height = "";
      view.replaceChildren(el("p", { class: "empty", text: "Not enough answers for this item yet." }));
      intro.textContent = "";
      priceNow.textContent = "";
      countNow.textContent = "";
      return;
    }
    const reshaped = Math.abs(window.innerHeight - screenTall) > 120;
    if (again || !model || model.item !== item || Math.abs(model.width - width) > 24 || reshaped) {
      screenTall = window.innerHeight;
      model = build(item, width);
      shown = null;
    }
    model.plantYours(price);

    // Pinned, the strip and everything above it must fit under the banner.
    section.classList.add("pinned");
    run.style.height = "";
    stuckAt = parseFloat(getComputedStyle(stage).top) || 0;
    pinned = canClip && !stillPreferred() && stage.offsetHeight <= window.innerHeight - stuckAt - 4;
    section.classList.toggle("pinned", pinned);
    // A strip that scrolls sideways has to be reachable from the keyboard.
    if (pinned) {
      for (const name of ["tabindex", "role", "aria-label"]) view.removeAttribute(name);
    } else {
      view.setAttribute("tabindex", "0");
      view.setAttribute("role", "group");
      view.setAttribute("aria-label", "The line of figures along the prices. It scrolls sideways.");
    }
    describe();
    if (pinned) {
      spend = { lead: window.innerHeight * 0.08, zoom: model.far >= 0.3 ? window.innerHeight * 0.5 : 0, pan: model.pan * 0.95 };
      run.style.height = `${stage.offsetHeight + walkLength(spend)}px`;
      view.scrollLeft = 0;
      update();
      return;
    }
    // Not pinned: the strip scrolls sideways and shows the price set above.
    model.track.style.transform = "";
    model.track.style.setProperty("--zoom", 1);
    const snapped = clamp(price, 0, model.top);
    shown = null;
    show(snapped);
    view.scrollLeft = model.x(snapped) - width * 0.3;
  }

  let before = state.get();
  state.subscribe((now) => {
    const rebuilt = now.itemId !== before.itemId;
    const resized = now.size !== before.size;
    const repriced = now.price !== before.price;
    before = now;
    if (rebuilt || !model) {
      layout(true);
    } else if (resized) {
      shown = null;
      describe();
      if (pinned) update();
      else show(clamp(now.price, 0, model.top));
    }
    if (repriced && model && !rebuilt) {
      model.plantYours(now.price);
      if (!pinned) {
        describe();
        show(clamp(now.price, 0, model.top));
      }
    }
  });

  layout();
  // The heading gains a drawing and the lettering arrives late: either can
  // change how tall the pinned part is, so both are watched.
  if (typeof ResizeObserver !== "undefined") {
    const watcher = new ResizeObserver(() => layout());
    watcher.observe(view);
    watcher.observe(stage);
  }
  // A screen that becomes much taller or shorter changes what fits. A small
  // change is left alone: on a phone the address bar comes and goes.
  window.addEventListener("resize", () => {
    if (Math.abs(window.innerHeight - screenTall) > 120) layout();
  });
  follow(update);
}
