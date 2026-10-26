"use client";

import { useCallback, useState } from "react";
import { GRID, routeNext, type P, type SnapTarget } from "@/app/_lib/circuit/geometry";
import { addComponent, addWire, moveComponent, moveWire, newComponent, numberLabels, removeComponent, removeWire, resizeArea, rotateComponent, updateComponent } from "@/app/_lib/circuit/ops";
import { DEFAULT_CIRCUIT_CONFIG, type CircuitComponent, type CircuitConfig, type ComponentType } from "@/app/_lib/circuit/types";
import { canRedoStudio, canUndoStudio, editStudioHistory, isStudioDirty, redoStudioHistory, startStudioHistory, undoStudioHistory, type StudioHistory } from "@/app/_lib/studioHistory";

/** The tool in hand: select and move, draw wires, or put a component of a kind. */
export type CircuitTool = "select" | "wire" | ComponentType;

/** A wire being drawn: its corners so far, and the way the terminal it started on points. */
export type WireDraft = { points: number[]; startDir?: P };

type Selection = { kind: "component" | "wire"; id: string };

// The state of the Circuit Studio: the circuit, with its own undo and redo (the exam's own undo history gets one step when the
// circuit is inserted or updated), what is selected, the tool in hand, the rotation a component about to be placed will have,
// and the wire being drawn. The edits themselves are pure functions in _lib/circuit/ops.ts.
export function useCircuitStudio(initial: CircuitConfig = DEFAULT_CIRCUIT_CONFIG) {
  const [history, setHistory] = useState<StudioHistory<CircuitConfig>>(() => startStudioHistory(initial));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [tool, setToolState] = useState<CircuitTool>("select");
  const [pendingRotation, setPendingRotation] = useState(0); // (the turn of the next component placed: R turns it before the click)
  const [draft, setDraft] = useState<WireDraft | null>(null);
  const config = history.present;

  // Edits are made on the latest circuit (two quick ones must not undo each other); `key` names what changed, so that a drag or a
  // typed field is one step of the undo.
  const change = useCallback((fn: (c: CircuitConfig) => CircuitConfig, key: string) => setHistory((h) => editStudioHistory(h, fn(h.present), key, Date.now())), []);

  const selectedComponent = selection?.kind === "component" ? (config.components.find((c) => c.id === selection.id) ?? null) : null;
  const selectedWire = selection?.kind === "wire" ? (config.wires.find((w) => w.id === selection.id) ?? null) : null; // (what undo took away is no longer selected)

  // ---- tools ----

  const setTool = useCallback((next: CircuitTool) => {
    setToolState(next);
    setDraft(null);
    setPendingRotation(0); // (each tool starts unturned)
    if (next !== "select") setSelection(null);
  }, []);
  const selectComponent = useCallback((id: string | null) => setSelection(id ? { kind: "component", id } : null), []);
  const selectWire = useCallback((id: string | null) => setSelection(id ? { kind: "wire", id } : null), []);
  const clearSelection = useCallback(() => setSelection(null), []);

  // ---- components ----

  // A click with a component tool in hand: one is put there (the tool stays in hand: a circuit has several), and selected.
  const placeComponent = useCallback(
    (type: ComponentType, x: number, y: number) => {
      const c = newComponent(config, type, x, y, pendingRotation);
      change((cfg) => addComponent(cfg, c), `add:${c.id}`);
      setSelection({ kind: "component", id: c.id });
    },
    [config, pendingRotation, change],
  );

  const moveComponentTo = useCallback((id: string, x: number, y: number) => change((c) => moveComponent(c, id, x, y), `move:${id}`), [change]);
  const nudge = useCallback((id: string, dx: number, dy: number) => change((c) => {
    const at = c.components.find((k) => k.id === id);
    return at ? moveComponent(c, id, at.x + dx * GRID, at.y + dy * GRID) : c;
  }, `move:${id}`), [change]);

  // R: turns the component about to be placed, or else the selected one.
  const rotate = useCallback(
    (by = 90) => {
      if (tool !== "select" && tool !== "wire") setPendingRotation((r) => (((r + by) % 360) + 360) % 360);
      else if (selectedComponent) change((c) => rotateComponent(c, selectedComponent.id, by), `rotate:${selectedComponent.id}`);
    },
    [tool, selectedComponent, change],
  );

  const updateComponentProps = useCallback(
    (id: string, patch: Partial<Pick<CircuitComponent, "label" | "value" | "closed" | "showValue" | "labelSide">>) => change((c) => updateComponent(c, id, patch), `comp:${id}:${Object.keys(patch).sort().join(",")}`),
    [change],
  );

  // ---- wires ----

  const finishWire = useCallback(
    (extra?: number[]) => {
      if (!draft) return;
      const points = extra ?? draft.points;
      const wire = { id: crypto.randomUUID(), points };
      if (points.length >= 4) {
        change((c) => addWire(c, points, wire.id), `wire:${wire.id}`);
        setSelection({ kind: "wire", id: wire.id });
      }
      setDraft(null);
    },
    [draft, change],
  );

  // A click with the wire tool: the first one starts a wire, the next ones carry it on (an L-shape between corners, or more), and a
  // click on a terminal or on another wire ends it there. Shift takes the other way round for the next leg.
  const wireClick = useCallback(
    (target: SnapTarget, flip: boolean) => {
      if (!draft) {
        setDraft({ points: [target.point.x, target.point.y], startDir: target.outward });
        return;
      }
      const last = { x: draft.points[draft.points.length - 2], y: draft.points[draft.points.length - 1] };
      if (Math.abs(last.x - target.point.x) < 0.5 && Math.abs(last.y - target.point.y) < 0.5) return; // (a double click lands twice on one point)
      const points = routeNext(draft.points, draft.startDir, target.point, flip);
      if (target.connects) finishWire(points);
      else setDraft({ ...draft, points });
    },
    [draft, finishWire],
  );

  const cancelWire = useCallback(() => setDraft(null), []);
  const moveWireBy = useCallback((id: string, dx: number, dy: number) => change((c) => moveWire(c, id, dx, dy), `wire-move:${id}`), [change]);

  // ---- the whole circuit ----

  const deleteSelected = useCallback(() => {
    if (!selection) return;
    if (selection.kind === "component") change((c) => removeComponent(c, selection.id), `remove:${selection.id}`);
    else change((c) => removeWire(c, selection.id), `remove:${selection.id}`);
    setSelection(null);
  }, [selection, change]);

  const numberTheLabels = useCallback(() => change((c) => numberLabels(c), "number"), [change]);

  const setArea = useCallback((width: number, height: number) => change((c) => resizeArea(c, width, height), "area"), [change]);

  const undo = useCallback(() => setHistory(undoStudioHistory), []);
  const redo = useCallback(() => setHistory(redoStudioHistory), []);

  return {
    config,
    selectedComponent,
    selectedWire,
    selectComponent,
    selectWire,
    clearSelection,
    tool,
    setTool,
    pendingRotation,
    placeComponent,
    moveComponentTo,
    nudge,
    rotate,
    updateComponentProps,
    draft,
    wireClick,
    finishWire: () => finishWire(),
    cancelWire,
    moveWireBy,
    deleteSelected,
    setArea,
    numberTheLabels,
    undo,
    redo,
    canUndo: canUndoStudio(history),
    canRedo: canRedoStudio(history),
    dirty: isStudioDirty(history),
    empty: config.components.length === 0 && config.wires.length === 0,
  };
}

export type CircuitStudioState = ReturnType<typeof useCircuitStudio>;
