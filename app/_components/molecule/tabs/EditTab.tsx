"use client";

import { useId, type RefObject } from "react";
import { Link2, Plus, RotateCcw, SquareDashed } from "lucide-react";
import Disclosure from "@/app/_components/graph-studio/Disclosure";
import { Group, Notice, Row, Segmented, SelectField, control, softButton } from "@/app/_components/graph-studio/fields";
import { useT } from "@/app/_lib/uiLang";
import { octetIssues } from "@/app/_molecule/chem";
import { addBond, addHydrogen, graphWarnings, replaceElement, setBondOrder, setLabel } from "@/app/_molecule/edit/ops";
import { isEmpty } from "@/app/_molecule/edit/select";
import type { MoleculeBlockData } from "@/app/_molecule/model";
import type { MoleculeEditor } from "../useMoleculeEditor";

const ELEMENTS = ["C", "N", "O", "S", "P", "F", "Cl", "Br", "I"];
const MAX_WARNINGS = 4;

interface Props {
  block: MoleculeBlockData;
  editor: MoleculeEditor;
  labelInput: RefObject<HTMLInputElement | null>;
  /** Changes when the section must be in sight (the Text button of the floating bar was pressed). */
  reveal: string | null;
}

// Changing the selected atoms and bonds. Removing, hiding and leaving blank are on the bar that appears next to the selection.
// Mistakes are warned about, never blocked: the teacher knows what the exercise needs.
export default function EditTab({ block, editor, labelInput, reveal }: Props) {
  const t = useT();
  const labelId = useId();
  const { selection: sel, apply } = editor;
  const g = block.graph;
  const none = isEmpty(sel);
  const atomOf = (id: string) => g.atoms.find((a) => a.id === id);
  const heavy = sel.atoms.filter((id) => atomOf(id)?.element !== "H");
  const elements = new Set(sel.atoms.map((id) => atomOf(id)?.element));
  const firstElement = sel.atoms[0] ? atomOf(sel.atoms[0])?.element : undefined;
  const label = sel.atoms[0] ? block.edits.atoms[sel.atoms[0]]?.label : undefined;
  const orders = new Set(sel.bonds.map((id) => g.bonds.find((b) => b.id === id)?.order));
  const order = orders.size === 1 ? String([...orders][0] ?? "") : "";
  const warnings = graphWarnings(g);
  const octet = block.representation === "lewis" ? octetIssues(g) : [];
  const elementOf = (id: string) => atomOf(id)?.element ?? "?";
  const small = "grid size-8 shrink-0 place-items-center rounded-lg bg-white text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.07)] transition-colors outline-none enabled:hover:text-accent-strong focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40";

  return (
    <Disclosure title={t("Edit")} testId="molecule-edit" reveal={reveal}>
      {none && <p className="px-1 text-[11px] text-muted">{t("Select an atom or a bond on the drawing to change it.")}</p>}

      {(sel.atoms.length > 0 || sel.bonds.length > 0) && (
        <Group>
          {heavy.length > 0 && (
            <SelectField
              label={t("Element")}
              value={elements.size === 1 ? (firstElement ?? "") : ""}
              onChange={(el) => el && apply((b) => heavy.reduce((n, id) => replaceElement(n, id, el), b))}
              options={[...(elements.size === 1 && firstElement && ELEMENTS.includes(firstElement) ? [] : [{ value: "", label: "—" }]), ...ELEMENTS.map((el) => ({ value: el, label: el }))]}
              testId="edit-element"
            />
          )}
          {sel.atoms.length > 0 && (
            <Row label={t("Text instead of the atom")} htmlFor={labelId} stacked>
              <div className="flex gap-1.5">
                <input
                  id={labelId}
                  ref={labelInput}
                  value={label ?? ""}
                  placeholder={firstElement}
                  onChange={(e) => apply((b) => setLabel(b, sel.atoms, e.target.value), "label")}
                  className={`${control} h-8 min-w-0 flex-1`}
                  style={{ userSelect: "text" }}
                />
                <button type="button" onClick={() => apply((b) => setLabel(b, sel.atoms, ""))} title={t("Empty box")} aria-label={t("Empty box")} className={small}>
                  <SquareDashed size={14} />
                </button>
                <button type="button" onClick={() => apply((b) => setLabel(b, sel.atoms, undefined))} disabled={label === undefined} title={t("Back to the atom")} aria-label={t("Back to the atom")} className={small}>
                  <RotateCcw size={14} />
                </button>
              </div>
            </Row>
          )}
          {sel.bonds.length > 0 && (
            <Row label={t("Bond order")} stacked>
              <Segmented
                label={t("Bond order")}
                value={order}
                onChange={(o) => apply((b) => sel.bonds.reduce((n, id) => setBondOrder(n, id, Number(o) as 1 | 2 | 3), b))}
                attr="data-bond-order"
                options={[
                  { value: "1", label: "—", title: "1" },
                  { value: "2", label: "=", title: "2" },
                  { value: "3", label: "≡", title: "3" },
                ]}
              />
            </Row>
          )}
        </Group>
      )}

      {(heavy.length > 0 || sel.atoms.length === 2) && (
        <div className="flex flex-col gap-1.5">
          {heavy.length > 0 && (
            <button type="button" onClick={() => apply((b) => heavy.reduce((n, id) => addHydrogen(n, id), b))} className={softButton}>
              <Plus size={14} />
              {t("Add a hydrogen")}
            </button>
          )}
          {sel.atoms.length === 2 && (
            <button type="button" onClick={() => apply((b) => addBond(b, sel.atoms[0], sel.atoms[1]))} className={softButton}>
              <Link2 size={14} />
              {t("Bond the two atoms")}
            </button>
          )}
        </div>
      )}

      {(warnings.length > 0 || octet.length > 0) && (
        <Notice testId="warnings">
          <ul className="flex flex-col gap-1">
            {warnings.slice(0, MAX_WARNINGS).map((w) => (
              <li key={`v${w.atomId}`}>{t("{element} has {used} bonds (usual: {allowed}).", { element: elementOf(w.atomId), used: w.used, allowed: w.allowed.join(", ") })}</li>
            ))}
            {octet.slice(0, MAX_WARNINGS).map((o) => (
              <li key={`o${o.atomId}`}>{t("{element}: {n} electrons around it, {expected} expected.", { element: elementOf(o.atomId), n: o.electrons, expected: o.expected })}</li>
            ))}
          </ul>
        </Notice>
      )}
    </Disclosure>
  );
}
