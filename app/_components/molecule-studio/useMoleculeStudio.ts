"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { ShapePatch } from "@/app/_components/shapes/StudioShapes";
import { addShape, duplicateShape, isLine, newShapeItem, removeShape, reorderShape, updateShape, type DrawnBox, type Order } from "@/app/_lib/shapes";
import { COALESCE_MS } from "@/app/_lib/studioHistory";
import { FRAGMENTS, attachFragment, placeFragment, type FragmentId } from "@/app/_lib/chemistry/fragments";
import {
  addAnnotationTo,
  addAtom as withAtom,
  addBondedAtom,
  claimAtom,
  connectAtoms,
  connectedAtomIds,
  cycleBond,
  makeAnnotation,
  makeAtom,
  moveAtom as withMovedAtom,
  placeRing,
  removeAnnotation,
  removeAtomAndHydrogens,
  removeBond,
  setBondType,
  translateAtoms,
  updateAnnotation as withUpdatedAnnotation,
} from "@/app/_lib/chemistry/graphOps";
import { beginGesture, canRedo, canUndo, edit as editHistory, endGesture, isDirty, redo, startHistory, undo, type History } from "@/app/_lib/chemistry/history";
import {
  EMPTY_SELECTION,
  copySelection,
  deleteSelection,
  only,
  pasteClipboard,
  prune,
  reverseBonds,
  selectAll,
  setBondTypes,
  setCharge,
  setElement,
  setMaskText,
  setMasked,
  setPairs,
  setPairsHidden,
  stepPairs,
  toggle,
  translateGroup,
  type Clipboard,
  type Selection,
  type SelectionKind,
} from "@/app/_lib/chemistry/selection";
import { placeElectron, removeElectron, removeElectronNear } from "@/app/_lib/chemistry/electrons";
import { movePair, pinPairs, placePair, removePair, removePairNear, type PairMark } from "@/app/_lib/chemistry/lonePairs";
import type { StudioView } from "@/app/_lib/chemistry/masking";
import type { Representation } from "@/app/_molecule/model";
import type { BondType, CanvasAnnotation, HydrogenMode, LonePairMode, MoleculeGraph, RingSpec, StudioTool } from "@/app/_lib/chemistry/types";
import { applyHydrogenMode, changeHydrogenMode, fillHydrogens, hydrogenModeOf } from "@/app/_lib/chemistry/valence";

export type { StudioTool };

// The element of the atom at the end of a bond drawn into empty space.
const NEW_ATOM_ELEMENT = "C";

// The Studio's own state: the graph being drawn, the tool, what is drawn with (element, bond, ring, group)
// and the selection. It is local on purpose: nothing here reaches the exam's undo history. The graph only
// goes to the page when the teacher inserts it. The edits themselves are pure functions in _lib/chemistry/.
// Every edit of the molecule goes through applyHydrogenMode (valence.ts). In the "auto" mode the hydrogens each atom
// still needs are remade after it, so they follow a moved atom, and a bond or a group that takes valence takes a
// hydrogen. In "manual" (the default of a new drawing) and "labels" nothing is added: the teacher draws every bond.
// Texts and arrows are not part of the molecule: editing them does not touch the hydrogens.
// Undo and redo are the Studio's own too (history.ts): a drag, or a text placed and typed, is one step.
export function useMoleculeStudio(initialGraph: MoleculeGraph) {
  const [history, setHistory] = useState<History>(() => startHistory(applyHydrogenMode(initialGraph)));
  const graph = history.graph;
  const [activeTool, setActiveTool] = useState<StudioTool>("select");
  const [activeElement, setActiveElement] = useState<string>("C");
  const [activeBondType, setActiveBondType] = useState<BondType>("single");
  const [activeRing, setActiveRing] = useState<RingSpec>({ sides: 6, isAromatic: false });
  const [activeTemplate, setActiveTemplate] = useState<FragmentId>("oh");
  const [picked, setPicked] = useState<Selection>(EMPTY_SELECTION);
  const [shapeId, setShapeId] = useState<string | null>(null); // the selected shape (when one is, nothing else is)
  const [shapeKind, setShapeKind] = useState("rect"); // the shape the Shapes tool draws
  const lastShapeEdit = useRef<{ key: string; at: number } | null>(null);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);
  // How the drawing is looked at (neither is an edit, so neither is in the undo history): the teacher's or the student's
  // view of it (the masks applied), and the drawing itself (null) or one of the school representations made from it.
  const [studioView, setStudioView] = useState<StudioView>("teacher");
  const [representation, setRepresentation] = useState<Representation | null>(null);
  const pastes = useRef(0); // how many times the clipboard was pasted: each copy goes a bit further, not on top of the last

  // Atoms, bonds, texts and arrows can be selected together. What is gone (deleted, or a hydrogen that is no
  // longer needed) is no longer selected.
  const selection = useMemo(() => prune(picked, graph), [picked, graph]);
  const select = useCallback((next: Selection) => {
    setPicked(next);
    setShapeId(null);
  }, []);
  const selectOnly = useCallback((kind: SelectionKind, id: string) => {
    setPicked(only(kind, id));
    setShapeId(null);
  }, []);
  const toggleSelected = useCallback((kind: SelectionKind, id: string) => {
    setPicked((s) => toggle(s, kind, id));
    setShapeId(null);
  }, []);
  const clearSelection = useCallback(() => {
    setPicked(EMPTY_SELECTION);
    setShapeId(null);
  }, []);
  const selectedShape = shapeId ? ((graph.shapes ?? []).find((s) => s.id === shapeId) ?? null) : null; // (what undo took away is no longer selected)

  // An edit that changes nothing (the same graph back) is not a step.
  const apply = useCallback(
    (change: (g: MoleculeGraph) => MoleculeGraph, remakeHydrogens: boolean) =>
      setHistory((h) => {
        const next = change(h.graph);
        return next === h.graph ? h : editHistory(h, remakeHydrogens ? applyHydrogenMode(next) : next);
      }),
    [],
  );
  const edit = useCallback((change: (g: MoleculeGraph) => MoleculeGraph) => apply(change, true), [apply]);
  const editNotes = useCallback((change: (g: MoleculeGraph) => MoleculeGraph) => apply(change, false), [apply]);

  // A gesture (a drag, a text being typed) is one step of the history, however many edits it makes.
  const startGesture = useCallback(() => setHistory(beginGesture), []);
  const finishGesture = useCallback(() => setHistory(endGesture), []);

  const undoStep = useCallback(() => setHistory(undo), []);
  const redoStep = useCallback(() => setHistory(redo), []);

  // Replaces the whole drawing (another starting point); the history and the selection belonged to the old one.
  const loadGraph = useCallback((next: MoleculeGraph) => {
    setHistory(startHistory(applyHydrogenMode(next)));
    setPicked(EMPTY_SELECTION);
    setShapeId(null);
  }, []);

  // ---- hydrogens ----

  // The mode is part of the drawing (the page needs it to draw the labels), so changing it is a step of the undo.
  const setHydrogenMode = useCallback((mode: HydrogenMode) => editNotes((g) => changeHydrogenMode(g, mode)), [editNotes]);
  // Adds the missing hydrogens once, as atoms of the teacher's (manual mode).
  const addMissingHydrogens = useCallback(() => editNotes(fillHydrogens), [editNotes]);

  // ---- lone pairs ----

  // How the lone pairs are written (off, dots, bars): part of the drawing, like the hydrogen mode.
  const setLonePairMode = useCallback((mode: LonePairMode) => editNotes((g) => (g.lonePairs === mode ? g : { ...g, lonePairs: mode })), [editNotes]);
  const stepPairsOf = useCallback((ids: readonly string[], delta: number) => editNotes((g) => stepPairs(g, ids, delta)), [editNotes]);
  const setPairsOf = useCallback((ids: readonly string[], pairs: number | undefined) => editNotes((g) => setPairs(g, ids, pairs)), [editNotes]);
  const setPairsHiddenOf = useCallback((ids: readonly string[], hidden: boolean) => editNotes((g) => setPairsHidden(g, ids, hidden)), [editNotes]);
  // Pairs put by hand (see lonePairs.ts): a click beside an atom, a click on a pair, a pair dragged round its atom (one step of the undo).
  const placePairAt = useCallback((id: string, deg: number) => editNotes((g) => placePair(g, id, deg)), [editNotes]);
  const removePairNearOf = useCallback((id: string, deg: number) => editNotes((g) => removePairNear(g, id, deg)), [editNotes]);
  const removePairOf = useCallback((id: string, mark: PairMark) => editNotes((g) => removePair(g, id, mark)), [editNotes]);
  const grabPair = useCallback(
    (id: string) => {
      startGesture();
      editNotes((g) => pinPairs(g, id)); // (the other pairs of the atom stay where they are drawn while one is moved)
    },
    [startGesture, editNotes],
  );
  // Single electrons (electrons.ts): a click beside an atom, a click on a dot.
  const placeElectronAt = useCallback((id: string, deg: number) => editNotes((g) => placeElectron(g, id, deg)), [editNotes]);
  const removeElectronNearOf = useCallback((id: string, deg: number) => editNotes((g) => removeElectronNear(g, id, deg)), [editNotes]);
  const removeElectronOf = useCallback((id: string, index: number) => editNotes((g) => removeElectron(g, id, index)), [editNotes]);
  const turnPair = useCallback((id: string, index: number, deg: number) => editNotes((g) => movePair(g, id, index, deg)), [editNotes]);
  // Every atom's pairs worked out from its valence and placed automatically (what was put by hand goes), and written.
  const writeAllPairs = useCallback(
    () =>
      editNotes((g) => {
        const all = setPairs(g, g.atoms.map((a) => a.id), undefined);
        return all.lonePairs && all.lonePairs !== "off" ? all : { ...all, lonePairs: "dots" };
      }),
    [editNotes],
  );

  // ---- atoms ----

  const addAtom = useCallback(
    (x: number, y: number) => {
      const atom = makeAtom(activeElement, x, y);
      edit((g) => withAtom(g, atom));
      return atom.id;
    },
    [activeElement, edit],
  );

  const moveAtom = useCallback((id: string, x: number, y: number) => edit((g) => withMovedAtom(g, id, x, y)), [edit]);

  // Moves a whole molecule (or ring) by (dx, dy): every atom reachable from `id` through bonds.
  const moveMolecule = useCallback((ids: ReadonlySet<string>, dx: number, dy: number) => edit((g) => translateAtoms(g, ids, dx, dy)), [edit]);
  const moleculeOf = useCallback((id: string) => connectedAtomIds(graph, id), [graph]);

  // Taking hold of an automatic hydrogen makes it the teacher's: it stays where it is dropped.
  const claim = useCallback((id: string) => edit((g) => claimAtom(g, id)), [edit]);

  // Moves atoms and texts together by (dx, dy): a group of the selection.
  const moveGroup = useCallback((atomIds: ReadonlySet<string>, noteIds: ReadonlySet<string>, dx: number, dy: number) => edit((g) => translateGroup(g, atomIds, noteIds, dx, dy)), [edit]);

  // Removes the atom and its bonds, and the hydrogens that hung on it alone; a selection on it goes with it.
  const deleteAtom = useCallback((id: string) => edit((g) => removeAtomAndHydrogens(g, id)), [edit]);

  const pickElement = useCallback((symbol: string) => {
    setActiveElement(symbol);
    setActiveTool("atom");
  }, []);

  // ---- bonds ----

  const pickBond = useCallback((type: BondType) => {
    setActiveBondType(type);
    setActiveTool("bond");
  }, []);

  // Two atoms are never bonded twice: bonding them again gives the existing bond the active type.
  const addBond = useCallback((sourceId: string, targetId: string) => edit((g) => connectAtoms(g, sourceId, targetId, activeBondType)), [activeBondType, edit]);

  // A bond drawn into empty space: a new carbon at (x, y), bonded to the atom it started from.
  const addBondedCarbon = useCallback((sourceId: string, x: number, y: number) => edit((g) => addBondedAtom(g, sourceId, NEW_ATOM_ELEMENT, x, y, activeBondType)), [activeBondType, edit]);

  const cycleBondType = useCallback((bondId: string) => edit((g) => cycleBond(g, bondId)), [edit]);
  const setTypeOfBond = useCallback((bondId: string, type: BondType) => edit((g) => setBondType(g, bondId, type)), [edit]);
  const deleteBond = useCallback((bondId: string) => edit((g) => removeBond(g, bondId)), [edit]);

  // ---- rings and groups ----

  const pickRing = useCallback((ring: RingSpec) => {
    setActiveRing(ring);
    setActiveTool("ring");
  }, []);

  // One ring at a time: the tool goes back to Select, so that the ring just placed can be moved.
  const addRing = useCallback(
    (x: number, y: number) => {
      edit((g) => placeRing(g, activeRing, x, y));
      setActiveTool("select");
    },
    [activeRing, edit],
  );

  const pickTemplate = useCallback((id: FragmentId) => {
    setActiveTemplate(id);
    setActiveTool("template");
  }, []);

  // The group goes on an atom (on a hydrogen: in its place), or on its own where the paper is clicked.
  const attachTemplate = useCallback((atomId: string) => edit((g) => attachFragment(g, FRAGMENTS[activeTemplate], atomId)), [activeTemplate, edit]);
  const placeTemplate = useCallback((x: number, y: number) => edit((g) => placeFragment(g, FRAGMENTS[activeTemplate], x, y)), [activeTemplate, edit]);

  // ---- texts and arrows ----

  // A new text or arrow, selected; the tool goes back to Select (one at a time, like a ring).
  const addAnnotation = useCallback(
    (type: CanvasAnnotation["type"], x: number, y: number) => {
      const note = makeAnnotation(type, x, y);
      startGesture(); // placing it and typing its text are one step; the editor ends it with finishGesture
      editNotes((g) => addAnnotationTo(g, note));
      setPicked(only("notes", note.id));
      setActiveTool("select");
      return note.id;
    },
    [editNotes, startGesture],
  );
  const updateAnnotation = useCallback((id: string, patch: Partial<Omit<CanvasAnnotation, "id" | "type">>) => editNotes((g) => withUpdatedAnnotation(g, id, patch)), [editNotes]);
  const deleteAnnotation = useCallback((id: string) => editNotes((g) => removeAnnotation(g, id)), [editNotes]);

  // ---- the selection ----

  const selectEverything = useCallback(() => setPicked(selectAll(graph)), [graph]);
  const deleteSelected = useCallback(() => {
    if (shapeId) {
      editNotes((g) => ({ ...g, shapes: removeShape(g.shapes, shapeId) }));
      setShapeId(null);
    } else edit((g) => deleteSelection(g, selection));
  }, [edit, editNotes, selection, shapeId]);

  // The properties of the selection: the same value for all its atoms or bonds.
  const setElementOf = useCallback((ids: readonly string[], symbol: string) => edit((g) => setElement(g, ids, symbol)), [edit]);
  const setChargeOf = useCallback((ids: readonly string[], charge: number) => edit((g) => setCharge(g, ids, charge)), [edit]);
  const setTypeOfBonds = useCallback((ids: readonly string[], type: BondType) => edit((g) => setBondTypes(g, ids, type)), [edit]);
  // Masking: hidden in the student version, written as `text` there ("" = an empty box / nothing, undefined = the default).
  const setMaskedOf = useCallback((targets: { atoms: readonly string[]; bonds: readonly string[] }, hidden: boolean) => edit((g) => setMasked(g, targets, hidden)), [edit]);
  const setMaskTextOf = useCallback((targets: { atoms: readonly string[]; bonds: readonly string[] }, text: string | undefined) => edit((g) => setMaskText(g, targets, text)), [edit]);
  const reverseBondsOf = useCallback((ids: readonly string[]) => edit((g) => reverseBonds(g, ids)), [edit]);

  // Copy, cut and paste stay in the Studio. Each paste goes 40 units further down and right than the last.
  const copy = useCallback(() => {
    const clip = copySelection(graph, selection);
    if (!clip) return false;
    setClipboard(clip);
    pastes.current = 0;
    return true;
  }, [graph, selection]);
  const cut = useCallback(() => {
    if (!copy()) return;
    edit((g) => deleteSelection(g, selection));
  }, [copy, edit, selection]);
  const paste = useCallback(() => {
    if (!clipboard) return;
    pastes.current += 1;
    const offset = 40 * pastes.current;
    const result = pasteClipboard(graph, clipboard, offset, offset);
    edit(() => result.graph);
    setPicked(result.selection);
    setShapeId(null);
  }, [clipboard, graph, edit]);

  // ---- shapes ----

  // A shape chosen in the gallery: the next drag on the paper draws it.
  const pickShape = useCallback((shape: string) => {
    setShapeKind(shape);
    setActiveTool("shape");
    setPicked(EMPTY_SELECTION);
    setShapeId(null);
  }, []);
  const selectShape = useCallback((id: string) => {
    setPicked(EMPTY_SELECTION);
    setShapeId(id);
  }, []);
  const drawShape = useCallback(
    (box: DrawnBox) => {
      const item = newShapeItem(shapeKind, box);
      editNotes((g) => ({ ...g, shapes: addShape(g.shapes, item) }));
      setPicked(EMPTY_SELECTION);
      setShapeId(item.id);
      setActiveTool("select"); // (like PowerPoint: one shape, then the Select tool is back)
    },
    [shapeKind, editNotes],
  );
  // `key` names what changed: edits of the same thing close together (typing the text, a thickness) are one step of the undo.
  const changeShape = useCallback(
    (id: string, patch: ShapePatch, key: string) => {
      const now = Date.now();
      const merge = lastShapeEdit.current?.key === key && now - lastShapeEdit.current.at < COALESCE_MS;
      lastShapeEdit.current = { key, at: now };
      const change = (g: MoleculeGraph): MoleculeGraph => ({ ...g, shapes: updateShape(g.shapes, id, patch) });
      if (merge) setHistory((h) => (change(h.graph) === h.graph ? h : { ...h, graph: change(h.graph) }));
      else editNotes(change);
    },
    [editNotes],
  );
  const orderShape = useCallback((id: string, order: Order) => editNotes((g) => ({ ...g, shapes: reorderShape(g.shapes, id, order) })), [editNotes]);
  const duplicateShapeOf = useCallback(
    (id: string) => {
      const { copy: dup } = duplicateShape(graph.shapes, id);
      if (!dup) return;
      editNotes((g) => ({ ...g, shapes: addShape(g.shapes, dup) }));
      setShapeId(dup.id);
    },
    [graph.shapes, editNotes],
  );
  const nudgeShape = useCallback((id: string, dx: number, dy: number) => changeShape(id, { x: (graph.shapes ?? []).find((s) => s.id === id)!.x + dx, y: (graph.shapes ?? []).find((s) => s.id === id)!.y + dy }, `shape-move:${id}`), [changeShape, graph.shapes]);
  const turnShape = useCallback(
    (id: string, by: number) => {
      const s = (graph.shapes ?? []).find((k) => k.id === id);
      if (s && !isLine(s)) changeShape(id, { rotation: ((((s.rotation ?? 0) + by) % 360) + 360) % 360 || undefined }, `shape-turn:${id}:${Date.now()}`);
    },
    [graph.shapes, changeShape],
  );

  return {
    graph,
    hydrogenMode: hydrogenModeOf(graph),
    lonePairMode: graph.lonePairs ?? ("off" as LonePairMode),
    setLonePairMode,
    stepPairsOf,
    setPairsOf,
    setPairsHiddenOf,
    placePairAt,
    removePairNearOf,
    removePairOf,
    grabPair,
    turnPair,
    placeElectronAt,
    removeElectronNearOf,
    removeElectronOf,
    writeAllPairs,
    setHydrogenMode,
    addMissingHydrogens,
    activeTool,
    setActiveTool,
    activeElement,
    setActiveElement,
    pickElement,
    activeBondType,
    setActiveBondType,
    pickBond,
    activeRing,
    pickRing,
    activeTemplate,
    pickTemplate,
    selection,
    select,
    selectOnly,
    toggleSelected,
    clearSelection,
    selectedShape,
    shapeKind,
    pickShape,
    selectShape,
    drawShape,
    changeShape,
    orderShape,
    duplicateShapeOf,
    nudgeShape,
    turnShape,
    selectEverything,
    deleteSelected,
    setElementOf,
    setChargeOf,
    setTypeOfBonds,
    reverseBondsOf,
    setMaskedOf,
    setMaskTextOf,
    studioView,
    setStudioView,
    representation,
    setRepresentation,
    copy,
    cut,
    paste,
    canPaste: clipboard !== null,
    addAtom,
    moveAtom,
    moveMolecule,
    moleculeOf,
    claim,
    moveGroup,
    deleteAtom,
    addBond,
    addBondedCarbon,
    cycleBondType,
    setTypeOfBond,
    deleteBond,
    addRing,
    attachTemplate,
    placeTemplate,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    loadGraph,
    startGesture,
    finishGesture,
    undo: undoStep,
    redo: redoStep,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    /** The drawing was changed since it was opened: closing it would lose something. */
    dirty: isDirty(history),
  };
}

export type MoleculeStudioState = ReturnType<typeof useMoleculeStudio>;
