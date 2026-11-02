"use client";

import { useId, useState } from "react";
import { formatNum } from "@/app/_lib/mathGraph";

export const inputCls = "w-full rounded-lg border border-line bg-subtle px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent";

// A number typed by the teacher: what is typed is theirs while the field has the focus (a lone "-" or "1." is on its way to a number),
// and what is a valid number within the limits goes to the graph as it is typed. The decimal comma is read too.
export function NumField({ value, onCommit, label, min = -1e6, max = 1e6, testId, className = "" }: { value: number; onCommit: (n: number) => void; label?: string; min?: number; max?: number; testId?: string; className?: string }) {
  const id = useId();
  const [text, setText] = useState<string | null>(null);
  const n = Number((text ?? "").replace(",", "."));
  const bad = text !== null && (text.trim() === "" || !Number.isFinite(n) || n < min || n > max);
  return (
    <div className={`flex min-w-0 flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-xs text-muted">
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        dir="ltr"
        value={text ?? formatNum(value).replace("−", "-")}
        data-testid={testId}
        aria-invalid={bad || undefined}
        onFocus={(e) => {
          setText(String(Math.round(value * 1e6) / 1e6));
          e.target.select();
        }}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value.replace(",", "."));
          if (e.target.value.trim() !== "" && Number.isFinite(v) && v >= min && v <= max) onCommit(v);
        }}
        onBlur={() => setText(null)}
        className={`${inputCls} tabular-nums ${bad ? "border-red-400" : ""}`}
      />
    </div>
  );
}
