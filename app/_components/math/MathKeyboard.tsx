"use client";

import { useEffect, useState } from "react";
import { mathCommand } from "@/app/_lib/activeMathfield";
import { svgUrl } from "@/app/_lib/library";
import { renderEquation } from "@/app/_lib/math";
import { MATH_TABS, keyLabel, type MathKey } from "@/app/_lib/mathKeys";
import { useT } from "@/app/_lib/uiLang";

const TAB_KEY = "examBuilder.mathTab";
const labelCache = new Map<string, string>();

// The key's formula drawn by MathJax (same look as on the page).
function KeyFace({ latex }: { latex: string }) {
  const [src, setSrc] = useState(() => labelCache.get(latex) ?? null);
  useEffect(() => {
    if (src) return;
    let alive = true;
    renderEquation(latex)
      .then((r) => {
        const url = svgUrl(r.svg);
        labelCache.set(latex, url);
        if (alive) setSrc(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [latex, src]);
  // eslint-disable-next-line @next/next/no-img-element -- small local svg
  return src ? <img src={src} alt="" className="pointer-events-none max-h-7 max-w-full object-contain" draggable={false} /> : <span className="text-faint">…</span>;
}

// Floating keyboard under the pages while an equation is selected. "×" closes it.
export default function MathKeyboard({ onClose }: { onClose: () => void }) {
  const t = useT();
  const [tabId, setTabId] = useState(() => {
    try {
      return localStorage.getItem(TAB_KEY) ?? "basic";
    } catch {
      return "basic";
    }
  });
  const tab = MATH_TABS.find((x) => x.id === tabId) ?? MATH_TABS[0];

  const pickTab = (id: string) => {
    setTabId(id);
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {}
  };

  // Buttons never take the focus away from the equation field.
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const press = (key: MathKey) => mathCommand(["insert", key.latex, { selectionMode: "placeholder" }]);

  return (
    <div
      className="pointer-events-auto flex max-h-[46vh] flex-col overflow-hidden rounded-xl border border-line bg-white/95 shadow-[0_18px_50px_-12px_rgba(16,24,40,0.35)] backdrop-blur-md"
      onMouseDown={keep}
    >
      {/* Tabs + close */}
      <div className="flex items-center gap-1 border-b border-line bg-subtle/70 px-2 py-1.5">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {MATH_TABS.map((x) => (
            <button
              key={x.id}
              onClick={() => pickTab(x.id)}
              className={`shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                x.id === tab.id ? "bg-white text-indigo-600 shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"
              }`}
            >
              {t(x.name)}
            </button>
          ))}
        </div>
        <button onClick={onClose} title={t("Close the keyboard")} className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-red-50 hover:text-red-600">
          <svg width="11" height="11" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2 2l6 6M8 2L2 8" />
          </svg>
        </button>
      </div>

      {/* Keys */}
      <div className="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-1.5 overflow-y-auto p-2.5" dir="ltr">
        {tab.keys.map((key) => (
          <button
            key={key.latex + key.title}
            title={key.title}
            onMouseDown={keep}
            onClick={() => press(key)}
            className={`flex h-11 items-center justify-center rounded-lg border border-line bg-white px-1.5 transition hover:-translate-y-px hover:border-indigo-300 hover:bg-indigo-50/60 hover:shadow-sm active:translate-y-0 ${
              key.wide ? "col-span-3" : ""
            }`}
          >
            <KeyFace latex={keyLabel(key)} />
          </button>
        ))}
      </div>

      {/* Editing keys */}
      <div className="flex items-center gap-1.5 border-t border-line px-2.5 py-1.5 text-xs">
        <EditKey title={t("Move left")} onClick={() => mathCommand("moveToPreviousChar")}>◀</EditKey>
        <EditKey title={t("Move right")} onClick={() => mathCommand("moveToNextChar")}>▶</EditKey>
        <EditKey title={t("Delete")} onClick={() => mathCommand("deleteBackward")}>⌫ {t("Delete")}</EditKey>
        <EditKey title={t("Undo")} onClick={() => mathCommand("undo")}>↶ {t("Undo")}</EditKey>
        <span className="ms-auto text-[11px] text-faint">{t("Tip: you can also type — x^2, sqrt, pi, lim…")}</span>
      </div>
    </div>
  );
}

function EditKey({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded-md border border-line bg-white px-2.5 py-1 font-medium text-ink hover:border-indigo-300 hover:bg-indigo-50"
    >
      {children}
    </button>
  );
}
