"use client";

import type { ReactNode } from "react";
import { MAX_PAPER, MIN_PAPER } from "@/app/_lib/graph/grid";
import { useT } from "@/app/_lib/uiLang";
import AnnotationsPanel from "./AnnotationsPanel";
import CurvesPanel from "./CurvesPanel";
import { NumberField, TextField, issueText } from "./fields";
import type { GraphStudioState } from "./useGraphStudio";

function Section({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-2.5 border-b border-line px-4 py-3.5 last:border-b-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-faint">{title}</h4>
      {children}
    </section>
  );
}

const check = "size-4 accent-indigo-600";

// The right panel of the Graph Studio: the limits and the label of each axis, the grid (steps, colour), the numbers and the
// size of the paper. Every change redraws the paper at once; one that cannot be drawn says why under its field.
export default function GraphPanel({ studio }: { studio: GraphStudioState }) {
  const t = useT();
  const { config, updateConfig, issues } = studio;
  const warnings = issues.filter((i) => i === "dense-major" || i === "dense-minor" || i === "minor-larger");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-testid="graph-panel">
      <CurvesPanel studio={studio} />
      <AnnotationsPanel studio={studio} />

      <Section title={t("Horizontal axis")} testId="graph-x-axis">
        <TextField label={t("Label")} value={config.xLabel} onChange={(xLabel) => updateConfig({ xLabel })} testId="x-label" />
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t("Minimum")} value={config.xMin} onCommit={(xMin) => updateConfig({ xMin })} testId="x-min" />
          <NumberField label={t("Maximum")} value={config.xMax} onCommit={(xMax) => updateConfig({ xMax })} testId="x-max" />
        </div>
      </Section>

      <Section title={t("Vertical axis")} testId="graph-y-axis">
        <TextField label={t("Label")} value={config.yLabel} onChange={(yLabel) => updateConfig({ yLabel })} testId="y-label" />
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t("Minimum")} value={config.yMin} onCommit={(yMin) => updateConfig({ yMin })} testId="y-min" />
          <NumberField label={t("Maximum")} value={config.yMax} onCommit={(yMax) => updateConfig({ yMax })} testId="y-max" />
        </div>
      </Section>

      <Section title={t("Grid")} testId="graph-grid">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={config.showGrid} onChange={(e) => updateConfig({ showGrid: e.target.checked })} data-testid="show-grid" className={check} />
          {t("Show the grid")}
        </label>
        <div className={`grid grid-cols-2 gap-2 ${config.showGrid ? "" : "pointer-events-none opacity-50"}`}>
          <NumberField label={t("Main step")} value={config.majorGridStep} onCommit={(majorGridStep) => updateConfig({ majorGridStep })} testId="major-step" />
          <NumberField label={t("Fine step")} value={config.minorGridStep} onCommit={(minorGridStep) => updateConfig({ minorGridStep })} testId="minor-step" />
        </div>
        <label className="flex items-center justify-between gap-2 text-xs text-muted">
          {t("Grid colour")}
          <input type="color" value={config.gridColor} onChange={(e) => updateConfig({ gridColor: e.target.value })} data-testid="grid-color" className="h-7 w-10 cursor-pointer rounded border border-line bg-white p-0.5" />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={config.showNumbers} onChange={(e) => updateConfig({ showNumbers: e.target.checked })} data-testid="show-numbers" className={check} />
          {t("Show the numbers")}
        </label>
        {warnings.map((w) => (
          <p key={w} role="status" data-testid={`graph-warning-${w}`} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
            <span className="grid size-4 shrink-0 place-items-center rounded-full bg-amber-600 text-[10px] font-bold text-white">!</span>
            {issueText(w, t)}
          </p>
        ))}
      </Section>

      <Section title={t("Paper size")} testId="graph-size">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t("Width (px)")} value={config.width} onCommit={(n) => updateConfig({ width: Math.round(n) })} testId="paper-width" />
          <NumberField label={t("Height (px)")} value={config.height} onCommit={(n) => updateConfig({ height: Math.round(n) })} testId="paper-height" />
        </div>
        <p className="text-[11px] text-faint tabular-nums">
          {MIN_PAPER}–{MAX_PAPER} px
        </p>
      </Section>
    </div>
  );
}
