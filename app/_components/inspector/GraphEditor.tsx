"use client";

import { ChevronDown, Plus, X } from "lucide-react";
import { useState } from "react";
import { tryCompile, type Fn } from "@/app/_lib/graphMath";
import {
  CURVE_PALETTE,
  MAX_FUNCTIONS,
  addFunction,
  addTangent,
  asymptoteLines,
  colorOf,
  findAsymptotes,
  fitY,
  formatNum,
  lineLabel,
  moveTangent,
  nameOf,
  optionsOf,
  removeFunction,
  removeTangent,
  setCurve,
  setFormula,
  tangentAt,
} from "@/app/_lib/mathGraph";
import type { GraphBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { AddRowButton, Field, NumberInput, RemoveButton, SmallButton } from "./fields";
import type { OnChange } from "./QuestionEditors";

export const USUAL_WINDOW = { xMin: -5, xMax: 5, yMin: -4, yMax: 6 };

// Formulas of the curves + the visible window (x and y ranges). Each curve has a few more things folded under it (its color, its
// derivative, its asymptotes, tangents). The window can also be moved and zoomed on the page itself (double-click the graph:
// canvas/blocks/GraphExplorer.tsx).
export function GraphEditor({ b, onChange }: { b: GraphBlock; onChange: OnChange }) {
  const t = useT();
  const [open, setOpen] = useState<number | null>(null); // the curve whose options are unfolded
  // Formula errors, in the app language ("Unexpected “)”" → key "Unexpected “{v}”").
  const errorText = (e: string) => {
    const m = /^(Unknown name|Unexpected|Missing) “(.*)”$/.exec(e);
    return m ? t(`${m[1]} “{v}”`, { v: m[2] }) : t(e);
  };
  const setFn = (i: number, v: string) => onChange(setFormula(b, i, v), `fn${i}`);
  const range = (key: "xMin" | "xMax" | "yMin" | "yMax", v: number) => {
    const next = { ...b, [key]: v };
    // Keep min < max.
    if (next.xMin < next.xMax && next.yMin < next.yMax) onChange({ [key]: v }, key);
  };
  const fitToCurves = () => {
    const fns = b.functions.flatMap((src, i) => (optionsOf(b, i).hidden ? [] : (tryCompile(src).fn ?? [])));
    const fit = fitY(fns, b.xMin, b.xMax);
    if (fit) onChange(fit, "window");
  };

  return (
    <>
      <Field label={t("Functions")}>
        <div className="flex flex-col gap-1.5">
          {b.functions.map((src, i) => {
            const { fn, error } = tryCompile(src);
            const unfolded = open === i;
            return (
              <div key={i}>
                <div className="flex items-center gap-1.5">
                  <span className="w-11 shrink-0 text-xs font-semibold" dir="ltr" style={{ color: colorOf(b, i) }}>
                    {nameOf(i)}(x) =
                  </span>
                  <input
                    dir="ltr"
                    data-keyboard="formula"
                    value={src}
                    spellCheck={false}
                    onChange={(e) => setFn(i, e.target.value)}
                    className={`w-full rounded-md border bg-white px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:ring-2 ${
                      error ? "border-red-300 focus:ring-red-100" : "border-line focus:border-accent focus:ring-accent-soft"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setOpen(unfolded ? null : i)}
                    title={t("Curve options")}
                    aria-label={t("Curve options")}
                    aria-expanded={unfolded}
                    data-testid={`curve-options-${i}`}
                    className="grid size-7 shrink-0 place-items-center rounded-[5px] text-faint outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    <ChevronDown size={13} strokeWidth={2} aria-hidden className={`transition-transform ${unfolded ? "rotate-180" : ""}`} />
                  </button>
                  {b.functions.length > 1 && (
                    <RemoveButton
                      title={t("Remove")}
                      onClick={() => {
                        onChange(removeFunction(b, i), "functions");
                        setOpen(null);
                      }}
                    />
                  )}
                </div>
                {error && <p className="mt-0.5 ps-12 text-[11px] text-red-700">{errorText(error)}</p>}
                {unfolded && <CurveOptions b={b} i={i} fn={fn ?? null} onChange={onChange} />}
              </div>
            );
          })}
          {b.functions.length < MAX_FUNCTIONS && <AddRowButton onClick={() => onChange(addFunction(b, "x") ?? {}, "functions")}>{t("Add a curve")}</AddRowButton>}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <Field label={t("x from")}>
          <NumberInput value={b.xMin} min={-1000} max={1000} onChange={(v) => range("xMin", v)} />
        </Field>
        <Field label={t("x to")}>
          <NumberInput value={b.xMax} min={-1000} max={1000} onChange={(v) => range("xMax", v)} />
        </Field>
        <Field label={t("y from")}>
          <NumberInput value={b.yMin} min={-1000} max={1000} onChange={(v) => range("yMin", v)} />
        </Field>
        <Field label={t("y to")}>
          <NumberInput value={b.yMax} min={-1000} max={1000} onChange={(v) => range("yMax", v)} />
        </Field>
      </div>
      <div className="flex gap-1.5">
        <SmallButton onClick={fitToCurves} title={t("Choose y so that the curves fit")}>
          {t("Fit to the curves")}
        </SmallButton>
        <SmallButton onClick={() => onChange(USUAL_WINDOW, "window")}>{t("Usual window")}</SmallButton>
      </div>

      <label className="flex items-center gap-2 text-xs text-ink">
        <input type="checkbox" checked={b.grid} onChange={(e) => onChange({ grid: e.target.checked }, "grid")} className="accent-accent" />
        {t("Show grid")}
      </label>
    </>
  );
}

// What else a curve shows: its color, its derivative f′ (dashed), its asymptotes, and its tangents at the x chosen.
function CurveOptions({ b, i, fn, onChange }: { b: GraphBlock; i: number; fn: Fn | null; onChange: OnChange }) {
  const t = useT();
  const o = optionsOf(b, i);
  const color = colorOf(b, i);
  const name = nameOf(i);
  const tangents = o.tangents ?? [];
  const change = (patch: Parameters<typeof setCurve>[2], key: string) => onChange(setCurve(b, i, patch), `curve${i}:${key}`);
  const found = fn && o.asymptotes ? asymptoteLines(findAsymptotes(fn, b.xMin, b.xMax)).map(lineLabel) : [];
  const addOne = () => {
    // the middle of the window, or a whole number near it where the curve has a tangent and there is none yet
    const mid = Math.round((b.xMin + b.xMax) / 2);
    const free = [0, 1, -1, 2, -2, 3, -3].map((d) => mid + d).find((a) => !tangents.some((x) => Math.abs(x - a) < 1e-9) && fn && tangentAt(fn, a));
    const changes = addTangent(b, i, free ?? mid);
    if (changes) onChange(changes, `curve${i}:tangent`);
  };

  return (
    <div className="ms-12 mt-1.5 flex flex-col gap-2 border-s-2 ps-2.5" style={{ borderColor: color }} data-testid={`curve-panel-${i}`}>
      <div className="flex items-center gap-1" role="group" aria-label={t("Color")}>
        {CURVE_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => change({ color: c === CURVE_PALETTE[i % CURVE_PALETTE.length] ? undefined : c }, "color")}
            aria-label={`${t("Color")} ${c}`}
            aria-pressed={c === color}
            style={{ background: c }}
            className={`size-4 rounded-full ${c === color ? "ring-2 ring-accent ring-offset-1" : ""}`}
          />
        ))}
      </div>
      <label className="flex items-center gap-2 text-xs text-ink">
        <input type="checkbox" checked={!!o.derivative} onChange={(e) => change({ derivative: e.target.checked || undefined }, "derivative")} className="accent-accent" />
        {t("Derivative")} <span dir="ltr">{name}′</span>
      </label>
      <label className="flex items-center gap-2 text-xs text-ink">
        <input type="checkbox" checked={!!o.asymptotes} onChange={(e) => change({ asymptotes: e.target.checked || undefined }, "asymptotes")} className="accent-accent" />
        {t("Asymptotes")}
      </label>
      {o.asymptotes && (
        <p className="-mt-1 text-xs leading-snug text-muted" dir="ltr">
          {found.length ? found.join(" · ") : t("No asymptote found in this window")}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {tangents.map((a, k) => {
          const tg = fn ? tangentAt(fn, a) : null;
          return (
            <div key={k} className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs text-muted">{t("Tangent at")}</span>
              <span className="shrink-0 text-xs text-muted" dir="ltr">
                x =
              </span>
              <div className="w-16 shrink-0">
                <NumberInput value={a} min={-1000} max={1000} step={0.5} onChange={(v) => onChange(moveTangent(b, i, k, v), `curve${i}:tangent${k}`)} />
              </div>
              <button
                type="button"
                onClick={() => onChange(removeTangent(b, i, k), `curve${i}:tangent`)}
                title={t("Remove")}
                aria-label={t("Remove")}
                className="grid size-6 shrink-0 place-items-center rounded-[5px] text-faint hover:bg-red-50 hover:text-red-700"
              >
                <X size={12} aria-hidden />
              </button>
              {!tg && <span className="text-[11px] text-red-700">{t("No tangent here")}</span>}
              {tg && (
                <span className="min-w-0 truncate text-[11px] text-faint" dir="ltr">
                  {name}′({formatNum(a)}) = {formatNum(tg.m)}
                </span>
              )}
            </div>
          );
        })}
        <button
          type="button"
          disabled={!fn}
          onClick={addOne}
          className="flex h-6 items-center gap-1 self-start rounded-[5px] px-1.5 text-xs text-muted hover:bg-hover hover:text-ink disabled:opacity-40"
        >
          <Plus size={11} strokeWidth={2} aria-hidden />
          {t("Add a tangent")}
        </button>
      </div>
    </div>
  );
}
