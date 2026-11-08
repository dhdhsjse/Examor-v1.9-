import { describe, expect, it } from "vitest";
import { layoutTable } from "../blockLayout";
import { cellAtPoint, cellsOf, cutTable, edgeAt, eraseEdge, mergeRange, planCut, splitRange, type Frame } from "../table/draw";
import { hEdgeShown, vEdgeShown, type TableData } from "../table/model";
import { mergeCells, unmergeCells } from "../table/ops";
import { studioTableOf, tablePatch } from "../../_components/table-studio/tablePreset";
import { clampSel, selRange } from "../../_components/table/tableSel";
import { copyTableCells, pasteTableCells } from "../../_components/table/tableClipboard";
import type { ExamMeta, TableBlock } from "../types";

const fr: ExamMeta = { title: "t", lang: "fr", templateId: "x" };

// A table drawn as a box: one cell 300 × 200
const box = (): { t: TableData; f: Frame } => ({ t: { cells: [[""]], header: false, colWidths: [300], rowHeights: [200] }, f: { colW: [300], rowH: [200] } });

const apply = (s: { t: TableData; f: Frame }, out: { patch: Partial<TableData>; frame: Frame } | null) => {
  expect(out).not.toBeNull();
  return { t: { ...s.t, ...out!.patch }, f: out!.frame };
};

// The cells as rectangles of px, sorted: what the table looks like
const shape = (s: { t: TableData; f: Frame }) =>
  cellsOf(s.t)
    .map((c) => {
      const X = [0, ...s.f.colW.map((_, i) => s.f.colW.slice(0, i + 1).reduce((a, b) => a + b, 0))];
      const Y = [0, ...s.f.rowH.map((_, i) => s.f.rowH.slice(0, i + 1).reduce((a, b) => a + b, 0))];
      return `${X[c.c]},${Y[c.r]}-${X[c.c + c.cs]},${Y[c.r + c.rs]}`;
    })
    .sort();

describe("drawing lines on a table", () => {
  it("cuts a cell in two with a line across it", () => {
    const s = apply(box(), cutTable(box().t, box().f, { axis: "v", at: 200, from: 0, to: 200 }));
    expect(s.f.colW).toEqual([200, 100]);
    expect(s.t.cells).toEqual([["", ""]]);
    expect(shape(s)).toEqual(["0,0-200,200", "200,0-300,200"]);
  });

  it("cuts only the cell the line goes across, the others stay whole (merged over the new line of the grid)", () => {
    let s = apply(box(), cutTable(box().t, box().f, { axis: "v", at: 200, from: 0, to: 200 }));
    s = apply(s, cutTable(s.t, s.f, { axis: "h", at: 50, from: 210, to: 290 }));
    expect(s.f.rowH).toEqual([50, 150]);
    expect(shape(s)).toEqual(["0,0-200,200", "200,0-300,50", "200,50-300,200"]);
    expect(s.t.merges).toEqual([{ r: 0, c: 0, rs: 2, cs: 1 }]);
  });

  it("cuts the whole cell when the line stops in the middle of it (a cell is never an L)", () => {
    const s = apply(box(), cutTable(box().t, box().f, { axis: "h", at: 100, from: 0, to: 120 }));
    expect(shape(s)).toEqual(["0,0-300,100", "0,100-300,200"]);
  });

  it("goes to a line of the grid that is near, and cuts every cell it goes over", () => {
    let s = apply(box(), cutTable(box().t, box().f, { axis: "v", at: 100, from: 0, to: 200 }));
    s = apply(s, cutTable(s.t, s.f, { axis: "v", at: 200, from: 0, to: 200 }));
    s = apply(s, cutTable(s.t, s.f, { axis: "h", at: 80, from: 0, to: 150 })); // (the first two columns)
    s = apply(s, cutTable(s.t, s.f, { axis: "h", at: 85, from: 200, to: 300 })); // (5 px off: on the same line)
    expect(s.f.rowH).toEqual([80, 120]);
    expect(s.t.merges ?? []).toEqual([]);
    expect(s.t.cells.length).toBe(2);
  });

  it("keeps a row from getting smaller than a row can be", () => {
    const plan = planCut(box().t, box().f, { axis: "h", at: 5, from: 0, to: 300 });
    expect(plan?.at).toBe(28);
    expect(planCut({ cells: [[""]], header: false }, { colW: [300], rowH: [40] }, { axis: "h", at: 20, from: 0, to: 300 })).toBeNull();
  });

  it("does nothing on a line that is already there, or outside the table", () => {
    const s = apply(box(), cutTable(box().t, box().f, { axis: "h", at: 100, from: 0, to: 300 }));
    expect(cutTable(s.t, s.f, { axis: "h", at: 102, from: 0, to: 300 })).toBeNull();
    expect(cutTable(s.t, s.f, { axis: "h", at: 0, from: 0, to: 300 })).toBeNull();
    expect(cutTable(s.t, s.f, { axis: "h", at: 400, from: 0, to: 300 })).toBeNull();
  });

  it("cuts the cell under a click", () => {
    let s = apply(box(), cutTable(box().t, box().f, { axis: "v", at: 150, from: 0, to: 200 }));
    s = apply(s, cutTable(s.t, s.f, { axis: "h", at: 100, from: 40, to: 40 }));
    expect(shape(s)).toEqual(["0,0-150,100", "0,100-150,200", "150,0-300,200"]);
  });

  it("keeps the text in the first part, and the second part dressed like it", () => {
    const t: TableData = { cells: [["Nom"]], header: false, cellStyles: { "0,0": { fill: "#fef3c7", bold: true, bL: false } } };
    const s = apply({ t, f: { colW: [300], rowH: [200] } }, cutTable(t, { colW: [300], rowH: [200] }, { axis: "h", at: 100, from: 0, to: 300 }));
    expect(s.t.cells).toEqual([["Nom"], [""]]);
    expect(s.t.cellStyles?.["1,0"]).toEqual({ fill: "#fef3c7", bold: true, bL: false });
  });

  it("draws the new line even in a table whose lines are hidden", () => {
    const t: TableData = { cells: [[""]], header: false, borders: "box" };
    const s = apply({ t, f: { colW: [300], rowH: [200] } }, cutTable(t, { colW: [300], rowH: [200] }, { axis: "h", at: 100, from: 0, to: 300 }));
    expect(hEdgeShown(s.t, 2, 1, 0)).toBe(true);
  });

  it("follows the formulas and stops at the size a table can have", () => {
    const t: TableData = { cells: [["1", "=A1*2"]], header: false, calc: true };
    const s = apply({ t, f: { colW: [100, 100], rowH: [200] } }, cutTable(t, { colW: [100, 100], rowH: [200] }, { axis: "v", at: 50, from: 0, to: 200 }));
    expect(s.t.cells[0]).toEqual(["1", "", "=A1*2"]);
    const wide: TableData = { cells: [Array.from({ length: 16 }, () => "")], header: false };
    const f = { colW: Array.from({ length: 16 }, () => 60), rowH: [100] };
    expect(planCut(wide, f, { axis: "v", at: 30, from: 0, to: 100 })?.full).toBe(true);
    expect(cutTable(wide, f, { axis: "v", at: 30, from: 0, to: 100 })).toBeNull();
  });

  it("is laid out by the page at the sizes it was drawn", () => {
    let s = apply(box(), cutTable(box().t, box().f, { axis: "v", at: 120, from: 0, to: 200 }));
    s = apply(s, cutTable(s.t, s.f, { axis: "h", at: 60, from: 130, to: 290 }));
    const b: TableBlock = { ...s.t, id: "t", type: "table", layout: { pageId: "p", x: 0, y: 0, width: 300, height: 0 } } as TableBlock;
    const L = layoutTable(b, fr);
    expect(L.colW.map(Math.round)).toEqual([120, 180]);
    expect(L.rows.map((r) => r.height)).toEqual([60, 140]);
    expect(L.cellBoxes.map((c) => [c.x, c.y, c.w, c.h].map(Math.round))).toEqual([
      [0, 0, 120, 200],
      [120, 0, 180, 60],
      [120, 60, 180, 140],
    ]);
  });
});

describe("rubbing out a line", () => {
  it("merges like Table Studio, preserving its anchor content and grid for a later split", () => {
    let s = apply(box(), cutTable(box().t, box().f, { axis: "v", at: 100, from: 0, to: 200 }));
    s = { ...s, t: { ...s.t, cells: [["a", "b"]] } };
    const hit = edgeAt(s.t, s.f, { u: 102, y: 50 });
    expect(hit).toMatchObject({ axis: "v", k: 1, shown: true });
    s = apply(s, eraseEdge(s.t, s.f, hit!));
    expect(s.t.cells).toEqual([["a", ""]]);
    expect(s.f.colW).toEqual([100, 200]);
    expect(s.t.merges).toEqual([{ r: 0, c: 0, rs: 1, cs: 2 }]);
    expect(shape(s)).toEqual(["0,0-300,200"]);
  });

  it("only hides the line when the cells would not make a rectangle", () => {
    let s = apply(box(), cutTable(box().t, box().f, { axis: "v", at: 150, from: 0, to: 200 }));
    s = apply(s, cutTable(s.t, s.f, { axis: "h", at: 100, from: 160, to: 290 }));
    const hit = edgeAt(s.t, s.f, { u: 150, y: 50 })!;
    expect(hit.before && hit.after).toBeTruthy();
    s = apply(s, eraseEdge(s.t, s.f, hit));
    expect(shape(s)).toEqual(["0,0-150,200", "150,0-300,100", "150,100-300,200"]);
    expect(vEdgeShown(s.t, 2, 1, 0)).toBe(false);
    expect(vEdgeShown(s.t, 2, 1, 1)).toBe(true);
    // drawing it again shows it
    s = apply(s, cutTable(s.t, s.f, { axis: "v", at: 150, from: 10, to: 90 }));
    expect(vEdgeShown(s.t, 2, 1, 0)).toBe(true);
  });

  it("hides a piece of the outline", () => {
    const s = apply(box(), eraseEdge(box().t, box().f, edgeAt(box().t, box().f, { u: 0, y: 100 })!));
    expect(vEdgeShown(s.t, 1, 0, 0)).toBe(false);
  });

  it("finds no line inside a merged cell", () => {
    let s = apply(box(), cutTable(box().t, box().f, { axis: "v", at: 150, from: 0, to: 200 }));
    s = apply(s, cutTable(s.t, s.f, { axis: "h", at: 100, from: 160, to: 290 }));
    expect(edgeAt(s.t, s.f, { u: 70, y: 100 })).toBeNull();
  });
});

describe("merging and splitting cells", () => {
  it("merges a range using the same anchor-content rule as the panel", () => {
    let s = apply(box(), cutTable(box().t, box().f, { axis: "h", at: 100, from: 0, to: 300 }));
    s = apply(s, cutTable(s.t, s.f, { axis: "v", at: 150, from: 0, to: 300 }));
    s = { ...s, t: { ...s.t, cells: [["1", "2"], ["3", "4"]] } };
    const out = mergeRange(s.t, s.f, { r0: 0, c0: 0, r1: 0, c1: 1 })!;
    s = apply(s, out);
    expect(shape(s)).toEqual(["0,0-300,100", "0,100-150,200", "150,100-300,200"]);
    expect(s.t.cells[0][0]).toBe("1");
    expect(out.cell).toEqual({ r: 0, c: 0, rs: 1, cs: 2 });
  });

  it("splits a cell into columns and rows of the same size", () => {
    const out = splitRange(box().t, box().f, { r0: 0, c0: 0, r1: 0, c1: 0 }, 3, 2)!;
    const s = apply(box(), out);
    expect(s.f.colW).toEqual([100, 100, 100]);
    expect(s.f.rowH).toEqual([100, 100]);
    expect(cellsOf(s.t)).toHaveLength(6);
  });

  it("splits a merged cell back along its own lines", () => {
    let s = apply(box(), cutTable(box().t, box().f, { axis: "v", at: 120, from: 0, to: 200 }));
    s = apply(s, cutTable(s.t, s.f, { axis: "h", at: 100, from: 130, to: 290 })); // (the first column is merged over two rows)
    s = apply(s, splitRange(s.t, s.f, { r0: 0, c0: 0, r1: 0, c1: 0 }, 1, 2));
    expect(s.f.rowH).toEqual([100, 100]);
    expect(s.t.merges ?? []).toEqual([]);
  });

  it("leaves a table alone when nothing can be split", () => {
    expect(splitRange(box().t, box().f, { r0: 0, c0: 0, r1: 0, c1: 0 }, 1, 1)).toBeNull();
  });

  it("finds the cell under a point", () => {
    let s = apply(box(), cutTable(box().t, box().f, { axis: "v", at: 120, from: 0, to: 200 }));
    s = apply(s, cutTable(s.t, s.f, { axis: "h", at: 100, from: 130, to: 290 }));
    expect(cellAtPoint(s.t, s.f, { u: 50, y: 150 })).toEqual({ r: 0, c: 0, rs: 2, cs: 1 });
    expect(cellAtPoint(s.t, s.f, { u: 250, y: 150 })).toEqual({ r: 1, c: 1, rs: 1, cs: 1 });
    expect(cellAtPoint(s.t, s.f, { u: 350, y: 150 })).toBeNull();
  });

  it("does not merge a cell that is already merged", () => {
    const s = apply(box(), cutTable(box().t, box().f, { axis: "h", at: 100, from: 0, to: 300 }));
    const g = { r0: 0, c0: 0, r1: 1, c1: 0 };
    const merged = apply(s, mergeRange(s.t, s.f, g));
    expect(mergeRange(merged.t, merged.f, g)).toBeNull();
  });
});

describe("drawing integration and edge cases", () => {
  it("shares formulas and formatting when copying between worksheet cells and Studio", () => {
    const t: TableData = { cells: [["2", "=A1*2"], ["3", ""]], header: false, calc: true, cellStyles: { "0,1": { bold: true, fill: "#ffeeaa" } } };
    const text = copyTableCells(t, { r0: 0, c0: 1, r1: 0, c1: 1 }, "fr");
    expect(text).toBe("4");
    const out = pasteTableCells(t, { r: 1, c: 1 }, text)!;
    expect(out.patch.cells?.[1][1]).toBe("=A2*2");
    expect(out.patch.cellStyles?.["1,1"]).toEqual({ bold: true, fill: "#ffeeaa" });
    expect(t.cells[1][1]).toBe("");
  });

  it("pastes external spreadsheet text and leaves merged neighbours intact", () => {
    const t: TableData = { cells: [["", ""], ["", ""]], header: false, merges: [{ r: 0, c: 1, rs: 2, cs: 1 }] };
    const out = pasteTableCells(t, { r: 0, c: 0 }, "Nom\tValeur\nÉlève\t42")!;
    expect(out.patch.cells).toEqual([["Nom", "Valeur"], ["Élève", ""]]);
    expect(out.patch.merges ?? t.merges).toEqual(t.merges);
  });

  it("does not create cell styles past the table limits on paste", () => {
    const source: TableData = { cells: [["a", "b"]], header: false, cellStyles: { "0,0": { bold: true }, "0,1": { italic: true } } };
    const text = copyTableCells(source, { r0: 0, c0: 0, r1: 0, c1: 1 }, "fr");
    const table: TableData = { cells: [Array.from({ length: 16 }, () => "")], header: false };
    const out = pasteTableCells(table, { r: 0, c: 15 }, text)!;
    expect(out.patch.cellStyles?.["0,15"]).toEqual({ bold: true });
    expect(out.patch.cellStyles?.["0,16"]).toBeUndefined();
  });

  it.each(["h", "v"] as const)("restores either erased outside border on the %s axis", (axis) => {
    for (const at of [0, axis === "h" ? 200 : 300]) {
      const original = box();
      const hit = edgeAt(original.t, original.f, axis === "h" ? { u: 150, y: at } : { u: at, y: 100 })!;
      const erased = apply(original, eraseEdge(original.t, original.f, hit));
      const restored = apply(erased, cutTable(erased.t, erased.f, { axis, at, from: 1, to: axis === "h" ? 299 : 199 }));
      const shown = axis === "h" ? hEdgeShown(restored.t, 1, at === 0 ? 0 : 1, 0) : vEdgeShown(restored.t, 1, at === 0 ? 0 : 1, 0);
      expect(shown).toBe(true);
      expect(shape(restored)).toEqual(shape(original));
    }
  });

  it("rejects a split completely if any requested piece is too small", () => {
    const s = box();
    const before = structuredClone(s);
    expect(splitRange(s.t, s.f, { r0: 0, c0: 0, r1: 0, c1: 0 }, 3, 10)).toBeNull();
    expect(s).toEqual(before);
  });

  it("rejects an entire split when a later cut exceeds the grid limit", () => {
    const t: TableData = { cells: [Array.from({ length: 15 }, () => "")], header: false };
    const f: Frame = { colW: Array.from({ length: 15 }, () => 120), rowH: [100] };
    expect(splitRange(t, f, { r0: 0, c0: 0, r1: 0, c1: 0 }, 3, 1)).toBeNull();
    expect(t.cells[0]).toHaveLength(15);
  });

  it.each([[0, 2], [2.5, 1], [2, NaN], [Infinity, 1]])("rejects invalid split counts %s × %s", (cols, rows) => {
    expect(splitRange(box().t, box().f, { r0: 0, c0: 0, r1: 0, c1: 0 }, cols, rows)).toBeNull();
  });

  it("keeps formulas and the grid identical to a Studio merge/unmerge", () => {
    const t: TableData = { cells: [["=C1*2", "label", "3"]], header: false, calc: true };
    const f = { colW: [90, 110, 100], rowH: [60] };
    const g = { r0: 0, c0: 0, r1: 0, c1: 1 };
    const s = apply({ t, f }, mergeRange(t, f, g));
    expect(s.t.cells).toEqual(mergeCells(t, g)!.patch.cells);
    expect(s.t.cells[0][0]).toBe("=C1*2");
    expect(s.f).toEqual(f);
    const split = apply(s, splitRange(s.t, s.f, g, 2, 1));
    expect(split.t.merges).toEqual(unmergeCells(s.t, g)!.merges);
    expect(split.f).toEqual(f);
  });

  it("splits each selected cell, without cutting the neighbouring cell", () => {
    let s = apply(box(), cutTable(box().t, box().f, { axis: "v", at: 180, from: 0, to: 200 }));
    s = apply(s, cutTable(s.t, s.f, { axis: "h", at: 100, from: 1, to: 170 }));
    s = apply(s, splitRange(s.t, s.f, { r0: 0, c0: 0, r1: 1, c1: 0 }, 3, 1));
    expect(cellsOf(s.t)).toHaveLength(7);
    expect(shape(s)).toContain("180,0-300,200");
  });

  it("round-trips a drawn table through Studio and JSON, including geometry and appearance", () => {
    let s = apply(box(), cutTable(box().t, box().f, { axis: "v", at: 120, from: 0, to: 200 }));
    s = apply(s, cutTable(s.t, s.f, { axis: "h", at: 80, from: 130, to: 290 }));
    const b = { ...s.t, id: "drawn", type: "table", font: { size: 14, family: "Arial" }, borderColor: "#222222", flip: true,
      cellStyles: { "0,0": { fill: "#ffeeaa", bold: true, bL: false } },
      layout: { pageId: "p", x: 90, y: 120, width: 300, height: 200 } } as TableBlock;
    const fromFile = JSON.parse(JSON.stringify(b)) as TableBlock;
    const patch = tablePatch(studioTableOf(fromFile));
    const after = { ...fromFile, ...patch, layout: { ...fromFile.layout, ...patch.layout } } as TableBlock;
    expect(after.cells).toEqual(b.cells);
    expect(after.merges).toEqual(b.merges);
    expect(after.cellStyles).toEqual(b.cellStyles);
    expect(after.layout).toEqual(b.layout);
    for (const lang of ["fr", "ar"] as const) {
      const layout = layoutTable(after, { ...fr, lang });
      expect(layout.cellBoxes).toEqual(layoutTable(b, { ...fr, lang }).cellBoxes);
      expect(layout.colW).toEqual([120, 180]);
      expect(layout.height).toBe(200);
    }
  });

  it("clamps stale selections after resize or undo before merging or splitting", () => {
    const sel = clampSel({ anchor: { r: 2, c: 2 }, focus: { r: 5, c: 9 } }, 1, 1)!;
    expect(selRange(sel)).toEqual({ r0: 0, c0: 0, r1: 0, c1: 0 });
    const s = box();
    expect(splitRange(s.t, s.f, selRange(sel), 2, 1)?.patch.cells).toEqual([["", ""]]);
    expect(mergeRange(s.t, s.f, selRange(sel))).toBeNull();
  });

  it("keeps a valid rectangular partition through repeated cuts, erases and splits", () => {
    let s = box();
    let seed = 317;
    const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 2 ** 32);
    for (let i = 0; i < 100; i++) {
      const axis = random() > 0.5 ? "h" : "v";
      const at = random() * (axis === "h" ? 200 : 300);
      const out = cutTable(s.t, s.f, { axis, at, from: 0, to: random() * (axis === "h" ? 300 : 200) });
      if (out) s = apply(s, out);
      const edge = edgeAt(s.t, s.f, { u: random() * 300, y: random() * 200 }, 10);
      if (edge) { const erased = eraseEdge(s.t, s.f, edge); if (erased) s = apply(s, erased); }
      expect(s.f.colW.reduce((a, b) => a + b, 0)).toBeCloseTo(300);
      expect(s.f.rowH.reduce((a, b) => a + b, 0)).toBeCloseTo(200);
      expect(s.f.colW.every((w) => w >= 24 - 0.01)).toBe(true);
      expect(s.f.rowH.every((h) => h >= 28 - 0.01)).toBe(true);
      const occupancy = s.t.cells.map((row) => row.map(() => 0));
      for (const cell of cellsOf(s.t)) for (let r = cell.r; r < cell.r + cell.rs; r++) for (let c = cell.c; c < cell.c + cell.cs; c++) occupancy[r][c]++;
      expect(occupancy.flat().every((n) => n === 1)).toBe(true);
    }
  });
});
