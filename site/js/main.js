// Loads the survey dataset and mounts each section of the page.
import { el } from "./ui/dom.js";
import * as banner from "./ui/banner.js";

async function start() {
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

  banner.mount(document.getElementById("banner"), dataset);
}

start();
