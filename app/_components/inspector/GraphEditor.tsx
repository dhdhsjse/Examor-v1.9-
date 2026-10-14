"use client";

import { tryCompile } from "@/app/_lib/graphMath";
import type { GraphBlock } from "@/app/_lib/types";
import { CURVE_COLORS } from "../canvas/blocks/GraphView";
import { AddRowButton, Field, NumberInput, RemoveButton } from "./fields";
import type { OnChange } from "./QuestionEditors";

const NAMES = ["f", "g", "h"];

// Common functions the teacher can start from.
const EXAMPLES = ["2x + 1", "x^2 - 2", "x^3 - 3x", "1/x", "sqrt(x)", "sin(x)", "e^x", "ln(x)", "|x|"];

// Formulas of the curves + the visible window (x and y ranges).
export function GraphEditor({ b, onChange }: { b: GraphBlock; onChange: OnChange }) {
  const setFn = (i: number, v: string) => onChange({ functions: b.functions.map((f, k) => (k === i ? v : f)) }, `fn${i}`);
  const range = (key: "xMin" | "xMax" | "yMin" | "yMax", v: number) => {
    const next = { ...b, [key]: v };
    // Keep min < max.
    if (next.xMin < next.xMax && next.yMin < next.yMax) onChange({ [key]: v }, key);
  };

  return (
    <>
      <Field label="Functions" hint="Write the formula with x — e.g. 2x+1, x^2-3, 1/x, sqrt(x), sin(x), e^x, ln(x).">
        <div className="flex flex-col gap-1.5">
          {b.functions.map((fn, i) => {
            const { error } = tryCompile(fn);
            return (
              <div key={i}>
                <div className="flex items-center gap-1.5">
                  <span className="w-11 shrink-0 text-xs font-semibold" style={{ color: CURVE_COLORS[i] }}>
                    {NAMES[i]}(x) =
                  </span>
                  <input
                    value={fn}
                    spellCheck={false}
                    onChange={(e) => setFn(i, e.target.value)}
                    className={`w-full rounded-md border bg-white px-2.5 py-1.5 font-mono text-[13px] text-ink outline-none focus:ring-2 ${
                      error ? "border-red-300 focus:ring-red-100" : "border-line focus:border-indigo-400 focus:ring-indigo-100"
                    }`}
                  />
                  {b.functions.length > 1 && <RemoveButton onClick={() => onChange({ functions: b.functions.filter((_, k) => k !== i) }, "functions")} />}
                </div>
                {error && <p className="mt-0.5 pl-12 text-[10px] text-red-600">{error}</p>}
              </div>
            );
          })}
          {b.functions.length < 3 && (
            <AddRowButton onClick={() => onChange({ functions: [...b.functions, "x"] }, "functions")}>Add a curve</AddRowButton>
          )}
        </div>
      </Field>

      <Field label="Examples (replace f)">
        <div className="flex flex-wrap gap-1">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setFn(0, ex)}
              className="rounded-md border border-line bg-white px-2 py-1 font-mono text-[11px] text-ink hover:border-indigo-300 hover:bg-indigo-50"
            >
              {ex}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <Field label="x from">
          <NumberInput value={b.xMin} min={-1000} max={1000} onChange={(v) => range("xMin", v)} />
        </Field>
        <Field label="x to">
          <NumberInput value={b.xMax} min={-1000} max={1000} onChange={(v) => range("xMax", v)} />
        </Field>
        <Field label="y from">
          <NumberInput value={b.yMin} min={-1000} max={1000} onChange={(v) => range("yMin", v)} />
        </Field>
        <Field label="y to">
          <NumberInput value={b.yMax} min={-1000} max={1000} onChange={(v) => range("yMax", v)} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink">
        <input type="checkbox" checked={b.grid} onChange={(e) => onChange({ grid: e.target.checked }, "grid")} className="accent-indigo-600" />
        Show grid
      </label>
      <p className="text-[10px] text-faint">Resize the graph with the corner handles on the page.</p>
    </>
  );
}
