"use client";

import { Atom, GraduationCap, Search, Shapes } from "lucide-react";
import { useUi } from "@/app/_lib/uiLang";
import { displayFromCounts } from "@/app/_molecule/chem";
import type { ChemEngine } from "@/app/_molecule/engine/ChemEngine";
import { popularMolecules } from "@/app/_molecule/families";
import { entryName, type DbEntry } from "@/app/_molecule/resolve/database";
import { WELCOME_FEATURES } from "@/app/_molecule/strings";
import { parseFormula } from "@/app/_molecule/resolve/normalize";
import { Formula } from "./ui";
import { usePreviews } from "./usePreviews";

interface Props {
  engine: ChemEngine | null;
  onPick: (e: DbEntry) => void;
}

// What the teacher sees before choosing a molecule: where to start, and what the Studio can do.
export default function Welcome({ engine, onPick }: Props) {
  const { t, lang } = useUi();
  const popular = popularMolecules();
  const pictures = usePreviews(engine, popular.map((e) => ({ key: e.id, smiles: e.smiles })), lang, { bondLength: 36, fontSize: 16 });

  const icons = [<Atom key="a" size={18} />, <GraduationCap key="g" size={18} />, <Shapes key="s" size={18} />];

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col justify-center gap-6 overflow-y-auto p-6">
      <div className="flex flex-col gap-1.5 text-center">
        <h3 className="text-xl font-semibold text-ink">{t("Which molecule do you need?")}</h3>
        <p className="flex items-center justify-center gap-1.5 text-sm text-muted">
          <Search size={14} />
          {t("Type a name, a formula such as C2H4O2, or SMILES above, or pick one:")}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {popular.map((e) => (
          <button key={e.id} onClick={() => onPick(e)} className="flex flex-col items-center gap-1 rounded-2xl border border-line bg-white p-3 transition-colors hover:border-accent hover:bg-accent-soft">
            <div dir="ltr" className="flex h-20 w-full items-center justify-center overflow-hidden [&>svg]:h-auto [&>svg]:max-h-20 [&>svg]:w-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: pictures[e.id] ?? "" }} />
            <span className="text-sm font-semibold text-ink">{entryName(e, lang)}</span>
            <span className="text-xs text-muted">
              <Formula text={displayFromCounts(parseFormula(e.formula) ?? {}) || e.formula} />
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 border-t border-line pt-5 sm:grid-cols-3">
        {WELCOME_FEATURES.map((f, i) => (
          <div key={f.title} className="flex gap-2.5">
            <span className="mt-0.5 text-accent">{icons[i]}</span>
            <div>
              <p className="text-xs font-semibold text-ink">{t(f.title)}</p>
              <p className="text-[11px] leading-snug text-muted">{t(f.text)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
