"use client";

import { useCallback, useMemo, useState } from "react";
import { canRedo, canUndo, commit, createHistory, redo, undo, type History } from "@/app/_molecule/edit/history";
import { emptySelection, prune, type Selection } from "@/app/_molecule/edit/select";
import type { MoleculeBlockData, MolGraph, MoleculeEdits, Representation, RenderOptions } from "@/app/_molecule/model";

// What the Studio's undo history remembers: the molecule and what is hidden. The representation, the options
// and the insert mode are not edits of the molecule: undo leaves them as they are.
interface Core {
  graph: MolGraph;
  edits: MoleculeEdits;
}

type View = Pick<MoleculeBlockData, "representation" | "options" | "exerciseMode">;
type Base = Pick<MoleculeBlockData, "schema" | "source" | "smiles" | "geometryCenters">;

interface State {
  history: History<Core> | null;
  base: Base | null;
  view: View | null;
  selection: Selection;
}

const EMPTY: State = { history: null, base: null, view: null, selection: emptySelection() };

// The molecule being edited in the Studio: its history, its selection and its view settings.
export function useMoleculeEditor(initial: MoleculeBlockData | null) {
  const [state, setState] = useState<State>(() => (initial ? fromBlock(initial) : EMPTY));

  const block = useMemo<MoleculeBlockData | null>(() => {
    if (!state.history || !state.base || !state.view) return null;
    return { ...state.base, ...state.view, graph: state.history.present.graph, edits: state.history.present.edits };
  }, [state]);

  // A molecule that was just looked up: a fresh history, the teacher's view settings are kept.
  const load = useCallback((next: MoleculeBlockData, keepView: boolean) => {
    setState((cur) => {
      const fresh = fromBlock(next);
      return keepView && cur.view ? { ...fresh, view: cur.view } : fresh;
    });
  }, []);

  // One edit (visibility or structural). Edits with the same `key` in quick succession are one undo step (a drag).
  const apply = useCallback((fn: (b: MoleculeBlockData) => MoleculeBlockData, key?: string) => {
    setState((cur) => {
      if (!cur.history || !cur.base || !cur.view) return cur;
      const before: MoleculeBlockData = { ...cur.base, ...cur.view, graph: cur.history.present.graph, edits: cur.history.present.edits };
      const after = fn(before);
      if (after === before) return cur;
      return { ...cur, history: commit(cur.history, { graph: after.graph, edits: after.edits }, key) };
    });
  }, []);

  const setView = useCallback((patch: Partial<View>) => setState((cur) => (cur.view ? { ...cur, view: { ...cur.view, ...patch } } : cur)), []);
  const setOptions = useCallback((patch: Partial<RenderOptions>) => setState((cur) => (cur.view ? { ...cur, view: { ...cur.view, options: { ...cur.view.options, ...patch } } } : cur)), []);
  const setRepresentation = useCallback((representation: Representation) => setView({ representation }), [setView]);
  const setSmiles = useCallback((smiles: string) => setState((cur) => (cur.base ? { ...cur, base: { ...cur.base, smiles } } : cur)), []);
  // The atoms drawn in perspective on a Cram drawing (a choice of the drawing, like the representation: not in the undo history).
  const setCenters = useCallback((geometryCenters: string[]) => setState((cur) => (cur.base ? { ...cur, base: { ...cur.base, geometryCenters } } : cur)), []);
  const setSelection = useCallback((selection: Selection) => setState((cur) => ({ ...cur, selection })), []);
  const doUndo = useCallback(() => setState((cur) => (cur.history ? { ...cur, history: undo(cur.history) } : cur)), []);
  const doRedo = useCallback(() => setState((cur) => (cur.history ? { ...cur, history: redo(cur.history) } : cur)), []);

  // What an undo, a deletion or a new molecule removed is no longer selected.
  const selection = useMemo(() => (block ? prune(state.selection, block.graph) : emptySelection()), [state.selection, block]);

  return {
    block,
    selection,
    setSelection,
    load,
    apply,
    setView,
    setOptions,
    setRepresentation,
    setSmiles,
    setCenters,
    undo: doUndo,
    redo: doRedo,
    canUndo: !!state.history && canUndo(state.history),
    canRedo: !!state.history && canRedo(state.history),
  };
}

function fromBlock(b: MoleculeBlockData): State {
  return {
    history: createHistory<Core>({ graph: b.graph, edits: b.edits }),
    base: { schema: b.schema, source: b.source, smiles: b.smiles, geometryCenters: b.geometryCenters },
    view: { representation: b.representation, options: b.options, exerciseMode: b.exerciseMode },
    selection: emptySelection(),
  };
}

export type MoleculeEditor = ReturnType<typeof useMoleculeEditor>;
