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
export function NumberField({ label, value, onCommit, testId, compact = false }: { label: string; value: number; onCommit: (n: number) => GraphIssue | null; testId: string; compact?: boolean }) {
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
      <label htmlFor={id} className={compact ? "sr-only" : "text-xs text-muted"}>
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

export function TextField({ label, value, onChange, testId }: { label: string; value: string; onChange: (s: string) => void; testId: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} className={input} />
    </div>
  );
}
