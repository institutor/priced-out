// Loads the survey dataset and mounts each section of the page.
import { createState } from "./state.js";
import { readLink, writeLink } from "./lib/link.js";
import { el } from "./ui/dom.js";
import { doodle, mark } from "./ui/doodles.js";
import { drawWhenSeen, perforation, redrawAll, shiverWhileSeen, underlineLastLine } from "./ui/ink.js";
import * as cover from "./ui/cover.js";
import * as banner from "./ui/banner.js";
import * as priceCheck from "./ui/priceCheck.js";
import * as access from "./ui/access.js";
import * as fixes from "./ui/fixes.js";
import * as pledges from "./ui/pledges.js";
import * as receipt from "./ui/receipt.js";
import * as said from "./ui/said.js";
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

  const footer = document.querySelector(".colophon-rule");
  const sign = footer.querySelector(".colophon-mark");
  sign.append(shiverWhileSeen(mark()), el("span", { class: "wordmark" }, "Priced ", el("span", { class: "out", text: "Out" })));
  footer.prepend(perforation(el("div", { class: "tear" }), "footer"));
  drawWhenSeen(sign);

  // The hand lettering can arrive after the first drawing. When it does the
  // words move, and the lines drawn under them are drawn again.
  document.fonts?.ready.then(() => redrawAll());
}

async function start() {
  openCover();

  let dataset;
  try {
    const response = await fetch("data/dataset.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    dataset = await response.json();
  } catch {
    document.getElementById("price-check").append(
      el("p", { class: "empty", text: "The survey data did not load. If you opened this page as a file, run npm run dev and open the address it prints." }),
    );
    return;
  }

  // The page opens on the view its address asks for, and keeps the address
  // in step with what is on screen, so the address bar is always a link to
  // this view. It is written a moment after the last change: a browser only
  // lets an address be rewritten so many times a minute, and dragging the
  // price would use that up.
  const state = createState({ ...readLink(window.location.search, dataset.items, START, priceCheck.START_PRICE), guess: null });
  const addressOf = (view) => `${window.location.pathname}${writeLink(view, START)}`;
  let writing = 0;
  state.subscribe((view) => {
    window.clearTimeout(writing);
    writing = window.setTimeout(() => {
      try {
        window.history.replaceState(null, "", `${addressOf(view)}${window.location.hash}`);
      } catch {
        // The address stays as it was. The page works the same.
      }
    }, 400);
  });

  banner.mount(document.getElementById("banner"), dataset);
  priceCheck.mount(document.getElementById("price-check"), dataset, state, {
    linkFor: (view) => new URL(addressOf(view), window.location.href).href,
  });
  access.mount(bodyOf("access"), dataset, state);
  fixes.mount(bodyOf("fixes"), dataset, state);
  pledges.mount(bodyOf("pledges"), dataset, state);
  receipt.mount(bodyOf("receipt"), dataset, state);
  if (dataset.meta.kind === "simulated") {
    // What an invented person says they once told a friend is not evidence
    // of anything, so that section is left out for a simulated panel.
    document.getElementById("said").remove();
    document.getElementById("fixes-title").textContent = "The fix the simulated students picked";
    document.getElementById("method-title").textContent = "What these numbers are, and what they are not";
  } else {
    said.mount(bodyOf("said"), dataset, state);
  }
  method.mount(bodyOf("method"), dataset, state);
  dress();

  // An address can point at one section. The sections were empty when the
  // browser first went looking for it, so it is found again now they are not.
  if (window.location.hash.length > 1) {
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView();
  }

  // How far down the page you are, for the line the banner draws along its
  // bottom edge. It is worked out at most once a frame.
  let waiting = false;
  const read = () => {
    waiting = false;
    const room = document.documentElement.scrollHeight - window.innerHeight;
    document.documentElement.style.setProperty("--read", room > 0 ? Math.min(1, window.scrollY / room).toFixed(4) : 0);
  };
  const later = () => {
    if (waiting) return;
    waiting = true;
    window.requestAnimationFrame(read);
  };
  window.addEventListener("scroll", later, { passive: true });
  window.addEventListener("resize", later);
  read();
}

start();
