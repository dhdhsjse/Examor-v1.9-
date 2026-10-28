import { describe, expect, it, vi } from "vitest";
import { makeActions } from "../../_components/table/tableActions";
import { clampSel, cellSel, rangeSel } from "../../_components/table/tableSel";
import { blankCells, type TableData, type TablePatch } from "../table";

const table = (extra: Partial<TableData> = {}): TableData => ({ cells: blankCells(3, 3), header: false, ...extra });
const make = (t: TableData, range: Parameters<typeof makeActions>[1]) => {
  const apply = vi.fn<(patch: TablePatch, key: string) => void>();
  const select = vi.fn();
  return { actions: makeActions(t, range, false, apply, select), apply, select };
};
const WHOLE = { r0: 0, c0: 0, r1: 2, c1: 2 };

describe("the font", () => {
  it("is set for the whole table when no cell is selected", () => {
    const { actions, apply } = make(table({ cellStyles: { "1,1": { font: "Georgia", bold: true } } }), null);
    expect(actions.fontForTable).toBe(true);
    actions.setFont("Verdana");
    const patch = apply.mock.calls[0][0];
    expect(patch.font).toEqual({ family: "Verdana" });
    // no cell keeps a font of its own, and what else the cells have stays
    expect(patch.cellStyles).toEqual({ "1,1": { bold: true } });
  });

  it("is set for the whole table when all of it is selected", () => {
    const { actions, apply } = make(table({ font: { size: 16 }, cellStyles: { "0,0": { font: "Georgia" } } }), WHOLE);
    expect(actions.fontForTable).toBe(true);
    actions.setFont("Verdana");
    expect(apply.mock.calls[0][0]).toEqual({ font: { size: 16, family: "Verdana" }, cellStyles: undefined });
  });

  it("is set cell by cell when some cells are selected", () => {
    const { actions, apply } = make(table(), { r0: 0, c0: 1, r1: 1, c1: 1 });
    expect(actions.fontForTable).toBe(false);
    actions.setFont("Georgia");
    const patch = apply.mock.calls[0][0];
    expect(patch.font).toBeUndefined();
    expect(patch.cellStyles).toEqual({ "0,1": { font: "Georgia" }, "1,1": { font: "Georgia" } });
  });

  it("goes back to the exam's font: the table has none of its own again, or the cell takes its own off", () => {
    const whole = make(table({ font: { family: "Verdana", size: 16 } }), null);
    whole.actions.setFont(undefined);
    expect(whole.apply.mock.calls[0][0].font).toEqual({ size: 16 });
    const only = make(table({ font: { family: "Verdana" } }), null);
    only.actions.setFont(undefined);
    expect(only.apply.mock.calls[0][0].font).toBeUndefined();
    const cell = make(table({ cellStyles: { "0,0": { font: "Georgia" } } }), { r0: 0, c0: 0, r1: 0, c1: 0 });
    cell.actions.setFont(undefined);
    expect(cell.apply.mock.calls[0][0].cellStyles).toBeUndefined();
  });

  it("shows the font of the selected cell, else the table's", () => {
    const t = table({ font: { family: "Verdana" }, cellStyles: { "0,0": { font: "Georgia" } } });
    expect(make(t, { r0: 0, c0: 0, r1: 0, c1: 0 }).actions.fontName).toBe("Georgia");
    expect(make(t, { r0: 1, c0: 1, r1: 1, c1: 1 }).actions.fontName).toBe("Verdana");
    expect(make(t, null).actions.fontName).toBe("Verdana");
    expect(make(table(), null).actions.fontName).toBeUndefined();
  });
});

describe("with no cell selected", () => {
  it("what needs cells does nothing: merging, rows, columns, sorting, clearing", () => {
    const { actions, apply, select } = make(table(), null);
    expect(actions.hasSelection).toBe(false);
    actions.merge();
    actions.insertRows(true);
    actions.deleteCols();
    actions.clear();
    expect(actions.sort("asc")).toBe(false);
    expect(actions.canMerge).toBe(false);
    expect(apply).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it("the formatting goes to every cell of the table", () => {
    const every = (v: object) => Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`${Math.floor(i / 3)},${i % 3}`, v]));
    const fill = make(table(), null);
    expect(fill.actions.target).toEqual(WHOLE);
    fill.actions.style({ fill: "#fff", align: "center" });
    expect(fill.apply.mock.calls[0][0].cellStyles).toEqual(every({ fill: "#fff", align: "center" }));
    const bold = make(table(), null);
    expect(bold.actions.isOn("bold")).toBe(false);
    bold.actions.toggle("bold");
    expect(bold.apply.mock.calls[0][0].cellStyles).toEqual(every({ bold: true }));
    const fmt = make(table(), null);
    fmt.actions.setFormat({ decimals: 2 });
    expect(fmt.apply.mock.calls[0][0].cellStyles).toEqual(every({ fmt: { decimals: 2 } }));
  });

  it("the lines go round the whole table: the outside, one side, each cell", () => {
    const outline = make(table({ borders: "none" }), null);
    outline.actions.borders("outer");
    const styles = outline.apply.mock.calls[0][0].cellStyles!;
    expect(styles["0,0"]).toEqual({ bT: true, bL: true });
    expect(styles["2,2"]).toEqual({ bB: true, bR: true });
    expect(styles["1,1"]).toBeUndefined();
    const top = make(table({ borders: "none" }), null);
    top.actions.borders("top", true);
    // (the line above row 2 is the bottom of the cells of row 1: the top of every cell is drawn by rows 0 and 1)
    expect(Object.keys(top.apply.mock.calls[0][0].cellStyles!).sort()).toEqual(["0,0", "0,1", "0,2", "1,0", "1,1", "1,2"]);
    expect(top.apply.mock.calls[0][0].cellStyles!["0,0"]).toEqual({ bT: true, bB: true });
  });

  it("shows the look all the cells share, and nothing when they differ", () => {
    const same = make(table({ cellStyles: Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`${Math.floor(i / 3)},${i % 3}`, { align: "right" }])) }), null);
    expect(same.actions.common("align")).toBe("right");
    const mixed = make(table({ cellStyles: { "0,0": { align: "right" } } }), null);
    expect(mixed.actions.common("align")).toBeUndefined();
    // a header is centered, the rest has no alignment of its own: they differ
    expect(make(table({ header: true }), null).actions.common("align")).toBeUndefined();
    expect(make(table({ header: true }), { r0: 0, c0: 0, r1: 0, c1: 2 }).actions.common("align")).toBe("center");
  });

  it("they work as before once cells are selected", () => {
    const { actions, apply } = make(table(), { r0: 0, c0: 0, r1: 0, c1: 1 });
    expect(actions.hasSelection).toBe(true);
    actions.toggle("bold");
    expect(apply.mock.calls[0][0].cellStyles).toEqual({ "0,0": { bold: true }, "0,1": { bold: true } });
  });
});

describe("the selection", () => {
  it("is kept inside a table that got smaller, and stays none", () => {
    expect(clampSel(null, 3, 3)).toBeNull();
    expect(clampSel(rangeSel({ r0: 2, c0: 2, r1: 5, c1: 5 }), 3, 3)).toEqual(rangeSel({ r0: 2, c0: 2, r1: 2, c1: 2 }));
    expect(clampSel(cellSel(9, 0), 3, 3)).toEqual(cellSel(2, 0));
  });
});

describe("flipping", () => {
  it("is a thing of the whole table: it turns on and off whatever is selected", () => {
    const on = make(table(), { r0: 0, c0: 0, r1: 0, c1: 0 });
    expect(on.actions.flipped).toBe(false);
    on.actions.flip();
    expect(on.apply.mock.calls[0][0]).toEqual({ flip: true });
    const off = make(table({ flip: true }), null);
    expect(off.actions.flipped).toBe(true);
    off.actions.flip();
    expect(off.apply.mock.calls[0][0]).toEqual({ flip: undefined });
  });

  it("swaps what Left border and Right border mean when the first column is on the right", () => {
    const apply = vi.fn<(patch: TablePatch, key: string) => void>();
    const t = table({ borders: "none" });
    makeActions(t, { r0: 0, c0: 0, r1: 0, c1: 0 }, true, apply, vi.fn()).borders("left");
    // (seen from the left of a mirrored table, that is the edge after its last column)
    expect(apply.mock.calls[0][0].cellStyles).toEqual({ "0,0": { bR: true } });
  });
});

describe("the buttons of the lines", () => {
  const WHOLE = { r0: 0, c0: 0, r1: 1, c1: 1 };

  it("draw the side of every cell when each is asked, and the selection's own side otherwise", () => {
    const each = make(table({ borders: "none" }), WHOLE);
    each.actions.borders("bottom", true);
    expect(each.apply.mock.calls[0][0].cellStyles).toEqual({ "0,0": { bB: true }, "0,1": { bB: true }, "1,0": { bB: true }, "1,1": { bB: true } });
    const whole = make(table({ borders: "none" }), WHOLE);
    whole.actions.borders("bottom", false);
    expect(whole.apply.mock.calls[0][0].cellStyles).toEqual({ "1,0": { bB: true }, "1,1": { bB: true } });
  });

  it("take off a side that is already drawn", () => {
    const drawn = table({ borders: "none", cellStyles: { "0,0": { bT: true } } });
    const { actions, apply } = make(drawn, { r0: 0, c0: 0, r1: 0, c1: 0 });
    expect(actions.borderOn("top")).toBe(true);
    actions.borders("top");
    expect(apply.mock.calls[0][0].cellStyles).toEqual({ "0,0": { bT: false } });
  });

  it("mean what is seen when the first column is on the right", () => {
    const apply = vi.fn<(patch: TablePatch, key: string) => void>();
    const mirrored = makeActions(table({ borders: "none" }), { r0: 0, c0: 0, r1: 0, c1: 0 }, true, apply, vi.fn());
    mirrored.borders("right");
    // (the right edge of the first column of a mirrored table is the edge before it)
    expect(apply.mock.calls[0][0].cellStyles).toEqual({ "0,0": { bL: true } });
    expect(mirrored.borderOn("right")).toBe(false);
  });
});
