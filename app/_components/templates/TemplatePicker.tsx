"use client";

import { useEffect, useState } from "react";
import { TEMPLATES, type Template, type TemplateItem } from "@/app/_lib/templates";
import { useT } from "@/app/_lib/uiLang";
import { HeaderSketch } from "../HeaderSketch";

interface Props {
  canClose: boolean; // false on first launch: a template must be chosen
  onPick: (t: Template) => void;
  onClose: () => void;
}

type Kind = "example" | "layout";
type LangFilter = "all" | "fr" | "ar";

// Full-screen window to start a new exam: complete examples, or an empty layout.
export default function TemplatePicker({ canClose, onPick, onClose }: Props) {
  const tr = useT();
  const [kind, setKind] = useState<Kind>("example");
  const [lang, setLang] = useState<LangFilter>("all");
  useEffect(() => {
    if (!canClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canClose, onClose]);

  const shown = TEMPLATES.filter((t) => (t.kind ?? "layout") === kind && (lang === "all" || t.lang === lang));
  const tab = (on: boolean) => `rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${on ? "bg-white text-indigo-700 shadow-sm" : "text-muted hover:text-ink"}`;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-6 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{tr("Start a new exam")}</h2>
            <p className="text-xs text-muted">{tr("Pick a ready example or an empty layout — you can change everything afterwards.")}</p>
          </div>
          {canClose && (
            <button onClick={onClose} className="grid size-8 place-items-center rounded-md text-muted hover:bg-subtle hover:text-ink" title={tr("Close (Esc)")}>
              ✕
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-4">
          <div className="flex rounded-lg bg-subtle p-1 ring-1 ring-line" role="tablist">
            <button role="tab" aria-selected={kind === "example"} className={tab(kind === "example")} onClick={() => setKind("example")}>
              {tr("Ready examples")}
            </button>
            <button role="tab" aria-selected={kind === "layout"} className={tab(kind === "layout")} onClick={() => setKind("layout")}>
              {tr("Empty layouts")}
            </button>
          </div>
          <div className="flex rounded-lg bg-subtle p-1 ring-1 ring-line" role="group" aria-label={tr("Exam language")}>
            {(
              [
                ["all", tr("All")],
                ["fr", "Français"],
                ["ar", "العربية"],
              ] as const
            ).map(([v, label]) => (
              <button key={v} aria-pressed={lang === v} className={tab(lang === v)} onClick={() => setLang(v)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 overflow-y-auto p-6 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((t) => (
            <button
              key={t.id}
              onClick={() => onPick(t)}
              className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white text-start transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-lg"
            >
              <div className="bg-subtle p-3">
                <MiniPage t={t} />
              </div>
              <div className="flex flex-col gap-0.5 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink" dir="auto">
                    {t.name}
                  </span>
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold ${t.lang === "ar" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"}`}>
                    {t.lang === "ar" ? "AR" : "FR"}
                  </span>
                </div>
                {t.subject && <span className="text-[10px] font-semibold text-amber-700">{tr(t.subject)}</span>}
                <span className="text-[11px] leading-snug text-muted">{tr(t.description)}</span>
              </div>
            </button>
          ))}
          {shown.length === 0 && <p className="col-span-full py-10 text-center text-xs text-faint">{tr("Nothing matches these filters.")}</p>}
        </div>
      </div>
    </div>
  );
}

// One line of a mini page for a block of the template.
function ItemSketch({ item }: { item: TemplateItem }) {
  const bar = (w: string, extra = "") => <div className={`h-1 rounded-full bg-slate-300 ${extra}`} style={{ width: w }} />;
  if ("figure" in item) return <div className="mx-auto h-5 w-8 rounded-sm border border-slate-400 bg-slate-50" />;
  if (item.type === "text") return bar(item.preset && "style" in item.preset && item.preset.style === "body" ? "85%" : "35%", item.preset && "style" in item.preset && item.preset.style === "body" ? "" : "bg-slate-500");
  return (
    <div className="space-y-0.5">
      {bar("75%")}
      {bar("50%", "bg-slate-200")}
      {bar("45%", "bg-slate-200")}
    </div>
  );
}

// A tiny drawing of the template's first page.
function MiniPage({ t }: { t: Template }) {
  const tr = useT();
  return (
    <div dir={t.lang === "ar" ? "rtl" : "ltr"} className="mx-auto flex aspect-[1/1.414] w-full flex-col gap-1.5 overflow-hidden bg-white p-2.5 shadow-sm ring-1 ring-black/5">
      {t.header && <HeaderSketch style={t.header} accent={t.accent} />}
      <div className="mt-1 space-y-1.5">
        {t.extras.length > 0 ? (
          t.extras.slice(0, 6).map((e, i) => <ItemSketch key={i} item={e} />)
        ) : (
          <div className="pt-6 text-center text-[9px] text-faint">{t.header ? "" : tr("Empty page")}</div>
        )}
      </div>
    </div>
  );
}
