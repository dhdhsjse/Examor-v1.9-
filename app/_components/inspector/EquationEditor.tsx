"use client";

import type { MathfieldElement } from "mathlive";
import { useEffect, useRef } from "react";
import { mathCommand, setActiveMathfield } from "@/app/_lib/activeMathfield";
import type { EquationBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { Field } from "./fields";

interface VirtualKeyboard {
  hide(): void;
}

interface Props {
  b: EquationBlock;
  onLatex: (latex: string) => void;
  keyboardOpen: boolean;
  onToggleKeyboard: () => void;
}

// The equation field (MathLive). The buttons are on our own math keyboard under the pages.
export default function EquationEditor({ b, onLatex, keyboardOpen, onToggleKeyboard }: Props) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const mfRef = useRef<MathfieldElement | null>(null);
  const onLatexRef = useRef(onLatex);
  const startLatex = useRef(b.latex);

  useEffect(() => {
    onLatexRef.current = onLatex;
  });

  // Create the MathLive field once per equation block (MathLive only runs in the browser).
  useEffect(() => {
    let mf: MathfieldElement | null = null;
    let cancelled = false;
    import("mathlive").then(({ MathfieldElement }) => {
      if (cancelled || !hostRef.current) return;
      MathfieldElement.fontsDirectory = "/mathlive/fonts";
      MathfieldElement.soundsDirectory = null;
      const field = new MathfieldElement();
      mf = field;
      field.value = startLatex.current;
      field.mathVirtualKeyboardPolicy = "manual"; // never show MathLive's own keyboard
      field.addEventListener("input", () => onLatexRef.current(field.value));
      hostRef.current.appendChild(field);
      mfRef.current = field;
      setActiveMathfield({ field, onInput: () => onLatexRef.current(field.value) });
      (window as unknown as { mathVirtualKeyboard?: VirtualKeyboard }).mathVirtualKeyboard?.hide();
    });
    return () => {
      cancelled = true;
      mf?.remove();
      mfRef.current = null;
      setActiveMathfield(null);
    };
  }, [b.id]);

  // Keep the field in sync after undo/redo.
  useEffect(() => {
    const mf = mfRef.current;
    if (mf && mf.value !== b.latex) mf.setValue(b.latex, { silenceNotifications: true });
  }, [b.latex]);

  return (
    <>
      <Field label={t("Equation")} hint={t("Type here, or use the math keyboard under the pages.")}>
        <div ref={hostRef} className="equation-host" dir="ltr" />
      </Field>
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={onToggleKeyboard}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
            keyboardOpen ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" />
            <path d="M4 6.5h1M7.5 6.5h1M11 6.5h1M5 9.5h6" strokeLinecap="round" />
          </svg>
          {keyboardOpen ? t("Hide math keyboard") : t("Show math keyboard")}
        </button>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            mathCommand("selectAll");
            mathCommand("deleteBackward");
          }}
          className="rounded-md border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          {t("Clear")}
        </button>
      </div>
      <p className="text-[10px] leading-snug text-faint">
        {t("Tip: double-click the equation on the page to edit it. Resize it with the corner handles.")}
      </p>
    </>
  );
}
