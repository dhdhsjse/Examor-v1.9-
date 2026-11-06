"use client";

import { useMemo } from "react";
import Disclosure from "@/app/_components/graph-studio/Disclosure";
import { Group, listRow } from "@/app/_components/graph-studio/fields";
import { useUi } from "@/app/_lib/uiLang";
import { displayFromCounts } from "@/app/_molecule/chem";
import { FAMILIES, moleculesOf } from "@/app/_molecule/families";
import { entryName, type DbEntry } from "@/app/_molecule/resolve/database";
import { parseFormula } from "@/app/_molecule/resolve/normalize";
import type { Candidate } from "@/app/_molecule/resolve/resolve";
import { Formula } from "./ui";

interface Props {
  candidates: Candidate[]; // what the last search found
  message: string | null; // why nothing was found, or that the engine is loading
  picked: string | null;
  onPickCandidate: (c: Candidate) => void;
  onPickEntry: (e: DbEntry) => void;
}

const MAX_RESULTS = 8;
const written = (formula: string) => displayFromCounts(parseFormula(formula) ?? {}) || formula;

// One molecule of a list: its name, and its formula at the end of the line.
function MoleculeRow({ name, formula, on, onPick }: { name: string; formula: string; on: boolean; onPick: () => void }) {
  return (
    <button onClick={onPick} aria-current={on || undefined} className={`${listRow(on)} py-2!`}>
      <span className={`min-w-0 flex-1 truncate text-[13px] tracking-[-0.01em] ${on ? "font-semibold" : "font-medium"}`}>{name}</span>
      <span className="shrink-0 text-xs text-muted tabular-nums" dir="ltr">
        <Formula text={written(formula)} />
      </span>
    </button>
  );
}

// The left column: what the search found, then the whole database by family (each one folds), so that a teacher can also pick a molecule
// without knowing what to type. A click shows it at once in the middle.
export default function MoleculeBrowser({ candidates, message, picked, onPickCandidate, onPickEntry }: Props) {
  const { t, lang } = useUi();
  const families = useMemo(() => FAMILIES.map((f) => ({ family: f, entries: moleculesOf(f) })), []);
  const results = candidates.slice(0, MAX_RESULTS);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto" data-testid="molecule-browser">
      {message && <p className="mx-4 mt-3 rounded-xl bg-subtle px-3 py-2 text-xs text-muted">{message}</p>}

      {results.length > 0 && (
        <Disclosure title={t("Results")} testId="molecule-results" count={candidates.length} reveal={results[0]?.id}>
          <Group>
            {results.map((c) => (
              <MoleculeRow key={c.id + c.smiles} name={c.names[lang] ?? c.names.en ?? c.smiles} formula={c.formula} on={picked === c.id} onPick={() => onPickCandidate(c)} />
            ))}
          </Group>
        </Disclosure>
      )}

      {families.map(({ family, entries }) => (
        <Disclosure key={family.id} title={t(family.label)} testId={`family-${family.id}`} count={entries.length} defaultOpen={false} reveal={entries.some((e) => e.id === picked) ? picked : null}>
          <Group>
            {entries.map((e) => (
              <MoleculeRow key={e.id} name={entryName(e, lang)} formula={e.formula} on={picked === e.id} onPick={() => onPickEntry(e)} />
            ))}
          </Group>
        </Disclosure>
      ))}
    </div>
  );
}
