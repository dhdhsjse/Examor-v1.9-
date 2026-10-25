// Undo and redo for the drawing Studio: the whole graph is kept after each step (a drawing is small), so a
// step can never be half undone. Pure functions; the Studio's state hook only stores the result.
//
// A *gesture* is something that changes the graph many times but is one step for the teacher: dragging an
// atom, or placing a text and typing it. It takes the snapshot once, when it begins; the edits inside it
// do not take more. A gesture that ends exactly as it began (a text placed and then given up) leaves no step.
import type { MoleculeGraph } from "./types";

export const HISTORY_LIMIT = 100;

export type History = {
  graph: MoleculeGraph;
  /** The graphs before each step, oldest first. */
  past: MoleculeGraph[];
  /** The graphs undone, the next redo first. */
  future: MoleculeGraph[];
  /** A gesture is open: edits change `graph` without a snapshot of their own. */
  gesture: boolean;
  /** The redo steps a gesture has set aside (its first change forgets them); given back if it ends where it began. */
  held: MoleculeGraph[] | null;
};

export const startHistory = (graph: MoleculeGraph): History => ({ graph, past: [], future: [], gesture: false, held: null });

export const canUndo = (h: History) => h.past.length > 0;
export const canRedo = (h: History) => h.future.length > 0;
/** The drawing has been changed since it was opened (so closing it would lose something). */
export const isDirty = (h: History) => h.past.length > 0;

const keep = (past: MoleculeGraph[]) => (past.length > HISTORY_LIMIT ? past.slice(past.length - HISTORY_LIMIT) : past);
const same = (a: MoleculeGraph, b: MoleculeGraph) => a === b || JSON.stringify(a) === JSON.stringify(b);

/** `next` is the graph after an edit. The same graph (an edit that did nothing) is not a step. */
export function edit(h: History, next: MoleculeGraph): History {
  if (next === h.graph) return h;
  if (h.gesture) return { ...h, graph: next, future: [] }; // the first real change of a gesture is what forgets the redo steps
  return { graph: next, past: keep([...h.past, h.graph]), future: [], gesture: false, held: null };
}

export function beginGesture(h: History): History {
  if (h.gesture) return h;
  // (the redo steps stay until the gesture changes something, and come back if it ends where it began)
  return { ...h, gesture: true, past: keep([...h.past, h.graph]), held: h.future };
}

export function endGesture(h: History): History {
  if (!h.gesture) return h;
  const start = h.past[h.past.length - 1];
  const unchanged = start !== undefined && same(start, h.graph);
  return { ...h, gesture: false, past: unchanged ? h.past.slice(0, -1) : h.past, future: unchanged && h.held ? h.held : h.future, held: null };
}

export function undo(h: History): History {
  if (!h.past.length) return h;
  return { graph: h.past[h.past.length - 1], past: h.past.slice(0, -1), future: [h.graph, ...h.future], gesture: false, held: null };
}

export function redo(h: History): History {
  if (!h.future.length) return h;
  return { graph: h.future[0], past: keep([...h.past, h.graph]), future: h.future.slice(1), gesture: false, held: null };
}
