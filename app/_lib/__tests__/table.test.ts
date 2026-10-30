import { describe, expect, it } from "vitest";
import {
  adjustFormula,
  blankCells,
  cellName,
  clearRange,
  colIndex,
  colName,
  createSheet,
  deleteLines,
  fillRange,
  formatNumber,
  insertLines,
  isError,
  isPlainTable,
  mergeCells,
  parseNumber,
  parseRef,
  parseTable,
  pasteMatrix,
  resizeTable,
  setBorders,
  setCell,
  setStyle,
  shiftFormula,
  sortRows,
  textOf,
  toTabText,
  unmergeCells,
  hEdgeShown,
  isBorderOn,
  vEdgeShown,
  type TableData,
  type Value,
} from "../table";

const table = (cells: string[][], extra: Partial<TableData> = {}): TableData => ({ cells, header: false, ...extra });
const evalAt = (cells: string[][], r: number, c: number): Value => createSheet(cells, true).value(r, c);
const calc = (formula: string, cells: string[][] = [["1", "2", "3"], ["4", "5", "6"]]): Value => evalAt([[formula, ...cells[0].slice(1)], ...cells.slice(1)].map((row, i) => (i === 0 ? row : row)), 0, 0);
const f = (formula: string) => evalAt([[formula, "10", "20", "30"], ["4", "5", "6", "text"]], 0, 0);

describe("cell names", () => {
  it("counts columns like a spreadsheet", () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(colName)).toEqual(["A", "B", "Z", "AA", "AB", "AZ", "BA"]);
    expect(["A", "Z", "AA", "AZ", "ba"].map(colIndex)).toEqual([0, 25, 26, 51, 52]);
    expect(cellName(2, 1)).toBe("B3");
  });

  it("reads references, with the parts fixed by $", () => {
    expect(parseRef("B3")).toEqual({ r: 2, c: 1, absR: false, absC: false });
    expect(parseRef("$B$3")).toEqual({ r: 2, c: 1, absR: true, absC: true });
    expect(parseRef("B")).toBeNull();
    expect(parseRef("B0")).toBeNull();
    expect(parseRef("SUM")).toBeNull();
  });
});

describe("numbers", () => {
  it("reads what was typed", () => {
    expect(parseNumber("12")).toBe(12);
    expect(parseNumber("12,5")).toBe(12.5);
    expect(parseNumber("-0.25")).toBe(-0.25);
    expect(parseNumber("1 200,5")).toBe(1200.5);
    expect(parseNumber("50 %")).toBe(0.5);
    expect(parseNumber("1e3")).toBe(1000);
    expect(parseNumber("12 V")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("1.2.3")).toBeNull();
  });

  it("writes them with a decimal comma, decimals, a percent sign and units", () => {
    expect(formatNumber(12.5)).toBe("12,5");
    expect(formatNumber(0.1 + 0.2)).toBe("0,3");
    expect(formatNumber(2, { decimals: 2 })).toBe("2,00");
    expect(formatNumber(1234567.891, { decimals: 1, thousands: true })).toBe("1 234 567,9");
    expect(formatNumber(0.256, { percent: true, decimals: 1 })).toBe("25,6 %");
    expect(formatNumber(4.7, { suffix: " kΩ" })).toBe("4,7 kΩ");
    expect(formatNumber(5, { prefix: "€ " }, ".")).toBe("€ 5");
    expect(formatNumber(-0.0001, { decimals: 2 })).toBe("0,00");
    expect(formatNumber(1.5, {}, ".")).toBe("1.5");
  });
});

describe("formulas", () => {
  it("do arithmetic with the usual order", () => {
    expect(f("=1+2*3")).toBe(7);
    expect(f("=(1+2)*3")).toBe(9);
    expect(f("=2^3^2")).toBe(512);
    expect(f("=-2^2")).toBe(-4);
    expect(f("=2^-1")).toBe(0.5);
    expect(f("=10/4")).toBe(2.5);
    expect(f("=50%")).toBe(0.5);
    expect(f("=200*10%")).toBe(20);
    expect(f("= 1 + 2")).toBe(3);
  });

  it("read cells and ranges", () => {
    expect(f("=B1+C1")).toBe(30);
    expect(f("=B1*$C$1")).toBe(200);
    expect(f("=SUM(B1:D1)")).toBe(60);
    expect(f("=SUM(B1:D2)")).toBe(60 + 5 + 6);
    expect(f("=AVERAGE(B1:D1)")).toBe(20);
    expect(f("=MIN(B1:D1)")).toBe(10);
    expect(f("=MAX(B1:D2)")).toBe(30);
    expect(f("=COUNT(A2:D2)")).toBe(3);
    expect(f("=COUNTA(A2:D2)")).toBe(4);
    expect(f("=PRODUCT(B1:C1)")).toBe(200);
    expect(f("=MEDIAN(B1:D1)")).toBe(20);
    expect(f("=SUM(D1:B1)")).toBe(60);
  });

  it("know the French names", () => {
    expect(f("=SOMME(B1:D1)")).toBe(60);
    expect(f("=MOYENNE(B1:D1)")).toBe(20);
    expect(f("=ARRONDI(2,567;1)")).toBe(2.6);
    expect(f("=SI(B1>5;1;0)")).toBe(1);
    expect(f("=RACINE(16)")).toBe(4);
    expect(f("=PUISSANCE(2;10)")).toBe(1024);
  });

  it("do the maths functions", () => {
    expect(f("=ROUND(2.567, 1)")).toBe(2.6);
    expect(f("=ROUND(-2.5)")).toBe(-3);
    expect(f("=ROUND(2,567;1)")).toBe(2.6);
    expect(f("=ROUND(2,567, 1)")).toEqual({ error: "#VALUE!" });
    expect(f("=ROUNDUP(2.11, 1)")).toBe(2.2);
    expect(f("=ROUNDDOWN(2.99, 1)")).toBe(2.9);
    expect(f("=ROUND(1234, -2)")).toBe(1200);
    expect(f("=ABS(-3)")).toBe(3);
    expect(f("=SQRT(2)")).toBeCloseTo(Math.SQRT2);
    expect(f("=INT(-1.5)")).toBe(-2);
    expect(f("=MOD(7, 3)")).toBe(1);
    expect(f("=MOD(-7, 3)")).toBe(2);
    expect(f("=POWER(2, 0.5)")).toBeCloseTo(Math.SQRT2);
    expect(f("=EXP(0)")).toBe(1);
    expect(f("=LN(1)")).toBe(0);
    expect(f("=LOG10(1000)")).toBeCloseTo(3);
    expect(f("=SIN(0)+COS(0)")).toBe(1);
    expect(f("=PI()")).toBeCloseTo(Math.PI);
    expect(f("=2*PI")).toBeCloseTo(2 * Math.PI);
  });

  it("do logic and text", () => {
    expect(f('=IF(B1>5, "big", "small")')).toBe("big");
    expect(f("=IF(B1<5, 1, 2)")).toBe(2);
    expect(f("=IF(B1<5, 1)")).toBe(false);
    expect(f("=AND(B1>5, C1>5)")).toBe(true);
    expect(f("=OR(B1>50, C1>50)")).toBe(false);
    expect(f("=NOT(B1>50)")).toBe(true);
    expect(f('="a"&"b"')).toBe("ab");
    expect(f('="v="&B1')).toBe("v=10");
    expect(f("=B1=10")).toBe(true);
    expect(f("=B1<>10")).toBe(false);
    expect(f("=B1>=10")).toBe(true);
  });

  it("leave out the text of a range and refuse the text of a sum", () => {
    expect(f("=SUM(A2:D2)")).toBe(4 + 5 + 6);
    expect(f("=A2+D2")).toEqual({ error: "#VALUE!" });
  });

  it("say what went wrong", () => {
    expect(f("=1/0")).toEqual({ error: "#DIV/0!" });
    expect(f("=MOD(1, 0)")).toEqual({ error: "#DIV/0!" });
    expect(f("=SQRT(-1)")).toEqual({ error: "#NUM!" });
    expect(f("=LN(0)")).toEqual({ error: "#NUM!" });
    expect(f("=Z99")).toEqual({ error: "#REF!" });
    expect(f("=FOO(1)")).toEqual({ error: "#NAME?" });
    expect(f("=foo")).toEqual({ error: "#NAME?" });
    expect(f("=1+")).toEqual({ error: "#ERROR!" });
    expect(f("=(1+2")).toEqual({ error: "#ERROR!" });
    expect(f('="abc')).toEqual({ error: "#ERROR!" });
    expect(f("=B1:C1")).toEqual({ error: "#VALUE!" });
    expect(f("=1/0+1")).toEqual({ error: "#DIV/0!" });
    expect(isError(f("=SUM(1/0, 2)"))).toBe(true);
  });

  it("follow the cells they use, and notice a circle", () => {
    const cells = [["=B1+1", "=C1*2", "5"], ["=A1+A1", "", ""]];
    expect(evalAt(cells, 0, 0)).toBe(11);
    expect(evalAt(cells, 1, 0)).toBe(22);
    const loop = [["=B1", "=A1"]];
    expect(evalAt(loop, 0, 0)).toEqual({ error: "#CIRC!" });
    expect(evalAt(loop, 0, 1)).toEqual({ error: "#CIRC!" });
    expect(evalAt([["=A1"]], 0, 0)).toEqual({ error: "#CIRC!" });
  });

  it("read the numbers typed in cells, with a comma or a unit-less text", () => {
    const cells = [["2,5", "4", "=A1*B1"]];
    expect(evalAt(cells, 0, 2)).toBe(10);
    expect(evalAt([["12 V", "=A1+1"]], 0, 1)).toEqual({ error: "#VALUE!" });
  });

  it("are only formulas when the table says so", () => {
    expect(createSheet([["=1+1"]], false).value(0, 0)).toBe("=1+1");
    expect(createSheet([["=1+1"]], true).value(0, 0)).toBe(2);
    expect(createSheet([["="]], true).value(0, 0)).toBe("=");
  });

  it("treat an empty cell as nothing", () => {
    expect(evalAt([["", "=A1+1", "=SUM(A1:B1)", "=AVERAGE(A1:A1)"]], 0, 1)).toBe(1);
    expect(evalAt([["", "=A1+1", "=SUM(A1:B1)", "=AVERAGE(A1:A1)"]], 0, 2)).toBe(1);
    expect(evalAt([["", "=A1+1", "=SUM(A1:B1)", "=AVERAGE(A1:A1)"]], 0, 3)).toEqual({ error: "#DIV/0!" });
  });
});

describe("references that move", () => {
  it("follow a copied formula", () => {
    expect(shiftFormula("=A1+B2", 1, 1)).toBe("=B2+C3");
    expect(shiftFormula("=$A$1+B2", 2, 0)).toBe("=$A$1+B4");
    expect(shiftFormula("=A$1+$B2", 3, 3)).toBe("=D$1+$B5");
    expect(shiftFormula("=SUM(A1:A3)", 0, 1)).toBe("=SUM(B1:B3)");
    expect(shiftFormula("=A1", -1, 0)).toBe("=#REF!");
    expect(shiftFormula("text A1", 1, 1)).toBe("text A1");
    expect(shiftFormula("=A1", 0, 0)).toBe("=A1");
  });

  it("follow a row that is inserted", () => {
    expect(adjustFormula("=A2+A5", { axis: "row", at: 3, count: 1, kind: "insert" })).toBe("=A2+A6");
    expect(adjustFormula("=SUM(A1:A5)", { axis: "row", at: 2, count: 2, kind: "insert" })).toBe("=SUM(A1:A7)");
    expect(adjustFormula("=A1+B1", { axis: "col", at: 1, count: 1, kind: "insert" })).toBe("=A1+C1");
  });

  it("follow a row that is deleted", () => {
    expect(adjustFormula("=A2+A5", { axis: "row", at: 1, count: 1, kind: "delete" })).toBe("=#REF!+A4");
    expect(adjustFormula("=SUM(A1:A5)", { axis: "row", at: 1, count: 2, kind: "delete" })).toBe("=SUM(A1:A3)");
    expect(adjustFormula("=SUM(A2:A3)", { axis: "row", at: 1, count: 2, kind: "delete" })).toBe("=SUM(#REF!)");
    expect(adjustFormula("=SUM(A1:A5)", { axis: "row", at: 0, count: 1, kind: "delete" })).toBe("=SUM(A1:A4)");
  });
});

describe("size", () => {
  it("keeps what still fits", () => {
    const t = table([["a", "b"], ["c", "d"]], { colWidths: [1, 3], rowHeights: [0, 40], merges: [{ r: 0, c: 0, rs: 2, cs: 2 }], cellStyles: { "1,1": { bold: true }, "0,0": { bold: true } } });
    const small = resizeTable(t, 1, 1);
    expect(small.cells).toEqual([["a"]]);
    expect(small.merges).toBeUndefined();
    expect(small.cellStyles).toEqual({ "0,0": { bold: true } });
    expect(small.colWidths).toEqual([1]);
    const big = resizeTable(t, 3, 3);
    expect(big.cells).toEqual([["a", "b", ""], ["c", "d", ""], ["", "", ""]]);
    expect(big.merges).toEqual([{ r: 0, c: 0, rs: 2, cs: 2 }]);
    expect(big.colWidths?.length).toBe(3);
    expect(big.colWidths?.[2]).toBe(2);
    expect(big.rowHeights).toEqual([0, 40, 0]);
  });

  it("has limits", () => {
    expect(resizeTable(table(blankCells(2, 2)), 500, 500).cells?.length).toBe(40);
    expect(resizeTable(table(blankCells(2, 2)), 0, 0).cells).toEqual([[""]]);
  });
});

describe("rows and columns", () => {
  const t = table([["a", "=A1"], ["b", "=A2"], ["c", "=SUM(A1:A3)"]], { rowHeights: [0, 30, 0], cellStyles: { "1,0": { bold: true } }, merges: [{ r: 1, c: 0, rs: 2, cs: 2 }] });

  it("inserts a row: the formulas, merges, looks and heights follow", () => {
    const p = insertLines(t, "row", 1)!;
    expect(p.cells).toEqual([["a", "=A1"], ["", ""], ["b", "=A3"], ["c", "=SUM(A1:A4)"]]);
    expect(p.merges).toEqual([{ r: 2, c: 0, rs: 2, cs: 2 }]);
    expect(p.cellStyles).toEqual({ "2,0": { bold: true } });
    expect(p.rowHeights).toEqual([0, 0, 30, 0]);
  });

  it("makes a merged cell grow when a row is inserted inside it", () => {
    const p = insertLines(t, "row", 2)!;
    expect(p.merges).toEqual([{ r: 1, c: 0, rs: 3, cs: 2 }]);
  });

  it("dresses a new row like the one before", () => {
    const p = insertLines(table([["a"], ["b"]], { cellStyles: { "0,0": { bold: true, bB: true } } }), "row", 1)!;
    expect(p.cellStyles?.["1,0"]).toEqual({ bold: true });
    expect(p.cellStyles?.["0,0"]).toEqual({ bold: true, bB: true });
  });

  it("inserts a column", () => {
    const p = insertLines(table([["a", "=A1+B1"]], { colWidths: [1, 3] }), "col", 1)!;
    expect(p.cells).toEqual([["a", "", "=A1+C1"]]);
    expect(p.colWidths).toEqual([1, 2, 3]);
  });

  it("deletes a row: the formulas, merges, looks and heights follow", () => {
    const p = deleteLines(t, "row", 0)!;
    expect(p.cells).toEqual([["b", "=A1"], ["c", "=SUM(#REF!)"].map((x, i) => (i ? "=SUM(A1:A2)" : x))]);
    expect(p.merges).toEqual([{ r: 0, c: 0, rs: 2, cs: 2 }]);
    expect(p.cellStyles).toEqual({ "0,0": { bold: true } });
    expect(p.rowHeights).toEqual([30, 0]);
  });

  it("shrinks a merged cell when one of its rows goes, and drops it when it is a single cell", () => {
    expect(deleteLines(t, "row", 1)!.merges).toEqual([{ r: 1, c: 0, rs: 1, cs: 2 }]);
    expect(deleteLines(t, "col", 1)!.merges).toEqual([{ r: 1, c: 0, rs: 2, cs: 1 }]);
    expect(deleteLines(table(blankCells(2, 2), { merges: [{ r: 0, c: 0, rs: 2, cs: 1 }] }), "row", 1)!.merges).toBeUndefined();
    const wide = table(blankCells(3, 3), { merges: [{ r: 0, c: 0, rs: 1, cs: 3 }] });
    expect(deleteLines(wide, "col", 1)!.merges).toEqual([{ r: 0, c: 0, rs: 1, cs: 2 }]);
  });

  it("keeps one row and one column at least, and stays inside the limits", () => {
    expect(deleteLines(table([["a"]]), "row", 0)).toBeNull();
    expect(deleteLines(table([["a", "b"]]), "col", 0)!.cells).toEqual([["b"]]);
    expect(insertLines(table(blankCells(40, 2)), "row", 0)).toBeNull();
    expect(insertLines(table(blankCells(2, 16)), "col", 0)).toBeNull();
  });
});

describe("cells", () => {
  it("sets, ignores what is the same, and refuses what is under a merged cell", () => {
    const t = table([["a", "b"]], { merges: [{ r: 0, c: 0, rs: 1, cs: 2 }] });
    expect(setCell(t, 0, 0, "x")?.cells).toEqual([["x", "b"]]);
    expect(setCell(t, 0, 0, "a")).toBeNull();
    expect(setCell(t, 0, 1, "x")).toBeNull();
    expect(setCell(t, 5, 5, "x")).toBeNull();
  });

  it("clears a range", () => {
    const t = table([["a", "b"], ["c", "d"]]);
    expect(clearRange(t, { r0: 0, c0: 0, r1: 1, c1: 0 })?.cells).toEqual([["", "b"], ["", "d"]]);
    expect(clearRange(table([[""]]), { r0: 0, c0: 0, r1: 0, c1: 0 })).toBeNull();
  });

  it("merges and splits", () => {
    const t = table([["a", "b"], ["c", "d"]]);
    const m = mergeCells(t, { r0: 0, c0: 0, r1: 0, c1: 1 })!;
    expect(m.patch.merges).toEqual([{ r: 0, c: 0, rs: 1, cs: 2 }]);
    expect(m.patch.cells).toEqual([["a", ""], ["c", "d"]]);
    expect(mergeCells(t, { r0: 0, c0: 0, r1: 0, c1: 0 })).toBeNull();
    const merged = { ...t, ...m.patch };
    expect(unmergeCells(merged, { r0: 0, c0: 1, r1: 0, c1: 1 })).toEqual({ merges: undefined });
    expect(unmergeCells(t, { r0: 0, c0: 0, r1: 1, c1: 1 })).toBeNull();
  });

  it("makes a merge whole when a new one touches it", () => {
    const t = table(blankCells(3, 3), { merges: [{ r: 0, c: 0, rs: 2, cs: 2 }] });
    const m = mergeCells(t, { r0: 1, c0: 1, r1: 2, c1: 2 })!;
    expect(m.range).toEqual({ r0: 0, c0: 0, r1: 2, c1: 2 });
    expect(m.patch.merges).toEqual([{ r: 0, c: 0, rs: 3, cs: 3 }]);
  });
});

describe("looks", () => {
  it("sets and takes off fields over a range", () => {
    const t = table(blankCells(2, 2));
    const p = setStyle(t, { r0: 0, c0: 0, r1: 1, c1: 0 }, { bold: true, fill: "#fff" })!;
    expect(p.cellStyles).toEqual({ "0,0": { bold: true, fill: "#fff" }, "1,0": { bold: true, fill: "#fff" } });
    const off = setStyle({ ...t, ...p }, { r0: 0, c0: 0, r1: 1, c1: 0 }, { bold: undefined, fill: undefined })!;
    expect(off.cellStyles).toBeUndefined();
    expect(setStyle({ ...t, ...p }, { r0: 0, c0: 0, r1: 0, c1: 0 }, { bold: true })).toBeNull();
  });

  it("draws and hides lines against the table's border style", () => {
    const base = table(blankCells(2, 2), { borders: "box" });
    expect(hEdgeShown(base, 2, 1, 0)).toBe(false);
    expect(hEdgeShown(base, 2, 0, 0)).toBe(true);
    expect(vEdgeShown(base, 2, 2, 1)).toBe(true);
    const all = setBorders(base, { r0: 0, c0: 0, r1: 1, c1: 1 }, "all")!;
    const t = { ...base, ...all };
    for (let i = 0; i <= 2; i++) for (let c = 0; c < 2; c++) expect(hEdgeShown(t, 2, i, c)).toBe(true);
    for (let j = 0; j <= 2; j++) for (let r = 0; r < 2; r++) expect(vEdgeShown(t, 2, j, r)).toBe(true);
    const none = { ...t, ...setBorders(t, { r0: 0, c0: 0, r1: 0, c1: 1 }, "none")! };
    expect(hEdgeShown(none, 2, 0, 0)).toBe(false);
    expect(hEdgeShown(none, 2, 1, 1)).toBe(false); // (the line under the first row)
    expect(hEdgeShown(none, 2, 2, 0)).toBe(true);
    const back = { ...none, ...setBorders(none, { r0: 0, c0: 0, r1: 1, c1: 1 }, "reset") };
    expect(back.cellStyles).toBeUndefined();
  });

  it("draws one side, the outside, or the inside", () => {
    const base = table(blankCells(3, 3), { borders: "none" });
    const outer = { ...base, ...setBorders(base, { r0: 0, c0: 0, r1: 2, c1: 2 }, "outer")! };
    expect(hEdgeShown(outer, 3, 0, 1)).toBe(true);
    expect(hEdgeShown(outer, 3, 3, 1)).toBe(true);
    expect(hEdgeShown(outer, 3, 1, 1)).toBe(false);
    expect(vEdgeShown(outer, 3, 0, 1)).toBe(true);
    expect(vEdgeShown(outer, 3, 3, 1)).toBe(true);
    const inner = { ...base, ...setBorders(base, { r0: 0, c0: 0, r1: 2, c1: 2 }, "inner")! };
    expect(hEdgeShown(inner, 3, 0, 0)).toBe(false);
    expect(hEdgeShown(inner, 3, 1, 0)).toBe(true);
    expect(vEdgeShown(inner, 3, 2, 2)).toBe(true);
    const bottom = { ...base, ...setBorders(base, { r0: 1, c0: 1, r1: 1, c1: 1 }, "bottom")! };
    expect(hEdgeShown(bottom, 3, 2, 1)).toBe(true);
    expect(hEdgeShown(bottom, 3, 2, 0)).toBe(false);
  });
});

describe("a plain table", () => {
  it("is one with none of the extras", () => {
    expect(isPlainTable(table([["a"]]))).toBe(true);
    expect(isPlainTable(table([["a"]], { merges: [], cellStyles: {}, calc: false }))).toBe(true);
    expect(isPlainTable(table([["a"]], { calc: true }))).toBe(false);
    expect(isPlainTable(table([["a"]], { banded: "#eee" }))).toBe(false);
    expect(isPlainTable(table([["a"]], { borders: "none" }))).toBe(false);
  });
});

describe("sorting", () => {
  const t = table([["Name", "Value"], ["b", "10"], ["a", "2"], ["c", ""], ["d", "30"]], { header: true, rowHeights: [0, 0, 50, 0, 0], cellStyles: { "2,0": { bold: true } } });

  it("sorts the body by a column, numbers as numbers, the empty ones last", () => {
    const p = sortRows(t, 1, "asc")!;
    expect(p.cells!.map((r) => r[0])).toEqual(["Name", "a", "b", "d", "c"]);
    expect(sortRows(t, 1, "desc")!.cells!.map((r) => r[0])).toEqual(["Name", "d", "b", "a", "c"]);
  });

  it("takes the heights and looks of a row with it", () => {
    const p = sortRows(t, 1, "asc")!;
    expect(p.rowHeights).toEqual([0, 50, 0, 0, 0]);
    expect(p.cellStyles).toEqual({ "1,0": { bold: true } });
  });

  it("sorts text in the natural order and keeps formulas pointing at their own row", () => {
    const f2 = table([["b", "=A1"], ["a", "=A2"]], { calc: true });
    const p = sortRows(f2, 0, "asc")!;
    expect(p.cells).toEqual([["a", "=A1"], ["b", "=A2"]]);
    expect(sortRows(table([["a"], ["b"]]), 0, "asc")).toBeNull(); // (already in order)
  });

  it("refuses when merged cells are in the way", () => {
    expect(sortRows({ ...t, merges: [{ r: 1, c: 0, rs: 2, cs: 1 }] }, 1, "asc")).toBeNull();
  });
});

describe("filling", () => {
  const g = (r0: number, c0: number, r1: number, c1: number) => ({ r0, c0, r1, c1 });

  it("continues a series of numbers", () => {
    const t = table([["1"], ["2"], [""], [""], [""]]);
    const p = fillRange(t, g(0, 0, 1, 0), { r: 4, c: 0 })!;
    expect(p.patch.cells!.map((r) => r[0])).toEqual(["1", "2", "3", "4", "5"]);
    expect(p.range).toEqual(g(0, 0, 4, 0));
  });

  it("copies a single number, counts on a numbered text, and repeats a pattern", () => {
    expect(fillRange(table([["7"], [""], [""]]), g(0, 0, 0, 0), { r: 2, c: 0 })!.patch.cells!.map((r) => r[0])).toEqual(["7", "7", "7"]);
    expect(fillRange(table([["Mesure 1"], [""], [""]]), g(0, 0, 0, 0), { r: 2, c: 0 })!.patch.cells!.map((r) => r[0])).toEqual(["Mesure 1", "Mesure 2", "Mesure 3"]);
    expect(fillRange(table([["a"], ["b"], [""], [""], [""]]), g(0, 0, 1, 0), { r: 4, c: 0 })!.patch.cells!.map((r) => r[0])).toEqual(["a", "b", "a", "b", "a"]);
  });

  it("fills to the right and upwards", () => {
    expect(fillRange(table([["2", "4", "", ""]]), g(0, 0, 0, 1), { r: 0, c: 3 })!.patch.cells![0]).toEqual(["2", "4", "6", "8"]);
    expect(fillRange(table([[""], [""], ["5"], ["6"]]), g(2, 0, 3, 0), { r: 0, c: 0 })!.patch.cells!.map((r) => r[0])).toEqual(["3", "4", "5", "6"]);
  });

  it("moves the formulas with their cells, and the looks too", () => {
    const t = table([["1", "=A1*2"], ["2", ""], ["3", ""]], { calc: true, cellStyles: { "0,1": { bold: true } } });
    const p = fillRange(t, g(0, 1, 0, 1), { r: 2, c: 1 })!;
    expect(p.patch.cells!.map((r) => r[1])).toEqual(["=A1*2", "=A2*2", "=A3*2"]);
    expect(p.patch.cellStyles).toMatchObject({ "1,1": { bold: true }, "2,1": { bold: true } });
  });

  it("does nothing when the handle did not leave the selection", () => {
    expect(fillRange(table([["1"], ["2"]]), g(0, 0, 1, 0), { r: 1, c: 0 })).toBeNull();
  });
});

describe("pasting", () => {
  it("puts a block at a cell and grows the table to hold it", () => {
    const t = table(blankCells(2, 2));
    const r = pasteMatrix(t, { r: 1, c: 1 }, [["a", "b"], ["c", "d"]])!;
    expect(r.patch.cells).toEqual([["", "", ""], ["", "a", "b"], ["", "c", "d"]]);
    expect(r.range).toEqual({ r0: 1, c0: 1, r1: 2, c1: 2 });
  });

  it("moves the formulas of a block copied from this table", () => {
    const t = table([["1", "=A1"], ["", ""]], { calc: true });
    const r = pasteMatrix(t, { r: 1, c: 0 }, [["=A1"]], { r: 0, c: 1 })!;
    expect(r.patch.cells![1][0]).toBe("=#REF!"); // (one column left of A is nothing)
    const r2 = pasteMatrix(t, { r: 1, c: 1 }, [["=A1"]], { r: 0, c: 1 })!;
    expect(r2.patch.cells![1][1]).toBe("=A2");
  });

  it("stops at the limits and skips the cells under a merged cell", () => {
    const big = pasteMatrix(table(blankCells(1, 1)), { r: 0, c: 0 }, blankCells(60, 30))!;
    expect(big.patch.cells!.length).toBe(40);
    expect(big.patch.cells![0].length).toBe(16);
    const m = table([["", ""]], { merges: [{ r: 0, c: 0, rs: 1, cs: 2 }] });
    expect(pasteMatrix(m, { r: 0, c: 0 }, [["a", "b"]])!.patch.cells).toEqual([["a", ""]]);
    expect(pasteMatrix(m, { r: 0, c: 0 }, [])).toBeNull();
  });

  it("gives back the text of a range", () => {
    expect(textOf(table([["a", "b"], ["c", "d"]]), { r0: 0, c0: 1, r1: 1, c1: 1 })).toEqual([["b"], ["d"]]);
  });
});

describe("the clipboard", () => {
  it("reads what a spreadsheet puts there", () => {
    expect(parseTable("a\tb\nc\td\n")).toEqual([["a", "b"], ["c", "d"]]);
    expect(parseTable("a\tb\r\nc\td\r\n")).toEqual([["a", "b"], ["c", "d"]]);
    expect(parseTable("a\tb\nc")).toEqual([["a", "b"], ["c", ""]]);
    expect(parseTable("single")).toEqual([["single"]]);
    expect(parseTable("")).toEqual([]);
    expect(parseTable('"a\tb"\t"line 1\nline 2"\t"say ""hi"""')).toEqual([["a\tb", "line 1\nline 2", 'say "hi"']]);
    expect(parseTable('5"\tx')).toEqual([['5"', "x"]]);
  });

  it("writes it back", () => {
    expect(toTabText([["a", "b"], ["c", "d"]])).toBe("a\tb\nc\td");
    expect(parseTable(toTabText([["a\tb", 'say "hi"', "x\ny"]]))).toEqual([["a\tb", 'say "hi"', "x\ny"]]);
  });
});

describe("value helpers", () => {
  it("shows the evaluated value of a plain number", () => {
    const sheet = createSheet([["12,5", "abc", ""]], true);
    expect(sheet.value(0, 0)).toBe(12.5);
    expect(sheet.value(0, 1)).toBe("abc");
    expect(sheet.value(0, 2)).toBeNull();
  });

  it("is used by calc() only as a convenience", () => {
    expect(calc("=1+1")).toBe(2);
  });
});

describe("the lines of a selection, or of each cell of it", () => {
  const WHOLE = { r0: 0, c0: 0, r1: 1, c1: 1 };
  const base = () => table(blankCells(3, 3), { borders: "none" });
  const h = (t: TableData, i: number, c: number) => hEdgeShown(t, 3, i, c);
  const v = (t: TableData, j: number, r: number) => vEdgeShown(t, 3, j, r);

  it("draws one side of the selection as a whole, or of every cell of it", () => {
    const whole = { ...base(), ...setBorders(base(), WHOLE, "top")! };
    expect([h(whole, 0, 0), h(whole, 0, 1), h(whole, 1, 0)]).toEqual([true, true, false]);
    const each = { ...base(), ...setBorders(base(), WHOLE, "top", { each: true })! };
    // the top of every cell: the line above row 0 and the line above row 1
    expect([h(each, 0, 0), h(each, 1, 0), h(each, 1, 1), h(each, 2, 0)]).toEqual([true, true, true, false]);
    const bottom = { ...base(), ...setBorders(base(), WHOLE, "bottom", { each: true })! };
    expect([h(bottom, 0, 0), h(bottom, 1, 0), h(bottom, 2, 1), h(bottom, 3, 0)]).toEqual([false, true, true, false]);
    const left = { ...base(), ...setBorders(base(), WHOLE, "left", { each: true })! };
    expect([v(left, 0, 0), v(left, 1, 0), v(left, 1, 1), v(left, 2, 0)]).toEqual([true, true, true, false]);
    const right = { ...base(), ...setBorders(base(), WHOLE, "right", { each: true })! };
    expect([v(right, 1, 0), v(right, 2, 1), v(right, 3, 0), v(right, 0, 0)]).toEqual([true, true, false, false]);
  });

  it("draws the outside of each cell: a box round every one", () => {
    const boxes = { ...base(), ...setBorders(base(), WHOLE, "outer", { each: true })! };
    for (const i of [0, 1, 2]) for (const c of [0, 1]) expect(h(boxes, i, c)).toBe(true);
    for (const j of [0, 1, 2]) for (const r of [0, 1]) expect(v(boxes, j, r)).toBe(true);
    // the outside of the selection as a whole leaves the line between its cells alone
    const outline = { ...base(), ...setBorders(base(), WHOLE, "outer")! };
    expect(h(outline, 1, 0)).toBe(false);
    expect(h(outline, 0, 0)).toBe(true);
  });

  it("says whether a side is drawn, and takes one line off", () => {
    const t = { ...base(), ...setBorders(base(), WHOLE, "top", { each: true })! };
    expect(isBorderOn(t, WHOLE, "top", true)).toBe(true);
    expect(isBorderOn(t, WHOLE, "top", false)).toBe(true);
    expect(isBorderOn(t, WHOLE, "bottom", true)).toBe(false);
    // only the top of the cell at B2 comes off
    const off = { ...t, ...setBorders(t, { r0: 1, c0: 1, r1: 1, c1: 1 }, "top", { show: false })! };
    expect([h(off, 1, 0), h(off, 1, 1), h(off, 0, 1)]).toEqual([true, false, true]);
    expect(isBorderOn(off, WHOLE, "top", true)).toBe(false);
  });

  it("works on a single cell alone", () => {
    const one = { r0: 2, c0: 2, r1: 2, c1: 2 };
    const t = { ...base(), ...setBorders(base(), one, "all")! };
    expect([h(t, 2, 2), h(t, 3, 2), v(t, 2, 2), v(t, 3, 2), h(t, 1, 2), v(t, 1, 2)]).toEqual([true, true, true, true, false, false]);
  });
});
