"use client";

import { useEffect, useState } from "react";
import { useT } from "@/app/_lib/uiLang";

interface Props {
  total: number; // points of all questions so far
  full: { value: number; auto: boolean; fromHeader: boolean };
  hidden: boolean; // points not printed on the paper
  onToggleHidden: () => void;
  onFullMark: (value: number) => void;
}

const KEY = "pointsMeterCollapsed";

// Small floating pill (top of the work area): "18 / 20 pts" with a progress bar.
// Red when the questions add up to more than the full mark. Can be collapsed
// to a tiny "18/20" chip (remembered between visits).
export default function PointsMeter({ total, full, hidden, onToggleHidden, onFullMark }: Props) {
  const t = useT();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "1") setCollapsed(true);
    } catch {}
  }, []);
  const collapse = (v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {}
  };

  const over = total > full.value;
  const exact = total === full.value;
  const ratio = full.value > 0 ? Math.min(1, total / full.value) : 0;
  const tone = over ? "text-red-600" : exact ? "text-emerald-600" : "text-ink";
  const bar = over ? "bg-red-500" : exact ? "bg-emerald-500" : "bg-indigo-500";
  const round = (n: number) => Math.round(n * 100) / 100;

  if (collapsed) {
    return (
      <button
        onClick={() => collapse(false)}
        title={t("Show points")}
        className={`pointer-events-auto rounded-md border bg-white/85 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shadow-sm backdrop-blur-md ${tone} ${over ? "border-red-300" : "border-white/70"}`}
      >
        {over && "⚠ "}
        {round(total)}/{round(full.value)}
      </button>
    );
  }

  return (
    <div
      className={`pointer-events-auto flex items-center gap-0.5 rounded-md border bg-white/85 py-0.5 ps-1.5 pe-0.5 shadow-sm backdrop-blur-md transition-colors ${
        over ? "border-red-300 ring-2 ring-red-200" : "border-white/70"
      }`}
      title={over ? t("The questions add up to more than the full mark!") : t("Points of all the questions / full mark")}
    >
      <div className="flex flex-col gap-0.5">
        <div className={`flex items-baseline gap-1 text-[11px] font-semibold tabular-nums ${tone}`}>
          {over && <span aria-hidden>⚠</span>}
          <span>{round(total)}</span>
          <span className="text-faint">/</span>
          {full.auto ? (
            <span title={t("The header follows the total of the questions")}>{round(full.value)}</span>
          ) : (
            <input
              type="number"
              min={1}
              max={200}
              value={full.value}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (v > 0) onFullMark(v);
              }}
              className="w-8 rounded bg-transparent text-center outline-none hover:bg-black/5 focus:bg-white focus:ring-2 focus:ring-indigo-200"
              title={full.fromHeader ? t("Full mark (also changes the exam header)") : t("Full mark")}
            />
          )}
          <span className="text-[9px] font-medium text-muted">{t("pts")}</span>
        </div>
        <div className="h-0.5 w-16 overflow-hidden rounded-full bg-slate-200">
          <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${ratio * 100}%` }} />
        </div>
      </div>

      <button
        onClick={onToggleHidden}
        title={hidden ? t("Points are hidden on the paper — click to show them") : t("Hide the points on the paper")}
        className={`grid size-5 place-items-center rounded transition-colors ${hidden ? "bg-amber-50 text-amber-600" : "text-muted hover:bg-black/5"}`}
      >
        {hidden ? (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
            <path d="M2 2l12 12M6.5 6.6A2 2 0 0 0 9.4 9.5M4.2 4.4C2.8 5.3 1.8 6.6 1.5 8c.8 2.6 3.5 4.5 6.5 4.5 1.3 0 2.5-.3 3.5-.9M7 3.6c.3 0 .7-.1 1-.1 3 0 5.7 1.9 6.5 4.5-.3 1-.9 2-1.7 2.7" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M1.5 8C2.3 5.4 5 3.5 8 3.5s5.7 1.9 6.5 4.5c-.8 2.6-3.5 4.5-6.5 4.5S2.3 10.6 1.5 8Z" />
            <circle cx="8" cy="8" r="2" />
          </svg>
        )}
      </button>
      <button
        onClick={() => collapse(true)}
        title={t("Collapse")}
        className="grid size-5 place-items-center rounded text-muted hover:bg-black/5"
      >
        <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 3l10 10M13 3L3 13" />
        </svg>
      </button>
    </div>
  );
}
