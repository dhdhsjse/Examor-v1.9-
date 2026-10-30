"use client";

import type { MathfieldElement } from "mathlive";
import { useEffect, useRef } from "react";
import { clearActiveMathfield, setActiveMathfield } from "@/app/_lib/activeMathfield";
import type { CurrentFormula } from "@/app/_lib/currentFormula";
import { useT } from "@/app/_lib/uiLang";
import { Field } from "./fields";

// The formula being edited in a text box (currentFormula.ts), in a big equation field of the Properties panel, like an equation block's:
// typed here (or with the math keyboard once clicked in), it changes in the text at once. A press here keeps the text box open
// (data-text-format).
export default function FormulaField({ formula }: { formula: CurrentFormula }) {
  const t = useT();
  const hostRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<MathfieldElement | null>(null);
  const latest = useRef(formula);
  useEffect(() => {
    latest.current = formula;
  });

  // One field per formula (MathLive only runs in the browser).
  useEffect(() => {
    let field: MathfieldElement | null = null;
    let cancelled = false;
    void import("mathlive").then(({ MathfieldElement }) => {
      if (cancelled || !hostRef.current) return;
      MathfieldElement.fontsDirectory = "/mathlive/fonts";
      MathfieldElement.soundsDirectory = null;
      field = new MathfieldElement();
      const f = field;
      f.mathVirtualKeyboardPolicy = "manual"; // our own keyboard, never MathLive's
      f.mathModeSpace = "\\:"; // the space bar puts a space in the formula
      f.value = latest.current.latex;
      const send = () => latest.current.setLatex(f.value);
      f.addEventListener("input", send);
      f.addEventListener("focus", () => setActiveMathfield({ field: f, onInput: send }));
      f.addEventListener("blur", () => clearActiveMathfield(f));
      hostRef.current.appendChild(f);
      fieldRef.current = f;
    });
    return () => {
      cancelled = true;
      if (field) clearActiveMathfield(field);
      field?.remove();
      fieldRef.current = null;
    };
  }, [formula.id]);

  // Typed in the text (or undone): the field here follows.
  useEffect(() => {
    const f = fieldRef.current;
    if (f && f.value !== formula.latex) f.setValue(formula.latex, { silenceNotifications: true });
  }, [formula.latex]);

  return (
    <div data-text-format="" data-testid="formula-field">
      <Field label={t("Formula")} hint={t("The formula selected in the text box: type here, or with the math keyboard.")}>
        <div ref={hostRef} className="equation-host" dir="ltr" />
      </Field>
    </div>
  );
}
