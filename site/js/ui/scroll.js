// Everything on the page that moves with the scroll (the zoom on the title
// page, the walk along the prices, the line that shows how far down the page
// you are) is redrawn here, together, once a frame.
const jobs = new Set();
let queued = false;

function run() {
  queued = false;
  for (const job of jobs) job();
}

function queue() {
  if (queued) return;
  queued = true;
  window.requestAnimationFrame(run);
}

// Runs `job` now and again after every scroll or change of size. Returns a
// function that stops it.
export function follow(job) {
  if (jobs.size === 0) {
    window.addEventListener("scroll", queue, { passive: true });
    window.addEventListener("resize", queue);
  }
  jobs.add(job);
  job();
  return () => jobs.delete(job);
}

// Asks for everything to be redrawn, for when something other than a scroll
// has moved the page about.
export const refresh = queue;

// People who ask for less motion get a page that holds still.
export function stillPreferred() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
