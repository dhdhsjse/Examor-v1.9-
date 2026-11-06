"use client";

import { useState } from "react";
import { Group, Notice, Row, Segmented, SwitchRow, softButton } from "@/app/_components/graph-studio/fields";
import { useUi } from "@/app/_lib/uiLang";
import { analyzeAtom, explainGeometry, GEOMETRY_NAMES, type Lang } from "@/app/_molecule/geometry/vsepr";
import type { MoleculeBlockData } from "@/app/_molecule/model";
import type { Selection } from "@/app/_molecule/edit/select";

interface Props {
  block: MoleculeBlockData;
  selection: Selection;
  onInsertText: (text: string) => void;
  // On the Cram drawing: is the selected atom a Cram centre, and make it one (or not).
  cram?: { isCenter: (atomId: string) => boolean; onToggle: (atomId: string) => void };
}

const LANGS: { value: Lang; label: string }[] = [
  { value: "ar", label: "العربية" },
  { value: "fr", label: "Français" },
  { value: "en", label: "English" },
];

// The geometry around the selected atom (VSEPR): AXE code, shape, angles and the sentence that justifies it.
export default function VseprPanel({ block, selection, onInsertText, cram }: Props) {
  const { t, lang: uiLang } = useUi();
  const [lang, setLang] = useState<Lang>(uiLang);
  const atomId = selection.atoms.length === 1 ? selection.atoms[0] : null;
  const a = atomId ? analyzeAtom(block.graph, atomId) : null;
  const text = a ? explainGeometry(a, lang) : "";

  if (!a) {
    return (
      <p className="px-1 text-[11px] text-muted">
        {cram ? t("Wedges and hashes are drawn around the Cram centres (dashed rings). Click an atom to choose another.") : t("Click an atom to see the geometry around it.")}
      </p>
    );
  }
  const value = (v: string, ltr = false) => (
    <span className="text-[13px] font-medium text-ink" dir={ltr ? "ltr" : undefined}>
      {v}
    </span>
  );
  return (
    <>
      <Group>
        <Row label={t("Atom")}>{value(a.element)}</Row>
        <Row label={t("Type")}>{value(a.code, true)}</Row>
        <Row label={t("Geometry")}>{value(GEOMETRY_NAMES[a.geometry][lang])}</Row>
        {a.idealAngles.length > 0 && <Row label={t("Angles")}>{value(a.idealAngles.map((x) => `${x}°`).join(" / "), true)}</Row>}
        {cram && atomId && <SwitchRow label={t("Draw this atom in perspective (Cram centre)")} checked={cram.isCenter(atomId)} onChange={() => cram.onToggle(atomId)} testId="cram-centre" />}
      </Group>
      {cram && atomId && cram.isCenter(atomId) && a.geometry !== "tetrahedral" && a.geometry !== "trigonal-pyramidal" && <Notice>{t("The geometry around this atom is planar: no wedges are drawn.")}</Notice>}

      <Segmented label={t("Language of the justification")} value={lang} onChange={setLang} options={LANGS} attr="data-lang" />
      <p dir={lang === "ar" ? "rtl" : "ltr"} className="rounded-xl bg-subtle px-3 py-2.5 text-xs leading-relaxed text-ink" style={{ userSelect: "text" }} data-testid="vsepr-text">
        {text}
      </p>
      <button type="button" onClick={() => onInsertText(text)} className={softButton}>
        {t("Insert this text in the exam")}
      </button>
    </>
  );
}
