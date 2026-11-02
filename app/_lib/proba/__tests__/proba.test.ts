import { describe, expect, it } from "vitest";
import { badSums, fillMissing, formatRational, numberStyle, parseProb, pathProbability, treeTexts } from "../numbers";
import { addItem, contentBounds, duplicateItem, newItem, newTree, PLACE_KINDS, removeItem } from "../ops";
import { drawItem, drawTree, regionSpots, vennCircles, vennRegions } from "../scene";
import { renderProbaSvg } from "../svg";
import { addChild, addSibling, buildTree, findNode, moveNode, parentOf, parseStage, paths, removeNode, stagesOf, suggestEvent, updateNode } from "../tree";
import { DEFAULT_PROBA_CONFIG, type ProbTree } from "../types";

describe("reading the probabilities", () => {
  it("reads decimals with a point or a comma, fractions and percents exactly", () => {
    expect(parseProb("0.3")).toEqual({ n: 3, d: 10 });
    expect(parseProb("0,35")).toEqual({ n: 7, d: 20 });
    expect(parseProb(" 1 / 4 ")).toEqual({ n: 1, d: 4 });
    expect(parseProb("2/6")).toEqual({ n: 1, d: 3 });
    expect(parseProb("25 %")).toEqual({ n: 1, d: 4 });
    expect(parseProb(".5")).toEqual({ n: 1, d: 2 });
    expect(parseProb("1")).toEqual({ n: 1, d: 1 });
  });

  it("gives nothing for what is not a number", () => {
    for (const s of ["", "p", "1-p", "1/0", "x/2", "0.3.4", "……"]) expect(parseProb(s)).toBeNull();
  });

  it("writes results the way the tree writes its numbers", () => {
    expect(numberStyle(["1/4", "3/4"])).toEqual({ fraction: true, comma: false });
    expect(numberStyle(["0,3", "0,7"])).toEqual({ fraction: false, comma: true });
    expect(formatRational({ n: 3, d: 20 }, { fraction: true, comma: false })).toBe("3/20");
    expect(formatRational({ n: 3, d: 20 }, { fraction: false, comma: true })).toBe("0,15");
    expect(formatRational({ n: 1, d: 3 }, { fraction: false, comma: false })).toBe("0.3333");
    expect(formatRational({ n: 2, d: 1 }, { fraction: true, comma: false })).toBe("2");
  });

  it("multiplies along a path, exactly", () => {
    expect(pathProbability(["0.3", "0.6"])).toEqual({ n: 9, d: 50 });
    expect(pathProbability(["1/3", "1/2"])).toEqual({ n: 1, d: 6 });
    expect(pathProbability(["0.1", "0.2", "0.3"])).toEqual({ n: 3, d: 500 }); // (no 0.006000000000000001)
    expect(pathProbability(["0.3", "p"])).toBeNull();
  });
});

describe("the edits of a tree", () => {
  const twoByTwo = () => buildTree([parseStage("A, !A"), parseStage("B; !B")]);

  it("builds every branch of every stage, with the complements barred", () => {
    const root = twoByTwo();
    expect(root.children.map((c) => [c.label, !!c.bar])).toEqual([["A", false], ["A", true]]);
    expect(root.children[1].children.map((c) => [c.label, !!c.bar])).toEqual([["B", false], ["B", true]]);
    expect(paths(root)).toHaveLength(4);
    expect(stagesOf(root)).toEqual(["A, !A", "B, !B"]);
  });

  it("suggests the event a new branch most likely needs", () => {
    const root = buildTree([parseStage("A, !A"), parseStage("B, !B")]);
    const a = root.children[0];
    // a new branch under Ā when A has B, B̄: copies A's at that place… there are none left: the next letter
    expect(suggestEvent(root, a.id)).toEqual({ label: "C", bar: false });
    const bare = buildTree([parseStage("A")]);
    expect(suggestEvent(bare, bare.id)).toEqual({ label: "A", bar: true });
    const { root: grown } = addChild(bare, bare.children[0].id);
    expect(findNode(grown, bare.children[0].id)!.children[0].label).toBe("B");
    // under Ā, the events A has
    const r2 = buildTree([parseStage("A, !A")]);
    const withB = addChild(addChild(r2, r2.children[0].id).root, r2.children[0].id).root;
    const second = addChild(withB, r2.children[1].id);
    expect([second.node!.label, !!second.node!.bar]).toEqual(["B", false]);
    expect(suggestEvent(second.root, r2.children[1].id)).toEqual({ label: "B", bar: true });
  });

  it("adds beside, changes, moves and removes branches", () => {
    let root = twoByTwo();
    const a = root.children[0];
    const sib = addSibling(root, a.id);
    root = sib.root;
    expect(root.children.map((c) => c.id).indexOf(sib.node!.id)).toBe(1);
    root = updateNode(root, a.id, { prob: "0.3", hideProb: true });
    expect(findNode(root, a.id)).toMatchObject({ prob: "0.3", hideProb: true });
    root = moveNode(root, a.id, 1);
    expect(root.children[1].id).toBe(a.id);
    expect(parentOf(root, a.children[0].id)!.id).toBe(a.id);
    root = removeNode(root, a.id);
    expect(findNode(root, a.id)).toBeNull();
    expect(removeNode(root, root.id).children).toEqual([]);
  });

  it("checks the sums and fills the one branch left blank", () => {
    let root = twoByTwo();
    const [a, na] = root.children;
    root = updateNode(root, a.id, { prob: "0,3" });
    root = updateNode(root, a.children[0].id, { prob: "0,6" });
    root = updateNode(root, na.children[0].id, { prob: "0,2" });
    root = updateNode(root, na.children[1].id, { prob: "0,7" });
    expect(badSums(root).map((b) => [b.node.id, b.sum])).toEqual([[na.id, { n: 9, d: 10 }]]);
    const filled = fillMissing(root);
    expect(findNode(filled, na.id)!.prob).toBe("0,7");
    expect(findNode(filled, a.children[1].id)!.prob).toBe("0,4");
    expect(findNode(filled, na.children[1].id)!.prob).toBe("0,7"); // (not blank: left alone)
    const frac = fillMissing(updateNode(twoByTwo(), twoByTwo().id, {}));
    expect(treeTexts(frac).every((t) => t === "")).toBe(true); // (nothing to work from)
  });
});

describe("the scene", () => {
  const tree = (patch: Partial<ProbTree> = {}): ProbTree => ({ ...newTree(["A, !A", "B, !B"], 100, 50), ...patch });

  it("puts a tree with the top-left corner of what it draws at its place", () => {
    const d = drawTree(tree());
    expect(d.bounds.x).toBeCloseTo(100);
    expect(d.bounds.y).toBeCloseTo(50);
    expect(d.bounds.w).toBeGreaterThan(200);
    // a hit for each node, and one for each branch's probability
    expect(d.hits.filter((h) => h.part === "node")).toHaveLength(7);
    expect(d.hits.filter((h) => h.part === "prob")).toHaveLength(6);
    // 6 branches
    expect(d.prims.filter((p) => p.k === "line" && p.pts.length === 4 && p.w > 1).length).toBeGreaterThanOrEqual(6);
  });

  it("writes a fraction one over the other, a hidden one as dots, and the columns of the paths", () => {
    const t = tree();
    const [a, na] = t.root.children;
    let root = updateNode(t.root, a.id, { prob: "1/4" });
    root = updateNode(root, na.id, { prob: "3/4", hideProb: true });
    root = updateNode(root, a.children[0].id, { prob: "1/5" });
    const texts = (x: ProbTree) => drawTree(x).prims.flatMap((p) => (p.k === "text" ? [p.text] : []));
    const plain = texts({ ...t, root });
    expect(plain).toContain("1");
    expect(plain).toContain("4");
    expect(plain).not.toContain("1/4");
    expect(plain).toContain("……");
    expect(plain).not.toContain("3");
    const cols = texts({ ...t, root, showOutcomes: true, showResults: true });
    expect(cols).toContain("∩");
    expect(cols).toContain("20"); // 1/4 × 1/5 = 1/20, as a fraction
  });

  it("lays a tree out from top to bottom too", () => {
    const right = drawTree(tree());
    const down = drawTree(tree({ direction: "down" }));
    expect(down.bounds.h).toBeGreaterThan(down.bounds.w * 0.6);
    expect(right.bounds.w).toBeGreaterThan(right.bounds.h);
  });

  it("finds a spot inside each region of a Venn diagram", () => {
    for (const sets of [2, 3] as const) {
      const cs = vennCircles(sets);
      const spots = regionSpots(sets);
      for (const key of vennRegions(sets)) {
        const s = spots[key];
        expect(s, key).toBeTruthy();
        cs.forEach((c, i) => expect(Math.hypot(s.x - c.cx, s.y - c.cy) <= c.r, `${key} circle ${i}`).toBe(key[i] === "1"));
      }
    }
    expect(vennRegions(2)).toEqual(["11", "10", "01", "00"]);
    expect(vennRegions(3)).toHaveLength(8);
  });

  it("draws every figure of the left panel, with a box", () => {
    for (const kind of PLACE_KINDS) {
      const d = drawItem(newItem(kind, 10, 20));
      expect(d.prims.length, kind).toBeGreaterThan(0);
      expect(d.bounds.w, kind).toBeGreaterThan(20);
      expect(d.bounds.x, kind).toBeCloseTo(10, 0);
    }
  });
});

describe("the sheet and its picture", () => {
  it("adds, copies and removes items", () => {
    const t = newTree(["A, !A"], 40, 40);
    let c = addItem(DEFAULT_PROBA_CONFIG, t);
    const { config, copy } = duplicateItem(c, t.id);
    c = config;
    expect(c.items).toHaveLength(2);
    expect(copy!.id).not.toBe(t.id);
    expect((copy as ProbTree).root.id).not.toBe(t.root.id);
    expect(removeItem(c, t.id).items).toHaveLength(1);
  });

  it("makes no picture of an empty sheet, and crops the picture to what is drawn", () => {
    expect(renderProbaSvg(DEFAULT_PROBA_CONFIG)).toBeNull();
    const venn = { ...newItem("venn2", 300, 200), shaded: ["11"] } as ReturnType<typeof newItem>;
    const c = addItem(addItem(DEFAULT_PROBA_CONFIG, newTree(["A, !A"], 40, 40)), venn);
    const img = renderProbaSvg(c)!;
    const box = contentBounds(c)!;
    expect(img.width).toBeGreaterThanOrEqual(Math.floor(box.w));
    expect(img.svg).toContain('data-kind="tree"');
    expect(img.svg).toContain("<clipPath");
    expect(img.svg).not.toMatch(/NaN|undefined/);
  });

  it("draws the brush strokes of the floating bar as ink", () => {
    const stroke = { id: "s1", shape: "freehand", ink: "brush" as const, stroke: "#ff0000", strokeWidth: 4, x: 10, y: 10, w: 50, h: 20, adj: [0, 0, 0.5, 1, 1, 0.5] };
    const img = renderProbaSvg({ ...DEFAULT_PROBA_CONFIG, shapes: [stroke] })!;
    expect(img.svg).toContain('fill="#ff0000"');
    expect(img.svg).not.toMatch(/NaN/);
  });
});
