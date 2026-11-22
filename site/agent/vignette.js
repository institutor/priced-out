// A small drawing for a part of the run: the agent, a stick figure with an
// aerial, saying in a few words what it is doing. It is decoration, in the
// hand of the title page. What happened is in the text beside it.
import { svg } from "../js/ui/dom.js";
import * as sketch from "../js/lib/sketch.js";
import { makePen, person, speech } from "../js/ui/scene.js";
import { aerial } from "./scene.js";

const WIDTH = 264;
const HEIGHT = 158;
const GROUND = 148;

// How the agent stands for each part.
const POSES = {
  plan: { left: "down", right: "neck" },
  write: { left: "down", right: "hold" },
  send: { left: "down", right: "wave" },
  decide: { left: "pocket", right: "up", mouth: "open" },
  answer: { left: "up", right: "hold", mouth: "open" },
};

// `lines` is one or two short lines for the speech bubble.
export function vignette(part, lines, seed = 1) {
  const stage = svg("svg", { class: "art scene-art m-vignette", viewBox: `0 0 ${WIDTH} ${HEIGHT}`, "aria-hidden": "true", focusable: "false" });
  const drawn = svg("g", { class: "scene-lines" });
  const words = svg("g", { class: "scene-words" });
  stage.append(drawn, words);
  stage.style.setProperty("--pen", 2);
  const pen = makePen(drawn);
  pen.stroke(sketch.line(6, GROUND + 2, 110, GROUND + 2, { seed: seed + 9, rough: 1.2, passes: 1 }), "ground", 260);
  const agent = person(pen, { x: 40, height: 100, look: 0.9, ...(POSES[part] ?? POSES.write) }, GROUND, seed, 0.7);
  aerial(pen, agent.head, 100, seed + 3);
  pen.now += 80;
  speech(words, pen, { lines, size: 19, centre: 170, top: lines.length > 1 ? 6 : 18 }, agent, seed + 5);
  return stage;
}
