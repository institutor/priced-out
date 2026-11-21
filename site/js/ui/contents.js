// A way to jump between the parts of the page: a paper tab in the corner of
// the screen that opens a list of them. It waits until the title page has
// been scrolled past, and the list marks the part being read.
import { el } from "./dom.js";
import { art, ink, inkButton, path, seedOf, wipe } from "./ink.js";
import * as sketch from "../lib/sketch.js";
import { partBeingRead } from "../lib/reading.js";

// The headings are written to be read in place, and several are too long for
// a list in a corner. These say the same in fewer words.
export const NAMES = {
  "price-check": "Check a price",
  access: "What it would take",
  fixes: "Ways to offer a lower price",
  pledges: "Members chipping in",
  receipt: "A year in your club",
  plan: "A note for your board",
  said: "What they said instead",
  method: "How we know",
  yours: "Run it for your own club",
  why: "Why this exists",
  made: "How the survey was made",
};

// Three short pen lines, the way a list is drawn.
function listMark() {
  const seed = seedOf("contents mark");
  return art("contents-mark", 18, 14,
    path(sketch.line(1.5, 2.5, 16.5, 2.5, { seed, rough: 0.5, passes: 1 })),
    path(sketch.line(1.5, 7, 16.5, 7, { seed: seed + 1, rough: 0.5, passes: 1 })),
    path(sketch.line(1.5, 11.5, 11.5, 11.5, { seed: seed + 2, rough: 0.5, passes: 1 })),
  );
}

// `root` is the empty <nav> the list is built in. The parts are read from the
// page as it stands, so a part that has been left out is not listed. Returns
// a way to stop listening, for when the page is laid out again.
export function mount(root, { cover = document.getElementById("top") } = {}) {
  wipe(root);
  const sections = [...document.querySelectorAll("main > section[id]")];
  if (sections.length === 0) return () => {};

  const links = sections.map((section) => el("a", {
    href: `#${section.id}`,
    text: NAMES[section.id] ?? section.querySelector("h2")?.textContent ?? section.id,
  }));
  const sheet = el("div", { class: "contents-sheet", id: "contents-sheet", hidden: true },
    el("ul", { class: "contents-list" },
      links.map((link) => el("li", {}, link)),
      el("li", { class: "contents-top" }, el("a", { href: "#top", text: "Back to the top" })),
    ),
  );
  // A card like the note for the board: a pen outline, with shading down its
  // right side and along its foot. The paper under it keeps the page's own
  // words from showing through.
  ink(sheet, (width, height) => {
    const seed = seedOf("contents sheet");
    return [
      path(`M0,0H${width}V${height}H0Z`, "contents-paper"),
      path(sketch.hatch(width - 9, 12, 7, height - 14, { seed: seed + 1, gap: 3.4, rough: 0.5 }), "note-shade"),
      path(sketch.hatch(12, height - 9, width - 14, 7, { seed: seed + 2, gap: 3.4, rough: 0.5 }), "note-shade"),
      path(sketch.rect(2, 2, width - 12, height - 12, { seed, rough: 1.3, passes: 2, over: 3 }), "note-edge"),
    ];
  });

  const tab = inkButton(el("button", {
    class: "contents-tab",
    type: "button",
    "aria-expanded": "false",
    "aria-controls": "contents-sheet",
  }, listMark(), el("span", { text: "Contents" })), "contents");

  const isOpen = () => !sheet.hidden;
  // Marks the part being read. The line is a third of the way down the screen.
  const mark = () => {
    const line = window.innerHeight / 3;
    const reading = partBeingRead(sections.map((section) => section.getBoundingClientRect().top), line);
    links.forEach((link, index) => {
      if (index === reading) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    return links[reading] ?? null;
  };
  const open = () => {
    const reading = mark();
    sheet.hidden = false;
    tab.setAttribute("aria-expanded", "true");
    // On a short screen the list scrolls, and the marked part may be below
    // the fold of it.
    reading?.scrollIntoView?.({ block: "nearest" });
  };
  const close = ({ focus = false } = {}) => {
    if (!isOpen()) return;
    sheet.hidden = true;
    tab.setAttribute("aria-expanded", "false");
    if (focus) tab.focus();
  };

  tab.addEventListener("click", () => (isOpen() ? close() : open()));
  // Choosing a part closes the list. The browser does the going there.
  sheet.addEventListener("click", (event) => {
    if (event.target.closest("a")) close();
  });
  // Escape closes the list wherever the focus is: some browsers do not move
  // the focus to a button that is clicked.
  const onKey = (event) => {
    if (event.key === "Escape" && isOpen()) close({ focus: true });
  };
  // The list also closes when the reader goes back to the page.
  const onFocusOut = (event) => {
    if (event.relatedTarget && !root.contains(event.relatedTarget)) close();
  };
  const outside = (event) => {
    if (!root.contains(event.target)) close();
  };
  // Scrolling with the list open moves the mark with the reader.
  const onScroll = () => {
    if (isOpen()) mark();
  };
  document.addEventListener("keydown", onKey);
  root.addEventListener("focusout", onFocusOut);
  document.addEventListener("pointerdown", outside);
  window.addEventListener("scroll", onScroll, { passive: true });

  // The tab stays off the title page, which has its own ways in.
  let watching = null;
  const show = (on) => {
    root.classList.toggle("is-on", on);
    if (!on) close();
  };
  if (cover && typeof IntersectionObserver !== "undefined") {
    watching = new IntersectionObserver(([entry]) => show(!entry.isIntersecting));
    watching.observe(cover);
  } else {
    show(true);
  }

  root.append(tab, sheet);
  return () => {
    document.removeEventListener("keydown", onKey);
    root.removeEventListener("focusout", onFocusOut);
    document.removeEventListener("pointerdown", outside);
    window.removeEventListener("scroll", onScroll);
    watching?.disconnect();
  };
}
