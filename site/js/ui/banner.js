// The strip across the top that says what kind of data the page is showing.
// Sample data is labelled on every screen: it must never pass for a finding.
import { el } from "./dom.js";

export function mount(root, dataset) {
  const { meta, rules } = dataset;
  if (meta.kind !== "real") {
    root.append(
      el("div", { class: "banner", role: "status" },
        el("p", {},
          el("strong", { text: "Sample data. " }),
          "These numbers are generated to build the site. They are not real responses and are not findings.",
        ),
      ),
    );
    return;
  }
  if (meta.n < rules.pilotN) {
    root.append(
      el("div", { class: "banner pilot", role: "status" },
        el("p", {},
          el("strong", { text: "Early results. " }),
          `${meta.n} students have answered so far. Treat every number here as a pilot.`,
        ),
      ),
    );
  }
}
