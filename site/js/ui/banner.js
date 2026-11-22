// The strip across the top that says what kind of data the page is showing.
// Sample data, a made-up club and simulated students are labelled on every
// screen: none of them must ever pass for a finding about real students.
import { el } from "./dom.js";
import { ink, path, seedOf } from "./ink.js";
import * as sketch from "../lib/sketch.js";

// A strip of coloured paper with an uneven bottom edge and a pen line along
// it. It stays at the top of the screen, so on a narrow screen it says the
// same thing in fewer words. A second pen goes over that line as the page is
// read, as far along it as the reader is down the page. `change` adds a link
// to the part of the page where other answers can be loaded.
export function strip(className, lead, text, short, { change = false } = {}) {
  const link = change ? [" ", el("a", { href: "#yours", text: "Change" })] : [];
  const node = el("div", { class: className, role: "status" },
    el("p", {}, el("strong", { text: lead }), el("span", { class: "long", text }), el("span", { class: "short", text: short }), link),
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

// The strip for answers someone has loaded from a file of their own. It
// always shows, and always says where the answers came from.
function loadedStrip({ meta, rules }) {
  const from = meta.loaded.name ? ` from ${meta.loaded.name}` : "";
  if (meta.loaded.example) {
    return strip(
      "banner",
      "A made-up club. ",
      `These ${meta.n} members were invented to show how a club's own file loads. They are not real responses and are not findings.`,
      `${meta.n} invented members, not real responses.`,
      { change: true },
    );
  }
  if (meta.kind === "simulated") {
    return strip(
      "banner",
      "Simulated students. ",
      `Every number here comes from ${meta.n} AI personas, read${from} on this device. No real student was asked.`,
      `${meta.n} AI personas answered, not real students.`,
      { change: true },
    );
  }
  if (meta.n < rules.pilotN) {
    return strip(
      "banner pilot",
      "Your club, early results. ",
      `${meta.n} members so far, read${from} on this device. Nothing was uploaded. Treat every number here as a pilot.`,
      `${meta.n} members so far. Treat every number as a pilot.`,
      { change: true },
    );
  }
  return strip(
    "banner pilot",
    "Your club's answers. ",
    `${meta.n} members, read${from} on this device. Nothing was uploaded, and reloading the page forgets them.`,
    `${meta.n} members, read on this device only.`,
    { change: true },
  );
}

export function mount(root, dataset) {
  const { meta, rules } = dataset;
  if (meta.loaded) {
    root.append(loadedStrip(dataset));
    return;
  }
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
