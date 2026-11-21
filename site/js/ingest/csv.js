// A small CSV reader: quoted cells, doubled quotes, newlines inside quotes, a
// leading byte-order mark, and lines that end in LF, CRLF or a lone CR. Blank
// lines are dropped, and so are rows with nothing in any cell, which a
// spreadsheet leaves behind when it saves.
//
// `delimiter` is what stands between cells. Flashpoint writes commas. A
// spreadsheet set to another language may save the same file with
// semicolons, and sniffDelimiter tells which a file uses.
export function parseCsv(text, { delimiter = "," } = {}) {
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
    const blank = row.every((value) => value.trim() === "");
    if (!blank) rows.push(row);
    row = [];
    rowLine = line;
  };

  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    // A lone CR ends a line, as it does in files from an old Mac spreadsheet.
    // The CR of a CRLF is passed over, and the LF after it ends the line.
    if (!quoted && char === "\r") {
      if (text[i + 1] === "\n") continue;
      char = "\n";
    }
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
    } else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      endRow();
    } else {
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

// Which of comma, semicolon and tab a file puts between its cells: the one
// that turns up most in its first line, outside quotes. A file with none of
// them is read as comma-separated.
export function sniffDelimiter(text) {
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const char of text.charCodeAt(0) === 0xfeff ? text.slice(1) : text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && char in counts) counts[char] += 1;
  }
  let best = ",";
  for (const [char, count] of Object.entries(counts)) {
    if (count > counts[best]) best = char;
  }
  return best;
}

// Turns [header, ...rows] into objects keyed by the header. Short rows are
// padded with empty strings. A header that repeats gets " (2)", " (3)" added,
// so no column is lost.
//
// Flashpoint's export has two header rows: the first names each question and
// is blank under a question's further columns, the second names every column.
// headerRow says which row to use (counting from 1); rows above it are dropped.
export function toObjects(rows, headerRow = 1) {
  if (rows.length === 0) return [];
  if (rows.length < headerRow) {
    throw new Error(`The CSV has ${rows.length} row(s), so there is no header row ${headerRow}.`);
  }
  const seen = new Map();
  const header = rows[headerRow - 1].map((name) => {
    const count = (seen.get(name) ?? 0) + 1;
    seen.set(name, count);
    return count === 1 ? name : `${name} (${count})`;
  });
  return rows.slice(headerRow).map((row) => Object.fromEntries(header.map((name, index) => [name, row[index] ?? ""])));
}
