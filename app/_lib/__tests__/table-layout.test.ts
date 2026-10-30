import { describe, expect, it } from "vitest";
import { TABLE_HEADER_FILL, TABLE_MIN_ROW, blockHeight, layoutTable } from "../blockLayout";
import { fontStack } from "../fonts";
import { newShapeItem } from "../shapes";
import { editRegions } from "../editRegions";
import type { ExamMeta, TableBlock } from "../types";

const fr: ExamMeta = { title: "t", lang: "fr", templateId: "x" };
const ar: ExamMeta = { ...fr, lang: "ar" };
const layout = { pageId: "p", x: 0, y: 0, width: 400, height: 0 };
const table = (cells: string[][], extra: Partial<TableBlock> = {}): TableBlock => ({ id: "t", type: "table", cells, header: false, layout, ...extra });

describe("a plain table", () => {
  it("is laid out the way tables always were, with one box per cell", () => {
    const L = layoutTable(table([["a", "b"], ["c", "d"]], { header: true }), fr);
    expect(L.ext).toBe(false);
    expect(L.lines).toEqual([]);
    expect(L.colW).toEqual([200, 200]);
    expect(L.rows.map((r) => r.height)).toEqual([TABLE_MIN_ROW, TABLE_MIN_ROW]);
    expect(L.cellBoxes).toHaveLength(4);
    expect(L.cellBoxes[0]).toMatchObject({ r: 0, c: 0, x: 0, y: 0, w: 200, h: TABLE_MIN_ROW, align: "center" });
    expect(L.cellBoxes[0].spec.font.bold).toBe(true);
    expect(L.cellBoxes[2].spec.font.bold).toBe(false);
    expect(L.cellBoxes[2].align).toBeUndefined();
  });

  it("puts the first column on the right in Arabic", () => {
    const L = layoutTable(table([["a", "b"]], { colWidths: [1, 3] }), ar);
    expect(L.colX[0]).toBe(300);
    expect(L.colX[1]).toBe(0);
  });

  it("is still one when the extras are empty", () => {
    expect(layoutTable(table([["a"]], { merges: [], cellStyles: {}, calc: false }), fr).ext).toBe(false);
  });

  it("gives the same typing regions as before", () => {
    const b = table([["a", "b"]], { header: true });
    const regions = editRegions(b, 1, fr, "exam");
    expect(regions).toHaveLength(2);
    expect(regions[0]).toMatchObject({ field: { kind: "cell", r: 0, c: 0 }, x: 6, y: 4, width: 188, height: TABLE_MIN_ROW - 8, align: "center" });
    expect(regions[1].x).toBe(206);
  });
});

describe("merged cells", () => {
  const b = table([["wide", "", "x"], ["a", "b", "c"], ["tall", "e", "f"], ["", "g", "h"]], {
    merges: [
      { r: 0, c: 0, rs: 1, cs: 2 },
      { r: 2, c: 0, rs: 2, cs: 1 },
    ],
  });
  const L = layoutTable(b, fr);

  it("makes one box of a merged cell, as wide or as tall as the cells it covers", () => {
    expect(L.ext).toBe(true);
    expect(L.cellBoxes).toHaveLength(4 * 3 - 2);
    const wide = L.cellBoxes.find((c) => c.r === 0 && c.c === 0)!;
    expect(wide.w).toBeCloseTo(2 * (400 / 3));
    expect(wide.h).toBe(TABLE_MIN_ROW);
    const tall = L.cellBoxes.find((c) => c.r === 2 && c.c === 0)!;
    expect(tall.h).toBe(2 * TABLE_MIN_ROW);
    expect(L.cellBoxes.some((c) => c.r === 0 && c.c === 1)).toBe(false);
  });

  it("has no line inside a merged cell and all the others", () => {
    const horizontal = L.lines.filter((l) => l[1] === l[3]);
    const vertical = L.lines.filter((l) => l[0] === l[2]);
    // horizontal: 5 lines × 3 columns, minus the one inside the tall cell
    expect(horizontal).toHaveLength(5 * 3 - 1);
    // vertical: 4 lines × 4 rows, minus the one inside the wide cell
    expect(vertical).toHaveLength(4 * 4 - 1);
    expect(horizontal.some((l) => l[1] === 3 * TABLE_MIN_ROW && l[0] === 0)).toBe(false);
    expect(vertical.some((l) => Math.abs(l[0] - 400 / 3) < 0.01 && l[1] === 0)).toBe(false);
  });

  it("grows the last row of a merged cell that lacks height", () => {
    const long = table([["one two three four five six seven eight nine ten eleven twelve", "x"], ["", "y"]], { merges: [{ r: 0, c: 0, rs: 2, cs: 1 }], colWidths: [1, 9] });
    const l = layoutTable(long, fr);
    const cell = l.cellBoxes.find((c) => c.r === 0 && c.c === 0)!;
    expect(cell.h).toBeGreaterThanOrEqual(cell.text.height + 8);
    expect(cell.h).toBe(l.rows[0].height + l.rows[1].height);
  });

  it("types in the merged cell where it is drawn", () => {
    const regions = editRegions(b, 1, fr, "exam");
    expect(regions).toHaveLength(10);
    expect(regions.find((r) => r.field.kind === "cell" && r.field.r === 0 && r.field.c === 0)!.width).toBeCloseTo(2 * (400 / 3) - 12);
  });

  it("reaches the height of the whole table", () => {
    expect(blockHeight(b, 1, fr)).toBe(4 * TABLE_MIN_ROW);
  });
});

describe("the look of cells", () => {
  it("fills the header, the banded rows, and the cells that ask", () => {
    const b = table([["h", "h"], ["1", "1"], ["2", "2"], ["3", "3"]], { header: true, banded: "#eef", cellStyles: { "3,1": { fill: "#fee" } } });
    const L = layoutTable(b, fr);
    const fill = (r: number, c: number) => L.cellBoxes.find((x) => x.r === r && x.c === c)!.fill;
    expect(fill(0, 0)).toBe(TABLE_HEADER_FILL);
    expect(fill(1, 0)).toBeUndefined();
    expect(fill(2, 0)).toBe("#eef");
    expect(fill(3, 0)).toBeUndefined();
    expect(fill(3, 1)).toBe("#fee");
    expect(layoutTable({ ...b, headerFill: "#abc" }, fr).cellBoxes[0].fill).toBe("#abc");
  });

  it("bolds, colors and sizes a cell, and aligns and places its text", () => {
    const b = table([["a", "b"]], { cellStyles: { "0,0": { bold: true, italic: true, color: "#f00", size: 20, align: "right", valign: "top" } }, rowHeights: [80] });
    const [a, c] = layoutTable(b, fr).cellBoxes;
    expect(a.spec.font).toMatchObject({ bold: true, italic: true, color: "#f00", size: 20 });
    expect(a.align).toBe("right");
    expect(a.textY).toBe(4);
    expect(c.spec.font.bold).toBe(false);
    expect(c.textY).toBeCloseTo((80 - c.text.height) / 2);
    expect(layoutTable(table([["a"]], { rowHeights: [80], cellStyles: { "0,0": { valign: "bottom" } } }), fr).cellBoxes[0].textY).toBeGreaterThan(40);
  });

  it("bolds the first column and the header", () => {
    const L = layoutTable(table([["h", "h"], ["a", "b"]], { header: true, firstCol: true, headerColor: "#fff" }), fr);
    const spec = (r: number, c: number) => L.cellBoxes.find((x) => x.r === r && x.c === c)!.spec.font;
    expect(spec(0, 1).bold).toBe(true);
    expect(spec(0, 1).color).toBe("#fff");
    expect(spec(1, 0).bold).toBe(true);
    expect(spec(1, 1).bold).toBe(false);
  });

  it("draws the lines the border style says", () => {
    const none = layoutTable(table([["a", "b"], ["c", "d"]], { borders: "none" }), fr);
    expect(none.ext).toBe(true);
    expect(none.lines).toEqual([]);
    const box = layoutTable(table([["a", "b"], ["c", "d"]], { borders: "box" }), fr);
    expect(box.lines).toHaveLength(2 * 2 + 2 * 2); // (the outside: 2 + 2 segments on each side)
    const grid = layoutTable(table([["a", "b"], ["c", "d"]], { borders: "grid" }), fr);
    expect(grid.lines).toHaveLength(3 * 2 + 3 * 2);
  });

  it("puts the first column's edge on the right in Arabic", () => {
    const L = layoutTable(table([["a", "b"]], { borders: "none", cellStyles: { "0,0": { bL: true } } }), ar);
    expect(L.lines).toEqual([[400, 0, 400, TABLE_MIN_ROW]]);
  });
});

describe("formulas", () => {
  it("show their value, formatted, and errors", () => {
    const b = table([["2,5", "4", "=A1*B1", "=A1/0"]], { calc: true, cellStyles: { "0,2": { fmt: { decimals: 2, suffix: " V" } } } });
    const L = layoutTable(b, fr);
    const text = (c: number) => L.cellBoxes[c].text.lines.map((l) => l.pieces.map((p) => p.text).join("")).join("");
    expect(text(2)).toBe("10,00 V");
    expect(text(3)).toBe("#DIV/0!");
    expect(text(0)).toBe("2,5");
  });

  it("stay text in a table that did not ask for formulas", () => {
    const L = layoutTable(table([["=1+1"]], { borders: "grid" }), fr);
    expect(L.cellBoxes[0].text.lines[0].pieces.map((p) => p.text).join("")).toBe("=1+1");
  });

  it("format a typed number too, and truth values in the language of the exam", () => {
    const b = table([["3.14159", "=1<2"]], { calc: true, cellStyles: { "0,0": { fmt: { decimals: 2 } } } });
    const t = (L: ReturnType<typeof layoutTable>, c: number) => L.cellBoxes[c].text.lines[0].pieces.map((p) => p.text).join("");
    expect(t(layoutTable(b, fr), 0)).toBe("3,14");
    expect(t(layoutTable(b, fr), 1)).toBe("VRAI");
    expect(t(layoutTable(b, ar), 1)).toBe("صحيح");
  });
});

describe("fonts", () => {
  it("gives a cell its own font and leaves the others with the table's", () => {
    const b = table([["a", "b"]], { font: { family: "Verdana" }, cellStyles: { "0,0": { font: "Georgia" } } });
    const [a, c] = layoutTable(b, fr).cellBoxes;
    expect(a.spec.font.family).toBe(fontStack("Georgia"));
    expect(c.spec.font.family).toBe(fontStack("Verdana"));
  });

  it("uses the table's font for every cell of a plain table too", () => {
    const L = layoutTable(table([["a", "b"]], { font: { family: "Verdana" } }), fr);
    expect(L.ext).toBe(false);
    expect(L.cellBoxes.every((c) => c.spec.font.family === fontStack("Verdana"))).toBe(true);
  });
});

describe("shapes over a table", () => {
  const shape = (y: number, h: number) => newShapeItem("rect", { x: 10, y, w: 50, h });

  it("keep a plain table plain", () => {
    expect(layoutTable(table([["a"]], { shapes: [shape(0, 20)] }), fr).ext).toBe(false);
  });

  it("make the table as high as the lowest of them when it goes below the rows", () => {
    const rows = TABLE_MIN_ROW * 2;
    const b = table([["a"], ["b"]]);
    expect(blockHeight(b, 1, fr)).toBe(rows);
    expect(blockHeight({ ...b, shapes: [shape(5, 10)] }, 1, fr)).toBe(rows);
    expect(blockHeight({ ...b, shapes: [shape(100, 40)] }, 1, fr)).toBeGreaterThanOrEqual(140);
  });
});

describe("a flipped table", () => {
  const cells = [["A", "B", "C"]];

  it("puts the first column on the other side of the page, in a French exam too", () => {
    const plain = layoutTable(table(cells), fr);
    expect(plain.mirror).toBe(false);
    expect(plain.colX).toEqual([0, 400 / 3, (2 * 400) / 3]);
    const flipped = layoutTable(table(cells, { flip: true }), fr);
    expect(flipped.mirror).toBe(true);
    expect(flipped.colX[0]).toBeCloseTo((2 * 400) / 3);
    expect(flipped.colX[2]).toBeCloseTo(0);
    // the text keeps the direction of the exam
    expect(flipped.F.rtl).toBe(false);
  });

  it("flips an Arabic table back to left to right", () => {
    expect(layoutTable(table(cells), ar).mirror).toBe(true);
    const flipped = layoutTable(table(cells, { flip: true }), ar);
    expect(flipped.mirror).toBe(false);
    expect(flipped.colX).toEqual([0, 400 / 3, (2 * 400) / 3]);
    expect(flipped.F.rtl).toBe(true);
  });

  it("keeps the widths of the columns with their columns", () => {
    const L = layoutTable(table(cells, { flip: true, colWidths: [1, 1, 2] }), fr);
    expect(L.colW).toEqual([100, 100, 200]);
    expect(L.colX).toEqual([300, 200, 0]);
  });

  it("flips the lines and the typing places of a table with extras", () => {
    const b = table([["A", "B"]], { flip: true, borders: "none", cellStyles: { "0,0": { bL: true } } });
    const L = layoutTable(b, fr);
    expect(L.ext).toBe(true);
    // the edge before the first column is on the right now
    expect(L.lines).toEqual([[400, 0, 400, TABLE_MIN_ROW]]);
    const regions = editRegions(table([["A", "B"]], { flip: true }), 1, fr, "exam");
    expect(regions[0].x).toBe(206);
    expect(regions[1].x).toBe(6);
  });
});
