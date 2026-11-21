// Loads the survey dataset and mounts each section of the page. The page can
// be laid out again for another set of answers: a club's own file, read in
// the browser, or the made-up club that shows how that works.
import { createState } from "./state.js";
import { readLink, writeLink } from "./lib/link.js";
import { el } from "./ui/dom.js";
import { doodle, mark } from "./ui/doodles.js";
import { drawWhenSeen, perforation, redrawAll, shiverWhileSeen, underlineLastLine, wipe } from "./ui/ink.js";
import * as cover from "./ui/cover.js";
import * as banner from "./ui/banner.js";
import * as priceCheck from "./ui/priceCheck.js";
import * as access from "./ui/access.js";
import * as fixes from "./ui/fixes.js";
import * as pledges from "./ui/pledges.js";
import * as receipt from "./ui/receipt.js";
import * as said from "./ui/said.js";
import * as yours from "./ui/yours.js";
import * as method from "./ui/method.js";

const bodyOf = (id) => document.querySelector(`#${id} .section-body`);

// The view the page opens with when its address asks for nothing else.
const START = { itemId: "formal", price: 45, size: 60, revealed: false };

// The title page needs nothing from the survey, so it starts straight away.
// Whatever happens to its drawing, the page underneath is shown.
function openCover() {
  const root = document.getElementById("top");
  cover.mount(root).catch(() => {}).finally(() => root.classList.add("play"));
}

// The pen work every section shares: a torn line above it, a small drawing
// beside its heading, and an underline under the heading's last line.
function dress() {
  for (const section of document.querySelectorAll("main > section")) {
    section.prepend(perforation(el("div", { class: "tear" }), section.id));
    const heading = section.querySelector("h2");
    if (heading) {
      underlineLastLine(heading, section.id);
      heading.prepend(shiverWhileSeen(doodle(heading.dataset.doodle)));
      drawWhenSeen(heading);
    }
    const body = section.querySelector(".section-body");
    if (body) drawWhenSeen(body);
  }
}

// The foot of the page is drawn once. It says nothing about the answers.
function dressFoot() {
  const footer = document.querySelector(".colophon-rule");
  const sign = footer.querySelector(".colophon-mark");
  sign.append(shiverWhileSeen(mark()), el("span", { class: "wordmark" }, "Priced ", el("span", { class: "out", text: "Out" })));
  footer.prepend(perforation(el("div", { class: "tear" }), "footer"));
  drawWhenSeen(sign);
}

// What the headings say depends on whose answers are on the page.
function retitle(meta) {
  const set = (id, text) => {
    const heading = document.getElementById(id);
    if (heading) heading.textContent = text;
  };
  if (meta.loaded?.example) {
    set("fixes-title", "The fix the made-up members picked");
    set("said-title", "What the made-up members said instead");
    set("method-title", "How to read a club's own numbers");
    return;
  }
  if (meta.kind === "simulated") {
    set("fixes-title", "The fix the simulated students picked");
    set("method-title", "What these numbers are, and what they are not");
    return;
  }
  if (meta.loaded) {
    set("fixes-title", "The fix your members said they'd use");
    set("yours-title", "Your club's answers are loaded");
  }
}

async function start() {
  openCover();

  // The sections as they are written in the page, before anything is drawn
  // in them. Each time the page is laid out it starts from a copy of these.
  const blank = document.getElementById("app").cloneNode(true);

  let published;
  try {
    const response = await fetch("data/dataset.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    published = await response.json();
  } catch {
    document.getElementById("price-check").append(
      el("p", { class: "empty", text: "The survey data did not load. If you opened this page as a file, run npm run dev and open the address it prints." }),
    );
    return;
  }

  const addressOf = (view) => `${window.location.pathname}${writeLink(view, START)}`;
  let writing = 0;
  let state = null;

  // Lays the whole page out for one set of answers.
  function show(dataset, { view, reported = "" } = {}) {
    const mine = Boolean(dataset.meta.loaded);
    wipe(document.getElementById("banner"));
    document.documentElement.style.removeProperty("--banner");
    const old = document.getElementById("app");
    wipe(old);
    old.replaceWith(blank.cloneNode(true));

    // The address bar is always a link to the view on screen. It is written
    // a moment after the last change: a browser only lets an address be
    // rewritten so many times a minute, and dragging the price would use
    // that up. A link cannot carry a club's own file, so while one is loaded
    // the page offers no link to copy.
    state = createState({ ...view, guess: null });
    state.subscribe((next) => {
      window.clearTimeout(writing);
      writing = window.setTimeout(() => {
        try {
          window.history.replaceState(null, "", `${addressOf(next)}${window.location.hash}`);
        } catch {
          // The address stays as it was. The page works the same.
        }
      }, 400);
    });

    banner.mount(document.getElementById("banner"), dataset);
    priceCheck.mount(document.getElementById("price-check"), dataset, state, {
      linkFor: mine ? null : (next) => new URL(addressOf(next), window.location.href).href,
    });
    access.mount(bodyOf("access"), dataset, state);
    fixes.mount(bodyOf("fixes"), dataset, state);
    pledges.mount(bodyOf("pledges"), dataset, state);
    receipt.mount(bodyOf("receipt"), dataset, state);
    if (dataset.meta.kind === "simulated") {
      // What an invented person says they once told a friend is not evidence
      // of anything, so that section is left out for a simulated panel.
      document.getElementById("said").remove();
    } else {
      said.mount(bodyOf("said"), dataset, state);
    }
    yours.mount(bodyOf("yours"), dataset, { read, reset, said: reported });
    method.mount(bodyOf("method"), dataset, state);
    retitle(dataset.meta);
    dress();
  }

  // After the page has been laid out again, the reader is put back where
  // they were: at the part that loads a file, which now says what it read.
  function settle() {
    const section = document.getElementById("yours");
    section.scrollIntoView();
    section.querySelector(".now-showing")?.focus({ preventScroll: true });
  }

  const carried = () => {
    const { itemId, price, size } = state.get();
    return { itemId, price, size, revealed: false };
  };

  // The code that reads an export is only fetched when a file is chosen.
  let reader = null;
  async function read(text, name) {
    reader ??= Promise.all([
      import("./ingest/club.js"),
      fetch("data/mapping.json").then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      }),
    ]);
    let club;
    let mapping;
    try {
      [club, mapping] = await reader;
    } catch (error) {
      reader = null;
      throw error;
    }
    const { dataset, report } = club.datasetFromExport(text, mapping, { name });
    show(dataset, { view: carried(), reported: club.describeReport(report) });
    settle();
  }

  function reset() {
    show(published, { view: carried(), reported: "The simulated students are back on the page." });
    settle();
  }

  // The page opens on the view its address asks for.
  show(published, { view: readLink(window.location.search, published.items, START, priceCheck.START_PRICE) });
  dressFoot();

  // The hand lettering can arrive after the first drawing. When it does the
  // words move, and the lines drawn under them are drawn again.
  document.fonts?.ready.then(() => redrawAll());

  // An address can point at one section. The sections were empty when the
  // browser first went looking for it, so it is found again now they are not.
  if (window.location.hash.length > 1) {
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }

  // How far down the page you are, for the line the banner draws along its
  // bottom edge. It is worked out at most once a frame.
  let waiting = false;
  const progress = () => {
    waiting = false;
    const room = document.documentElement.scrollHeight - window.innerHeight;
    document.documentElement.style.setProperty("--read", room > 0 ? Math.min(1, window.scrollY / room).toFixed(4) : 0);
  };
  const later = () => {
    if (waiting) return;
    waiting = true;
    window.requestAnimationFrame(progress);
  };
  window.addEventListener("scroll", later, { passive: true });
  window.addEventListener("resize", later);
  progress();
}

start();
