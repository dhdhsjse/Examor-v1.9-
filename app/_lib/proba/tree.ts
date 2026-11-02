// The edits of a probability tree, as pure functions root -> root: build one from its stages, add a branch (with the event it
// most likely needs), change, remove. Unit-tested.
import type { ProbNode } from "./types";

export const newNodeId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `n${Math.random().toString(36).slice(2)}`);

export const newNode = (label = "", prob = "", bar = false, children: ProbNode[] = []): ProbNode => ({ id: newNodeId(), label, prob, ...(bar ? { bar } : {}), children });

/** An event as typed in the quick builder: "A", "!A" or "~A" (the complement, drawn Ā), "A'" is kept as written. */
export function parseEvent(text: string): { label: string; bar: boolean } {
  const s = text.trim();
  const m = /^[!~¬](.+)$/.exec(s);
  return m ? { label: m[1].trim(), bar: true } : { label: s, bar: false };
}

/** The events of one stage as typed: "A, !A" or "R; B; V". */
export const parseStage = (text: string) =>
  text
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(parseEvent);

/** A whole tree from its stages: every node of a stage has the events of the next one under it. */
export function buildTree(stages: { label: string; bar: boolean }[][], rootLabel = ""): ProbNode {
  const grow = (depth: number): ProbNode[] => (depth >= stages.length ? [] : stages[depth].map((e) => newNode(e.label, "", e.bar, grow(depth + 1))));
  return newNode(rootLabel, "", false, grow(0));
}

export function findNode(root: ProbNode, id: string): ProbNode | null {
  if (root.id === id) return root;
  for (const c of root.children) {
    const f = findNode(c, id);
    if (f) return f;
  }
  return null;
}

export function parentOf(root: ProbNode, id: string): ProbNode | null {
  for (const c of root.children) {
    if (c.id === id) return root;
    const f = parentOf(c, id);
    if (f) return f;
  }
  return null;
}

/** How deep a node is (the root is 0), or -1. */
export function depthOf(root: ProbNode, id: string, d = 0): number {
  if (root.id === id) return d;
  for (const c of root.children) {
    const f = depthOf(c, id, d + 1);
    if (f >= 0) return f;
  }
  return -1;
}

const nodesAt = (root: ProbNode, depth: number): ProbNode[] => (depth === 0 ? [root] : root.children.flatMap((c) => nodesAt(c, depth - 1)));

export function mapNode(root: ProbNode, id: string, fn: (n: ProbNode) => ProbNode): ProbNode {
  if (root.id === id) return fn(root);
  let changed = false;
  const children = root.children.map((c) => {
    const next = mapNode(c, id, fn);
    if (next !== c) changed = true;
    return next;
  });
  return changed ? { ...root, children } : root;
}

export const updateNode = (root: ProbNode, id: string, patch: Partial<Omit<ProbNode, "id" | "children">>) => mapNode(root, id, (n) => ({ ...n, ...patch }));

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** The event a new branch under `parent` most likely needs: the one a node of the same level already has at that place (B̄ under Ā
 * when A has B, B̄), else the complement of a lone event (Ā after A), else the next letter of its level. */
export function suggestEvent(root: ProbNode, parentId: string): { label: string; bar: boolean } {
  const parent = findNode(root, parentId);
  if (!parent) return { label: "", bar: false };
  const at = parent.children.length;
  const depth = depthOf(root, parentId);
  const model = nodesAt(root, depth).find((n) => n.id !== parentId && n.children.length > at);
  if (model) return { label: model.children[at].label, bar: !!model.children[at].bar };
  if (at === 1 && !parent.children[0].bar && parent.children[0].label) return { label: parent.children[0].label, bar: true };
  if (at === 0) return { label: LETTERS[depth % LETTERS.length], bar: false };
  const last = parent.children[at - 1].label;
  const i = LETTERS.indexOf(last);
  return { label: i >= 0 && i < LETTERS.length - 1 ? LETTERS[i + 1] : "", bar: false };
}

/** A new branch at the end of a node's branches; the new node is returned too (to be selected). */
export function addChild(root: ProbNode, parentId: string): { root: ProbNode; node: ProbNode | null } {
  if (!findNode(root, parentId)) return { root, node: null };
  const e = suggestEvent(root, parentId);
  const node = newNode(e.label, "", e.bar);
  return { root: mapNode(root, parentId, (n) => ({ ...n, children: [...n.children, node] })), node };
}

/** A new branch next to a node (after it). Not for the root. */
export function addSibling(root: ProbNode, id: string): { root: ProbNode; node: ProbNode | null } {
  const parent = parentOf(root, id);
  if (!parent) return { root, node: null };
  const e = suggestEvent(root, parent.id);
  const node = newNode(e.label, "", e.bar);
  const i = parent.children.findIndex((c) => c.id === id);
  return { root: mapNode(root, parent.id, (n) => ({ ...n, children: [...n.children.slice(0, i + 1), node, ...n.children.slice(i + 1)] })), node };
}

/** A node and everything after it taken away (the root stays: its branches go). */
export function removeNode(root: ProbNode, id: string): ProbNode {
  if (root.id === id) return { ...root, children: [] };
  const parent = parentOf(root, id);
  if (!parent) return root;
  return mapNode(root, parent.id, (n) => ({ ...n, children: n.children.filter((c) => c.id !== id) }));
}

/** A node moved up or down among its siblings. */
export function moveNode(root: ProbNode, id: string, by: -1 | 1): ProbNode {
  const parent = parentOf(root, id);
  if (!parent) return root;
  const i = parent.children.findIndex((c) => c.id === id);
  const j = i + by;
  if (j < 0 || j >= parent.children.length) return root;
  return mapNode(root, parent.id, (n) => {
    const children = [...n.children];
    [children[i], children[j]] = [children[j], children[i]];
    return { ...n, children };
  });
}

/** The same tree with new ids (a copy). */
export const cloneTree = (n: ProbNode): ProbNode => ({ ...n, id: newNodeId(), children: n.children.map(cloneTree) });

/** Every path from the root to a leaf: the nodes along it (without the root). */
export function paths(root: ProbNode): ProbNode[][] {
  if (!root.children.length) return [];
  const out: ProbNode[][] = [];
  const walk = (n: ProbNode, path: ProbNode[]) => {
    if (!n.children.length) out.push(path);
    else n.children.forEach((c) => walk(c, [...path, c]));
  };
  walk(root, []);
  return out;
}

/** The stages of a tree written back for the quick builder ("A, !A"), read from its first branch of each level. */
export function stagesOf(root: ProbNode): string[] {
  const out: string[] = [];
  let level = [root];
  while (level.some((n) => n.children.length)) {
    const model = level.find((n) => n.children.length)!;
    out.push(model.children.map((c) => (c.bar ? `!${c.label}` : c.label)).join(", "));
    level = level.flatMap((n) => n.children);
  }
  return out;
}
