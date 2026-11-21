// The strip across the top that says what kind of data the page is showing.
// Sample data and simulated students are labelled on every screen: neither
// must ever pass for a finding about real students.
import { el } from "./dom.js";
import { ink, path, seedOf } from "./ink.js";
import * as sketch from "../lib/sketch.js";

// A strip of coloured paper with an uneven bottom edge and a pen line along
// it. It stays at the top of the screen, so on a narrow screen it says the
// same thing in fewer words. A second pen goes over that line as the page is
// read, as far along it as the reader is down the page.
function strip(className, lead, text, short) {
  const node = el("div", { class: className, role: "status" },
    el("p", {}, el("strong", { text: lead }), el("span", { class: "long", text }), el("span", { class: "short", text: short })),
  );
  const seed = seedOf("banner");
  ink(node, (width, height) => {
    // The rest of the page leaves this much room under the top of the screen.
    document.documentElement.style.setProperty("--banner", `${height}px`);
    const steps = Math.max(4, Math.round(width / 90));
    const edge = [];
    for (let step = 0; step <= steps; step++) edge.push([width + 6 - ((width + 12) * step) / steps, height - 5]);
    return [
      path(`${sketch.polyline(edge, { seed, rough: 1.6, passes: 1 })}L-6,-6L${width + 6},-6Z`, "banner-fill"),
      path(sketch.line(-6, height - 3.5, width + 6, height - 3.5, { seed: seed + 1, rough: 1.5, passes: 2 }), "banner-rule"),
      path(sketch.line(-6, height - 3.5, width + 6, height - 3.5, { seed: seed + 2, rough: 1.2, passes: 1 }), "banner-read", { pathLength: 1 }),
    ];
  });
  return node;
}

export function mount(root, dataset) {
  const { meta, rules } = dataset;
  if (meta.kind === "simulated") {
    root.append(strip(
      "banner",
      "Simulated students. ",
      `Every number here comes from ${meta.n} AI personas that Flashpoint generated. No real student was asked.`,
      `${meta.n} AI personas answered, not real students.`,
    ));
    return;
  }
  if (meta.kind !== "real") {
    root.append(strip(
      "banner",
      "Sample data. ",
      "These numbers are generated to build the site. They are not real responses and are not findings.",
      "Generated numbers, not real responses.",
    ));
    return;
  }
  if (meta.n < rules.pilotN) {
    root.append(strip(
      "banner pilot",
      "Early results. ",
      `${meta.n} students have answered so far. Treat every number here as a pilot.`,
      `${meta.n} answers so far. Treat every number as a pilot.`,
    ));
  }
}
