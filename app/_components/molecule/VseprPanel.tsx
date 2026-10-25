"use client";

import { useState } from "react";
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

const LANGS: Lang[] = ["ar", "fr", "en"];
const LANG_LABEL: Record<Lang, string> = { ar: "العربية", fr: "Français", en: "English" };

// The geometry around the selected atom (VSEPR): AXE code, shape, angles and the sentence that justifies it.
export default function VseprPanel({ block, selection, onInsertText, cram }: Props) {
  const { t, lang: uiLang } = useUi();
  const [lang, setLang] = useState<Lang>(uiLang);
  const atomId = selection.atoms.length === 1 ? selection.atoms[0] : null;
  const a = atomId ? analyzeAtom(block.graph, atomId) : null;
  const text = a ? explainGeometry(a, lang) : "";

  return (
    <div className="flex flex-col gap-2">
      {!a ? (
        <p className="text-xs text-faint">{t("Click an atom to see the geometry around it.")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
            <span className="text-muted">{t("Atom")}</span>
            <span className="font-medium text-ink">{a.element}</span>
            <span className="text-muted">{t("Type")}</span>
            <span className="font-medium text-ink" dir="ltr">
              {a.code}
            </span>
            <span className="text-muted">{t("Geometry")}</span>
            <span className="font-medium text-ink">{GEOMETRY_NAMES[a.geometry][lang]}</span>
            {a.idealAngles.length > 0 && (
              <>
                <span className="text-muted">{t("Angles")}</span>
                <span className="font-medium text-ink" dir="ltr">
                  {a.idealAngles.map((x) => `${x}°`).join(" / ")}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-1" role="group" aria-label={t("Language of the justification")}>
            {LANGS.map((l) => (
              <button key={l} onClick={() => setLang(l)} className={`flex-1 rounded-md border px-1.5 py-1 text-[11px] ${lang === l ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-ink hover:bg-subtle"}`}>
                {LANG_LABEL[l]}
              </button>
            ))}
          </div>
          <p dir={lang === "ar" ? "rtl" : "ltr"} className="rounded-md bg-subtle px-2.5 py-2 text-xs leading-relaxed text-ink" style={{ userSelect: "text" }} data-testid="vsepr-text">
            {text}
          </p>
          <button onClick={() => onInsertText(text)} className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-ink hover:bg-subtle">
            {t("Insert this text in the exam")}
          </button>
          {cram && atomId && (
            <div className="flex flex-col gap-1.5 border-t border-line pt-2">
              <button
                onClick={() => cram.onToggle(atomId)}
                aria-pressed={cram.isCenter(atomId)}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium ${cram.isCenter(atomId) ? "border-accent bg-accent-soft text-accent-strong" : "border-line text-ink hover:bg-subtle"}`}
              >
                {cram.isCenter(atomId) ? t("Cram centre: drawn in perspective") : t("Draw this atom in perspective (Cram centre)")}
              </button>
              {cram.isCenter(atomId) && a.geometry !== "tetrahedral" && a.geometry !== "trigonal-pyramidal" && <p className="text-[11px] text-amber-800">{t("The geometry around this atom is planar: no wedges are drawn.")}</p>}
            </div>
          )}
        </>
      )}
    </div>
  );
}
