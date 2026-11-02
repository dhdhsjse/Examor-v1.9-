"use client";

import { Eye, EyeOff, Plus, Trash2, X } from "lucide-react";
import { useMemo } from "react";
import { tryCompile } from "@/app/_lib/graphMath";
import {
  CURVE_PALETTE,
  MAX_FUNCTIONS,
  addFunction,
  addTangent,
  colorOf,
  findAsymptotes,
  formatNum,
  asymptoteLines,
  lineLabel,
  lineText,
  moveTangent,
  nameOf,
  optionsOf,
  removeFunction,
  removeTangent,
  setCurve,
  setFormula,
  tangentAt,
} from "@/app/_lib/mathGraph";
import { useT } from "@/app/_lib/uiLang";
import { NumField, inputCls } from "./fields";
import type { StudioGraph } from "./mathGraphPreset";

const EXAMPLES = ["x^2 - 2", "x^3 - 3x", "1/x", "(x^2 + 1)/x", "2x/(x - 1)", "sin(x)", "e^x", "ln(x)"];

interface Props {
  graph: StudioGraph;
  apply: (changes: Partial<StudioGraph>, key: string) => void;
  selected: number;
  onSelect: (i: number) => void;
}

// The functions of the graph, each with what is done to it: its formula, color, whether it is shown, its derivative, its asymptotes and
// the tangents at the points chosen. A tangent can also be added by clicking the curve (the tool above the graph).
export default function FunctionsPanel({ graph, apply, selected, onSelect }: Props) {
  const t = useT();
  const errorText = (e: string) => {
    const m = /^(Unknown name|Unexpected|Missing) “(.*)”$/.exec(e);
    return m ? t(`${m[1]} “{v}”`, { v: m[2] }) : t(e);
  };
  const add = (formula: string) => {
    // a function that is still empty is filled before another is added
    const last = graph.functions.length - 1;
    const changes = graph.functions[last]?.trim() === "" ? setFormula(graph, last, formula) : addFunction(graph, formula);
    if (changes) {
      apply(changes, `add:${Date.now()}`);
      onSelect(graph.functions[last]?.trim() === "" ? last : graph.functions.length);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3" data-testid="functions-panel">
      {graph.functions.map((src, i) => (
        <FunctionCard
          key={i}
          graph={graph}
          i={i}
          src={src}
          active={i === selected}
          apply={apply}
          onSelect={() => onSelect(i)}
          onRemove={() => {
            apply(removeFunction(graph, i), `remove:${Date.now()}`);
            onSelect(Math.max(0, Math.min(selected > i ? selected - 1 : selected, graph.functions.length - 2)));
          }}
          errorText={errorText}
        />
      ))}

      {graph.functions.length < MAX_FUNCTIONS && (
        <button type="button" onClick={() => add("")} data-testid="add-function" className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-accent bg-accent-soft/40 px-3 py-2 text-sm font-medium text-accent-strong hover:bg-accent-soft">
          <Plus size={15} />
          {t("Add a function")}
        </button>
      )}

      <section className="flex flex-col gap-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Examples")}</h4>
        <div className="flex flex-wrap gap-1" dir="ltr">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => add(ex)} disabled={graph.functions.length >= MAX_FUNCTIONS && graph.functions[graph.functions.length - 1]?.trim() !== ""} className="rounded-md border border-line bg-white px-2 py-1 font-mono text-[11px] text-ink hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-40">
              {ex}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function FunctionCard({ graph, i, src, active, apply, onSelect, onRemove, errorText }: { graph: StudioGraph; i: number; src: string; active: boolean; apply: Props["apply"]; onSelect: () => void; onRemove: () => void; errorText: (e: string) => string }) {
  const t = useT();
  const o = optionsOf(graph, i);
  const color = colorOf(graph, i);
  const name = nameOf(i);
  const { fn, error } = useMemo(() => tryCompile(src), [src]);
  const blank = src.trim() === "";
  const found = useMemo(() => (fn && o.asymptotes ? asymptoteLines(findAsymptotes(fn, graph.xMin, graph.xMax)).map(lineLabel) : []), [fn, o.asymptotes, graph.xMin, graph.xMax]);
  const change = (patch: Parameters<typeof setCurve>[2], key: string) => apply(setCurve(graph, i, patch), `curve:${i}:${key}`);
  const tangents = o.tangents ?? [];

  return (
    <section data-testid={`function-${i}`} data-active={active || undefined} onMouseDown={onSelect} className={`flex flex-col gap-2.5 rounded-xl border bg-white p-3 transition-colors ${active ? "border-accent shadow-sm" : "border-line"} ${o.hidden ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-1.5">
        <span className="size-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        <span className="shrink-0 text-xs font-semibold" dir="ltr" style={{ color }}>
          {name}(x) =
        </span>
        <input
          dir="ltr"
          value={src}
          spellCheck={false}
          data-keyboard="formula"
          data-testid={`formula-${i}`}
          placeholder="x^2 - 2"
          onFocus={onSelect}
          onChange={(e) => apply(setFormula(graph, i, e.target.value), `formula:${i}`)}
          className={`${inputCls} min-w-0 flex-1 font-mono ${error && !blank ? "border-red-300" : ""}`}
        />
        <button type="button" onClick={() => change({ hidden: !o.hidden }, "hidden")} title={o.hidden ? t("Show this function") : t("Hide this function")} aria-label={o.hidden ? t("Show this function") : t("Hide this function")} aria-pressed={!o.hidden} data-testid={`toggle-${i}`} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink">
          {o.hidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>
        {graph.functions.length > 1 && (
          <button type="button" onClick={onRemove} title={t("Remove this function")} aria-label={t("Remove this function")} data-testid={`remove-${i}`} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600">
            <Trash2 size={15} />
          </button>
        )}
      </div>
      {error && !blank && <p className="-mt-1 text-[11px] text-red-600">{errorText(error)}</p>}

      <div className="flex items-center gap-1" role="group" aria-label={t("Color")}>
        {CURVE_PALETTE.map((c) => (
          <button key={c} type="button" onClick={() => change({ color: c === CURVE_PALETTE[i % CURVE_PALETTE.length] ? undefined : c }, "color")} aria-label={`${t("Color")} ${c}`} aria-pressed={c === color} style={{ background: c }} className={`size-5 rounded-full border ${c === color ? "ring-2 ring-accent ring-offset-1" : "border-white"}`} />
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip on={!!o.derivative} onClick={() => change({ derivative: !o.derivative }, "derivative")} testId={`derivative-${i}`} title={t("Draw the curve of the derivative, dashed")}>
          {t("Derivative")} {name}′
        </Chip>
        <Chip on={!!o.asymptotes} onClick={() => change({ asymptotes: !o.asymptotes }, "asymptotes")} testId={`asymptotes-${i}`} title={t("Draw the lines the curve gets closer to")}>
          {t("Asymptotes")}
        </Chip>
      </div>
      {o.asymptotes && (
        <p data-testid={`asymptote-list-${i}`} className="text-[11px] leading-snug text-muted" dir="ltr">
          {found.length ? found.join(" · ") : t("No asymptote found in this window")}
        </p>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-ink">{t("Tangents")}</h4>
          <button
            type="button"
            disabled={!fn}
            onClick={() => {
              const mid = Math.round(((graph.xMin + graph.xMax) / 2) * 10) / 10;
              const free = [0, 1, -1, 2, -2, 3, -3].map((d) => mid + d).find((a) => !tangents.some((x) => Math.abs(x - a) < 1e-9) && fn && tangentAt(fn, a));
              const changes = addTangent(graph, i, free ?? mid);
              if (changes) apply(changes, `tangent:${i}:${Date.now()}`);
            }}
            data-testid={`add-tangent-${i}`}
            className="flex items-center gap-1 rounded-md border border-line px-2 py-0.5 text-xs font-medium text-ink hover:border-accent hover:bg-accent-soft disabled:opacity-40"
          >
            <Plus size={12} />
            {t("Add a tangent")}
          </button>
        </div>
        {tangents.map((a, k) => {
          const tg = fn ? tangentAt(fn, a) : null;
          return (
            <div key={k} data-testid={`tangent-${i}-${k}`} className="flex items-center gap-2">
              <span className="shrink-0 text-xs text-muted" dir="ltr">
                x =
              </span>
              <NumField value={a} onCommit={(v) => apply(moveTangent(graph, i, k, v), `tangent-x:${i}:${k}`)} className="w-20 shrink-0" testId={`tangent-x-${i}-${k}`} />
              <span className="min-w-0 flex-1 text-[11px] leading-tight text-muted" dir="ltr" data-testid={`tangent-info-${i}-${k}`}>
                {tg ? (
                  <>
                    {name}′({formatNum(a)}) = {formatNum(tg.m)}
                    <br />
                    {lineText(tg.m, tg.p)}
                  </>
                ) : (
                  <span className="text-red-600">
                    {t("No tangent here")}
                  </span>
                )}
              </span>
              <button type="button" onClick={() => apply(removeTangent(graph, i, k), `tangent:${i}:${Date.now()}`)} title={t("Remove")} aria-label={t("Remove")} className="grid size-6 shrink-0 place-items-center rounded-md text-muted hover:bg-red-50 hover:text-red-600">
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Chip({ on, onClick, children, title, testId }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string; testId?: string }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-pressed={on} data-testid={testId} className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-white text-muted hover:border-accent hover:text-ink"}`}>
      {children}
    </button>
  );
}
