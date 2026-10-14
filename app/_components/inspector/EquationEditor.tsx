"use client";

import type { MathfieldElement } from "mathlive";
import { useEffect, useRef } from "react";
import type { EquationBlock } from "@/app/_lib/types";
import { Field } from "./fields";

// Helper buttons: each one inserts a piece of LaTeX (#0 / #? = places to type).
const HELPERS: { label: string; latex: string; title: string }[] = [
  { label: "a⁄b", latex: "\\frac{#0}{#?}", title: "Fraction" },
  { label: "√", latex: "\\sqrt{#0}", title: "Square root" },
  { label: "ⁿ√", latex: "\\sqrt[#?]{#0}", title: "n-th root" },
  { label: "xⁿ", latex: "#@^{#?}", title: "Power" },
  { label: "xₙ", latex: "#@_{#?}", title: "Index" },
  { label: "( )", latex: "\\left(#0\\right)", title: "Parentheses" },
  { label: "|x|", latex: "\\left|#0\\right|", title: "Absolute value" },
  { label: "π", latex: "\\pi", title: "Pi" },
  { label: "∞", latex: "\\infty", title: "Infinity" },
  { label: "±", latex: "\\pm", title: "Plus minus" },
  { label: "×", latex: "\\times", title: "Times" },
  { label: "÷", latex: "\\div", title: "Divide" },
  { label: "≤", latex: "\\leq", title: "Less or equal" },
  { label: "≥", latex: "\\geq", title: "Greater or equal" },
  { label: "≠", latex: "\\neq", title: "Not equal" },
  { label: "≈", latex: "\\approx", title: "Approximately" },
  { label: "→", latex: "\\vec{#0}", title: "Vector" },
  { label: "∠", latex: "\\widehat{#0}", title: "Angle" },
  { label: "∫", latex: "\\int_{#?}^{#?}", title: "Integral" },
  { label: "Σ", latex: "\\sum_{#?}^{#?}", title: "Sum" },
  { label: "lim", latex: "\\lim_{#?\\to#?}", title: "Limit" },
  { label: "°", latex: "^{\\circ}", title: "Degree" },
  { label: "∈", latex: "\\in", title: "Belongs to" },
  { label: "ℝ", latex: "\\mathbb{R}", title: "Real numbers" },
];

interface VirtualKeyboard {
  visible: boolean;
  show(): void;
  hide(): void;
}

// MathLive editor: type equations visually, with helper buttons and a virtual keyboard.
export default function EquationEditor({ b, onLatex }: { b: EquationBlock; onLatex: (latex: string) => void }) {
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
      mf = new MathfieldElement();
      mf.value = startLatex.current;
      mf.mathVirtualKeyboardPolicy = "manual";
      mf.addEventListener("input", () => mf && onLatexRef.current(mf.value));
      hostRef.current.appendChild(mf);
      mfRef.current = mf;
    });
    return () => {
      cancelled = true;
      mf?.remove();
      mfRef.current = null;
    };
  }, [b.id]);

  // Keep the field in sync after undo/redo.
  useEffect(() => {
    const mf = mfRef.current;
    if (mf && mf.value !== b.latex) mf.setValue(b.latex, { silenceNotifications: true });
  }, [b.latex]);

  const insert = (latex: string) => {
    const mf = mfRef.current;
    if (!mf) return;
    mf.executeCommand(["insert", latex]);
    mf.focus();
  };

  const toggleKeyboard = () => {
    const kb = (window as unknown as { mathVirtualKeyboard?: VirtualKeyboard }).mathVirtualKeyboard;
    if (!kb) return;
    mfRef.current?.focus();
    if (kb.visible) kb.hide();
    else kb.show();
  };

  return (
    <>
      <Field label="Equation" hint="Type directly (e.g. x^2, sqrt, pi) or use the buttons below.">
        <div ref={hostRef} className="equation-host" />
      </Field>
      <div className="grid grid-cols-6 gap-1">
        {HELPERS.map((h) => (
          <button
            key={h.title}
            type="button"
            title={h.title}
            onMouseDown={(e) => e.preventDefault() /* keep focus in the field */}
            onClick={() => insert(h.latex)}
            className="h-8 rounded-md border border-line bg-white text-[13px] text-ink hover:border-indigo-300 hover:bg-indigo-50"
          >
            {h.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={toggleKeyboard}
        className="self-start rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
      >
        Math keyboard
      </button>
      <p className="text-[10px] text-faint">Resize the equation with the corner handles on the page.</p>
    </>
  );
}
