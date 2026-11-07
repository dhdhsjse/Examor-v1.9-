"use client";

import { ChevronDown, Plus } from "lucide-react";
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
import { AddRowButton, Field, Group, NumberInput, RemoveButton, Row, SmallButton, Toggle, iconButtonCls, inputCls } from "./fields";
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
      <Field group label={t("Functions")}>
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
                    aria-label={`${nameOf(i)}(x)`}
                    className={`${inputCls} h-7 font-mono ${error ? "border-red-300! focus:border-red-400!" : ""}`}
                  />
                  <button
                    type="button"
                    onClick={() => setOpen(unfolded ? null : i)}
                    title={t("Curve options")}
                    aria-label={t("Curve options")}
                    aria-expanded={unfolded}
                    data-testid={`curve-options-${i}`}
                    className={iconButtonCls}
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
                {/* (under the formula: the width of the name and its gap) */}
                {error && <p className="mt-0.5 ps-[50px] text-[11px] leading-snug text-red-700">{errorText(error)}</p>}
                {unfolded && <CurveOptions b={b} i={i} fn={fn ?? null} onChange={onChange} />}
              </div>
            );
          })}
          {b.functions.length < MAX_FUNCTIONS && <AddRowButton onClick={() => onChange(addFunction(b, "x") ?? {}, "functions")}>{t("Add a curve")}</AddRowButton>}
        </div>
      </Field>

      {/* The window: x and y, each from … to on one row */}
      <Group>
        {(
          [
            { axis: "x", lo: "xMin", hi: "xMax", from: t("x from"), to: t("x to") },
            { axis: "y", lo: "yMin", hi: "yMax", from: t("y from"), to: t("y to") },
          ] as const
        ).map(({ axis, lo, hi, from, to }) => (
          <Row key={axis} label={<span className="font-mono text-ink" dir="ltr">{axis}</span>}>
            <NumberInput value={b[lo]} min={-1000} max={1000} ariaLabel={from} className="w-16" onChange={(v) => range(lo, v)} />
            <span className="text-xs text-muted" aria-hidden>…</span>
            <NumberInput value={b[hi]} min={-1000} max={1000} ariaLabel={to} className="w-16" onChange={(v) => range(hi, v)} />
          </Row>
        ))}
        <div className="grid grid-cols-2 gap-1.5">
          <SmallButton onClick={fitToCurves} title={t("Choose y so that the curves fit")}>
            <span className="truncate">{t("Fit to the curves")}</span>
          </SmallButton>
          <SmallButton onClick={() => onChange(USUAL_WINDOW, "window")}>
            <span className="truncate">{t("Usual window")}</span>
          </SmallButton>
        </div>
        <Toggle checked={b.grid} onChange={(grid) => onChange({ grid }, "grid")} label={t("Show grid")} />
      </Group>
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
    // (the whole width of the panel, marked by the curve's color: the rows keep room for their controls)
    <div className="mt-1.5 flex flex-col border-s-2 ps-2" style={{ borderColor: color }} data-testid={`curve-panel-${i}`}>
      <div className="flex h-7 items-center gap-1.5" role="group" aria-label={t("Color")}>
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
      <Toggle
        checked={!!o.derivative}
        onChange={(on) => change({ derivative: on || undefined }, "derivative")}
        label={
          <>
            {t("Derivative")} <span dir="ltr">{name}′</span>
          </>
        }
      />
      <Toggle checked={!!o.asymptotes} onChange={(on) => change({ asymptotes: on || undefined }, "asymptotes")} label={t("Asymptotes")} />
      {o.asymptotes && (
        <p className="pb-1 text-xs leading-snug text-muted [overflow-wrap:anywhere]" dir="ltr">
          {found.length ? found.join(" · ") : t("No asymptote found in this window")}
        </p>
      )}
      {/* Tangents: x = [a]  f′(a) = m  ×  (its slope, or why there is none, in the space left) */}
      {tangents.map((a, k) => {
        const tg = fn ? tangentAt(fn, a) : null;
        return (
          <div key={k} className="flex h-8 items-center gap-1.5" role="group" aria-label={t("Tangent at")}>
            <span className="shrink-0 text-xs text-muted" dir="ltr">
              x =
            </span>
            <NumberInput value={a} min={-1000} max={1000} step={0.5} ariaLabel={t("Tangent at")} className="w-14" onChange={(v) => onChange(moveTangent(b, i, k, v), `curve${i}:tangent${k}`)} />
            {tg ? (
              <span className="min-w-0 flex-1 truncate text-[11px] text-faint" dir="ltr">
                {name}′({formatNum(a)}) = {formatNum(tg.m)}
              </span>
            ) : (
              <span className="min-w-0 flex-1 truncate text-[11px] text-red-700" title={t("No tangent here")}>
                {t("No tangent here")}
              </span>
            )}
            <RemoveButton title={t("Remove")} onClick={() => onChange(removeTangent(b, i, k), `curve${i}:tangent`)} />
          </div>
        );
      })}
      <button
        type="button"
        disabled={!fn}
        onClick={addOne}
        className="flex h-7 items-center gap-1.5 self-start rounded-[5px] px-1.5 text-xs text-muted outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-40"
      >
        <Plus size={12} strokeWidth={2} aria-hidden />
        {t("Add a tangent")}
      </button>
    </div>
  );
}
