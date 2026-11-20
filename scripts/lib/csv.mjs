// A small CSV reader: quoted cells, doubled quotes, CRLF, newlines inside
// quotes and a leading byte-order mark. Blank lines are dropped.
export function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  const endRow = () => {
    row.push(cell);
    cell = "";
    const blank = row.length === 1 && row[0] === "";
    if (!blank) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
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
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      endRow();
    } else if (char !== "\r") {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) endRow();
  return rows;
}

// Turns [header, ...rows] into objects keyed by the header. Short rows are
// padded with empty strings.
export function toObjects(rows) {
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows.slice(1).map((row) => Object.fromEntries(header.map((name, index) => [name, row[index] ?? ""])));
}
