"use client";

import { useCallback, useState } from "react";
import type { ShapePatch } from "@/app/_components/shapes/StudioShapes";
import { eraseStrokes } from "@/app/_lib/ink/eraser";
import { addItem, duplicateItem, moveItemTo, newItem, removeItem, resizeArea, updateItem, type PlaceKind } from "@/app/_lib/proba/ops";
import { drawItem } from "@/app/_lib/proba/scene";
import { addChild, addSibling, addStage, addStageEvent, findNode, freeLetters, moveNode, parentOf, removeNode, removeStage, removeStageEvent, renameStageEvent, updateNode, type StageEvent } from "@/app/_lib/proba/tree";
import { DEFAULT_PROBA_CONFIG, type ProbaConfig, type ProbItem, type ProbNode, type ProbTree } from "@/app/_lib/proba/types";
import { FREEHAND_ID, addShape, duplicateShape, newShapeId, removeShape, reorderShape, updateShape, type Order, type ShapeItem } from "@/app/_lib/shapes";
import { canRedoStudio, canUndoStudio, editStudioHistory, isStudioDirty, redoStudioHistory, startStudioHistory, undoStudioHistory, type StudioHistory } from "@/app/_lib/studioHistory";

/** The tool in hand: select and move, the tools of the floating bar, or a tile of the left panel to put on the sheet. */
export type ProbaTool = "select" | "draw" | "shape" | "textbox" | "eraser" | PlaceKind;

export type ProbaSelection = { kind: "item"; id: string; node?: string } | { kind: "shape"; id: string };

export const isPlaceTool = (t: ProbaTool): t is PlaceKind => !["select", "draw", "shape", "textbox", "eraser"].includes(t);

// A text box drawn on the sheet that was left empty goes away (it would be an invisible box).
const emptyTextBox = (s: ShapeItem | undefined) => !!s && !s.text?.trim() && s.fill === null && s.stroke === null;

// The state of the Probability Studio: the sheet, with its own undo and redo (the exam's own undo history gets one step when the
// sheet is inserted or updated), what is selected (an item, a node of a tree, or a drawing), and the tool in hand. The edits
// themselves are pure functions in _lib/proba.
export function useProbaStudio(initial: ProbaConfig = DEFAULT_PROBA_CONFIG, coin: [string, string] = ["P", "F"]) {
  const [history, setHistory] = useState<StudioHistory<ProbaConfig>>(() => startStudioHistory(initial));
  const [selection, setSelection] = useState<ProbaSelection | null>(null);
  const [tool, setToolState] = useState<ProbaTool>("select");
  const [shapeKind, setShapeKind] = useState("rect");
  const [textId, setTextId] = useState<string | null>(null); // the drawing whose text is being typed
  const config = history.present;

  const change = useCallback((fn: (c: ProbaConfig) => ProbaConfig | null, key: string) => setHistory((h) => {
    const next = fn(h.present);
    return next ? editStudioHistory(h, next, key, Date.now()) : h;
  }), []);

  // what is selected, as it is now (what undo took away is no longer selected)
  const selectedItem = selection?.kind === "item" ? (config.items.find((i) => i.id === selection.id) ?? null) : null;
  const selectedTree = selectedItem?.kind === "tree" ? selectedItem : null;
  const selectedNode = selectedTree && selection?.kind === "item" && selection.node ? findNode(selectedTree.root, selection.node) : null;
  const selectedShape = selection?.kind === "shape" ? ((config.shapes ?? []).find((s) => s.id === selection.id) ?? null) : null;

  // ---- tools ----

  const setTool = useCallback((next: ProbaTool) => {
    setToolState(next);
    if (next !== "select") setSelection(null);
  }, []);
  const pickShape = useCallback((kind: string) => {
    if (kind === FREEHAND_ID) return setTool("draw");
    setShapeKind(kind);
    setTool("shape");
  }, [setTool]);

  const selectItem = useCallback((id: string, node?: string) => setSelection({ kind: "item", id, ...(node ? { node } : {}) }), []);
  const selectShape = useCallback((id: string | null) => setSelection(id ? { kind: "shape", id } : null), []);
  const clearSelection = useCallback(() => setSelection(null), []);

  // ---- items ----

  /** A tile put on the sheet where it was clicked (its middle there), selected; the Select tool is back. */
  const placeItem = useCallback(
    (kind: PlaceKind, x: number, y: number) => {
      const item = newItem(kind, 0, 0, coin);
      const b = drawItem(item).bounds;
      const placed = { ...item, x: Math.round(x - b.w / 2), y: Math.round(y - b.h / 2) } as ProbItem;
      change((c) => addItem(c, placed), `add:${placed.id}`);
      setSelection({ kind: "item", id: placed.id });
      setToolState("select");
    },
    [change, coin],
  );

  const moveItem = useCallback((id: string, x: number, y: number) => change((c) => moveItemTo(c, id, x, y), `move:${id}`), [change]);
  const nudgeItem = useCallback((id: string, dx: number, dy: number) => change((c) => {
    const it = c.items.find((i) => i.id === id);
    return it ? moveItemTo(c, id, it.x + dx, it.y + dy) : c;
  }, `move:${id}`), [change]);

  /** An item changed: `key` names what changed, so that typing in one field is one step of the undo. */
  const changeItem = useCallback(<T extends ProbItem>(id: string, fn: (item: T) => T, key: string) => change((c) => updateItem<T>(c, id, fn), key), [change]);

  const duplicate = useCallback(() => {
    if (selection?.kind !== "item") return;
    const { copy } = duplicateItem(config, selection.id);
    if (!copy) return;
    change((c) => addItem(c, copy), `dup:${copy.id}`);
    setSelection({ kind: "item", id: copy.id });
  }, [selection, config, change]);

  // ---- trees ----

  const changeTree = useCallback((id: string, fn: (t: ProbTree) => ProbTree, key: string) => changeItem<ProbTree>(id, fn, key), [changeItem]);

  const setNode = useCallback(
    (treeId: string, nodeId: string, patch: Partial<Omit<ProbNode, "id" | "children">>) =>
      changeTree(treeId, (t) => ({ ...t, root: updateNode(t.root, nodeId, patch) }), `node:${nodeId}:${Object.keys(patch).sort().join(",")}`),
    [changeTree],
  );

  /** A new branch under a node (or next to it). The node stays selected, so its + (or Tab) adds the next one at once. */
  const branch = useCallback(
    (treeId: string, nodeId: string, sibling = false) => {
      const tree = config.items.find((i) => i.id === treeId);
      if (tree?.kind !== "tree") return null;
      const { root, node } = sibling ? addSibling(tree.root, nodeId) : addChild(tree.root, nodeId);
      if (!node) return null;
      change((c) => updateItem<ProbTree>(c, treeId, (t) => ({ ...t, root })), `branch:${node.id}`);
      setSelection({ kind: "item", id: treeId, node: nodeId });
      return node;
    },
    [config.items, change],
  );

  const moveBranch = useCallback((treeId: string, nodeId: string, by: -1 | 1) => changeTree(treeId, (t) => ({ ...t, root: moveNode(t.root, nodeId, by) }), `order:${nodeId}:${Date.now()}`), [changeTree]);

  // ---- the stages of a tree (every node of one level at once) ----

  /** An event renamed (or barred) everywhere in its stage. */
  const renameStage = useCallback(
    (treeId: string, depth: number, from: StageEvent, patch: Partial<StageEvent>) =>
      changeTree(treeId, (t) => ({ ...t, root: renameStageEvent(t.root, depth, from, patch) }), `stage:${treeId}:${depth}:${from.bar ? "!" : ""}:${Object.keys(patch).join(",")}`),
    [changeTree],
  );
  /** A new event in a stage (a letter the tree does not use yet), under every node of the stage before. */
  const addEventToStage = useCallback(
    (treeId: string, depth: number) => changeTree(treeId, (t) => ({ ...t, root: addStageEvent(t.root, depth, { label: freeLetters(t.root, 1)[0] ?? "", bar: false }) }), `stage-add:${Date.now()}`),
    [changeTree],
  );
  const removeEventFromStage = useCallback(
    (treeId: string, depth: number, e: StageEvent) => changeTree(treeId, (t) => ({ ...t, root: removeStageEvent(t.root, depth, e) }), `stage-remove:${Date.now()}`),
    [changeTree],
  );
  /** A new last stage: two events the tree does not use yet, under every leaf. */
  const addStageTo = useCallback(
    (treeId: string) => changeTree(treeId, (t) => ({ ...t, root: addStage(t.root, freeLetters(t.root, 2).map((label) => ({ label, bar: false }))) }), `stage-new:${Date.now()}`),
    [changeTree],
  );
  const removeStageFrom = useCallback(
    (treeId: string, depth: number) => {
      changeTree(treeId, (t) => ({ ...t, root: removeStage(t.root, depth) }), `stage-drop:${Date.now()}`);
      setSelection({ kind: "item", id: treeId });
    },
    [changeTree],
  );

  // ---- drawings of the floating bar ----

  const addDrawing = useCallback(
    (item: ShapeItem) => {
      change((c) => ({ ...c, shapes: addShape(c.shapes, item) }), `add:${item.id}`);
      if (tool === "draw") return; // (the brush stays in hand: a drawing is many strokes)
      setSelection({ kind: "shape", id: item.id });
      setToolState("select"); // (like PowerPoint: one shape, then the Select tool is back)
      if (tool === "textbox") setTextId(item.id); // (a text box: type in it at once)
    },
    [tool, change],
  );
  const changeShape = useCallback((id: string, patch: ShapePatch, key: string) => change((c) => ({ ...c, shapes: updateShape(c.shapes, id, patch) }), key), [change]);
  const eraseShapes = useCallback((ids: ReadonlySet<string>, gesture: string) => change((c) => {
    const left = (c.shapes ?? []).filter((s) => !ids.has(s.id));
    return { ...c, shapes: left.length ? left : undefined };
  }, gesture), [change]);
  // the real eraser: the drawings it went over are cut there (worked out from the sheet as it is at each move)
  const eraseInk = useCallback((path: { x: number; y: number }[], radius: number, gesture: string) => change((c) => {
    const left = eraseStrokes(c.shapes ?? [], path, radius, newShapeId);
    return left && { ...c, shapes: left.length ? left : undefined };
  }, gesture), [change]);
  const orderShape = useCallback((id: string, order: Order) => change((c) => ({ ...c, shapes: reorderShape(c.shapes, id, order) }), `order:${id}:${Date.now()}`), [change]);
  const duplicateShapeOf = useCallback((id: string) => {
    const { copy } = duplicateShape(config.shapes, id);
    if (!copy) return;
    change((c) => ({ ...c, shapes: addShape(c.shapes, copy) }), `dup:${copy.id}`);
    setSelection({ kind: "shape", id: copy.id });
  }, [config.shapes, change]);
  const deleteShape = useCallback((id: string, key = `remove:${id}`) => {
    change((c) => {
      const left = removeShape(c.shapes, id);
      return { ...c, shapes: left.length ? left : undefined };
    }, key);
    setSelection(null);
  }, [change]);
  const editText = useCallback((id: string | null) => {
    const typed = (config.shapes ?? []).find((s) => s.id === textId);
    setTextId(id);
    if (!id && typed && emptyTextBox(typed)) deleteShape(typed.id, `add:${typed.id}`); // (the same step of the undo as drawing it)
  }, [config.shapes, textId, deleteShape]);

  // ---- the whole sheet ----

  /** Delete: the selected branch (and what follows it), else the selected item or drawing. */
  const deleteSelected = useCallback(() => {
    if (!selection) return;
    if (selection.kind === "shape") return deleteShape(selection.id);
    const tree = config.items.find((i) => i.id === selection.id);
    if (tree?.kind === "tree" && selection.node && selection.node !== tree.root.id) {
      const parent = parentOf(tree.root, selection.node);
      change((c) => updateItem<ProbTree>(c, tree.id, (t) => ({ ...t, root: removeNode(t.root, selection.node!) })), `remove:${selection.node}`);
      setSelection({ kind: "item", id: tree.id, node: parent?.id });
      return;
    }
    change((c) => removeItem(c, selection.id), `remove:${selection.id}`);
    setSelection(null);
  }, [selection, config.items, change, deleteShape]);

  const deleteItem = useCallback((id: string) => {
    change((c) => removeItem(c, id), `remove:${id}`);
    setSelection(null);
  }, [change]);

  const setArea = useCallback((width: number, height: number) => change((c) => resizeArea(c, width, height), "area"), [change]);

  const undo = useCallback(() => setHistory(undoStudioHistory), []);
  const redo = useCallback(() => setHistory(redoStudioHistory), []);

  return {
    config,
    tool,
    setTool,
    shapeKind,
    pickShape,
    selection,
    selectedItem,
    selectedTree,
    selectedNode,
    selectedShape,
    selectItem,
    selectShape,
    clearSelection,
    placeItem,
    moveItem,
    nudgeItem,
    changeItem,
    duplicate,
    changeTree,
    setNode,
    branch,
    moveBranch,
    renameStage,
    addEventToStage,
    removeEventFromStage,
    addStageTo,
    removeStageFrom,
    textId,
    editText,
    addDrawing,
    changeShape,
    eraseShapes,
    eraseInk,
    orderShape,
    duplicateShapeOf,
    deleteShape,
    deleteSelected,
    deleteItem,
    setArea,
    undo,
    redo,
    canUndo: canUndoStudio(history),
    canRedo: canRedoStudio(history),
    dirty: isStudioDirty(history),
    empty: config.items.length === 0 && !config.shapes?.length,
  };
}

export type ProbaStudioState = ReturnType<typeof useProbaStudio>;
