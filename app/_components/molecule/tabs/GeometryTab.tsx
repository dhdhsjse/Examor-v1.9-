"use client";

import Disclosure from "@/app/_components/graph-studio/Disclosure";
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

// The shape around an atom (VSEPR), with the sentence that justifies it, ready to put in the exam. On the Cram drawing, it also chooses
// which atoms are drawn in perspective.
export default function GeometryTab({ block, selection, onInsertText, onToggleCenter }: Props) {
  const t = useT();
  const cram = block.representation === "cram";
  return (
    // (closed at first; on the Cram drawing it is where the centres are chosen, so it is open)
    <Disclosure key={cram ? "cram" : "other"} title={t("Geometry")} testId="molecule-geometry" defaultOpen={cram}>
      <VseprPanel block={block} selection={selection} onInsertText={onInsertText} cram={cram ? { isCenter: (id) => cramCenters(block).includes(id), onToggle: onToggleCenter } : undefined} />
    </Disclosure>
  );
}
