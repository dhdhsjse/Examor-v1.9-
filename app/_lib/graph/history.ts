// Undo and redo of the Graph Studio's configuration. Typing in one field is one step, not one per key: edits of the same
// field made within COALESCE_MS of each other replace each other. Pure functions (no React), unit-tested.
import type { GraphConfig } from "./types";

export const COALESCE_MS = 800;
const LIMIT = 100;

export type GraphHistory = {
  past: GraphConfig[];
  present: GraphConfig;
  future: GraphConfig[];
  /** What it was opened with: the Studio is "dirty" when the present is not that */
  start: GraphConfig;
  /** The field of the last edit and when it was made, to merge a quick series of edits */
  last: { key: string; at: number } | null;
};

export const startHistory = (config: GraphConfig): GraphHistory => ({ past: [], present: config, future: [], start: config, last: null });

// (the curves and annotations are compared by what they hold: an edit that sets a value to itself is not a step)
const same = (a: GraphConfig, b: GraphConfig) => (Object.keys(a) as (keyof GraphConfig)[]).every((k) => (k === "functions" || k === "annotations" ? JSON.stringify(a[k]) === JSON.stringify(b[k]) : a[k] === b[k]));

/** `next` is the new configuration; `key` names the field(s) changed ("" = never merged). The same configuration back is not a step. */
export function edit(h: GraphHistory, next: GraphConfig, key: string, now: number): GraphHistory {
  if (same(h.present, next)) return h;
  const merge = key !== "" && h.last?.key === key && now - h.last.at < COALESCE_MS && h.past.length > 0;
  const past = merge ? h.past : [...h.past, h.present].slice(-LIMIT);
  return { ...h, past, present: next, future: [], last: { key, at: now } };
}

export function undo(h: GraphHistory): GraphHistory {
  if (!h.past.length) return h;
  return { ...h, past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], last: null };
}

export function redo(h: GraphHistory): GraphHistory {
  if (!h.future.length) return h;
  return { ...h, past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1), last: null };
}

export const canUndo = (h: GraphHistory) => h.past.length > 0;
export const canRedo = (h: GraphHistory) => h.future.length > 0;
export const isDirty = (h: GraphHistory) => !same(h.present, h.start);
