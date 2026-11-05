"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { curveName, readout } from "@/app/_lib/graph/annotations";
import { axisSteps, type DashStyle, type DataLineStyle } from "@/app/_lib/graph/types";
import { FUNCTION_SPECS, MAX_STROKE, MIN_STROKE, expressionError, parseDataText, sampleCurve, titrationInfo } from "@/app/_lib/graph/mathUtils";
import { useT } from "@/app/_lib/uiLang";
import Disclosure from "./Disclosure";
import { ColorRow, DeleteButton, Group, NumberField, Notice, OptionalNumberField, PickRow, SelectField, SliderRow, SwitchRow, TextField } from "./fields";
import type { GraphStudioState } from "./useGraphStudio";

// A white button on the grey cards of the table of values
const button =
  "flex h-9 w-full items-center justify-center rounded-xl bg-white text-[13px] font-medium tracking-[-0.01em] text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.07)] transition-[transform,opacity] duration-100 ease-out outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98] disabled:opacity-40";

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
      <Group>
        <SwitchRow label={t("Show the points")} checked={selected.showPoints !== false} onChange={(v) => updateFunction(selected.id, { showPoints: v })} testId="show-points" />
        <SelectField
          label={t("Line between the points")}
          value={selected.lineStyle ?? "none"}
          onChange={(v) => updateFunction(selected.id, { lineStyle: v as DataLineStyle })}
          options={[
            { value: "none", label: t("None") },
            { value: "straight", label: t("Straight segments") },
            { value: "smooth", label: t("Smooth curve") },
          ]}
          testId="connect-points"
        />
      </Group>

      <div className="flex flex-col gap-2 rounded-2xl bg-subtle p-2.5" data-testid="points-table">
        {points.length > 0 && (
          <div className="grid grid-cols-[1fr_1fr_1.75rem] gap-1.5 px-0.5 text-[11px] font-medium text-muted" dir="ltr">
            <span>x</span>
            <span>y</span>
            <span />
          </div>
        )}
        <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pe-0.5" dir="ltr">
          {points.map((p, i) => (
            <div key={p.id} className="grid grid-cols-[1fr_1fr_1.75rem] items-start gap-1.5" data-point-row={i}>
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
              <button
                onClick={() => removeDataPoint(selected.id, p.id)}
                aria-label={t("Remove this point")}
                title={t("Remove this point")}
                data-testid={`point-remove-${i}`}
                className="grid size-8 place-items-center rounded-lg text-muted transition-[transform,background-color,color] duration-100 outline-none hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-accent active:scale-90"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <button onClick={() => addDataPoint(last ? last.x + axisSteps(config, "x").major : 0, last ? last.y : 0)} data-testid="add-row" className={button}>
          {t("Add a row")}
        </button>
      </div>

      <div className="flex flex-col gap-2 rounded-2xl bg-subtle p-2.5">
        <label className="px-0.5 text-[12px] text-muted" htmlFor="paste-values">
          {t("Paste values (one point per line: x and y)")}
        </label>
        <textarea
          id="paste-values"
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={3}
          dir="ltr"
          placeholder={"0\t9\n1\t6,2\n2\t4.1"}
          data-testid="paste-values"
          className="w-full rounded-lg bg-white px-2.5 py-2 font-mono text-xs text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.07)] outline-none transition-shadow focus:shadow-[0_0_0_2px_var(--color-accent,#4f46e5)]"
        />
        <button onClick={addPasted} disabled={!pasted.trim()} data-testid="paste-add" className={button}>
          {t("Add these values")}
        </button>
        {result && (
          <p role="status" data-testid="paste-result" className="px-0.5 text-xs text-muted">
            {t("{added} added, {rejected} skipped", { added: result.added, rejected: result.rejected })}
          </p>
        )}
      </div>
    </>
  );
}

// The curves of the paper (top of the right panel): the list of them, and for the selected one its formula and parameters (or, for
// a series of measured points, its table of values), the range it is drawn on, its colour, thickness and line, and whether the
// student version has it; live: every change redraws the curve at once.
export default function CurvesPanel({ studio }: { studio: GraphStudioState }) {
  const t = useT();
  const { config, selected, selectFunction, updateFunction, removeFunction } = studio;
  const status = useMemo(() => (selected ? sampleCurve(selected, config).status : "ok"), [selected, config]);
  const spec = selected ? FUNCTION_SPECS[selected.type] : null;
  const isData = selected?.type === "data";
  const isFormula = selected?.type === "formula";
  const formulaError = isFormula ? expressionError(selected.expression ?? "") : null;
  const titration = selected?.type === "titration" ? titrationInfo(selected.params) : null;
  // Formula errors, in the app language ("Unexpected “)”" → key "Unexpected “{v}”").
  const errorText = (e: string) => {
    const m = /^(Unknown name|Unexpected|Missing) “(.*)”$/.exec(e);
    return m ? t(`${m[1]} “{v}”`, { v: m[2] }) : t(e);
  };

  return (
    <Disclosure title={t("Curves")} testId="graph-curves" count={config.functions.length} empty={config.functions.length === 0} reveal={selected?.id}>
      <Group role="listbox" label={t("Curves")}>
        {config.functions.map((fn) => {
          const on = fn.id === selected?.id;
          const { name, n } = curveName(config, fn);
          return (
            <PickRow key={fn.id} on={on} onPick={() => selectFunction(on ? null : fn.id)} color={fn.color} hidden={fn.hidden} attrs={{ "data-curve": fn.id }}>
              {t(name)}
              {n ? ` ${n}` : ""}
            </PickRow>
          );
        })}
      </Group>

      {selected && spec && (
        <div className="flex flex-col gap-3" data-testid="curve-inspector" data-type={selected.type}>
          {isData ? (
            <DataInspector studio={studio} />
          ) : (
            <>
              {isFormula ? (
                <div dir="ltr" className="flex flex-col gap-1.5">
                  <Group>
                    <TextField label={t("y =")} value={selected.expression ?? ""} onChange={(expression) => updateFunction(selected.id, { expression })} testId="curve-expression" keyboard="formula" />
                  </Group>
                  {formulaError && (
                    <p role="status" data-testid="curve-expression-error" className="px-1 text-[11px] text-red-600">
                      {errorText(formulaError)}
                    </p>
                  )}
                </div>
              ) : (
                <p className="rounded-2xl bg-subtle px-3.5 py-2.5 text-[13px] text-ink" dir="ltr" data-testid="curve-formula">
                  {spec.formula}
                </p>
              )}
              {spec.params.length > 0 && (
                <div dir="ltr">
                  <Group>
                    {spec.params.map((p) =>
                      p.options ? (
                        <SelectField
                          key={`${selected.id}:${p.key}`}
                          label={t(p.label)}
                          title={p.title ? t(p.title) : undefined}
                          value={String(selected.params[p.key] ?? p.options[0].value)}
                          onChange={(v) => updateFunction(selected.id, { params: { [p.key]: Number(v) } })}
                          options={p.options.map((o) => ({ value: String(o.value), label: t(o.label) }))}
                          testId={`param-${p.key}`}
                        />
                      ) : (
                        <NumberField
                          key={`${selected.id}:${p.key}`}
                          label={p.label}
                          title={p.title ? t(p.title) : undefined}
                          value={selected.params[p.key] ?? 0}
                          onCommit={(value) => {
                            updateFunction(selected.id, { params: { [p.key]: value } });
                            return null;
                          }}
                          testId={`param-${p.key}`}
                        />
                      ),
                    )}
                  </Group>
                </div>
              )}
              {titration && (
                <p className="px-1 text-xs text-muted tabular-nums" dir="ltr" data-testid="titration-info">
                  {t("Equivalence: x = {ve}, pH = {ph} · pH at half of it: {half}", { ve: readout(titration.ve), ph: readout(titration.phE), half: readout(titration.phHalf) })}
                </p>
              )}
              {spec.note && <p className="px-1 text-[11px] text-muted">{t(spec.note)}</p>}

              <div dir="ltr">
                <Group>
                  <OptionalNumberField label={t("Draw from x")} value={selected.from} onCommit={(from) => updateFunction(selected.id, { from })} testId="curve-from" placeholder={t("paper edge")} />
                  <OptionalNumberField label={t("Draw up to x")} value={selected.to} onCommit={(to) => updateFunction(selected.id, { to })} testId="curve-to" placeholder={t("paper edge")} />
                </Group>
              </div>
            </>
          )}

          <Group>
            <SelectField
              label={t("Line")}
              value={selected.dash ?? "solid"}
              onChange={(v) => updateFunction(selected.id, { dash: v === "solid" ? undefined : (v as DashStyle) })}
              options={[
                { value: "solid", label: t("Solid line") },
                { value: "dashed", label: t("Dashed line") },
                { value: "dotted", label: t("Dotted line") },
              ]}
              testId="curve-dash"
            />
            <ColorRow label={t("Colour")} value={selected.color} onChange={(color) => updateFunction(selected.id, { color })} testId="curve-color" />
            <SliderRow label={t("Thickness")} value={selected.strokeWidth} min={MIN_STROKE} max={MAX_STROKE} step={0.5} onChange={(strokeWidth) => updateFunction(selected.id, { strokeWidth })} testId="curve-width" />
          </Group>

          <Group>
            <SwitchRow label={t("Hide from the students")} checked={!!selected.hidden} onChange={(hidden) => updateFunction(selected.id, { hidden })} testId="mask-curve" />
          </Group>

          {status !== "ok" && <Notice testId={`curve-${status}`}>{status === "undefined" ? t("This curve is not defined for these values.") : t("This curve is outside the paper: change the axes or its parameters.")}</Notice>}
          <DeleteButton label={t("Delete the curve")} onClick={() => removeFunction(selected.id)} testId="delete-curve" />
        </div>
      )}
    </Disclosure>
  );
}
