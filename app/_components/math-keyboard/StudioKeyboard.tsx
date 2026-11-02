"use client";

import { Keyboard } from "lucide-react";
import { useEffect } from "react";
import { useT } from "@/app/_lib/uiLang";
import { trackTextFields } from "./fieldTarget";
import FloatingKeyboard from "./FloatingKeyboard";
import { setStudioKeyboard, toggleStudioKeyboard, useKeyboardStore } from "./keyboardStore";

// The math keyboard inside a studio (Graph, Circuit, Molecule drawing…). Put it once in the studio, next to its dialogs: it follows the
// text fields the teacher clicks in, shows the keyboard window while the button of the header is on, and puts it away when the
// studio closes, so every studio opens without it.
export function StudioKeyboard() {
  const { studio } = useKeyboardStore();
  useEffect(() => {
    const stop = trackTextFields();
    return () => {
      stop();
      setStudioKeyboard(false);
    };
  }, []);
  return studio ? <FloatingKeyboard where="studio"onClose={() => setStudioKeyboard(false)} /> : null;
}

// The keyboard button for the header of a studio, where the top bar of the page is out of reach. Same icon as the top bar's.
export function StudioKeyboardButton() {
  const t = useT();
  const { studio } = useKeyboardStore();
  const text = studio ? t("Hide math keyboard") : t("Show math keyboard");
  return (
    <button
      type="button"
      onClick={toggleStudioKeyboard}
      // Keeps the focus (and the cursor) in the field being typed in.
      onMouseDown={(e) => e.preventDefault()}
      title={text}
      aria-label={text}
      aria-pressed={studio}
      data-testid="keyboard-toggle"
      className={`grid size-8 shrink-0 place-items-center rounded-lg transition-colors ${studio ? "bg-accent-soft text-accent-strong" : "text-muted hover:bg-subtle hover:text-ink"}`}
    >
      <Keyboard size={16} strokeWidth={1.75} aria-hidden />
    </button>
  );
}
