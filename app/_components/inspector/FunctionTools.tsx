"use client";

import { useMemo, useState } from "react";
import type { BlockPreset } from "@/app/_lib/blocks";
import { compileLatex, derivativeTable, functionName, graphWindow, studyFunction, type StudyRange } from "@/app/_lib/functionStudy";
import type { BlockType, Lang } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { Toggle, inputCls } from "./fields";

interface Props {
  latex: string;
  lang: Lang;
  // A new block made from the function, put on the page under the equation (its own block, not in the same text box).
  onInsert: (type: BlockType, preset: BlockPreset) => void;
}

const num = (s: string): number | undefined => {
  const v = Number(s.replace(",", ".").replace("−", "-"));
  return s.trim() && Number.isFinite(v) ? v : undefined;
};

// Under an equation's field (or a formula's, in a text box): the graph of the function, and its first derivative test table
// (where it increases and decreases), each made as a new block on the page.
export default function FunctionTools({ latex, lang, onInsert }: Props) {
  const t = useT();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [blank, setBlank] = useState(false);
  const [words, setWords] = useState(false);
  const { fn, formula, error } = useMemo(() => compileLatex(latex), [latex]);
  const range: StudyRange = useMemo(() => ({ from: num(from), to: num(to) }), [from, to]);
  const badRange = range.from !== undefined && range.to !== undefined && range.from >= range.to;
  // (sampled once per function and interval: the equation is typed in key by key)
  const study = useMemo(() => (fn && !badRange ? studyFunction(fn, range) : null), [fn, range, badRange]);

  const makeGraph = () => {
    if (!fn) return;
    const win = graphWindow(fn, study ?? undefined);
    const w = range.from !== undefined && range.to !== undefined && !badRange ? { ...win, xMin: range.from, xMax: range.to } : win;
    onInsert("graph", { functions: [formula], ...w, grid: true });
  };

  const makeTable = () => {
    if (!study) return;
    const { name, variable } = functionName(latex);
    const table = derivativeTable(study, { name, variable, lang, blank, words });
    onInsert("table", { ...table, header: false, firstCol: true });
  };

  const tooMany = (study?.points.length ?? 0) > 9;

  return (
    <section className="flex flex-col gap-2 rounded-md border border-line p-2.5" data-text-format="">
      <h3 className="text-[11px] font-semibold text-ink">{t("Study of the function")}</h3>
      {error || !fn ? (
        <p className="text-[11px] leading-snug text-faint">{t("Type a function, e.g. f(x) = x^2 - 2x, to draw its graph or make its table of variations.")}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-1.5">
            <ToolButton onClick={makeGraph} label={t("Function graph")} icon={<GraphGlyph />} />
            <ToolButton onClick={makeTable} label={t("Variation table")} icon={<TableGlyph />} disabled={badRange} />
          </div>
          <details className="group/fn">
            <summary className="cursor-pointer list-none text-[11px] text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
              {t("Options of the table")} ▾
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-muted">
                <span className="shrink-0">{t("Study on")}</span>
                <input aria-label={t("From")} placeholder="−∞" value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} h-7 w-full min-w-0 text-center`} />
                <span>…</span>
                <input aria-label={t("To")} placeholder="+∞" value={to} onChange={(e) => setTo(e.target.value)} className={`${inputCls} h-7 w-full min-w-0 text-center`} />
              </div>
              <Toggle checked={words} onChange={setWords} label={t("Words instead of arrows")} />
              <Toggle checked={blank} onChange={setBlank} label={t("Blank, for the student to fill")} />
            </div>
          </details>
          {badRange && <p className="text-[11px] text-red-600">{t("The start of the interval must be before its end.")}</p>}
          {tooMany && !badRange && <p className="text-[11px] leading-snug text-amber-700">{t("Many changes of direction: choose an interval in the options for a shorter table.")}</p>}
          <p className="text-[10px] leading-snug text-faint">{t("Each one is added as its own block under the equation.")}</p>
        </>
      )}
    </section>
  );
}

function ToolButton({ onClick, label, icon, disabled }: { onClick: () => void; label: string; icon: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="flex h-14 flex-col items-center justify-center gap-1 rounded-[6px] border border-line bg-white text-[11px] font-medium text-ink transition-colors outline-none hover:border-accent hover:bg-accent-soft hover:text-accent focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  );
}

const GraphGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
    <path d="M2 9h14M9 2v14" opacity=".45" />
    <path d="M3 3.5c2 9 4 10 6 5.5s4-4 6 6" />
  </svg>
);

const TableGlyph = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="1.5" y="3" width="15" height="12" rx="1.5" />
    <path d="M1.5 7h15M1.5 11h15M5.5 3v12" opacity=".55" />
    <path d="M7.5 14l2.5-2.5M12 11.5l2.5 2.5" />
  </svg>
);
