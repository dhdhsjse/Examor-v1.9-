"use client";

import { useEffect, useState } from "react";
import { buildBlock } from "@/app/_molecule/block";
import type { ChemEngine } from "@/app/_molecule/engine/ChemEngine";
import type { RenderOptions } from "@/app/_molecule/model";
import { renderMolecule } from "@/app/_molecule/render";

export interface PreviewItem {
  key: string;
  smiles: string;
}

// Small drawings (SVG) of a list of molecules, made one after the other as they come into the list.
export function usePreviews(engine: ChemEngine | null, items: PreviewItem[], lang: RenderOptions["lang"], size = { bondLength: 34, fontSize: 15 }): Record<string, string> {
  const [pictures, setPictures] = useState<Record<string, string>>({});
  const signature = items.map((i) => `${i.key}=${i.smiles}`).join("|");
  useEffect(() => {
    if (!engine) return;
    let alive = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const it of items) {
        try {
          const b = await buildBlock(engine, { id: it.key, smiles: it.smiles, formula: "", names: {}, source: "local-db", rank: 0 }, { kind: "smiles", input: it.smiles }, lang);
          next[it.key] = renderMolecule({ ...b, options: { ...b.options, ...size } }).svg;
        } catch {
          // a molecule that cannot be drawn is listed without a picture
        }
        if (!alive) return;
      }
      if (alive) setPictures((p) => ({ ...p, ...next }));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, signature, lang, size.bondLength, size.fontSize]);
  return pictures;
}
