"use client";

import { EyeOff, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { ANNOTATION_SPECS, DEFAULT_FONT_SIZE, curveName, freeFromCurve, markerY, readout, resolveAnnotation, tangentOf, triangleDeltas } from "@/app/_lib/graph/annotations";
import { buildScene } from "@/app/_lib/graph/grid";
import { formatNumber, isMathFunction } from "@/app/_lib/graph/mathUtils";
import type { GraphAnnotation, GraphConfig } from "@/app/_lib/graph/types";
import { useT } from "@/app/_lib/uiLang";
import { NumberField, TextField } from "./fields";
import type { GraphStudioState } from "./useGraphStudio";

const select = "w-full rounded-lg border border-line bg-subtle px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent";
const check = "size-4 accent-indigo-600";
const diff = (a: number, b: number) => Math.round((a - b) * 1e9) / 1e9; // (no float noise in a field)

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-muted">
      {label}
      {children}
    </label>
  );
}

// The name of an annotation in the list ("Tangent", "Slope triangle"…), with what it is about when that tells them apart.
function useAnnotationLabel(config: GraphConfig) {
  const t = useT();
  return (a: GraphAnnotation) => {
    const base = t(ANNOTATION_SPECS[a.type].name);
    if (a.type === "text") return a.text ? `${base}: ${a.text}` : base;
    if (a.type === "asymptote") return `${base} ${a.orientation === "vertical" ? "x" : "y"} = ${formatNumber(a.value ?? 0)}`;
    const fn = a.curveId ? config.functions.find((f) => f.id === a.curveId) : undefined;
    if (!fn) return base;
    const { name, n } = curveName(config, fn);
    return `${base} · ${t(name)}${n ? ` ${n}` : ""}`;
  };
}

// The annotations of the paper (right panel, under the curves): the list of them, and for the selected one its own fields. The
// position of an annotation is in graph units; it can also be dragged on the paper by its handles.
export default function AnnotationsPanel({ studio }: { studio: GraphStudioState }) {
  const t = useT();
  const { config, selectedAnnotation: sel, selectAnnotation, updateAnnotation, removeAnnotation } = studio;
  const label = useAnnotationLabel(config);
  const set = (patch: Partial<GraphAnnotation>) => sel && updateAnnotation(sel.id, patch);
  const num = (key: "x" | "y" | "x2" | "y2" | "value" | "fontSize", testId: string, title: string, value: number | undefined) => (
    <NumberField
      label={title}
      value={value ?? 0}
      onCommit={(n) => {
        set({ [key]: n });
        return null;
      }}
      testId={testId}
    />
  );

  // what is wrong with the selected one (it is then not drawn)
  const status = sel ? resolveAnnotation(sel, config, buildScene(config).origin).status : "ok";
  const curveOptions = config.functions.filter(isMathFunction).map((f) => {
    const { name, n } = curveName(config, f);
    return (
      <option key={f.id} value={f.id}>
        {t(name)}
        {n ? ` ${n}` : ""}
      </option>
    );
  });
  const onCurve = !!sel?.curveId;
  const deltas = sel?.type === "triangle" ? triangleDeltas(sel, config) : null;
  const tangent = sel?.type === "tangent" ? tangentOf(sel, config) : null;
  const my = sel?.type === "marker" ? markerY(sel, config) : null;

  return (
    <section data-testid="graph-annotations" className="flex flex-col gap-2.5 border-b border-line px-4 py-3.5">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Annotations")}</h4>

      {config.annotations.length === 0 ? (
        <p className="text-xs text-muted" data-testid="no-annotations">
          {t("No annotation yet: pick a tool in the Annotations list.")}
        </p>
      ) : (
        <div className="flex flex-col gap-1" role="listbox" aria-label={t("Annotations")}>
          {config.annotations.map((a) => {
            const on = a.id === sel?.id;
            return (
              <button
                key={a.id}
                role="option"
                aria-selected={on}
                onClick={() => selectAnnotation(on ? null : a.id)}
                data-annotation={a.id}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-start text-sm transition-colors ${on ? "border-accent bg-accent-soft text-accent-strong ring-1 ring-accent" : "border-line bg-white text-ink hover:border-accent hover:bg-accent-soft"}`}
              >
                <span className="min-w-0 flex-1 truncate">{label(a)}</span>
                {a.hidden && <EyeOff size={14} className="shrink-0 text-muted" aria-label={t("Hidden from the students")} />}
              </button>
            );
          })}
        </div>
      )}

      {sel && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-line bg-subtle/60 p-3" data-testid="annotation-inspector" data-type={sel.type}>
          <p className="text-xs font-semibold text-ink">{t(ANNOTATION_SPECS[sel.type].name)}</p>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={!!sel.hidden} onChange={(e) => set({ hidden: e.target.checked })} data-testid="mask-annotation" className={check} />
            {t("Hide from the students")}
          </label>

          {sel.type === "text" && (
            <>
              <TextField label={t("Text")} value={sel.text ?? ""} onChange={(text) => set({ text })} testId="anno-text" />
              <div className="grid grid-cols-2 gap-2" dir="ltr">
                {num("x", "anno-x", "x", sel.x)}
                {num("y", "anno-y", "y", sel.y)}
              </div>
              {num("fontSize", "anno-size", t("Font size"), sel.fontSize ?? DEFAULT_FONT_SIZE)}
            </>
          )}

          {sel.type === "asymptote" && (
            <>
              <Row label={t("Direction")}>
                <select value={sel.orientation ?? "horizontal"} onChange={(e) => set({ orientation: e.target.value as "horizontal" | "vertical" })} data-testid="anno-orientation" className={`${select} w-40`}>
                  <option value="horizontal">{t("Horizontal (y = …)")}</option>
                  <option value="vertical">{t("Vertical (x = …)")}</option>
                </select>
              </Row>
              <div dir="ltr">{num("value", "anno-value", sel.orientation === "vertical" ? "x" : "y", sel.value)}</div>
              <TextField label={t("Label (optional)")} value={sel.text ?? ""} onChange={(text) => set({ text })} testId="anno-label" />
            </>
          )}

          {sel.type === "tangent" && (
            <>
              <Row label={t("Curve")}>
                <select value={sel.curveId ?? ""} onChange={(e) => set({ curveId: e.target.value })} data-testid="anno-curve" className={`${select} w-40`}>
                  {curveOptions}
                </select>
              </Row>
              <div dir="ltr">{num("x", "anno-x", t("Point of contact (x)"), sel.x)}</div>
              {tangent && typeof tangent !== "string" && (
                <p className="text-xs text-muted tabular-nums" dir="ltr" data-testid="tangent-readout">
                  y = {readout(tangent.slope)}·x {tangent.y - tangent.slope * tangent.x < 0 ? "−" : "+"} {readout(Math.abs(tangent.y - tangent.slope * tangent.x))} · {t("Slope")} = {readout(tangent.slope)}
                </p>
              )}
            </>
          )}

          {sel.type === "triangle" && (
            <>
              <Row label={t("Curve")}>
                <select
                  value={sel.curveId ?? ""}
                  onChange={(e) => set(e.target.value ? { curveId: e.target.value } : freeFromCurve(sel, config))}
                  data-testid="anno-curve"
                  className={`${select} w-40`}
                >
                  <option value="">{t("None (free)")}</option>
                  {curveOptions}
                </select>
              </Row>
              <div className="grid grid-cols-2 gap-2" dir="ltr">
                {num("x", "anno-x", "x", sel.x)}
                <NumberField label="Δx" value={sel.x2 !== undefined && sel.x !== undefined ? diff(sel.x2, sel.x) : 0}
                  onCommit={(dx) => {
                    set({ x2: (sel.x ?? 0) + dx });
                    return null;
                  }} testId="anno-dx" />
                {!onCurve && num("y", "anno-y", "y", sel.y)}
                {!onCurve && (
                  <NumberField label="Δy" value={sel.y2 !== undefined && sel.y !== undefined ? diff(sel.y2, sel.y) : 0}
                    onCommit={(dy) => {
                      set({ y2: (sel.y ?? 0) + dy });
                      return null;
                    }} testId="anno-dy" />
                )}
              </div>
              {deltas && (
                <p className="text-xs text-muted tabular-nums" dir="ltr" data-testid="triangle-readout">
                  Δx = {readout(deltas.dx)} · Δy = {readout(deltas.dy)}
                  {deltas.dx !== 0 && ` · ${t("Slope")} = ${readout(deltas.dy / deltas.dx)}`}
                </p>
              )}
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={!!sel.showValues} onChange={(e) => set({ showValues: e.target.checked })} data-testid="anno-show-values" className={check} />
                {t("Write the values of Δx and Δy")}
              </label>
            </>
          )}

          {sel.type === "marker" && (
            <>
              <Row label={t("Curve")}>
                <select
                  value={sel.curveId ?? ""}
                  onChange={(e) => set(e.target.value ? { curveId: e.target.value } : freeFromCurve(sel, config))}
                  data-testid="anno-curve"
                  className={`${select} w-40`}
                >
                  <option value="">{t("None (free)")}</option>
                  {curveOptions}
                </select>
              </Row>
              <div className="grid grid-cols-2 gap-2" dir="ltr">
                {num("x", "anno-x", "x", sel.x)}
                {onCurve ? (
                  <p className="self-end pb-2 text-xs text-muted tabular-nums" data-testid="marker-y">
                    y = {my === null ? "—" : readout(my)}
                  </p>
                ) : (
                  num("y", "anno-y", "y", sel.y)
                )}
              </div>
              <Row label={t("Shape")}>
                <select value={sel.shape ?? "cross"} onChange={(e) => set({ shape: e.target.value as "cross" | "plus" | "dot" })} data-testid="anno-shape" className={`${select} w-40`}>
                  <option value="cross">{t("Cross")}</option>
                  <option value="plus">{t("Plus")}</option>
                  <option value="dot">{t("Dot")}</option>
                </select>
              </Row>
              <TextField label={t("Label (optional)")} value={sel.text ?? ""} onChange={(text) => set({ text })} testId="anno-label" />
              <label className="flex items-center gap-2 text-sm text-ink">
                <input type="checkbox" checked={!!sel.guides} onChange={(e) => set({ guides: e.target.checked })} data-testid="anno-guides" className={check} />
                {t("Dashed lines to the axes")}
              </label>
            </>
          )}

          <Row label={t("Colour")}>
            <input type="color" value={sel.color ?? "#000000"} onChange={(e) => set({ color: e.target.value })} data-testid="anno-color" className="h-7 w-10 cursor-pointer rounded border border-line bg-white p-0.5" />
          </Row>
          {ANNOTATION_SPECS[sel.type].dashable && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={sel.dashed ?? true} onChange={(e) => set({ dashed: e.target.checked })} data-testid="anno-dashed" className={check} />
              {t("Dashed")}
            </label>
          )}

          {status !== "ok" && (
            <p role="status" data-testid={`anno-${status}`} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              <span className="grid size-4 shrink-0 place-items-center rounded-full bg-amber-600 text-[10px] font-bold text-white">!</span>
              {status === "outside" ? t("This is outside the paper: change the axes or its position.") : t("It cannot be drawn with these values: the curve has no value there.")}
            </p>
          )}
          <button onClick={() => removeAnnotation(sel.id)} data-testid="delete-annotation" className="flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50">
            <Trash2 size={14} />
            {t("Delete")}
          </button>
        </div>
      )}
    </section>
  );
}
