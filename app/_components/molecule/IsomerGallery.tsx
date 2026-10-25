"use client";

import { useEffect, useMemo, useState } from "react";
import { useUi } from "@/app/_lib/uiLang";
import { buildBlock } from "@/app/_molecule/block";
import type { ChemEngine } from "@/app/_molecule/engine/ChemEngine";
import { describeMolecule, relation } from "@/app/_molecule/isomers/describe";
import { loadIsomers } from "@/app/_molecule/isomers/load";
import { GROUP_LABEL, GROUP_ORDER, ISSUE_LABEL, RELATION_LABEL, type GroupId, type IsomerEntry, type IsomerFile, type IsomerInfo, type Relation } from "@/app/_molecule/isomers/types";
import type { MolGraph } from "@/app/_molecule/model";
import { renderMolecule } from "@/app/_molecule/render";

const PAGE = 24;

type Shape = "all" | "linear" | "branched" | "ring";

interface Props {
  engine: ChemEngine;
  formula: string; // Hill formula of the molecule being edited
  smiles: string; // its canonical SMILES (highlighted in the gallery)
  graph: MolGraph;
  onPick: (entry: IsomerEntry) => void;
  onClose: () => void;
}

// "C2H4O2" with real subscripts.
const Formula = ({ text }: { text: string }) => <>{text.split(/(\d+)/).map((part, i) => (/^\d+$/.test(part) ? <sub key={i}>{part}</sub> : part))}</>;

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={`rounded-full border px-2.5 py-1 text-xs ${active ? "border-accent bg-accent text-white" : "border-line text-ink hover:bg-subtle"}`}>
      {children}
    </button>
  );
}

// Every isomer of the formula the school can use, with filters. Click one to load it into the Studio.
export default function IsomerGallery({ engine, formula, smiles, graph, onPick, onClose }: Props) {
  const { t, lang } = useUi();
  const [file, setFile] = useState<IsomerFile | null | undefined>(undefined); // undefined = loading
  const [current, setCurrent] = useState<IsomerInfo | null>(null);
  const [schoolOnly, setSchoolOnly] = useState(true);
  const [group, setGroup] = useState<GroupId | "all">("all");
  const [shape, setShape] = useState<Shape>("all");
  const [rel, setRel] = useState<"all" | "chain" | "position" | "function">("all");
  const [shown, setShown] = useState(PAGE);
  const [pictures, setPictures] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    loadIsomers(formula).then((f) => alive && setFile(f));
    describeMolecule(engine, graph).then((i) => alive && setCurrent(i));
    return () => {
      alive = false;
    };
  }, [engine, formula, graph]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const base = useMemo(() => (file ? file.entries.filter((e) => (schoolOnly ? e.school : true)) : []), [file, schoolOnly]);
  const groups = useMemo(() => GROUP_ORDER.filter((id) => base.some((e) => e.groups.includes(id))), [base]);
  const relationOf = (e: IsomerEntry): Relation | null => (current ? relation({ ...current, smiles }, e) : null);
  const list = useMemo(
    () =>
      base.filter((e) => {
        if (group !== "all" && !e.groups.includes(group)) return false;
        if (shape === "ring" && !e.ring) return false;
        if (shape === "linear" && (e.ring || e.branched)) return false;
        if (shape === "branched" && !e.branched) return false;
        if (rel !== "all") {
          const r = current ? relation({ ...current, smiles }, e) : null;
          if (r !== rel) return false;
        }
        return true;
      }),
    [base, group, shape, rel, current, smiles],
  );
  const visible = list.slice(0, shown);

  // Small drawings, made as the cards come into the list.
  useEffect(() => {
    let alive = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const e of visible) {
        if (pictures[e.smiles]) continue;
        try {
          const b = await buildBlock(engine, { id: e.smiles, smiles: e.smiles, formula, names: {}, source: "isomer-table", rank: 0 }, { kind: "smiles", input: e.smiles }, lang);
          next[e.smiles] = renderMolecule({ ...b, options: { ...b.options, bondLength: 30, fontSize: 13 } }).svg;
        } catch {
          // a structure that cannot be drawn is listed without a picture
        }
        if (!alive) return;
      }
      if (alive && Object.keys(next).length) setPictures((p) => ({ ...p, ...next }));
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible.map((v) => v.smiles).join("|"), engine, lang]);

  const notListed = file ? (schoolOnly ? file.schoolTotal - base.length : file.total - base.length) : 0;
  const nameOf = (e: IsomerEntry) => e.name?.[lang] ?? e.name?.en;

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-white" data-testid="isomer-gallery">
      <div className="flex items-center gap-3 border-b border-line px-5 py-3">
        <h3 className="text-base font-semibold text-ink">
          {t("Isomers of")} <Formula text={formula} />
        </h3>
        {file && (
          <span className="text-xs text-muted" data-testid="isomer-count">
            {t("{n} shown", { n: list.length })}
            {notListed > 0 ? ` · ${t("{n} more not listed", { n: notListed })}` : ""}
          </span>
        )}
        <label className="ms-auto flex items-center gap-2 text-xs text-ink">
          <input type="checkbox" className="accent-indigo-600" checked={schoolOnly} onChange={(e) => (setSchoolOnly(e.target.checked), setShown(PAGE))} />
          {t("School level only")}
        </label>
        <button onClick={onClose} className="grid size-8 place-items-center rounded-md text-muted hover:bg-subtle hover:text-ink" title={t("Close (Esc)")}>
          ✕
        </button>
      </div>

      {file === undefined && <p className="p-5 text-sm text-muted">{t("Loading…")}</p>}
      {file === null && <p className="p-5 text-sm text-muted">{t("No other isomers of this formula.")}</p>}

      {file && (
        <>
          <div className="flex flex-col gap-2 border-b border-line px-5 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="me-1 text-[11px] font-semibold text-muted">{t("Functional group")}</span>
              <Chip active={group === "all"} onClick={() => (setGroup("all"), setShown(PAGE))}>
                {t("All")}
              </Chip>
              {groups.map((id) => (
                <Chip key={id} active={group === id} onClick={() => (setGroup(id), setShown(PAGE))}>
                  {t(GROUP_LABEL[id])}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="me-1 text-[11px] font-semibold text-muted">{t("Shape")}</span>
              {(["all", "linear", "branched", "ring"] as Shape[]).map((s) => (
                <Chip key={s} active={shape === s} onClick={() => (setShape(s), setShown(PAGE))}>
                  {t(s === "all" ? "All" : s === "linear" ? "Linear chain" : s === "branched" ? "Branched chain" : "Ring")}
                </Chip>
              ))}
              <span className="ms-4 me-1 text-[11px] font-semibold text-muted">{t("Compared with the current molecule")}</span>
              {(["all", "chain", "position", "function"] as const).map((r) => (
                <Chip key={r} active={rel === r} onClick={() => (setRel(r), setShown(PAGE))}>
                  {r === "all" ? t("All") : t(RELATION_LABEL[r])}
                </Chip>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {!list.length ? (
              <p className="text-sm text-muted">{t("No structure matches these filters.")}</p>
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))" }}>
                {visible.map((e) => {
                  const r = relationOf(e);
                  const isCurrent = e.smiles === smiles;
                  return (
                    <button
                      key={e.smiles}
                      onClick={() => onPick(e)}
                      data-testid="isomer-card"
                      data-smiles={e.smiles}
                      aria-current={isCurrent}
                      className={`flex flex-col gap-1 rounded-lg border p-2 text-start ${isCurrent ? "border-accent bg-accent-soft" : "border-line hover:bg-subtle"}`}
                    >
                      <div dir="ltr" className="flex h-24 items-center justify-center overflow-hidden [&>svg]:h-auto [&>svg]:max-h-24 [&>svg]:w-auto [&>svg]:max-w-full" dangerouslySetInnerHTML={{ __html: pictures[e.smiles] ?? "" }} />
                      <span className="min-h-5 text-sm font-medium text-ink">{nameOf(e) ?? ""}</span>
                      <span className="text-xs text-muted">{e.groups.map((id) => t(GROUP_LABEL[id])).join(" · ")}</span>
                      {isCurrent ? (
                        <span className="text-[11px] font-semibold text-accent-strong">{t("Current molecule")}</span>
                      ) : (
                        r &&
                        r !== "same" && <span className="text-[11px] text-faint">{t(RELATION_LABEL[r])}</span>
                      )}
                      {!e.school && e.issues && <span className="text-[11px] text-amber-800">{t("Not school level: {why}", { why: e.issues.map((i) => t(ISSUE_LABEL[i])).join(", ") })}</span>}
                    </button>
                  );
                })}
              </div>
            )}
            {list.length > shown && (
              <div className="mt-4 flex justify-center">
                <button onClick={() => setShown((n) => n + PAGE)} className="rounded-md border border-line px-4 py-2 text-sm text-ink hover:bg-subtle">
                  {t("Show more")}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
