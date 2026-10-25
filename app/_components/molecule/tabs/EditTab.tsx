"use client";

import { Link2, Plus, Trash2 } from "lucide-react";
import { useT } from "@/app/_lib/uiLang";
import { octetIssues } from "@/app/_molecule/chem";
import { addBond, addHydrogen, graphWarnings, replaceElement, setBondOrder } from "@/app/_molecule/edit/ops";
import { removeSelected } from "@/app/_molecule/edit/selectionOps";
import { emptySelection, isEmpty } from "@/app/_molecule/edit/select";
import type { MoleculeBlockData } from "@/app/_molecule/model";
import type { MoleculeEditor } from "../useMoleculeEditor";
import { ActionButton, Group } from "../ui";

const ELEMENTS = ["C", "N", "O", "S", "P", "F", "Cl", "Br", "I"];

interface Props {
  block: MoleculeBlockData;
  editor: MoleculeEditor;
}

// Changing the molecule itself (not only what the student sees): both versions change. Mistakes are warned about,
// never blocked: the teacher knows what the exercise needs.
export default function EditTab({ block, editor }: Props) {
  const t = useT();
  const { selection: sel, apply, setSelection } = editor;
  const g = block.graph;
  const none = isEmpty(sel);
  const atomOf = (id: string) => g.atoms.find((a) => a.id === id);
  const heavy = sel.atoms.filter((id) => atomOf(id)?.element !== "H");
  const elements = new Set(sel.atoms.map((id) => atomOf(id)?.element));
  const firstElement = sel.atoms[0] ? atomOf(sel.atoms[0])?.element : undefined;
  const firstBond = sel.bonds[0] ? g.bonds.find((b) => b.id === sel.bonds[0]) : undefined;
  const warnings = graphWarnings(g);
  const octet = block.representation === "lewis" ? octetIssues(g) : [];
  const elementOf = (id: string) => atomOf(id)?.element ?? "?";

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-xl bg-subtle px-3.5 py-3 text-xs leading-relaxed text-muted">{t("Change the molecule itself. The student version and the answer key both change. Hiding parts for the student is in the Exam tab.")}</p>

      {none && <p className="text-xs text-faint">{t("Select an atom or a bond on the drawing to change it.")}</p>}

      {heavy.length > 0 && (
        <Group title={t("Element")} hint={t("Another atom takes its place; its hydrogens follow.")}>
          <select
            value={elements.size === 1 ? (firstElement ?? "") : ""}
            aria-label={t("Element")}
            onChange={(e) => e.target.value && apply((b) => heavy.reduce((n, id) => replaceElement(n, id, e.target.value), b))}
            className="rounded-lg border border-line bg-white px-2.5 py-1.5 text-xs"
          >
            <option value="" disabled />
            {ELEMENTS.map((el) => (
              <option key={el} value={el}>
                {el}
              </option>
            ))}
          </select>
        </Group>
      )}

      {sel.bonds.length > 0 && (
        <Group title={t("Bond order")} hint={t("Single, double or triple. The hydrogens of both atoms follow.")}>
          <div className="flex gap-1.5">
            {([1, 2, 3] as const).map((o) => (
              <ActionButton key={o} label={o === 1 ? "—" : o === 2 ? "=" : "≡"} onClick={() => apply((b) => sel.bonds.reduce((n, id) => setBondOrder(n, id, o), b))} disabled={!!firstBond && sel.bonds.length === 1 && firstBond.order === o} />
            ))}
          </div>
        </Group>
      )}

      {!none && (
        <Group title={t("Add or remove")}>
          <div className="flex flex-wrap gap-1.5">
            <ActionButton icon={<Plus size={14} />} label={t("Add a hydrogen")} onClick={() => apply((b) => heavy.reduce((n, id) => addHydrogen(n, id), b))} disabled={!heavy.length} />
            <ActionButton icon={<Link2 size={14} />} label={t("Bond the two atoms")} onClick={() => apply((b) => addBond(b, sel.atoms[0], sel.atoms[1]))} disabled={sel.atoms.length !== 2} />
            <ActionButton
              icon={<Trash2 size={14} />}
              label={t("Remove")}
              shortcut="Del"
              tone="danger"
              onClick={() => {
                apply((b) => removeSelected(b, sel));
                setSelection(emptySelection());
              }}
              disabled={!sel.atoms.length && !sel.bonds.length}
            />
          </div>
        </Group>
      )}

      {(warnings.length > 0 || octet.length > 0) && (
        <Group title={t("Checks")} hint={t("These are only warnings: you decide what the exercise needs.")}>
          <div className="flex flex-col gap-1.5" data-testid="warnings">
            {warnings.slice(0, 4).map((w) => (
              <p key={`v${w.atomId}`} className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
                {t("{element} has {used} bonds (usual: {allowed}).", { element: elementOf(w.atomId), used: w.used, allowed: w.allowed.join(", ") })}
              </p>
            ))}
            {octet.slice(0, 4).map((o) => (
              <p key={`o${o.atomId}`} className="rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
                {t("{element}: {n} electrons around it, {expected} expected.", { element: elementOf(o.atomId), n: o.electrons, expected: o.expected })}
              </p>
            ))}
          </div>
        </Group>
      )}
    </div>
  );
}
