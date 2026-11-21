import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = fileURLToPath(new URL("../site/", import.meta.url));

// Every file the page's script needs before it can run: what it imports, what
// those import, and so on. A file that is only fetched later, when a club's
// export is chosen, is brought in with import() and is not counted.
function neededBy(entry) {
  const found = new Set();
  const visit = (file) => {
    if (found.has(file)) return;
    found.add(file);
    const source = fs.readFileSync(path.join(site, file), "utf8");
    for (const match of source.matchAll(/^import\s[^;]*?\sfrom\s+"(\.[^"]+)";/gms)) {
      visit(path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1])));
    }
  };
  visit(entry);
  found.delete(entry);
  return [...found].sort();
}

test("the page asks up front for every file its script needs, and for no other", () => {
  const html = fs.readFileSync(path.join(site, "index.html"), "utf8");
  const asked = [...html.matchAll(/<link rel="modulepreload" href="([^"]+)">/g)].map((match) => match[1]);
  assert.deepEqual([...asked].sort(), neededBy("js/main.js"));
  assert.equal(new Set(asked).size, asked.length, "a file is asked for twice");
  for (const file of asked) assert.ok(fs.existsSync(path.join(site, file)), `${file} is not there`);
});

test("the code that reads a club's file is only fetched when a file is chosen", () => {
  const needed = neededBy("js/main.js");
  assert.ok(needed.length > 20);
  assert.equal(needed.some((file) => file.startsWith("js/ingest/")), false);
});
