// Tables on the clipboard: text separated by tabs (what Excel, Google Sheets and LibreOffice put there) and back. Pure functions.

/** Tab-separated text as rows of cells (all of the same length). Cells in quotes may hold tabs and line breaks. */
export function parseTable(text: string): string[][] {
  const clean = text.replace(/\r\n?/g, "\n").replace(/\n+$/, "");
  if (!clean) return [];
  const sep = "\t";
  const rows: string[][] = [[]];
  let cell = "";
  let quoted = false;
  let started = false; // (a quote opens a quoted cell only at its start)
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && !started) {
      quoted = true;
      started = true;
    } else if (ch === sep) {
      rows[rows.length - 1].push(cell);
      cell = "";
      started = false;
    } else if (ch === "\n") {
      rows[rows.length - 1].push(cell);
      rows.push([]);
      cell = "";
      started = false;
    } else {
      cell += ch;
      started = true;
    }
  }
  rows[rows.length - 1].push(cell);
  const width = Math.max(...rows.map((r) => r.length));
  return rows.map((r) => [...r, ...Array.from({ length: width - r.length }, () => "")]);
}

/** Rows of cells as tab-separated text (a cell with a tab, a quote or a line break is put in quotes, as Excel does) */
export function toTabText(rows: string[][]): string {
  const cell = (s: string) => (/[\t\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return rows.map((r) => r.map(cell).join("\t")).join("\n");
}
