"use client";

import { Keyboard, Pencil } from "lucide-react";
import { toggleStudioKeyboard, useKeyboardStore } from "@/app/_components/math-keyboard/keyboardStore";
import { useT } from "@/app/_lib/uiLang";

const toolBtn = (on: boolean) =>
  `grid size-7 place-items-center rounded-md transition-colors ${on ? "bg-indigo-600 text-white shadow-sm" : "text-muted hover:bg-black/5 hover:text-ink"}`;

// The small floating toolbar at the bottom of a Studio's drawing, like the one under the page (ToolRail): Select, the pencil, and after a
// line the math keyboard (it is not a tool: it shows / hides the keyboard that types in the field being written). Put it in a box that is
// `relative`: it floats over the bottom of it, in the middle.
export default function StudioDock({ pencil, selecting = !pencil, onSelect, onPencil, hint }: {
  /** The pencil is in hand */
  pencil: boolean;
  /** The Select tool is in hand (by default: when the pencil is not) */
  selecting?: boolean;
  onSelect: () => void;
  onPencil: () => void;
  /** The pencil's tooltip */
  hint: string;
}) {
  const t = useT();
  const { studio: keyboardOpen } = useKeyboardStore();
  const keyboardText = keyboardOpen ? t("Hide math keyboard") : t("Show math keyboard");
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-20 flex justify-center">
      <div data-testid="studio-dock" dir="ltr" className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-white/70 bg-white/80 p-1 shadow-[0_6px_20px_-6px_rgba(16,24,40,0.25)] backdrop-blur-md">
        <button type="button" onClick={onSelect} aria-pressed={selecting} title={t("Select and move")} aria-label={t("Select and move")} className={toolBtn(selecting)}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
            <path d="M3 1.5l9.5 7.2-4.3.6 2.6 4.9-1.9 1-2.6-5-3.3 3z" />
          </svg>
        </button>
        <button type="button" onClick={onPencil} aria-pressed={pencil} title={hint} aria-label={hint} data-testid="studio-pencil" className={toolBtn(pencil)}>
          <Pencil size={15} strokeWidth={1.9} aria-hidden />
        </button>
        <span aria-hidden className="mx-1 h-5 w-px bg-line" />
        <button
          type="button"
          onClick={toggleStudioKeyboard}
          // Keeps the focus (and the cursor) in the field being typed in.
          onMouseDown={(e) => e.preventDefault()}
          aria-pressed={keyboardOpen}
          title={keyboardText}
          aria-label={keyboardText}
          data-testid="keyboard-toggle"
          className={toolBtn(keyboardOpen)}
        >
          <Keyboard size={16} strokeWidth={1.75} aria-hidden />
        </button>
      </div>
    </div>
  );
}
