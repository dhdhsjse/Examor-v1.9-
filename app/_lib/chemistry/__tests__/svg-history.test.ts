import { describe, expect, it } from "vitest";
import { svgSize } from "../../library";
import { BOND_LENGTH } from "../bondGeometry";
import { drawingBounds } from "../geometry";
import { addAnnotationTo, addAtom, makeAnnotation, makeAtom, moveAtom } from "../graphOps";
import { HISTORY_LIMIT, beginGesture, canRedo, canUndo, edit, endGesture, isDirty, redo, startHistory, undo } from "../history";
import { SAMPLE_MOLECULES } from "../samples";
import { renderDrawingSvg } from "../svg";
import type { MoleculeGraph } from "../types";

const EMPTY: MoleculeGraph = { atoms: [], bonds: [], annotations: [] };
const acetic = () => SAMPLE_MOLECULES.find((s) => s.id === "acetic-acid")!.graph;
const atom = (id: string, element: string, x: number, y: number, extra = {}) => ({ ...makeAtom(element, x, y), id, ...extra });

describe("the picture of a drawing", () => {
  it("is nothing for an empty drawing", () => {
    expect(renderDrawingSvg(EMPTY)).toBeNull();
  });

  it("has a size the page code can read, and a viewBox of the same size", () => {
    const r = renderDrawingSvg(acetic())!;
    expect(r.width).toBeGreaterThan(100);
    expect(r.height).toBeGreaterThan(80);
    expect(svgSize(r.svg)).toEqual({ w: r.width, h: r.height });
    expect(r.svg).toContain(`viewBox="0 0 ${r.width} ${r.height}"`);
    expect(r.svg.startsWith("<svg ")).toBe(true);
    expect(r.svg.endsWith("</svg>")).toBe(true);
  });

  it("draws every atom symbol and every bond line (a double bond is two lines)", () => {
    const g = acetic();
    const { svg } = renderDrawingSvg(g)!;
    expect((svg.match(/<text /g) ?? []).length).toBe(g.atoms.length);
    expect((svg.match(/<line /g) ?? []).length).toBe(8); // 7 bonds, one of them double
    expect(svg).toContain(">O</text>");
  });

  it("is black and white unless colour is asked for", () => {
    const g = acetic();
    const bw = renderDrawingSvg(g)!.svg;
    expect([...bw.matchAll(/(?:fill|stroke)="(#[0-9A-Fa-f]{6})"/g)].every((m) => m[1] === "#000000")).toBe(true);
    const colour = renderDrawingSvg(g, { colour: true })!.svg;
    expect(colour).toContain("#FF0D0D"); // oxygen
  });

  it("keeps everything inside the picture, with a margin", () => {
    const { svg, width, height } = renderDrawingSvg(acetic())!;
    const [, tx, ty] = /translate\(([-\d.]+) ([-\d.]+)\)/.exec(svg)!.map(Number);
    for (const m of svg.matchAll(/<text x="([-\d.]+)" y="([-\d.]+)"/g)) {
      expect(+m[1] + tx).toBeGreaterThan(10);
      expect(+m[1] + tx).toBeLessThan(width - 10);
      expect(+m[2] + ty).toBeGreaterThan(10);
      expect(+m[2] + ty).toBeLessThan(height - 10);
    }
  });

  it("is as big as the drawing plus a margin", () => {
    const one = renderDrawingSvg({ ...EMPTY, atoms: [atom("a", "C", 500, 500)] })!;
    expect(one.width).toBe(one.height);
    expect(one.width).toBeLessThan(60); // not a picture of the whole page: the drawing is moved to the corner
    const two = renderDrawingSvg({ ...EMPTY, atoms: [atom("a", "C", 0, 0), atom("b", "C", 200, 0)] })!;
    expect(two.width - one.width).toBe(200);
  });

  it("writes a charge with a real minus sign", () => {
    const { svg } = renderDrawingSvg({ ...EMPTY, atoms: [atom("a", "O", 0, 0, { charge: -1 }), atom("b", "N", 80, 0, { charge: 2 })] })!;
    expect(svg).toContain(">−</text>");
    expect(svg).toContain(">2+</text>");
  });

  it("draws a wedge as a filled triangle and a hashed bond as strokes", () => {
    const g: MoleculeGraph = { ...EMPTY, atoms: [atom("a", "C", 0, 0), atom("b", "C", BOND_LENGTH, 0)], bonds: [{ id: "x", sourceId: "a", targetId: "b", type: "wedge", hidden: false }] };
    expect(renderDrawingSvg(g)!.svg).toMatch(/<polygon points="[-\d.]+,[-\d.]+ [-\d.]+,[-\d.]+ [-\d.]+,[-\d.]+" fill="#000000"\/>/);
    const dash = renderDrawingSvg({ ...g, bonds: [{ ...g.bonds[0], type: "dash" }] })!.svg;
    expect((dash.match(/<line /g) ?? []).length).toBeGreaterThan(3);
  });

  it("skips a bond to an atom that is not there", () => {
    const g: MoleculeGraph = { ...EMPTY, atoms: [atom("a", "C", 0, 0)], bonds: [{ id: "x", sourceId: "a", targetId: "gone", type: "single", hidden: false }] };
    expect((renderDrawingSvg(g)!.svg.match(/<line /g) ?? []).length).toBe(0);
  });

  it("writes texts with real subscripts and charges (the pieces are tspans)", () => {
    const g = addAnnotationTo(EMPTY, { ...makeAnnotation("text", 0, 0), text: "H2SO4" });
    const { svg } = renderDrawingSvg(g)!;
    expect(svg).toMatch(/<tspan font-size="18">H<\/tspan><tspan font-size="12.6" dy="3.6">2<\/tspan><tspan font-size="18" dy="-3.6">SO<\/tspan>/);
    const ion = renderDrawingSvg(addAnnotationTo(EMPTY, { ...makeAnnotation("text", 0, 0), text: "Fe2+" }))!.svg;
    expect(ion).toContain('dy="-7.2"'); // raised
  });

  it("escapes what is typed", () => {
    const { svg } = renderDrawingSvg(addAnnotationTo(EMPTY, { ...makeAnnotation("text", 0, 0), text: "a<b & \"c\"" }))!;
    expect(svg).toContain("a&lt;b &amp; &quot;c&quot;");
    expect(svg).not.toContain("a<b");
  });

  it("draws an arrow with its head, and its conditions centred above it", () => {
    const g = addAnnotationTo(EMPTY, { ...makeAnnotation("arrow", 0, 100), width: 120, text: "Ac2O" });
    const { svg } = renderDrawingSvg(g)!;
    expect(svg).toMatch(/<line x1="0" y1="100" x2="109" y2="100"[^>]*stroke-width="2"/);
    expect(svg).toMatch(/<polygon points="120,100 108,95 108,105"/);
    expect(svg).toMatch(/<text x="60" [^>]*text-anchor="middle"/);
  });

  it("draws an arrow without conditions, and ignores an empty text", () => {
    const arrow = renderDrawingSvg(addAnnotationTo(EMPTY, makeAnnotation("arrow", 0, 0)))!.svg;
    expect(arrow).not.toContain("<text");
    const empty = renderDrawingSvg(addAnnotationTo({ ...EMPTY, atoms: [atom("a", "C", 0, 0)] }, makeAnnotation("text", 40, 0)))!.svg;
    expect((empty.match(/<text /g) ?? []).length).toBe(1);
  });

  it("makes room for conditions longer than their arrow", () => {
    const short = { ...makeAnnotation("arrow", 100, 0), width: 40, text: "" };
    const long = { ...short, text: "H2SO4, heat, 150 °C" };
    const a = drawingBounds(addAnnotationTo(EMPTY, short))!;
    const b = drawingBounds(addAnnotationTo(EMPTY, long))!;
    expect(b.minX).toBeLessThan(a.minX);
    expect(b.maxX).toBeGreaterThan(a.maxX);
  });

  it("does not change the drawing it is given", () => {
    const g = acetic();
    const copy = structuredClone(g);
    renderDrawingSvg(g);
    expect(g).toEqual(copy);
  });
});

describe("undo and redo", () => {
  const a = EMPTY;
  const b = addAtom(a, atom("x", "C", 0, 0));
  const c = addAtom(b, atom("y", "O", 50, 0));
  const d = addAtom(c, atom("z", "N", 100, 0));

  it("starts with nothing to undo", () => {
    const h = startHistory(a);
    expect([canUndo(h), canRedo(h), isDirty(h)]).toEqual([false, false, false]);
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it("goes back and forth one edit at a time", () => {
    let h = edit(edit(edit(startHistory(a), b), c), d);
    expect(h.graph).toBe(d);
    expect(isDirty(h)).toBe(true);
    h = undo(h);
    expect(h.graph).toBe(c);
    h = undo(undo(h));
    expect(h.graph).toBe(a);
    expect(isDirty(h)).toBe(false);
    expect(canRedo(h)).toBe(true);
    h = redo(redo(h));
    expect(h.graph).toBe(c);
    expect(redo(redo(h)).graph).toBe(d);
  });

  it("forgets what could have been redone as soon as something new is drawn", () => {
    let h = undo(edit(edit(startHistory(a), b), c));
    expect(canRedo(h)).toBe(true);
    h = edit(h, d);
    expect(canRedo(h)).toBe(false);
    expect(undo(h).graph).toBe(b);
  });

  it("does not count an edit that changed nothing", () => {
    const h = startHistory(b);
    expect(edit(h, b)).toBe(h);
  });

  it("remembers the last 100 steps only", () => {
    let h = startHistory(a);
    for (let i = 0; i < HISTORY_LIMIT + 30; i++) h = edit(h, { ...a, atoms: [atom("n", "C", i, 0)] });
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    let back = h;
    while (canUndo(back)) back = undo(back);
    // edit i made x = i; the graph before edit i is x = i - 1; the 30 oldest steps (edits 0..29) are forgotten,
    // so the furthest back is the drawing from before edit 30: x = 29 (and not the empty drawing)
    expect(back.graph.atoms[0].x).toBe(29);
  });

  it("is one step for a whole drag, however many edits it made", () => {
    let h = edit(startHistory(a), b);
    h = beginGesture(h);
    for (let i = 1; i <= 20; i++) h = edit(h, moveAtom(h.graph, "x", i, 0));
    h = endGesture(h);
    expect(h.graph.atoms[0].x).toBe(20);
    expect(h.past).toHaveLength(2); // the atom placed, and the drag
    h = undo(h);
    expect(h.graph.atoms[0].x).toBe(0); // back to before the drag, not one pixel back
    expect(redo(h).graph.atoms[0].x).toBe(20);
  });

  it("starting a gesture twice, or ending one that never began, does nothing", () => {
    const h = beginGesture(startHistory(b));
    expect(beginGesture(h)).toBe(h);
    expect(endGesture(startHistory(b))).toEqual(startHistory(b));
  });

  it("leaves no step for a gesture that ends where it began (a text placed and given up)", () => {
    let h = beginGesture(startHistory(b));
    const note = makeAnnotation("text", 0, 0);
    h = edit(h, addAnnotationTo(h.graph, note));
    h = edit(h, { ...h.graph, annotations: [] });
    h = endGesture(h);
    expect(h.past).toHaveLength(0);
    expect(isDirty(h)).toBe(false);
    expect(h.gesture).toBe(false);
  });

  it("a gesture that changes nothing keeps what could be redone; one that changes something forgets it", () => {
    let h = undo(edit(startHistory(a), b)); // b undone: redo is possible
    expect(canRedo(h)).toBe(true);
    const given = endGesture(beginGesture(h));
    expect(canRedo(given)).toBe(true);
    expect(given.past).toEqual(h.past);
    let moved = beginGesture(h);
    expect(canRedo(moved)).toBe(true); // not yet: nothing has changed
    moved = edit(moved, c);
    expect(canRedo(moved)).toBe(false);
    expect(canRedo(endGesture(moved))).toBe(false);
    h = given;
    expect(redo(h).graph).toBe(b);
  });

  it("a text placed and then given up leaves the redo steps as they were, though it added and removed something", () => {
    const h = undo(edit(startHistory(a), b));
    let g = beginGesture(h);
    const note = makeAnnotation("text", 0, 0);
    g = edit(g, addAnnotationTo(g.graph, note));
    expect(canRedo(g)).toBe(false); // while it is open, the new text is the latest thing
    g = edit(g, { ...g.graph, annotations: [] });
    g = endGesture(g);
    expect(g.past).toEqual(h.past);
    expect(canRedo(g)).toBe(true);
    expect(redo(g).graph).toBe(b);
  });

  it("a text placed and typed is one step", () => {
    let h = beginGesture(startHistory(b));
    const note = makeAnnotation("text", 0, 0);
    h = edit(h, addAnnotationTo(h.graph, note));
    h = edit(h, { ...h.graph, annotations: [{ ...note, text: "H2O" }] });
    h = endGesture(h);
    expect(h.past).toHaveLength(1);
    expect(undo(h).graph).toBe(b);
  });

  it("undo closes a gesture left open", () => {
    const h = undo(edit(beginGesture(edit(startHistory(a), b)), c));
    expect(h.gesture).toBe(false);
  });
});
