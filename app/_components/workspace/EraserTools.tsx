"use client";

import { Eraser, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ERASER_SIZES, type EraserMode } from "@/app/_lib/ink/eraser";
import type { EraserTool } from "@/app/_lib/ink/useEraserTool";
import { useT } from "@/app/_lib/uiLang";

// (the buttons of the floating tool bars)
const toolBtn = (on: boolean, corner: string) =>
  `ui-icon grid size-8 place-items-center ${corner} transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${on ? "bg-accent text-white" : "text-ink hover:bg-hover"}`;

const MODES: { mode: EraserMode; label: string; hint: string; Icon: typeof Eraser }[] = [
  { mode: "partial", label: "Eraser", hint: "Rubs out the parts of the drawings it goes over", Icon: Eraser },
  { mode: "stroke", label: "Stroke eraser", hint: "Rubs out whole drawings and shapes", Icon: Trash2 },
];

// The Eraser button of a floating tool bar (put it in the bar, which is `relative`). In hand, a bubble over it says how it rubs:
// a real eraser (the parts of the drawings it goes over) or the stroke eraser (whole drawings and shapes), and how big it is. The
// bubble steps aside when the eraser starts rubbing; clicking the button again brings it back (or hides it).
export default function EraserTools({ open, eraser, onOpen, shortcut, corner = "rounded-[5px]", button }: { open: boolean; eraser: EraserTool; onOpen: () => void; shortcut?: string; /** The button's corners, like the other buttons of its bar */ corner?: string; /** The button's whole look, for a bar in other colors (the table tools' bar) */ button?: (on: boolean) => string }) {
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
        className={button ? button(open) : toolBtn(open, corner)}
      >
        <Eraser aria-hidden />
      </button>

      <div
        role="group"
        aria-label={t("Eraser")}
        aria-hidden={!shown}
        data-testid="eraser-panel"
        className={`absolute bottom-full left-1/2 mb-2 w-64 -translate-x-1/2 rounded-md border border-line bg-white p-3 text-start shadow-sm transition-[opacity,transform] duration-200 ${shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1 opacity-0"}`}
      >
        <div role="radiogroup" className="grid h-7 grid-cols-2 overflow-hidden rounded border border-line">
          {MODES.map(({ mode, label: name, Icon }) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={eraser.mode === mode}
              tabIndex={shown ? 0 : -1}
              onClick={() => eraser.setMode(mode)}
              data-testid={`eraser-${mode}`}
              className={`flex items-center justify-center gap-1 text-xs not-first:border-s not-first:border-line ${eraser.mode === mode ? "bg-accent-soft font-medium text-accent-strong" : "text-muted hover:bg-hover hover:text-ink"}`}
            >
              <Icon size={14} aria-hidden />
              {t(name)}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs leading-snug text-muted">{t(MODES.find((m) => m.mode === eraser.mode)?.hint ?? "")}</p>

        <div className="mt-2 flex items-center gap-2">
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
            className="min-w-0 flex-1 accent-accent"
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
