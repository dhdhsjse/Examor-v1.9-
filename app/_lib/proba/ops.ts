// The edits of the Probability Studio's sheet, as pure functions config -> config, and what a new tree, diagram, urn… starts as.
// Unit-tested.
import { shapesBounds } from "@/app/_lib/shapes";
import { drawItem, type Box } from "./scene";
import { buildTree, cloneTree, newNodeId, parseStage } from "./tree";
import { MAX_AREA, MIN_AREA, type ItemKind, type ProbaConfig, type ProbItem, type ProbTree } from "./types";

export const newItemId = () => `p-${newNodeId()}`;

/** A new tree made of stages ("A, !A"), its top-left corner at (x, y). */
export function newTree(stages: string[], x: number, y: number): ProbTree {
  return {
    id: newItemId(),
    kind: "tree",
    x,
    y,
    root: buildTree(stages.map(parseStage).filter((s) => s.length)),
    direction: "right",
    levelGap: 120,
    leafGap: 46,
    fontSize: 17,
  };
}

/** The tiles of the left panel: what each puts on the sheet. `venn3` is a Venn diagram of three sets. */
export type PlaceKind = Exclude<ItemKind, "venn"> | "venn2" | "venn3";
export const PLACE_KINDS: PlaceKind[] = ["tree", "venn2", "venn3", "urn", "dice", "coin", "spinner", "cards"];

/** What a tile puts on the sheet, its top-left corner at (x, y). `coin` is the two letters of a coin's sides in the language. */
export function newItem(kind: PlaceKind, x: number, y: number, coin: [string, string] = ["P", "F"]): ProbItem {
  const id = newItemId();
  switch (kind) {
    case "tree":
      return newTree(["A, !A", "B, !B"], x, y);
    case "venn2":
    case "venn3":
      return { id, kind: "venn", x, y, sets: kind === "venn2" ? 2 : 3, labels: ["A", "B", "C"], universe: "Ω", showUniverse: true, values: {}, shaded: [] };
    case "urn":
      return { id, kind: "urn", x, y, label: "", balls: [{ color: "red", count: 3, text: "" }, { color: "blue", count: 2, text: "" }] };
    case "dice":
      return { id, kind: "dice", x, y, faces: [5, 2] };
    case "coin":
      return { id, kind: "coin", x, y, sides: [coin[0], coin[1]] };
    case "spinner":
      return { id, kind: "spinner", x, y, radius: 70, sectors: [{ label: "1", weight: 1, color: "red" }, { label: "2", weight: 1, color: "blue" }, { label: "3", weight: 1, color: "yellow" }, { label: "4", weight: 1, color: "green" }] };
    case "cards":
      return { id, kind: "cards", x, y, texts: ["1", "2", "3", "4"] };
  }
}

export const addItem = (c: ProbaConfig, item: ProbItem): ProbaConfig => ({ ...c, items: [...c.items, item] });

export const updateItem = <T extends ProbItem>(c: ProbaConfig, id: string, fn: (item: T) => T): ProbaConfig => ({
  ...c,
  items: c.items.map((it) => (it.id === id ? fn(it as T) : it)),
});

export const removeItem = (c: ProbaConfig, id: string): ProbaConfig => ({ ...c, items: c.items.filter((it) => it.id !== id) });

export const moveItemTo = (c: ProbaConfig, id: string, x: number, y: number): ProbaConfig => updateItem(c, id, (it) => ({ ...it, x: Math.round(x), y: Math.round(y) }));

/** A copy of an item a little lower and to the right (a tree gets new ids for its nodes). */
export function duplicateItem(c: ProbaConfig, id: string): { config: ProbaConfig; copy: ProbItem | null } {
  const it = c.items.find((i) => i.id === id);
  if (!it) return { config: c, copy: null };
  const copy: ProbItem = { ...structuredClone(it), id: newItemId(), x: it.x + 24, y: it.y + 24 };
  if (copy.kind === "tree") copy.root = cloneTree(copy.root);
  return { config: addItem(c, copy), copy };
}

/** An item brought to the front (drawn last) or sent to the back. */
export function reorderItem(c: ProbaConfig, id: string, front: boolean): ProbaConfig {
  const it = c.items.find((i) => i.id === id);
  if (!it) return c;
  const rest = c.items.filter((i) => i.id !== id);
  return { ...c, items: front ? [...rest, it] : [it, ...rest] };
}

export const resizeArea = (c: ProbaConfig, width: number, height: number): ProbaConfig => {
  const clamp = (v: number) => Math.round(Math.min(MAX_AREA, Math.max(MIN_AREA, v)));
  return { ...c, width: clamp(width), height: clamp(height) };
};

/** The box around everything drawn (null for an empty sheet). */
export function contentBounds(c: ProbaConfig): Box | null {
  const boxes: Box[] = c.items.map((it) => drawItem(it).bounds);
  const s = shapesBounds(c.shapes);
  if (s) boxes.push({ x: s.minX, y: s.minY, w: s.maxX - s.minX, h: s.maxY - s.minY });
  if (!boxes.length) return null;
  const x0 = Math.min(...boxes.map((b) => b.x));
  const y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w));
  const y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
