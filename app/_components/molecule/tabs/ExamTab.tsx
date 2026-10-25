"use client";

import { Eye, EyeOff, RotateCcw, SquareDashed } from "lucide-react";
import { useT } from "@/app/_lib/uiLang";
import { setDisplayOrder, setHideAllHydrogens, setLabel } from "@/app/_molecule/edit/ops";
import { applyVisibility, changedParts } from "@/app/_molecule/edit/selectionOps";
import { count, isEmpty } from "@/app/_molecule/edit/select";
import { emptyEdits, type MoleculeBlockData, type Visibility } from "@/app/_molecule/model";
import PreviewStrip from "../PreviewStrip";
import type { MoleculeEditor } from "../useMoleculeEditor";
import { ActionButton, Group } from "../ui";

interface Props {
  block: MoleculeBlockData;
  editor: MoleculeEditor;
  labelInput: React.RefObject<HTMLInputElement | null>;
}

// Preparing the exam: choose what the student does not see. The answer key always shows everything.
export default function ExamTab({ block, editor, labelInput }: Props) {
  const t = useT();
  const { selection: sel, apply } = editor;
  const none = isEmpty(sel);
  const changed = changedParts(block);
  const firstAtom = sel.atoms[0] ? block.graph.atoms.find((a) => a.id === sel.atoms[0]) : undefined;
  const label = firstAtom ? block.edits.atoms[firstAtom.id]?.label : undefined;
  const setVis = (v: Visibility) => apply((b) => applyVisibility(b, sel, v), "visibility");

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-xl bg-accent-soft px-3.5 py-3 text-xs leading-relaxed text-accent-strong">
        {t("Hide parts of the molecule for the student. The answer key always shows everything.")}
      </p>

      <Group title={t("1. Choose what to hide")} hint={none ? t("Click atoms, bonds or lone pairs on the drawing. Shift-click adds to the selection.") : undefined}>
        <p className="text-xs font-medium text-ink" data-testid="selection-count">
          {none ? t("Nothing selected") : t("{n} selected", { n: count(sel) })}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <ActionButton icon={<EyeOff size={14} />} label={t("Hide")} hint={t("Hide in the student version")} shortcut="H" onClick={() => setVis("hidden")} disabled={none} />
          <ActionButton icon={<SquareDashed size={14} />} label={t("Blank")} hint={t("Leave an empty box for the student to fill")} shortcut="B" onClick={() => setVis("blank")} disabled={none || (!sel.atoms.length && !sel.bonds.length)} />
          <ActionButton icon={<Eye size={14} />} label={t("Show")} hint={t("Show it again")} shortcut="S" onClick={() => setVis("shown")} disabled={none} />
        </div>
        <label className="flex items-center gap-2 text-xs text-ink">
          <input type="checkbox" className="accent-indigo-600" checked={!!block.edits.hideAllHydrogens} onChange={(e) => apply((b) => setHideAllHydrogens(b, e.target.checked))} />
          {t("Hide all hydrogens")}
        </label>
      </Group>

      {sel.atoms.length > 0 && (
        <Group title={t("Text instead of the atom")} hint={t("For example a question mark, or an empty box.")}>
          <div className="flex gap-1.5">
            <input
              ref={labelInput}
              value={label ?? ""}
              placeholder={firstAtom?.element}
              onChange={(e) => apply((b) => setLabel(b, sel.atoms, e.target.value), "label")}
              aria-label={t("Text instead of the atom")}
              className="min-w-0 flex-1 rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent"
              style={{ userSelect: "text" }}
            />
            <ActionButton icon={<SquareDashed size={14} />} label={t("Empty box")} onClick={() => apply((b) => setLabel(b, sel.atoms, ""))} iconOnly />
            <ActionButton icon={<RotateCcw size={14} />} label={t("Back to the atom")} onClick={() => apply((b) => setLabel(b, sel.atoms, undefined))} disabled={label === undefined} iconOnly />
          </div>
        </Group>
      )}

      {sel.bonds.length > 0 && (
        <Group title={t("Draw the bond as")}>
          <div className="flex flex-wrap gap-1.5">
            {([1, 2, 3] as const).map((o) => (
              <ActionButton key={o} label={o === 1 ? "—" : o === 2 ? "=" : "≡"} onClick={() => apply((b) => setDisplayOrder(b, sel.bonds, o))} />
            ))}
            <ActionButton label={t("As it is")} onClick={() => apply((b) => setDisplayOrder(b, sel.bonds, undefined))} />
          </div>
        </Group>
      )}

      <Group title={t("2. Check both versions")}>
        <PreviewStrip block={block} vertical />
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted" data-testid="changed-count">
            {changed ? t("{n} parts changed in the student version", { n: changed }) : t("Nothing is hidden yet: both versions are the same.")}
          </p>
          {changed > 0 && <ActionButton icon={<RotateCcw size={13} />} label={t("Show everything again")} onClick={() => apply((b) => ({ ...b, edits: emptyEdits() }))} />}
        </div>
      </Group>
    </div>
  );
}
