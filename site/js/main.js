// Loads the survey dataset and mounts each section of the page.
import { createState } from "./state.js";
import { el } from "./ui/dom.js";
import * as banner from "./ui/banner.js";
import * as priceCheck from "./ui/priceCheck.js";
import * as access from "./ui/access.js";
import * as fixes from "./ui/fixes.js";
import * as pledges from "./ui/pledges.js";
import * as receipt from "./ui/receipt.js";

const bodyOf = (id) => document.querySelector(`#${id} .section-body`);

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

  const state = createState({ itemId: "formal", price: 45, size: 60, revealed: false, guess: null });
  banner.mount(document.getElementById("banner"), dataset);
  priceCheck.mount(document.getElementById("price-check"), dataset, state);
  access.mount(bodyOf("access"), dataset, state);
  fixes.mount(bodyOf("fixes"), dataset, state);
  pledges.mount(bodyOf("pledges"), dataset, state);
  receipt.mount(bodyOf("receipt"), dataset, state);
}

start();
