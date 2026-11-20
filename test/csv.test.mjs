import test from "node:test";
import assert from "node:assert/strict";
import { parseCsv, toObjects } from "../scripts/lib/csv.mjs";
import { mulberry32, shuffle } from "../scripts/lib/rng.mjs";

test("parseCsv handles quotes, commas and doubled quotes", () => {
  const rows = parseCsv('a,b,c\n"x, y","say ""hi""",z\n');
  assert.deepEqual(rows, [["a", "b", "c"], ["x, y", 'say "hi"', "z"]]);
});

test("parseCsv handles CRLF, newlines inside quotes and a byte-order mark", () => {
  const rows = parseCsv('﻿name,note\r\n"A","line one\nline two"\r\nB,\r\n');
  assert.deepEqual(rows, [["name", "note"], ["A", "line one\nline two"], ["B", ""]]);
});

test("parseCsv keeps empty cells and drops a trailing blank line", () => {
  assert.deepEqual(parseCsv("a,b,c\n1,,3\n\n"), [["a", "b", "c"], ["1", "", "3"]]);
  assert.deepEqual(parseCsv(""), []);
});

test("toObjects keys each row by the header", () => {
  const objects = toObjects([["a", "b"], ["1", "2"], ["3"]]);
  assert.deepEqual(objects, [{ a: "1", b: "2" }, { a: "3", b: "" }]);
});

test("mulberry32 is repeatable for a seed", () => {
  const first = mulberry32(1);
  const second = mulberry32(1);
  const a = [first(), first(), first()];
  const b = [second(), second(), second()];
  assert.deepEqual(a, b);
  assert.ok(a.every((value) => value >= 0 && value < 1));
  assert.notDeepEqual(a, [mulberry32(2)(), mulberry32(2)(), mulberry32(2)()]);
});

test("shuffle keeps every element and leaves its input alone", () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const output = shuffle(input, mulberry32(7));
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual([...output].sort((a, b) => a - b), input);
  assert.notDeepEqual(output, input);
});
