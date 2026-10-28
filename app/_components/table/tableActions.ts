import { blankCells, cellLook, clearRange, colsOf, deleteLines, insertLines, isBorderOn, mergeCells, rowsOf, setBorders, setStyle, sortRows, unmergeCells, type BorderMode, type BorderSide, type CellLook, type CellRange, type NumberFormat, type TableCellStyle, type TableData, type TablePatch } from "@/app/_lib/table";
import { cellSel, rangeSel, type Sel } from "./tableSel";

export type ApplyPatch = (patch: TablePatch, key: string) => void;

// What the buttons of the format bar and the right-click menu do to the selected cells of a table: each one makes a patch (through
// the pure operations of _lib/table) and hands it to `apply`, and moves the selection where the change leaves it. With no cell
// selected the formatting (the font, bold, colors, alignment, lines, number format) goes to the whole table; what needs cells (merge, rows,
// columns, sort, clear) is off.
export interface TableActions {
  /** A cell (or more) is selected: merging, rows, columns, sorting and clearing work. The formatting works without: it goes to the whole table. */
  hasSelection: boolean;
  /** The cells the formatting goes to: the selection, or all the table when none is selected */
  target: CellRange;
  /** The value of a look that all those cells share (undefined when they differ) */
  common: <K extends keyof CellLook>(key: K) => CellLook[K] | undefined;
  style: (patch: Partial<TableCellStyle>) => void;
  /** Bold or italic: off when every selected cell has it, else on */
  toggle: (key: "bold" | "italic") => void;
  isOn: (key: "bold" | "italic") => boolean;
  /** Draws a side (or all, the outside, the inside…) of the selection, or of each selected cell alone (`each`). A side that is drawn is taken off instead. */
  borders: (mode: BorderMode, each?: boolean) => void;
  /** Whether a side of the selection (or of each cell of it) is drawn: its button shows it */
  borderOn: (side: BorderSide, each?: boolean) => boolean;
  setFormat: (fmt: NumberFormat | undefined) => void;
  merge: () => void;
  unmerge: () => void;
  canMerge: boolean;
  canUnmerge: boolean;
  insertRows: (after: boolean) => void;
  deleteRows: () => void;
  insertCols: (after: boolean) => void;
  deleteCols: () => void;
  clear: () => void;
  /** Sorts the body rows by the first selected column; false when merged cells are in the way */
  sort: (dir: "asc" | "desc") => boolean;
  /** The font shown for the selection (the table's own when the cells have none), and whether choosing one changes the whole table */
  fontName: string | undefined;
  fontForTable: boolean;
  /** The table is flipped (the columns in the other order) and the button that flips it back and forth */
  flipped: boolean;
  flip: () => void;
  /** Each selected cell takes the font; for the whole table (all of it selected, or no cell selected) the table takes it and no cell keeps its own */
  setFont: (family: string | undefined) => void;
}

let counter = 0;
const unique = (name: string) => `${name}:${++counter}`; // (a key that is never merged into the one before: one undo step each)

// The cell looks without any font of their own
const withoutFonts = (styles: TableData["cellStyles"]): TableData["cellStyles"] => {
  if (!styles) return undefined;
  const next: Record<string, TableCellStyle> = {};
  for (const [k, s] of Object.entries(styles)) {
    const { font: _font, ...rest } = s;
    void _font;
    if (Object.keys(rest).length) next[k] = rest;
  }
  return Object.keys(next).length ? next : undefined;
};

export function makeActions(table: TableData, selected: CellRange | null, rtl: boolean, apply: ApplyPatch, select: (s: Sel) => void): TableActions {
  const rows = rowsOf(table);
  const cols = colsOf(table);
  const live = selected !== null;
  const range: CellRange = selected ?? { r0: 0, c0: 0, r1: rows - 1, c1: cols - 1 };
  const nr = range.r1 - range.r0 + 1;
  const nc = range.c1 - range.c0 + 1;
  const cells = () => {
    const out: [number, number][] = [];
    for (let r = range.r0; r <= range.r1; r++) for (let c = range.c0; c <= range.c1; c++) out.push([r, c]);
    return out;
  };
  const plain: TableData = { ...table, cellStyles: undefined };
  const isOn = (key: "bold" | "italic") => cells().every(([r, c]) => cellLook(table, r, c)[key] === true);
  const touching = live && (table.merges ?? []).some((m) => m.r <= range.r1 && m.r + m.rs - 1 >= range.r0 && m.c <= range.c1 && m.c + m.cs - 1 >= range.c0);
  const whole = range.r0 === 0 && range.c0 === 0 && range.r1 === rows - 1 && range.c1 === cols - 1;
  const fontForTable = !live || whole;

  return {
    hasSelection: live,
    target: range,
    common<K extends keyof CellLook>(key: K): CellLook[K] | undefined {
      const first = cellLook(table, range.r0, range.c0)[key];
      return cells().every(([r, c]) => cellLook(table, r, c)[key] === first) ? first : undefined;
    },
    style(patch) {
      const p = setStyle(table, range, patch);
      if (p) apply(p, `style:${Object.keys(patch).sort().join(",")}`);
    },
    toggle(key) {
      const on = isOn(key);
      // turning it off: a cell that is bold by itself (a header) has to say "not bold"; the others just take the field off
      const needsFalse = on && cells().some(([r, c]) => cellLook(plain, r, c)[key] === true);
      const p = setStyle(table, range, { [key]: on ? (needsFalse ? false : undefined) : true });
      if (p) apply(p, `style:${key}`);
    },
    isOn,
    borders(mode, each = false) {
      // "left" and "right" are what is seen: in a table with the first column on the right they are the other way round
      const m: BorderMode = rtl ? (mode === "left" ? "right" : mode === "right" ? "left" : mode) : mode;
      const side = m === "top" || m === "bottom" || m === "left" || m === "right";
      // a side that is drawn is taken off, so a single line of a cell can be removed
      const p = setBorders(table, range, m, { each, show: side ? !isBorderOn(table, range, m, each) : undefined });
      if (p) apply(p, unique("borders"));
    },
    borderOn(side, each = false) {
      const m: BorderSide = rtl ? (side === "left" ? "right" : side === "right" ? "left" : side) : side;
      return isBorderOn(table, range, m, each);
    },
    setFormat(fmt) {
      const p = setStyle(table, range, { fmt });
      if (p) apply(p, unique("format"));
    },
    merge() {
      if (!live) return;
      const m = mergeCells(table, range);
      if (!m) return;
      apply(m.patch, unique("merge"));
      select(rangeSel(m.range));
    },
    unmerge() {
      if (!live) return;
      const p = unmergeCells(table, range);
      if (p) apply(p, unique("unmerge"));
    },
    canMerge: live && (nr * nc > 1 || touching),
    canUnmerge: touching,
    insertRows(after) {
      if (!live) return;
      const at = after ? range.r1 + 1 : range.r0;
      const p = insertLines(table, "row", at, nr);
      if (!p) return;
      apply(p, unique("insert-rows"));
      select(rangeSel({ r0: at, r1: at + nr - 1, c0: range.c0, c1: range.c1 }));
    },
    deleteRows() {
      if (!live) return;
      const p = deleteLines(table, "row", range.r0, nr);
      if (!p) return;
      apply(p, unique("delete-rows"));
      const last = (p.cells?.length ?? 1) - 1;
      select(cellSel(Math.min(range.r0, last), range.c0));
    },
    insertCols(after) {
      if (!live) return;
      const at = after ? range.c1 + 1 : range.c0;
      const p = insertLines(table, "col", at, nc);
      if (!p) return;
      apply(p, unique("insert-cols"));
      select(rangeSel({ c0: at, c1: at + nc - 1, r0: range.r0, r1: range.r1 }));
    },
    deleteCols() {
      if (!live) return;
      const p = deleteLines(table, "col", range.c0, nc);
      if (!p) return;
      apply(p, unique("delete-cols"));
      const last = (p.cells?.[0]?.length ?? 1) - 1;
      select(cellSel(range.r0, Math.min(range.c0, last)));
    },
    clear() {
      if (!live) return;
      const p = clearRange(table, range);
      if (p) apply(p, unique("clear"));
    },
    sort(dir) {
      if (!live) return false;
      const p = sortRows(table, range.c0, dir);
      if (!p) return false;
      apply(p, unique("sort"));
      return true;
    },
    fontName: (live ? cellLook(table, range.r0, range.c0).family : undefined) ?? table.font?.family,
    fontForTable,
    flipped: !!table.flip,
    flip() {
      apply({ flip: table.flip ? undefined : true }, unique("flip"));
    },
    setFont(family) {
      if (fontForTable) {
        const font = { ...table.font };
        if (family) font.family = family;
        else delete font.family;
        apply({ font: Object.keys(font).length ? font : undefined, cellStyles: withoutFonts(table.cellStyles) }, unique("font"));
        return;
      }
      const p = setStyle(table, range, { font: family });
      if (p) apply(p, unique("font"));
    },
  };
}

/** A fresh table of the given size */
export const newTable = (rows: number, cols: number): TableData => ({ cells: blankCells(rows, cols), header: false });
