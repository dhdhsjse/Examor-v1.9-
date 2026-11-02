"use client";

import { Keyboard } from "lucide-react";
import { useEffect } from "react";
import type { PlainFlavor } from "@/app/_lib/keyboard/plainText";
import { useT } from "@/app/_lib/uiLang";
import { trackTextFields } from "./fieldTarget";
import FloatingKeyboard from "./FloatingKeyboard";
import { setStudioKeyboard, toggleStudioKeyboard, useKeyboardStore } from "./keyboardStore";

// The math keyboard inside a studio (Graph, Circuit, Molecule drawing…). Put it once in the studio, next to its dialogs: it follows the
// text fields the teacher clicks in, shows the keyboard window while the button of the header is on, and puts it away when the
// studio closes, so every studio opens without it. `flavor` is the kind of text a field takes unless it says otherwise (data-keyboard): the labels of
// the graph studios read their scripts as markup (the default), the texts of a chart are plain ("text": x², H₂O).
export function StudioKeyboard({ flavor }: { flavor?: PlainFlavor }) {
  const { studio } = useKeyboardStore();
  useEffect(() => {
    const stop = trackTextFields(flavor);
    return () => {
      stop();
      setStudioKeyboard(false);
    };
  }, [flavor]);
  return studio ? <FloatingKeyboard target="field" onClose={() => setStudioKeyboard(false)} /> : null;
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
