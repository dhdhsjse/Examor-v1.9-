"use client";

import { EyeOff, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { curveName } from "@/app/_lib/graph/annotations";
import { FUNCTION_SPECS, MAX_STROKE, MIN_STROKE, parseDataText, sampleCurve } from "@/app/_lib/graph/mathUtils";
import { useT } from "@/app/_lib/uiLang";
import { NumberField } from "./fields";
import type { GraphStudioState } from "./useGraphStudio";

const check = "size-4 accent-indigo-600";

// The values of a series of measured points as a table (x, y, one row per point), with the points added by a button or pasted
// from a spreadsheet. Every cell is live: the point moves on the paper as it is typed.
function DataInspector({ studio }: { studio: GraphStudioState }) {
  const t = useT();
  const { config, selected, updateFunction, updateDataPoint, removeDataPoint, addDataPoint, addDataPoints } = studio;
  const [pasted, setPasted] = useState("");
  const [result, setResult] = useState<{ added: number; rejected: number } | null>(null);
  if (!selected) return null;
  const points = selected.points ?? [];
  const last = points[points.length - 1];

  const addPasted = () => {
    const { points: values, rejected } = parseDataText(pasted);
    addDataPoints(selected.id, values);
    setResult({ added: values.length, rejected });
    if (values.length) setPasted("");
  };

  return (
    <>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={selected.showPoints !== false} onChange={(e) => updateFunction(selected.id, { showPoints: e.target.checked })} data-testid="show-points" className={check} />
        {t("Show the points")}
      </label>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={selected.lineStyle === "straight"} onChange={(e) => updateFunction(selected.id, { lineStyle: e.target.checked ? "straight" : "none" })} data-testid="connect-points" className={check} />
        {t("Join the points with lines")}
      </label>

      <div className="flex flex-col gap-1.5" data-testid="points-table">
        <div className="grid grid-cols-[1fr_1fr_1.5rem] gap-1.5 text-xs text-muted" dir="ltr">
          <span>x</span>
          <span>y</span>
          <span />
        </div>
        {points.length === 0 && <p className="text-xs text-muted">{t("No points yet: click the paper with the points tool, add a row, or paste values.")}</p>}
        <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pe-0.5" dir="ltr">
          {points.map((p, i) => (
            <div key={p.id} className="grid grid-cols-[1fr_1fr_1.5rem] items-start gap-1.5" data-point-row={i}>
              <NumberField
                compact
                label={`x ${i + 1}`}
                value={p.x}
                onCommit={(x) => {
                  updateDataPoint(selected.id, p.id, { x });
                  return null;
                }}
                testId={`point-x-${i}`}
              />
              <NumberField
                compact
                label={`y ${i + 1}`}
                value={p.y}
                onCommit={(y) => {
                  updateDataPoint(selected.id, p.id, { y });
                  return null;
                }}
                testId={`point-y-${i}`}
              />
              <button onClick={() => removeDataPoint(selected.id, p.id)} aria-label={t("Remove this point")} title={t("Remove this point")} data-testid={`point-remove-${i}`} className="mt-1 grid size-6 place-items-center rounded text-muted hover:bg-red-50 hover:text-red-600">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => addDataPoint(last ? last.x + config.majorGridStep : 0, last ? last.y : 0)} data-testid="add-row" className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft">
          {t("Add a row")}
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs text-muted" htmlFor="paste-values">
          {t("Paste values (one point per line: x and y)")}
        </label>
        <textarea id="paste-values" value={pasted} onChange={(e) => setPasted(e.target.value)} rows={3} dir="ltr" placeholder={"0\t9\n1\t6,2\n2\t4.1"} data-testid="paste-values" className="w-full rounded-lg border border-line bg-subtle px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:border-accent" />
        <button onClick={addPasted} disabled={!pasted.trim()} data-testid="paste-add" className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft disabled:opacity-40">
          {t("Add these values")}
        </button>
        {result && (
          <p role="status" data-testid="paste-result" className="text-xs text-muted">
            {t("{added} added, {rejected} skipped", { added: result.added, rejected: result.rejected })}
          </p>
        )}
      </div>
    </>
  );
}

// The curves of the paper (top of the right panel): the list of them, and for the selected one its formula and parameters (or, for
// a series of measured points, its table of values), its colour and thickness, and whether the student version has it; live: every
// change redraws the curve at once.
export default function CurvesPanel({ studio }: { studio: GraphStudioState }) {
  const t = useT();
  const { config, selected, selectFunction, updateFunction, removeFunction } = studio;
  const status = useMemo(() => (selected ? sampleCurve(selected, config).status : "ok"), [selected, config]);
  const spec = selected ? FUNCTION_SPECS[selected.type] : null;
  const isData = selected?.type === "data";

  return (
    <section data-testid="graph-curves" className="flex flex-col gap-2.5 border-b border-line px-4 py-3.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Curves")}</h4>

      {config.functions.length === 0 ? (
        <p className="text-xs text-muted" data-testid="no-curves">
          {t("No curve yet: pick a function in the Functions list.")}
        </p>
      ) : (
        <div className="flex flex-col gap-1" role="listbox" aria-label={t("Curves")}>
          {config.functions.map((fn) => {
            const on = fn.id === selected?.id;
            const { name, n } = curveName(config, fn);
            return (
              <button
                key={fn.id}
                role="option"
                aria-selected={on}
                onClick={() => selectFunction(on ? null : fn.id)}
                data-curve={fn.id}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-start text-sm transition-colors ${on ? "border-accent bg-accent-soft text-accent-strong ring-1 ring-accent" : "border-line bg-white text-ink hover:border-accent hover:bg-accent-soft"}`}
              >
                <span className="size-3 shrink-0 rounded-full border border-black/20" style={{ background: fn.color }} />
                <span className="min-w-0 flex-1 truncate">
                  {t(name)}
                  {n ? ` ${n}` : ""}
                </span>
                {fn.hidden && <EyeOff size={14} className="shrink-0 text-muted" aria-label={t("Hidden from the students")} />}
              </button>
            );
          })}
        </div>
      )}

      {selected && spec && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-subtle/60 p-3" data-testid="curve-inspector" data-type={selected.type}>
          <p className="text-xs font-semibold text-ink">{t(spec.name)}</p>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={!!selected.hidden} onChange={(e) => updateFunction(selected.id, { hidden: e.target.checked })} data-testid="mask-curve" className={check} />
            {t("Hide from the students")}
          </label>

          {isData ? (
            <DataInspector studio={studio} />
          ) : (
            <>
              <p className="text-xs text-muted" dir="ltr" data-testid="curve-formula">
                {t("Formula")}: {spec.formula}
              </p>
              <div className="grid grid-cols-2 gap-2" dir="ltr">
                {spec.params.map((p) => (
                  <NumberField
                    key={`${selected.id}:${p.key}`}
                    label={p.label}
                    value={selected.params[p.key] ?? 0}
                    onCommit={(value) => {
                      updateFunction(selected.id, { params: { [p.key]: value } });
                      return null;
                    }}
                    testId={`param-${p.key}`}
                  />
                ))}
              </div>
            </>
          )}

          <label className="flex items-center justify-between gap-2 text-xs text-muted">
            {t("Colour")}
            <input type="color" value={selected.color} onChange={(e) => updateFunction(selected.id, { color: e.target.value })} data-testid="curve-color" className="h-7 w-10 cursor-pointer rounded border border-line bg-white p-0.5" />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs text-muted">
            {t("Thickness")}
            <input type="range" min={MIN_STROKE} max={MAX_STROKE} step={0.5} value={selected.strokeWidth} onChange={(e) => updateFunction(selected.id, { strokeWidth: Number(e.target.value) })} data-testid="curve-width" className="w-28 accent-indigo-600" />
          </label>
          {status !== "ok" && (
            <p role="status" data-testid={`curve-${status}`} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              <span className="grid size-4 shrink-0 place-items-center rounded-full bg-amber-600 text-[10px] font-bold text-white">!</span>
              {status === "undefined" ? t("This curve is not defined for these values.") : t("This curve is outside the paper: change the axes or its parameters.")}
            </p>
          )}
          <button onClick={() => removeFunction(selected.id)} data-testid="delete-curve" className="flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50">
            <Trash2 size={14} />
            {t("Delete the curve")}
          </button>
        </div>
      )}
    </section>
  );
}
