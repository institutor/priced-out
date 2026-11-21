// A small CSV reader: quoted cells, doubled quotes, CRLF, newlines inside
// quotes and a leading byte-order mark. Blank lines are dropped.
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  let quoteLine = 1;

  const endRow = () => {
    row.push(cell);
    cell = "";
    const blank = row.length === 1 && row[0] === "";
    if (!blank) rows.push(row);
    row = [];
    rowLine = line;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "\n") line += 1;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
      quoteLine = rowLine;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      endRow();
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (quoted) {
    // Without this, everything after the stray quote would become one cell
    // and the rows after it would vanish without a word.
    throw new Error(`The CSV has a quote that never closes, in the row starting at line ${quoteLine}.`);
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

// Turns [header, ...rows] into objects keyed by the header. Short rows are
// padded with empty strings. A header that repeats gets " (2)", " (3)" added,
// so no column is lost.
export function toObjects(rows) {
  if (rows.length === 0) return [];
  const seen = new Map();
  const header = rows[0].map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name} (${count})`;
  });
  return rows.slice(1).map((row) => Object.fromEntries(header.map((name, index) => [name, row[index] ?? ""])));
}
