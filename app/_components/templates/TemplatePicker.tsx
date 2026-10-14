"use client";

import { useEffect } from "react";
import { TEMPLATES, type Template } from "@/app/_lib/templates";
import { useT } from "@/app/_lib/uiLang";

interface Props {
  canClose: boolean; // false on first launch: a template must be chosen
  onPick: (t: Template) => void;
  onClose: () => void;
}

// Full-screen window to start a new exam from a ready-made layout.
export default function TemplatePicker({ canClose, onPick, onClose }: Props) {
  const tr = useT();
  useEffect(() => {
    if (!canClose) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canClose, onClose]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-6 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-line px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">{tr("Start a new exam")}</h2>
            <p className="text-xs text-muted">{tr("Pick a ready layout — you can change everything afterwards.")}</p>
          </div>
          {canClose && (
            <button onClick={onClose} className="grid size-8 place-items-center rounded-md text-muted hover:bg-subtle hover:text-ink" title={tr("Close (Esc)")}>
              ✕
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 overflow-y-auto p-6 sm:grid-cols-3 lg:grid-cols-4">
          {TEMPLATES.map((t) => (
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
                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold ${t.lang === "ar" ? "bg-emerald-50 text-emerald-700" : "bg-indigo-50 text-indigo-700"}`}>
                    {t.lang === "ar" ? "AR" : "FR"}
                  </span>
                </div>
                <span className="text-[11px] leading-snug text-muted">{tr(t.description)}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// A tiny drawing of the template's page.
function MiniPage({ t }: { t: Template }) {
  const tr = useT();
  const rtl = t.lang === "ar";
  const bar = (w: string, extra = "") => <div className={`h-1 rounded-full bg-slate-300 ${extra}`} style={{ width: w }} />;

  return (
    <div dir={rtl ? "rtl" : "ltr"} className="mx-auto flex aspect-[1/1.414] w-full flex-col gap-1.5 bg-white p-2.5 shadow-sm ring-1 ring-black/5">
      {t.header === "classic" && (
        <div className="grid grid-cols-[3fr_4fr_3fr] border border-slate-500">
          <div className="space-y-1 border-e border-slate-500 p-1">{bar("80%")}{bar("60%")}</div>
          <div className="flex flex-col items-center gap-1 border-e border-slate-500 p-1">{bar("90%", "bg-slate-500")}{bar("60%")}</div>
          <div className="space-y-1 p-1">{bar("70%")}{bar("60%")}</div>
          <div className="col-span-3 flex border-t border-slate-500">
            <div className="flex-1 space-y-1 p-1">{bar("70%")}{bar("40%")}</div>
            <div className="w-1/4 border-s border-slate-500" />
          </div>
        </div>
      )}
      {t.header === "modern" && (
        <div className="flex items-center justify-between rounded bg-indigo-50 p-1.5">
          <div className="flex-1 space-y-1">{bar("70%", "bg-indigo-400")}{bar("45%", "bg-indigo-200")}</div>
          <div className="size-4 rounded-full border border-indigo-400 bg-white" />
        </div>
      )}
      {t.header === "minimal" && (
        <div className="flex flex-col items-center gap-1 border-b border-slate-500 pb-1.5">
          {bar("50%", "bg-slate-500")}
          {bar("35%")}
        </div>
      )}
      {/* Content lines */}
      <div className="mt-1 space-y-1.5">
        {t.extras.length > 0 ? (
          t.extras.slice(0, 4).map((e, i) => (
            <div key={i} className="space-y-0.5">
              {bar(e.type === "text" ? "35%" : "75%", e.type === "text" ? "bg-slate-500" : "")}
              {e.type !== "text" && (
                <>
                  {bar("50%", "bg-slate-200")}
                  {bar("45%", "bg-slate-200")}
                </>
              )}
            </div>
          ))
        ) : (
          <div className="pt-6 text-center text-[9px] text-faint">{t.header ? "" : tr("Empty page")}</div>
        )}
      </div>
    </div>
  );
}
