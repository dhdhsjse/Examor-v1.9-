"use client";

import { Eraser, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ERASER_SIZES, type EraserMode } from "@/app/_lib/ink/eraser";
import type { EraserTool } from "@/app/_lib/ink/useEraserTool";
import { useT } from "@/app/_lib/uiLang";

// (the buttons of the floating tool bars)
const toolBtn = (on: boolean) =>
  `ui-icon grid size-8 place-items-center rounded-[5px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${on ? "bg-accent text-white" : "text-ink hover:bg-hover"}`;

const MODES: { mode: EraserMode; label: string; hint: string; Icon: typeof Eraser }[] = [
  { mode: "partial", label: "Eraser", hint: "Rubs out the parts of the drawings it goes over", Icon: Eraser },
  { mode: "stroke", label: "Stroke eraser", hint: "Rubs out whole drawings and shapes", Icon: Trash2 },
];

// The Eraser button of a floating tool bar (put it in the bar, which is `relative`). In hand, a bubble over it says how it rubs:
// a real eraser (the parts of the drawings it goes over) or the stroke eraser (whole drawings and shapes), and how big it is. The
// bubble steps aside when the eraser starts rubbing; clicking the button again brings it back (or hides it).
export default function EraserTools({ open, eraser, onOpen, shortcut }: { open: boolean; eraser: EraserTool; onOpen: () => void; shortcut?: string }) {
  const t = useT();
  const [bubble, setBubble] = useState(true);
  const shown = open && bubble;
  const label = shortcut ? `${t("Eraser")} (${shortcut})` : t("Eraser");
  const [lo, hi] = ERASER_SIZES;

  useEffect(() => {
    if (!shown) return;
    const hide = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.tagName === "CANVAS" && el.closest(".konvajs-content")) setBubble(false);
    };
    window.addEventListener("pointerdown", hide, true);
    return () => window.removeEventListener("pointerdown", hide, true);
  }, [shown]);

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={() => {
          if (!open) {
            setBubble(true);
            onOpen();
          } else setBubble(!bubble);
        }}
        aria-pressed={open}
        title={label}
        aria-label={label}
        data-testid="eraser-tool"
        className={toolBtn(open)}
      >
        <Eraser aria-hidden />
      </button>

      <div
        role="group"
        aria-label={t("Eraser")}
        aria-hidden={!shown}
        data-testid="eraser-panel"
        className={`absolute bottom-full left-1/2 mb-3 w-64 -translate-x-1/2 rounded-xl border border-line bg-white p-3 text-start shadow-[0_10px_30px_-10px_rgba(16,24,40,0.35)] transition-[opacity,transform] duration-200 ${shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"}`}
      >
        <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-lg bg-subtle p-1">
          {MODES.map(({ mode, label: name, Icon }) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={eraser.mode === mode}
              tabIndex={shown ? 0 : -1}
              onClick={() => eraser.setMode(mode)}
              data-testid={`eraser-${mode}`}
              className={`flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors ${eraser.mode === mode ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"}`}
            >
              <Icon size={14} strokeWidth={1.9} aria-hidden />
              {t(name)}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] leading-snug text-muted">{t(MODES.find((m) => m.mode === eraser.mode)?.hint ?? "")}</p>

        <div className="mt-3 flex items-center gap-2.5">
          <span className="text-xs text-muted">{t("Size")}</span>
          <input
            type="range"
            min={lo}
            max={hi}
            value={eraser.size}
            tabIndex={shown ? 0 : -1}
            onChange={(e) => eraser.setSize(Number(e.target.value))}
            aria-label={t("Size")}
            data-testid="eraser-size"
            className="min-w-0 flex-1 accent-[var(--color-accent,#4f46e5)]"
          />
          <span className="w-9 text-end text-xs tabular-nums text-ink">{eraser.size}px</span>
          {/* the tip, at its size on the screen (up to the room it has) */}
          <span className="grid size-10 shrink-0 place-items-center" aria-hidden>
            <span className="block rounded-full border border-ink/70 bg-white" style={{ width: Math.min(40, eraser.size), height: Math.min(40, eraser.size) }} />
          </span>
        </div>
      </div>
    </div>
  );
}
