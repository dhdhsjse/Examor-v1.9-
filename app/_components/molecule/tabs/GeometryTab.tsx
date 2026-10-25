"use client";

import { useT } from "@/app/_lib/uiLang";
import type { Selection } from "@/app/_molecule/edit/select";
import type { MoleculeBlockData } from "@/app/_molecule/model";
import { cramCenters } from "@/app/_molecule/render/cram";
import VseprPanel from "../VseprPanel";

interface Props {
  block: MoleculeBlockData;
  selection: Selection;
  onInsertText: (text: string) => void;
  onToggleCenter: (atomId: string) => void;
}

// The shape around an atom (VSEPR), with the sentence that justifies it, ready to paste in the exam.
export default function GeometryTab({ block, selection, onInsertText, onToggleCenter }: Props) {
  const t = useT();
  const cram = block.representation === "cram";
  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-subtle px-3.5 py-3 text-xs leading-relaxed text-muted">
        {cram ? t("Wedges and hashes are drawn around the Cram centres (dashed rings). Click an atom to choose another.") : t("Click an atom to see the shape of the molecule around it and the sentence that justifies it.")}
      </p>
      <VseprPanel block={block} selection={selection} onInsertText={onInsertText} cram={cram ? { isCenter: (id) => cramCenters(block).includes(id), onToggle: onToggleCenter } : undefined} />
    </div>
  );
}
