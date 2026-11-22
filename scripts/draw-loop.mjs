// Writes the loop drawing from the agent's page to a file, so the README can
// show it. The page draws it in the browser; here a stand-in for the page's
// document collects the same shapes and writes them out as one SVG.
//
//   node scripts/draw-loop.mjs
import fs from "node:fs";

class Node {
  constructor(tag) {
    this.tag = tag;
    this.attrs = {};
    this.children = [];
    this.text = "";
    this.style = { setProperty() {} };
  }
  setAttribute(name, value) { this.attrs[name] = String(value); }
  append(...children) { this.children.push(...children); }
  set textContent(value) { this.text = String(value); }
}
globalThis.document = { createElementNS: (space, tag) => new Node(tag), createTextNode: (text) => text };

const { loop } = await import("../site/agent/draw.js");

// The page's stylesheet, as far as this one drawing needs it.
const INK = "#1b1f6b";
const STYLE = {
  "m-loop-line": `fill="none" stroke="${INK}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"`,
  thin: `fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"`,
  round: `fill="none" stroke="#b8456b" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"`,
  "m-loop-paper": `fill="#fcfcfe" stroke="none"`,
};
const FONT = `font-family="'Londrina Solid','Arial Narrow','Helvetica Neue',Arial,sans-serif"`;
const WORDS = {
  plain: `${FONT} font-size="19" font-weight="700" fill="${INK}"`,
  soft: `${FONT} font-size="19" font-weight="700" fill="#4c5196"`,
  big: `${FONT} font-size="23" font-weight="700" fill="#3a3fc4"`,
  round: `font-family="ui-monospace,Menlo,monospace" font-size="15" fill="#b8456b"`,
};
const safe = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function write(node) {
  const classes = (node.attrs.class ?? "").split(" ");
  if (node.tag === "path") {
    const look = classes.includes("round") ? STYLE.round : classes.includes("thin") ? STYLE.thin : classes.includes("m-loop-paper") ? STYLE["m-loop-paper"] : STYLE["m-loop-line"];
    return `<path d="${node.attrs.d}" ${look}/>`;
  }
  if (node.tag === "text") {
    const look = WORDS[["soft", "big", "round"].find((name) => classes.includes(name)) ?? "plain"];
    return `<text x="${node.attrs.x}" y="${node.attrs.y}" text-anchor="middle" ${look}>${safe(node.text)}</text>`;
  }
  return node.children.map(write).join("\n");
}

const drawing = loop();
const [, , width, height] = drawing.attrs.viewBox.split(" ");
const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="The agent's loop: one objective in; it writes a survey, seals its guess, sends it out, opens the envelope and decides; then another round, or the answer.">
<rect width="${width}" height="${height}" fill="#fcfcfe"/>
${write(drawing)}
</svg>
`;
fs.writeFileSync(new URL("../docs/agent-loop.svg", import.meta.url), out);
console.log(`Wrote docs/agent-loop.svg (${out.length} bytes).`);
