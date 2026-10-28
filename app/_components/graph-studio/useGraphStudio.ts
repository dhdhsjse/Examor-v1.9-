"use client";

import { useCallback, useMemo, useState } from "react";
import type { ShapePatch } from "@/app/_components/shapes/StudioShapes";
import { addShape, duplicateShape, isLine, newShapeItem, removeShape, reorderShape, updateShape, type DrawnBox, type Order } from "@/app/_lib/shapes";
import { detachCurve, handlesOf, moveHandle, newAnnotation, type Handle, type PlacePoint } from "@/app/_lib/graph/annotations";
import { configIssues, fatalIssue, type GraphIssue } from "@/app/_lib/graph/grid";
import { canRedo, canUndo, edit, isDirty, redo, startHistory, undo, type GraphHistory } from "@/app/_lib/graph/history";
import { newDataSeries, newFunction } from "@/app/_lib/graph/mathUtils";
import { instantiateTemplate, presetChanges, type GraphPreset, type GraphTemplate } from "@/app/_lib/graph/presets";
import { DEFAULT_GRAPH_CONFIG, axisSteps, normalizeGraphConfig, type AnnotationType, type DataPoint, type FunctionType, type GraphAnnotation, type GraphConfig, type GraphFunction } from "@/app/_lib/graph/types";

/** What can change in a curve: its colour, its thickness, its line (solid, dashed, dotted), the range it is drawn on, the text of a formula, whether it is masked, some of its parameters (the others stay), and for a series of measured points how it is drawn. */
export type FunctionPatch = Partial<Pick<GraphFunction, "color" | "strokeWidth" | "hidden" | "showPoints" | "lineStyle" | "expression" | "from" | "to" | "dash">> & { params?: Record<string, number> };

/** The tool in hand: an annotation, or the one that adds measured points to the selected series. */
export type GraphTool = AnnotationType | "points";

/** Whose version of the graph is on the screen: the teacher's (everything, the masked parts faded) or the student's (the masks applied, only looked at). */
export type GraphView = "teacher" | "student";

// The state of the Graph Studio: the configuration of the paper (with its curves and annotations), with its own undo and redo
// (the exam's own undo history gets one step when the graph is inserted or updated), what is selected (a curve or an
// annotation, never both), the annotation tool in hand, and whether clicks snap to the grid. A change that would make the paper
// impossible to draw (a maximum under the minimum, a step of zero…) is refused, and the reason is returned so that the field can
// say it; the paper on the screen is always a drawable one.
export function useGraphStudio(initial: GraphConfig = DEFAULT_GRAPH_CONFIG) {
  const [history, setHistory] = useState<GraphHistory>(() => startHistory(normalizeGraphConfig(initial)));
  const [selection, setSelection] = useState<{ kind: "curve" | "annotation" | "shape"; id: string } | null>(null);
  const [tool, setTool] = useState<GraphTool | null>(null); // the tool in hand: the next click on the paper places an annotation, or a point (and stays in hand)
  const [shapeTool, setShapeTool] = useState<string | null>(null); // the shape the next drag on the paper draws (from the Shapes gallery)
  const [view, setViewState] = useState<GraphView>("teacher");
  const [snap, setSnap] = useState(true); // clicks and drags land on the fine grid
  const config = history.present;

  // Returns what is wrong with the change (it is then not made), or null.
  const updateConfig = useCallback(
    (updates: Partial<GraphConfig>): GraphIssue | null => {
      const issue = fatalIssue({ ...config, ...updates });
      if (issue) return issue;
      setHistory((h) => edit(h, { ...h.present, ...updates }, Object.keys(updates).sort().join(","), Date.now()));
      return null;
    },
    [config],
  );

  // Edits of the curves and annotations are made on the latest configuration (two quick ones must not undo each other), and each
  // kind of edit of one thing is its own step, so that undoing a parameter does not undo the curve itself.
  const change = useCallback((fn: (c: GraphConfig) => GraphConfig, key: string) => setHistory((h) => edit(h, fn(h.present), key, Date.now())), []);

  // ---- selection ----

  const selectedFunction = selection?.kind === "curve" ? (config.functions.find((f) => f.id === selection.id) ?? null) : null;
  const selectedAnnotation = selection?.kind === "annotation" ? (config.annotations.find((a) => a.id === selection.id) ?? null) : null; // (what undo took away is no longer selected)
  const selectFunction = useCallback((id: string | null) => setSelection(id ? { kind: "curve", id } : null), []);
  const selectAnnotation = useCallback((id: string | null) => setSelection(id ? { kind: "annotation", id } : null), []);
  const selectedShape = selection?.kind === "shape" ? ((config.shapes ?? []).find((s) => s.id === selection.id) ?? null) : null;
  const selectShape = useCallback((id: string | null) => setSelection(id ? { kind: "shape", id } : null), []);
  // (a series stays selected while its points are being put: they go to it)
  const pickTool = useCallback((next: GraphTool | null) => {
    setShapeTool(null);
    setTool((t) => (t === next ? null : next));
    if (next !== "points") setSelection(null);
  }, []);
  // The student's view is only looked at: nothing is selected or in hand in it.
  const setView = useCallback((next: GraphView) => {
    setViewState(next);
    if (next === "student") {
      setSelection(null);
      setTool(null);
      setShapeTool(null);
    }
  }, []);

  // ---- curves ----

  const addFunction = useCallback(
    (type: FunctionType) => {
      const fn = newFunction(type, config);
      change((c) => ({ ...c, functions: [...c.functions, fn] }), `add:${fn.id}`);
      setSelection({ kind: "curve", id: fn.id });
      setTool(null);
    },
    [config, change],
  );

  const updateFunction = useCallback(
    (id: string, patch: FunctionPatch) => {
      const key = `fn:${id}:${Object.keys(patch.params ?? {}).concat(Object.keys(patch).filter((k) => k !== "params")).sort().join(",")}`;
      change((c) => ({ ...c, functions: c.functions.map((f: GraphFunction) => (f.id === id ? { ...f, ...patch, params: { ...f.params, ...patch.params } } : f)) }), key);
    },
    [change],
  );

  // (a tangent on the curve goes with it; a triangle or a marker stays where it was)
  const removeFunction = useCallback(
    (id: string) => {
      change((c) => ({ ...c, annotations: detachCurve(c, id), functions: c.functions.filter((f) => f.id !== id) }), `remove:${id}`);
      setSelection((s) => (s?.id === id ? null : s));
    },
    [change],
  );

  // ---- measured points ----

  // A new series (selected, with the points tool in hand to fill it).
  const addSeries = useCallback(() => {
    const series = newDataSeries(config);
    change((c) => ({ ...c, functions: [...c.functions, series] }), `add:${series.id}`);
    setSelection({ kind: "curve", id: series.id });
    setTool("points");
  }, [config, change]);

  // A point at graph (x, y): in the selected series, or in a new one when none is selected.
  const addDataPoint = useCallback(
    (x: number, y: number) => {
      const point: DataPoint = { id: crypto.randomUUID(), x, y };
      const target = selectedFunction?.type === "data" ? selectedFunction : null;
      if (target) {
        change((c) => ({ ...c, functions: c.functions.map((f) => (f.id === target.id ? { ...f, points: [...(f.points ?? []), point] } : f)) }), `pt-add:${point.id}`);
        return;
      }
      const series = newDataSeries(config, [point]);
      change((c) => ({ ...c, functions: [...c.functions, series] }), `add:${series.id}`);
      setSelection({ kind: "curve", id: series.id });
    },
    [config, change, selectedFunction],
  );

  // Several at once (values pasted from a spreadsheet).
  const addDataPoints = useCallback(
    (seriesId: string, values: { x: number; y: number }[]) => {
      if (!values.length) return;
      const added = values.map((v) => ({ id: crypto.randomUUID(), x: v.x, y: v.y }));
      change((c) => ({ ...c, functions: c.functions.map((f) => (f.id === seriesId ? { ...f, points: [...(f.points ?? []), ...added] } : f)) }), `pt-paste:${added[0].id}`);
    },
    [change],
  );

  const updateDataPoint = useCallback(
    (seriesId: string, pointId: string, patch: Partial<Pick<DataPoint, "x" | "y">>) => {
      change((c) => ({ ...c, functions: c.functions.map((f) => (f.id === seriesId ? { ...f, points: (f.points ?? []).map((p) => (p.id === pointId ? { ...p, ...patch } : p)) } : f)) }), `pt:${pointId}:${Object.keys(patch).sort().join(",")}`);
    },
    [change],
  );

  const removeDataPoint = useCallback(
    (seriesId: string, pointId: string) => {
      change((c) => ({ ...c, functions: c.functions.map((f) => (f.id === seriesId ? { ...f, points: (f.points ?? []).filter((p) => p.id !== pointId) } : f)) }), `pt-remove:${pointId}`);
    },
    [change],
  );

  // ---- annotations ----

  // A click on the paper with an annotation tool in hand. Returns whether one was made (a tangent needs a curve).
  const placeAnnotation = useCallback(
    (type: AnnotationType, point: PlacePoint): boolean => {
      const a = newAnnotation(type, point, config);
      if (!a) return false;
      change((c) => ({ ...c, annotations: [...c.annotations, a] }), `add:${a.id}`);
      setSelection({ kind: "annotation", id: a.id });
      setTool(null);
      return true;
    },
    [config, change],
  );

  const updateAnnotation = useCallback(
    (id: string, patch: Partial<GraphAnnotation>) => {
      change((c) => ({ ...c, annotations: c.annotations.map((a) => (a.id === id ? { ...a, ...patch } : a)) }), `anno:${id}:${Object.keys(patch).sort().join(",")}`);
    },
    [change],
  );

  // Dragging a handle of the selected annotation to graph (x, y): it lands on the fine grid of each axis (a sheet has a scale for each).
  const dragHandle = useCallback(
    (id: string, role: Handle["role"], x: number, y: number) => {
      const a = config.annotations.find((n) => n.id === id);
      const patch = a && moveHandle(a, role, x, y, snap ? { x: axisSteps(config, "x").minor, y: axisSteps(config, "y").minor } : null);
      if (patch) updateAnnotation(id, patch);
    },
    [config, snap, updateAnnotation],
  );

  const removeAnnotation = useCallback(
    (id: string) => {
      change((c) => ({ ...c, annotations: c.annotations.filter((a) => a.id !== id) }), `remove:${id}`);
      setSelection((s) => (s?.id === id ? null : s));
    },
    [change],
  );

  // ---- shapes ----

  // A shape chosen in the gallery: the next drag on the paper draws it.
  const pickShape = useCallback((shape: string) => {
    setShapeTool(shape);
    setTool(null);
    setSelection(null);
  }, []);
  const drawShape = useCallback(
    (box: DrawnBox) => {
      if (!shapeTool) return;
      const item = newShapeItem(shapeTool, box);
      change((c) => ({ ...c, shapes: addShape(c.shapes, item) }), `add:${item.id}`);
      setSelection({ kind: "shape", id: item.id });
      setShapeTool(null); // (like PowerPoint: one shape, then the Select tool is back)
    },
    [shapeTool, change],
  );
  const changeShape = useCallback((id: string, patch: ShapePatch, key: string) => change((c) => ({ ...c, shapes: updateShape(c.shapes, id, patch) }), key), [change]);
  const orderShape = useCallback((id: string, order: Order) => change((c) => ({ ...c, shapes: reorderShape(c.shapes, id, order) }), `order:${id}:${Date.now()}`), [change]);
  const duplicateShapeOf = useCallback(
    (id: string) => {
      const { copy } = duplicateShape(config.shapes, id);
      if (!copy) return;
      change((c) => ({ ...c, shapes: addShape(c.shapes, copy) }), `dup:${copy.id}`);
      setSelection({ kind: "shape", id: copy.id });
    },
    [config.shapes, change],
  );
  const removeShapeById = useCallback(
    (id: string) => {
      change((c) => ({ ...c, shapes: removeShape(c.shapes, id) }), `remove:${id}`);
      setSelection((s) => (s?.id === id ? null : s));
    },
    [change],
  );
  const nudgeShape = useCallback(
    (id: string, dx: number, dy: number) => change((c) => ({ ...c, shapes: (c.shapes ?? []).map((s) => (s.id === id ? { ...s, x: s.x + dx, y: s.y + dy } : s)) }), `shape-move:${id}`),
    [change],
  );
  const turnShape = useCallback(
    (id: string, by: number) => {
      const s = (config.shapes ?? []).find((k) => k.id === id);
      if (s && !isLine(s)) changeShape(id, { rotation: ((((s.rotation ?? 0) + by) % 360) + 360) % 360 || undefined }, `shape-turn:${id}:${Date.now()}`);
    },
    [config.shapes, changeShape],
  );

  // ---- starting sheets ----

  // A preset sets the limits, the titles and the steps of both axes (the curves stay); a template puts a whole sheet in place of the
  // paper: its scales, curves and annotations. Each is one step of the Studio's undo.
  const applyPreset = useCallback(
    (preset: GraphPreset) => {
      updateConfig(presetChanges(preset));
    },
    [updateConfig],
  );

  const applyTemplate = useCallback(
    (template: GraphTemplate, maxWidth?: number) => {
      const next = instantiateTemplate(template, config, maxWidth);
      change(() => next, `template:${template.id}`);
      setSelection(null);
      setTool(null);
    },
    [config, change],
  );

  const undoStep = useCallback(() => setHistory(undo), []);
  const redoStep = useCallback(() => setHistory(redo), []);
  const issues = useMemo(() => configIssues(config), [config]);
  const masked = config.functions.filter((f) => f.hidden).length + config.annotations.filter((a) => a.hidden).length;
  const handles = useMemo(() => (selectedAnnotation ? handlesOf(selectedAnnotation, config) : []), [selectedAnnotation, config]);

  return {
    config,
    updateConfig,
    issues,
    selected: selectedFunction,
    selectedAnnotation,
    selectedShape,
    selectShape,
    shapeTool,
    pickShape,
    drawShape,
    changeShape,
    orderShape,
    duplicateShapeOf,
    removeShapeById,
    nudgeShape,
    turnShape,
    handles,
    selectFunction,
    selectAnnotation,
    tool,
    pickTool,
    view,
    setView,
    masked,
    addSeries,
    addDataPoint,
    addDataPoints,
    updateDataPoint,
    removeDataPoint,
    snap,
    setSnap,
    applyPreset,
    applyTemplate,
    addFunction,
    updateFunction,
    removeFunction,
    placeAnnotation,
    updateAnnotation,
    dragHandle,
    removeAnnotation,
    undo: undoStep,
    redo: redoStep,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    dirty: isDirty(history),
  };
}

export type GraphStudioState = ReturnType<typeof useGraphStudio>;
