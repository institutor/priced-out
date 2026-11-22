// Present mode: the page one screen at a time, for showing to a room or
// recording. Every part of the page marked data-slide becomes a screen. The
// arrow keys move, Escape leaves, and the address remembers the screen.
import { el } from "../js/ui/dom.js";
import { inkButton, redrawAll } from "../js/ui/ink.js";

const typing = (target) => ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName) || target?.isContentEditable;
const pressing = (target) => ["BUTTON", "A", "SUMMARY"].includes(target?.tagName);

// Which screen an address asks for: "#s3" is the third. Otherwise the first.
export function screenIn(hash, count) {
  const found = /^#s(\d+)$/.exec(hash ?? "");
  if (!found) return 0;
  return Math.max(0, Math.min(count - 1, Number(found[1]) - 1));
}

// `bar` is the empty strip the controls go in. `before` runs as the mode is
// entered, so the page can put everything in view first. `note(slide)` gives
// the few words the strip shows on the right for a screen.
export function mount(bar, { before = () => {}, note = () => "" } = {}) {
  const root = document.documentElement;
  let slides = [];
  let at = 0;
  let timer = 0;

  const where = el("span", { class: "m-bar-where" });
  const title = el("span", { class: "m-bar-title" });
  const aside = el("span", { class: "m-bar-note" });
  const back = inkButton(el("button", { class: "button m-small", type: "button", "aria-label": "Back one screen", onclick: () => show(at - 1) }, el("span", { text: "Back" })), "present back");
  const next = inkButton(el("button", { class: "button m-small", type: "button", "aria-label": "Next screen", onclick: () => show(at + 1) }, el("span", { text: "Next" })), "present next");
  const leave = el("button", { class: "m-link", type: "button", text: "Leave", onclick: () => close() });
  bar.append(
    el("div", { class: "m-bar-in" },
      el("p", { class: "m-bar-text", "aria-live": "polite" }, where, title),
      aside,
      el("p", { class: "m-bar-keys", text: "← → move · F full screen · Esc leaves" }),
      el("div", { class: "m-bar-buttons" }, back, next, leave),
    ),
  );

  const on = () => root.classList.contains("present");

  const address = (hash, present) => {
    const url = new URL(window.location.href);
    if (present) url.searchParams.set("present", "");
    else url.searchParams.delete("present");
    url.hash = hash;
    try {
      window.history.replaceState(null, "", url.href.replace("present=", "present"));
    } catch {
      // The address stays as it was. The page works the same.
    }
  };

  function show(index) {
    if (slides.length === 0) return;
    at = Math.max(0, Math.min(slides.length - 1, index));
    const slide = slides[at];
    slides.forEach((other) => other.classList.toggle("on", other === slide));
    where.textContent = `${at + 1} of ${slides.length}`;
    title.textContent = slide.dataset.slide;
    aside.textContent = note(slide);
    // A button that is switched off cannot keep the keyboard's place.
    const held = document.activeElement;
    back.disabled = at === 0;
    next.disabled = at === slides.length - 1;
    if (held === back && back.disabled) next.focus();
    if (held === next && next.disabled) back.focus();
    window.scrollTo(0, 0);
    // A screen that was hidden had no size, so its drawings are made now,
    // and drawn in as if by hand.
    redrawAll(slide);
    window.clearTimeout(timer);
    slide.classList.add("drawing");
    timer = window.setTimeout(() => slide.classList.remove("drawing"), 2600);
    address(`s${at + 1}`, true);
    // The strip covers the bottom of the screen, so the screen leaves it room.
    root.style.setProperty("--m-bar-h", `${bar.offsetHeight}px`);
  }

  // A screen taller than the window is read down before the next one comes.
  const room = () => document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
  function onward() {
    if (room() > 24) window.scrollBy({ top: window.innerHeight * 0.8 });
    else show(at + 1);
  }
  function backward() {
    if (window.scrollY > 24) window.scrollBy({ top: -window.innerHeight * 0.8 });
    else show(at - 1);
  }

  // The screen a part of the page is on, or -1.
  function screenOf(node) {
    if (!node) return -1;
    const slide = node.closest("[data-slide]") ?? node.querySelector("[data-slide]");
    return slides.indexOf(slide);
  }

  function open(index = 0) {
    before();
    // The button that opened this keeps no hold on the space bar.
    document.activeElement?.blur?.();
    slides = [...document.querySelectorAll("[data-slide]")];
    root.classList.add("present");
    bar.hidden = false;
    show(index);
  }

  function close() {
    const slide = slides[at];
    root.classList.remove("present");
    bar.hidden = true;
    slides.forEach((other) => other.classList.remove("on", "drawing"));
    if (document.fullscreenElement) document.exitFullscreen?.();
    address("", false);
    redrawAll();
    slide?.scrollIntoView();
  }

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
    if (!on()) {
      if (event.key === "p" || event.key === "P") open(0);
      return;
    }
    const key = event.key;
    if (key === "Escape") close();
    else if (key === "ArrowRight") show(at + 1);
    else if (key === "ArrowLeft") show(at - 1);
    else if (key === "PageDown" || (key === " " && !event.shiftKey && !pressing(event.target))) onward();
    else if (key === "PageUp" || (key === " " && event.shiftKey && !pressing(event.target))) backward();
    else if (key === "Home") show(0);
    else if (key === "End") show(slides.length - 1);
    else if (key === "f" || key === "F") {
      if (document.fullscreenElement) document.exitFullscreen?.();
      else root.requestFullscreen?.().catch(() => {});
      return;
    } else if (/^[1-9]$/.test(key)) show(Number(key) - 1);
    else return;
    event.preventDefault();
  });

  // A link to another part of the page goes to the screen that part is on.
  document.addEventListener("click", (event) => {
    if (!on()) return;
    const link = event.target.closest?.('a[href^="#"]');
    const id = link?.getAttribute("href").slice(1);
    if (!id) return;
    const index = screenOf(document.getElementById(id));
    event.preventDefault();
    if (index >= 0) show(index);
  });

  // An address typed or followed while presenting goes to its screen.
  window.addEventListener("hashchange", () => {
    if (on() && /^#s\d+$/.test(window.location.hash)) show(screenIn(window.location.hash, slides.length));
  });

  return { open, close, show, on, count: () => document.querySelectorAll("[data-slide]").length };
}
