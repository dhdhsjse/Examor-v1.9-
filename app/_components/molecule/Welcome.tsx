"use client";

import { idle, tileBase } from "@/app/_components/graph-studio/fields";
import { useUi } from "@/app/_lib/uiLang";
import { displayFromCounts } from "@/app/_molecule/chem";
import type { ChemEngine } from "@/app/_molecule/engine/ChemEngine";
import { popularMolecules } from "@/app/_molecule/families";
import { entryName, type DbEntry } from "@/app/_molecule/resolve/database";
import { parseFormula } from "@/app/_molecule/resolve/normalize";
import { Formula } from "./ui";
import { usePreviews } from "./usePreviews";

interface Props {
  engine: ChemEngine | null;
  onPick: (e: DbEntry) => void;
}

// What the teacher sees before choosing a molecule: one line saying where to start, and the molecules asked for most.
export default function Welcome({ engine, onPick }: Props) {
  const { t, lang } = useUi();
  const popular = popularMolecules();
  const pictures = usePreviews(engine, popular.map((e) => ({ key: e.id, smiles: e.smiles })), lang, { bondLength: 26, fontSize: 12 });

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col justify-center gap-4 overflow-y-auto p-6" data-testid="molecule-welcome">
      <p className="text-center text-[13px] text-muted">{t("Type a name, a formula such as C2H4O2, or SMILES above, or pick one:")}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {popular.map((e) => (
          <button key={e.id} onClick={() => onPick(e)} className={`${tileBase} ${idle} gap-1! p-2.5`}>
            <div dir="ltr" className="flex h-14 w-full items-center justify-center overflow-hidden mix-blend-multiply [&>svg]:h-auto [&>svg]:max-h-14 [&>svg]:w-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: pictures[e.id] ?? "" }} />
            <span className="text-[13px] font-semibold text-ink">{entryName(e, lang)}</span>
            <span className="text-[11px] font-normal text-muted">
              <Formula text={displayFromCounts(parseFormula(e.formula) ?? {}) || e.formula} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
