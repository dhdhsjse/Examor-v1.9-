"use client";

import { useId, useState } from "react";
import { MAX_PAPER, MIN_PAPER, type GraphIssue } from "@/app/_lib/graph/grid";
import { useT } from "@/app/_lib/uiLang";

const input = "w-full rounded-lg border border-line bg-subtle px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent";

/** What a refused change says, as an interface text (`t` of the Studio). */
export function issueText(issue: GraphIssue, t: (s: string, v?: Record<string, string | number>) => string, limits?: { min: number; max: number }): string {
  switch (issue) {
    case "x-range":
    case "y-range":
      return t("The minimum must be less than the maximum.");
    case "major-step":
    case "minor-step":
      return t("The step must be greater than zero.");
    case "size":
      return t("The paper must be between {min} and {max} px.", { min: limits?.min ?? 0, max: limits?.max ?? 0 });
    case "dense-major":
      return t("The main steps are too fine: their lines are left out.");
    case "dense-minor":
      return t("The fine steps are too fine: their lines are left out.");
    case "minor-larger":
      return t("The fine step is larger than the main step.");
  }
}

// A number the teacher types: the text is theirs while the field has the focus (so "-", "0." or "1e" can be typed on the way
// to a number), and the value of the Studio otherwise. A number is given to `onCommit` as it is typed; when the Studio refuses
// it (it would make the paper impossible to draw) the reason is shown under the field and the paper keeps its last good state.
export function NumberField({ label, value, onCommit, testId, compact = false, title }: { label: string; value: number; onCommit: (n: number) => GraphIssue | null; testId: string; compact?: boolean; title?: string }) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState<string | null>(null); // null = not being typed in
  const [error, setError] = useState<string | null>(null);

  const change = (raw: string) => {
    setText(raw);
    const n = Number(raw.replace(",", "."));
    if (raw.trim() === "" || !Number.isFinite(n)) return setError(t("Enter a number."));
    const issue = onCommit(n);
    setError(issue ? issueText(issue, t, { min: MIN_PAPER, max: MAX_PAPER }) : null);
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} title={title} className={compact ? "sr-only" : "text-xs text-muted"}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={text ?? String(value)}
        onFocus={() => setText(String(value))}
        onChange={(e) => change(e.target.value)}
        onBlur={() => {
          setText(null);
          setError(null);
        }}
        title={title}
        aria-invalid={error ? true : undefined}
        data-testid={testId}
        className={`${input} tabular-nums ${error ? "border-red-400" : ""}`}
      />
      {error && (
        <p role="alert" data-testid={`${testId}-error`} className="text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// A number that may also be left empty (the limits of a curve: empty = as far as the paper goes). Typing a number gives it to
// `onCommit`, emptying the field gives it undefined.
export function OptionalNumberField({ label, value, onCommit, testId, placeholder }: { label: string; value: number | undefined; onCommit: (n: number | undefined) => void; testId: string; placeholder?: string }) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const change = (raw: string) => {
    setText(raw);
    if (raw.trim() === "") {
      setError(null);
      return onCommit(undefined);
    }
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return setError(t("Enter a number."));
    setError(null);
    onCommit(n);
  };

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={text ?? (value === undefined ? "" : String(value))}
        placeholder={placeholder}
        onFocus={() => setText(value === undefined ? "" : String(value))}
        onChange={(e) => change(e.target.value)}
        onBlur={() => {
          setText(null);
          setError(null);
        }}
        aria-invalid={error ? true : undefined}
        data-testid={testId}
        className={`${input} tabular-nums ${error ? "border-red-400" : ""}`}
      />
      {error && (
        <p role="alert" data-testid={`${testId}-error`} className="text-[11px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

// `keyboard="formula"`: a formula the Studio reads (y = f(x)), so the math keyboard types "√(x)" and "x^2" there, not label markup.
export function TextField({ label, value, onChange, testId, hint, keyboard }: { label: string; value: string; onChange: (s: string) => void; testId: string; hint?: string; keyboard?: "formula" }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} data-keyboard={keyboard} className={input} />
      {hint && <p className="text-[11px] text-faint">{hint}</p>}
    </div>
  );
}

// A choice between a few things, as a drop-down (the labels are already in the app's language).
export function SelectField({ label, value, options, onChange, testId, title }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; testId: string; title?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} title={title} className="text-xs text-muted">
        {label}
      </label>
      <select id={id} value={value} title={title} onChange={(e) => onChange(e.target.value)} data-testid={testId} className={input}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
