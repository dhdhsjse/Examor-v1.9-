"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useUi } from "@/app/_lib/uiLang";
import { displayFromCounts } from "@/app/_molecule/chem";
import { FAMILIES, moleculesOf } from "@/app/_molecule/families";
import { entryName, type DbEntry } from "@/app/_molecule/resolve/database";
import { parseFormula } from "@/app/_molecule/resolve/normalize";
import type { Candidate } from "@/app/_molecule/resolve/resolve";
import type { ChemEngine } from "@/app/_molecule/engine/ChemEngine";
import { Formula } from "./ui";
import { usePreviews } from "./usePreviews";

interface Props {
  engine: ChemEngine | null;
  candidates: Candidate[]; // what the last search found
  message: string | null; // why nothing was found, or that the engine is loading
  picked: string | null;
  onPickCandidate: (c: Candidate) => void;
  onPickEntry: (e: DbEntry) => void;
}

const PREVIEW = { bondLength: 26, fontSize: 12 };

function Thumb({ svg }: { svg?: string }) {
  return <div dir="ltr" className="flex h-14 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white [&>svg]:h-auto [&>svg]:max-h-14 [&>svg]:w-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: svg ?? "" }} />;
}

// The left column: what the search found, or the whole database by family, so that a teacher can also pick a
// molecule without knowing what to type.
export default function MoleculeBrowser({ engine, candidates, message, picked, onPickCandidate, onPickEntry }: Props) {
  const { t, lang } = useUi();
  const [view, setView] = useState<"results" | "browse">("browse");
  const [family, setFamily] = useState<string | null>(null);
  // A new search shows its results; the browser stays where the teacher left it otherwise.
  const [seen, setSeen] = useState(candidates);
  if (seen !== candidates) {
    setSeen(candidates);
    if (candidates.length) setView("results");
  }

  const fam = FAMILIES.find((f) => f.id === family);
  const entries = useMemo(() => (fam ? moleculesOf(fam) : []), [fam]);
  const items = view === "results" ? candidates.slice(0, 8).map((c) => ({ key: c.id, smiles: c.smiles })) : entries.map((e) => ({ key: e.id, smiles: e.smiles }));
  const pictures = usePreviews(engine, items, lang, PREVIEW);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="tablist" className="m-3 mb-0 flex gap-1 rounded-xl bg-subtle p-1">
        {(["results", "browse"] as const).map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            disabled={v === "results" && !candidates.length}
            onClick={() => setView(v)}
            className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${view === v ? "bg-white text-accent-strong shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {v === "results" ? t("Results") : t("Browse")}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {message && <p className="mb-2 rounded-lg bg-subtle px-3 py-2 text-xs text-muted">{message}</p>}

        {view === "results" && (
          <div className="flex flex-col gap-1.5">
            {candidates.map((c) => (
              <button
                key={c.id + c.smiles}
                onClick={() => onPickCandidate(c)}
                aria-current={picked === c.id}
                className={`flex items-center gap-2 rounded-xl border p-1.5 text-start transition-colors ${picked === c.id ? "border-accent bg-accent-soft" : "border-line bg-white hover:bg-subtle"}`}
              >
                <Thumb svg={pictures[c.id]} />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold text-ink">{c.names[lang] ?? c.names.en ?? c.smiles}</span>
                  <span className="block truncate text-[11px] text-muted">
                    <Formula text={displayFromCounts(parseFormula(c.formula) ?? {}) || c.formula} />
                    {c.names.fr && lang !== "fr" ? ` · ${c.names.fr}` : ""}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}

        {view === "browse" && (
          <div className="flex flex-col gap-1">
            <p className="mb-1 px-1 text-[11px] text-muted">{t("Choose a family, then a molecule.")}</p>
            {FAMILIES.map((f) => {
              const open = family === f.id;
              const list = open ? entries : [];
              return (
                <div key={f.id}>
                  <button onClick={() => setFamily(open ? null : f.id)} aria-expanded={open} className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors ${open ? "bg-accent-soft text-accent-strong" : "text-ink hover:bg-subtle"}`}>
                    <span>{t(f.label)}</span>
                    <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
                  </button>
                  {open && (
                    <div className="my-1 flex flex-col gap-1">
                      {list.map((e) => (
                        <button key={e.id} onClick={() => onPickEntry(e)} aria-current={picked === e.id} className={`flex items-center gap-2 rounded-xl border p-1.5 text-start transition-colors ${picked === e.id ? "border-accent bg-accent-soft" : "border-line bg-white hover:bg-subtle"}`}>
                          <Thumb svg={pictures[e.id]} />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-ink">{entryName(e, lang)}</span>
                            <span className="block truncate text-[11px] text-muted">
                              <Formula text={displayFromCounts(parseFormula(e.formula) ?? {}) || e.formula} />
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
