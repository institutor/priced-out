// Tiny DOM helpers. Text always goes in as text nodes, never as markup.
const SVG_NS = "http://www.w3.org/2000/svg";

function append(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "object" ? child : document.createTextNode(String(child)));
  }
  return node;
}

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key in node && key !== "list" && key !== "form") node[key] = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  return append(node, children);
}

export function svg(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === "text") node.textContent = value;
    else node.setAttribute(key, value);
  }
  return append(node, children);
}

export function clear(node) {
  node.textContent = "";
  return node;
}

// A run of text with a few emphasised pieces:
// sentence("Charge ", ["$20"], " or less.") gives text, <strong>, text.
export function sentence(...parts) {
  return parts.map((part) => (Array.isArray(part) ? el("strong", { text: String(part[0]) }) : part));
}
