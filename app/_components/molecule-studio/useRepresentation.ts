"use client";

import { useEffect, useMemo, useState } from "react";
import type { StudioView } from "@/app/_lib/chemistry/masking";
import { drawingToMolfile } from "@/app/_lib/chemistry/molfile";
import { makeRepresentation, type RepresentationNote } from "@/app/_lib/chemistry/representation";
import type { MoleculeGraph } from "@/app/_lib/chemistry/types";
import { useUi } from "@/app/_lib/uiLang";
import { getBrowserEngine } from "@/app/_molecule/engine/loadBrowser";
import type { MoleculeBlockData, Representation } from "@/app/_molecule/model";

export { drawingToMolfile };
export type { RepresentationNote };

export type RepresentationPreview = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; block: MoleculeBlockData; svg: string; notes: RepresentationNote[] };

const IDLE: RepresentationPreview = { status: "idle" };
const LOADING: RepresentationPreview = { status: "loading" };

// The drawing in one of the school representations (brute, semi-structural, structural, skeletal, Lewis, Cram), made by the
// generator's engine and renderers (see _lib/chemistry/representation.ts). `rep` null = the drawing itself: nothing is computed.
export function useRepresentation(graph: MoleculeGraph, rep: Representation | null, view: StudioView = "teacher"): RepresentationPreview {
  const { lang } = useUi();
  const empty = graph.atoms.length === 0;
  const key = useMemo(() => ({ graph, rep, view, lang }), [graph, rep, view, lang]);
  const [done, setDone] = useState<{ key: typeof key; preview: RepresentationPreview } | null>(null);

  useEffect(() => {
    if (!rep || empty) return;
    let alive = true;
    (async () => {
      let preview: RepresentationPreview;
      try {
        preview = { status: "ready", ...(await makeRepresentation(graph, rep, view, lang, getBrowserEngine())) };
      } catch (e) {
        preview = { status: "error", message: e instanceof Error ? e.message : String(e) };
      }
      if (alive) setDone({ key, preview });
    })();
    return () => {
      alive = false;
    };
  }, [key, graph, rep, empty, view, lang]);

  if (!rep || empty) return IDLE;
  if (done?.key === key) return done.preview;
  // (while the next one is made, the last one of the same representation stays: no flicker on every edit)
  return done?.preview.status === "ready" && done.key.rep === rep ? done.preview : LOADING;
}
