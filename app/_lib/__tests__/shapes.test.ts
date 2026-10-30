import { describe, expect, it } from "vitest";
import {
  SHAPES,
  SHAPE_CATEGORIES,
  addShape,
  boxFromDrag,
  defaultSize,
  dragHandle,
  duplicateShape,
  handlePoints,
  layoutShapeText,
  lineEnds,
  localExtent,
  localToWorld,
  moveLineEnd,
  newShapeItem,
  paintFill,
  pathPoints,
  pushRecent,
  removeShape,
  reorderShape,
  resolveStyle,
  shade,
  shapeBounds,
  shapeDef,
  shapeParts,
  shapeSvg,
  shapesIn,
  updateShape,
  worldToLocal,
  wrapLine,
  type ShapeItem,
} from "../shapes";

const SIZES: [number, number][] = [
  [120, 90],
  [10, 10],
  [400, 30],
  [30, 400],
  [1, 1],
];

describe("the catalog", () => {
  it("has unique ids, a name and a known category for every shape", () => {
    const ids = SHAPES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of SHAPES) {
      expect(s.label.length).toBeGreaterThan(1);
      expect(SHAPE_CATEGORIES).toContain(s.category);
    }
  });

  it("has every category of the gallery filled", () => {
    for (const c of SHAPE_CATEGORIES) expect(shapesIn(c).length).toBeGreaterThanOrEqual(6);
  });

  it("draws every shape, at every size, with finite numbers only", () => {
    for (const s of SHAPES) {
      for (const [w, h] of SIZES) {
        const parts = shapeParts({ shape: s.id }, w, h);
        expect(parts.length, `${s.id} ${w}×${h}`).toBeGreaterThan(0);
        for (const p of parts) {
          expect(p.d, `${s.id} ${w}×${h}`).toMatch(/^M/);
          expect(p.d).not.toMatch(/NaN|Infinity|undefined/);
          for (const [x, y] of pathPoints(p.d)) {
            expect(Number.isFinite(x) && Number.isFinite(y), `${s.id} ${w}×${h}: ${p.d}`).toBe(true);
          }
        }
      }
    }
  });

  it("draws a line even when it is flat", () => {
    for (const s of SHAPES.filter((x) => x.line)) {
      for (const [w, h] of [[150, 0], [0, 80], [150, 60]]) {
        const parts = shapeParts({ shape: s.id }, w, h);
        expect(parts[0].paint, s.id).toBe("line");
        expect(parts[0].d).not.toMatch(/NaN/);
      }
    }
  });

  it("falls back to a rectangle for a shape it does not know", () => {
    expect(shapeDef("from-the-future").id).toBe("rect");
    expect(shapeParts({ shape: "from-the-future" }, 50, 40)[0].d).toBe(shapeParts({ shape: "rect" }, 50, 40)[0].d);
  });

  it("keeps every shape inside its box, except the pointers and the lines that go out on purpose", () => {
    const reaching = new Set(["callout"]);
    for (const s of SHAPES) {
      if (s.line || [...reaching].some((r) => s.id.startsWith(r))) continue;
      const e = localExtent({ shape: s.id }, 200, 120);
      expect(e.minX, s.id).toBeGreaterThanOrEqual(-0.5);
      expect(e.minY, s.id).toBeGreaterThanOrEqual(-0.5);
      expect(e.maxX, s.id).toBeLessThanOrEqual(200.5);
      expect(e.maxY, s.id).toBeLessThanOrEqual(120.5);
    }
  });
});

describe("the yellow handles", () => {
  it("are where the values say, and dragging a handle where it is changes nothing", () => {
    for (const s of SHAPES.filter((x) => x.adjust)) {
      const adjust = s.adjust!;
      for (const [w, h] of [[200, 120], [90, 150]]) {
        const handles = handlePoints({ shape: s.id }, w, h);
        expect(handles.length, s.id).toBeGreaterThan(0);
        handles.forEach(([x, y], i) => {
          expect(Number.isFinite(x) && Number.isFinite(y), s.id).toBe(true);
          const back = dragHandle({ shape: s.id }, i, x, y, w, h);
          back.forEach((v, k) => expect(v, `${s.id} handle ${i} value ${k}`).toBeCloseTo(adjust.defaults[k] ?? v, 0));
        });
      }
    }
  });

  it("keep a shape drawable wherever they are dragged", () => {
    for (const s of SHAPES.filter((x) => x.adjust)) {
      for (const [x, y] of [[-50, -50], [0, 0], [100, 60], [500, 500], [-20, 300]]) {
        const adj = dragHandle({ shape: s.id }, 0, x, y, 200, 120);
        const parts = shapeParts({ shape: s.id, adj }, 200, 120);
        for (const p of parts) expect(p.d, `${s.id} dragged to ${x},${y}`).not.toMatch(/NaN|Infinity/);
      }
    }
  });

  it("move a rounded rectangle's corners", () => {
    const [[x, y]] = handlePoints({ shape: "roundRect", adj: [0.3] }, 200, 100);
    expect(x).toBeCloseTo(30);
    expect(y).toBe(0);
    expect(dragHandle({ shape: "roundRect" }, 0, 20, 0, 200, 100)[0]).toBeCloseTo(0.2);
    expect(dragHandle({ shape: "roundRect" }, 0, 999, 0, 200, 100)[0]).toBe(0.5); // (no more than a half)
  });

  it("move the tip of a speech bubble anywhere", () => {
    const adj = dragHandle({ shape: "calloutRect" }, 0, 300, 250, 200, 100);
    const [[x, y]] = handlePoints({ shape: "calloutRect", adj }, 200, 100);
    expect(x).toBeCloseTo(300);
    expect(y).toBeCloseTo(250);
    const box = localExtent({ shape: "calloutRect", adj }, 200, 100);
    expect(box.maxX).toBeGreaterThanOrEqual(300);
    expect(box.maxY).toBeGreaterThanOrEqual(250);
  });
});

describe("colors and outline", () => {
  it("draws nothing inside and a dark outline by default", () => {
    expect(resolveStyle({ shape: "rect" })).toEqual({ fill: null, stroke: "#111827", strokeWidth: 2 });
    expect(resolveStyle({ shape: "rect", fill: "#ff0000", stroke: null }).stroke).toBeNull();
  });

  it("always outlines a line, and never fills it", () => {
    expect(resolveStyle({ shape: "arrow", fill: "#ff0000", stroke: null })).toMatchObject({ fill: null, stroke: "#111827" });
  });

  it("fills the arrow head with the outline's color and the faces of a cube with shades of the fill", () => {
    const s = { shape: "cube", fill: "#3366cc", stroke: "#000000" };
    expect(paintFill("solid", s)).toBe("#000000");
    expect(paintFill("fill", s)).toBe("#3366cc");
    expect(paintFill("light", s)).not.toBe("#3366cc");
    expect(paintFill("line", s)).toBeNull();
    expect(paintFill("dark", { shape: "cube" })).toBeNull();
  });

  it("mixes with white and black", () => {
    expect(shade("#000000", 0.5)).toBe("#808080");
    expect(shade("#ffffff", -0.5)).toBe("#808080");
    expect(shade("red", 0.5)).toBe("red");
    expect(shade("#fff", 0)).toBe("#ffffff");
  });
});

describe("drawing a shape with the mouse", () => {
  it("fills the box between the two corners, whichever way the mouse went", () => {
    expect(boxFromDrag("rect", [10, 10], [110, 60])).toMatchObject({ x: 10, y: 10, w: 100, h: 50, flipX: false });
    expect(boxFromDrag("rect", [110, 60], [10, 10])).toMatchObject({ x: 10, y: 10, w: 100, h: 50, flipX: false, flipY: false });
  });

  it("draws a line from the first point to the second", () => {
    expect(boxFromDrag("line", [100, 100], [20, 40])).toMatchObject({ x: 20, y: 40, w: 80, h: 60, flipX: true, flipY: true });
    const item = newShapeItem("arrow", boxFromDrag("arrow", [100, 100], [20, 140]));
    expect(lineEnds(item)).toEqual({ start: [100, 100], end: [20, 140] });
  });

  it("makes a square with Shift, and a circle from its centre with Alt", () => {
    expect(boxFromDrag("ellipse", [0, 0], [100, 40], { square: true })).toMatchObject({ w: 100, h: 100 });
    expect(boxFromDrag("ellipse", [100, 100], [130, 120], { fromCenter: true })).toMatchObject({ x: 70, y: 80, w: 60, h: 40 });
  });

  it("snaps a line to 45° steps with Shift", () => {
    const b = boxFromDrag("line", [0, 0], [100, 12], { square: true });
    expect(b.h).toBeLessThan(1);
    expect(b.w).toBeGreaterThan(90);
  });

  it("gives a plain click the usual size, centred on the click", () => {
    const [w, h] = defaultSize("rect");
    expect(boxFromDrag("rect", [200, 200], [201, 200])).toMatchObject({ x: 200 - w / 2, y: 200 - h / 2, w, h });
    expect(defaultSize("line")[1]).toBe(0);
  });

  it("never makes a box smaller than a few pixels, except a flat line", () => {
    expect(newShapeItem("rect", { x: 0, y: 0, w: 0, h: 1 }).w).toBeGreaterThanOrEqual(6);
    expect(newShapeItem("line", { x: 0, y: 0, w: 100, h: 0 }).h).toBe(0);
  });
});

describe("lists of shapes", () => {
  const a = newShapeItem("rect", { x: 0, y: 0, w: 50, h: 50 });
  const b = newShapeItem("ellipse", { x: 10, y: 10, w: 50, h: 50 });
  const c = newShapeItem("star5", { x: 20, y: 20, w: 50, h: 50 });
  const list = [a, b, c];

  it("adds on top, removes, and ignores what is not there", () => {
    expect(addShape(list, a).length).toBe(4);
    expect(addShape(undefined, a)).toEqual([a]);
    expect(removeShape(list, b.id).map((s) => s.id)).toEqual([a.id, c.id]);
    expect(removeShape(list, "nope")).toHaveLength(3);
  });

  it("returns the same list when an update changes nothing", () => {
    expect(updateShape(list, a.id, { x: 0 })).toBe(list);
    expect(updateShape(list, "nope", { x: 5 })).toBe(list);
    const moved = updateShape(list, a.id, { x: 7 });
    expect(moved).not.toBe(list);
    expect(moved[0].x).toBe(7);
    expect(list[0].x).toBe(0);
  });

  it("never turns a line", () => {
    const line = newShapeItem("line", { x: 0, y: 0, w: 50, h: 20 });
    expect(updateShape([line], line.id, { rotation: 45 })[0].rotation).toBeUndefined();
  });

  it("changes the stacking order", () => {
    expect(reorderShape(list, a.id, "front").map((s) => s.id)).toEqual([b.id, c.id, a.id]);
    expect(reorderShape(list, c.id, "back").map((s) => s.id)).toEqual([c.id, a.id, b.id]);
    expect(reorderShape(list, a.id, "forward").map((s) => s.id)).toEqual([b.id, a.id, c.id]);
    expect(reorderShape(list, a.id, "backward").map((s) => s.id)).toEqual([a.id, b.id, c.id]);
    expect(reorderShape(list, "nope", "front")).toHaveLength(3);
  });

  it("copies a shape beside the original, on top, with its own id and handles", () => {
    const tuned = { ...a, adj: [0.3] };
    const { list: next, copy } = duplicateShape([tuned, b], a.id);
    expect(next).toHaveLength(3);
    expect(copy!.id).not.toBe(a.id);
    expect(copy).toMatchObject({ x: 14, y: 14, shape: "rect" });
    copy!.adj![0] = 0.9;
    expect(tuned.adj[0]).toBe(0.3);
    expect(duplicateShape(list, "nope").copy).toBeNull();
  });

  it("moves the end of a line and keeps the other where it was", () => {
    const line = newShapeItem("line", { x: 10, y: 10, w: 100, h: 50 });
    const moved = moveLineEnd(line, "end", [10, 200]);
    expect(lineEnds(moved)).toEqual({ start: [10, 10], end: [10, 200] });
    expect(moved.w).toBe(0);
    const back = moveLineEnd(moved, "start", [150, 10]);
    expect(lineEnds(back)).toEqual({ start: [150, 10], end: [10, 200] });
    expect(back.flipX).toBe(true);
    expect(back.flipY).toBeUndefined();
  });
});

describe("recently used shapes", () => {
  it("puts the newest first, once, and keeps a few", () => {
    expect(pushRecent(["a", "b", "c"], "c")).toEqual(["c", "a", "b"]);
    expect(pushRecent([], "x")).toEqual(["x"]);
    expect(pushRecent(["a", "b", "c"], "d", 3)).toEqual(["d", "a", "b"]);
  });
});

describe("turning and flipping", () => {
  const item: ShapeItem = { id: "s", shape: "rect", x: 100, y: 50, w: 80, h: 40, rotation: 90 };

  it("turns round the centre", () => {
    // the top-left corner of the box (40 left and 20 above the centre) goes to the top-right after a quarter turn clockwise
    const [x, y] = localToWorld(item, 0, 0);
    expect(x).toBeCloseTo(140 + 20);
    expect(y).toBeCloseTo(70 - 40);
  });

  it("goes there and back", () => {
    for (const it of [item, { ...item, flipX: true, rotation: 33 }, { ...item, flipY: true, flipX: true, rotation: -70 }]) {
      const p = localToWorld(it, 13, 7);
      const q = worldToLocal(it, p[0], p[1]);
      expect(q[0]).toBeCloseTo(13);
      expect(q[1]).toBeCloseTo(7);
    }
  });

  it("measures the box of a turned shape, and of a pointer that goes out of it", () => {
    const b = shapeBounds({ ...item, strokeWidth: 0.25 });
    expect(b.maxX - b.minX).toBeLessThan(45); // 40 high, turned: about 40 wide
    expect(b.maxY - b.minY).toBeGreaterThan(79);
    const call = newShapeItem("calloutRect", { x: 0, y: 0, w: 100, h: 50 }, { adj: [0.1, 1.5] });
    expect(shapeBounds(call).maxY).toBeGreaterThan(100);
  });
});

describe("the text in a shape", () => {
  const narrow = (text: string) => text.length * 10; // every letter 10 px wide

  it("breaks lines at the spaces", () => {
    expect(wrapLine("one two three", 80, narrow)).toEqual(["one two", "three"]);
    expect(wrapLine("", 80, narrow)).toEqual([""]);
  });

  it("cuts a word that is wider than the line", () => {
    expect(wrapLine("abcdefghij", 40, narrow)).toEqual(["abcd", "efgh", "ij"]);
  });

  it("keeps the lines inside the room the shape leaves, centred by default", () => {
    const style = { shape: "rect", text: "hello world again", fontSize: 10 };
    const layout = layoutShapeText(style, 100, 60, (t) => t.length * 10)!;
    expect(layout.lines.map((l) => l.text)).toEqual(["hello", "world", "again"]);
    for (const l of layout.lines) {
      expect(l.x).toBeGreaterThanOrEqual(4);
      expect(l.x + l.width).toBeLessThanOrEqual(96);
    }
    const mid = layout.lines[0].y + (layout.lines.length * layout.lineHeight) / 2;
    expect(mid).toBeCloseTo(30);
  });

  it("aligns left, right, top and bottom", () => {
    const base = { shape: "rect", text: "ab", fontSize: 10 };
    const m = (t: string) => t.length * 10;
    expect(layoutShapeText({ ...base, textAlign: "left" }, 100, 60, m)!.lines[0].x).toBe(4);
    expect(layoutShapeText({ ...base, textAlign: "right" }, 100, 60, m)!.lines[0].x).toBe(76);
    expect(layoutShapeText({ ...base, textVAlign: "top" }, 100, 60, m)!.lines[0].y).toBe(4);
    expect(layoutShapeText({ ...base, textVAlign: "bottom" }, 100, 60, m)!.lines[0].y).toBeCloseTo(60 - 4 - 12);
  });

  it("starts a new line at a line break, and has nothing for an empty text", () => {
    expect(layoutShapeText({ shape: "rect", text: "a\nb" }, 100, 60, () => 5)!.lines).toHaveLength(2);
    expect(layoutShapeText({ shape: "rect", text: "  " }, 100, 60)).toBeNull();
    expect(layoutShapeText({ shape: "rect" }, 100, 60)).toBeNull();
  });

  it("uses the middle of an oval, not its corners", () => {
    const rect = layoutShapeText({ shape: "rect", text: "x y z w v u t s r q p o n m" }, 100, 100, (t) => t.length * 8)!;
    const oval = layoutShapeText({ shape: "ellipse", text: "x y z w v u t s r q p o n m" }, 100, 100, (t) => t.length * 8)!;
    expect(oval.lines.length).toBeGreaterThanOrEqual(rect.lines.length);
  });
});

describe("the picture of a shape", () => {
  it("is an svg group in the studio's coordinates, with the id of the shape", () => {
    const item: ShapeItem = { id: "abc", shape: "rect", x: 10, y: 20, w: 100, h: 50, fill: "#ffeeaa", stroke: "#112233", strokeWidth: 3 };
    const svg = shapeSvg(item);
    expect(svg).toContain('data-shape="abc"');
    expect(svg).toContain("translate(60 45)");
    expect(svg).toContain('fill="#ffeeaa"');
    expect(svg).toContain('stroke="#112233"');
    expect(svg).toContain('stroke-width="3"');
    expect(svg).not.toContain("rotate");
    expect(svg).not.toContain("<text");
  });

  it("turns, flips and dashes", () => {
    const svg = shapeSvg({ id: "t", shape: "arrow", x: 0, y: 0, w: 100, h: 40, flipX: true, dash: "dashed" });
    expect(svg).toContain("scale(-1 1)");
    expect(svg).toContain("stroke-dasharray");
    expect(shapeSvg({ id: "r", shape: "rect", x: 0, y: 0, w: 10, h: 10, rotation: 30 })).toContain("rotate(30)");
  });

  it("does not dash the head of an arrow", () => {
    const svg = shapeSvg({ id: "t", shape: "arrow", x: 0, y: 0, w: 100, h: 0, dash: "dotted" });
    const paths = svg.match(/<path [^>]*>/g)!;
    expect(paths[0]).toContain("stroke-dasharray");
    expect(paths[1]).not.toContain("stroke-dasharray");
    expect(paths[1]).toContain('fill="#111827"');
  });

  it("writes the text, escaped, outside the flipped group", () => {
    const svg = shapeSvg({ id: "t", shape: "rect", x: 0, y: 0, w: 200, h: 80, text: "a < b & c", flipX: true });
    expect(svg).toContain("a &lt; b &amp; c");
    expect(svg.indexOf("<text")).toBeGreaterThan(svg.indexOf("</g>"));
  });

  it("draws no outline for a shape without one", () => {
    const svg = shapeSvg({ id: "t", shape: "rect", x: 0, y: 0, w: 10, h: 10, fill: "#ff0000", stroke: null });
    expect(svg).toContain('fill="#ff0000"');
    expect(svg).not.toContain("stroke=");
  });
});

describe("the interface strings", () => {
  it("has a French and an Arabic name for every shape and category", async () => {
    const { FR, AR } = await import("../uiStrings");
    for (const key of [...SHAPE_CATEGORIES, ...SHAPES.map((s) => s.label)]) {
      expect(FR[key], `FR ${key}`).toBeTruthy();
      expect(AR[key], `AR ${key}`).toBeTruthy();
    }
  });

  it("keeps the other meanings of the words it shares with the rest of the app", async () => {
    const { SHAPES_FR } = await import("../shapes/strings");
    // "Outline" (a text effect), "Bold" and "Cross" already mean something else in the app: the shapes use keys of their own
    for (const key of ["Outline", "Bold", "Cross", "Line", "Arrow", "Rectangle", "Cube", "Cylinder"]) expect(SHAPES_FR[key], key).toBeUndefined();
  });
});

describe("the font of the text in a shape", () => {
  it("is Arial unless the shape has one", () => {
    const seen: string[] = [];
    const layout = layoutShapeText({ shape: "rect", text: "hello" }, 100, 60, (t, _s, _b, _i, family) => {
      seen.push(family);
      return t.length * 8;
    })!;
    expect(layout.family).toBe("Arial, Helvetica, sans-serif");
    expect(new Set(seen)).toEqual(new Set(["Arial, Helvetica, sans-serif"]));
  });

  it("measures the lines in that font and draws them in it", () => {
    const seen = new Set<string>();
    const layout = layoutShapeText({ shape: "rect", text: "hello", fontFamily: "Georgia" }, 100, 60, (t, _s, _b, _i, family) => {
      seen.add(family);
      return t.length * 8;
    })!;
    expect(layout.family).toMatch(/^Georgia,/);
    expect([...seen]).toEqual([layout.family]);
  });

  it("goes into the picture, on the text only", () => {
    const svg = shapeSvg({ id: "f", shape: "rect", x: 0, y: 0, w: 200, h: 80, text: "hi", fontFamily: "Georgia" });
    expect(svg).toMatch(/<text [^>]*font-family="Georgia,/);
    expect(shapeSvg({ id: "g", shape: "rect", x: 0, y: 0, w: 200, h: 80, text: "hi" })).toMatch(/<text [^>]*font-family="Arial, Helvetica, sans-serif"/);
  });
});
