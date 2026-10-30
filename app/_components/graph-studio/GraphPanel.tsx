"use client";

import { useState, type ReactNode } from "react";
import ShapeProperties from "@/app/_components/shapes/ShapeProperties";
import { CONTENT_WIDTH } from "@/app/_lib/a4";
import { CM_PX, MAX_PAPER, MIN_PAPER, PAPER_MARGIN, fitPaper } from "@/app/_lib/graph/grid";
import { axisSteps, type AxisNumbers } from "@/app/_lib/graph/types";
import { useT } from "@/app/_lib/uiLang";
import AnnotationsPanel from "./AnnotationsPanel";
import CurvesPanel from "./CurvesPanel";
import { NumberField, SelectField, TextField, issueText } from "./fields";
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
const round1 = (v: number) => Math.round(v * 10) / 10;

// One axis: its title, its limits, its own spacing of the lines (a sheet has its scale on each axis: "1 cm ↔ 5 mL" along, "1 cm ↔ 2 pH"
// up) and which of its numbers are written.
function AxisSection({ studio, axis }: { studio: GraphStudioState; axis: "x" | "y" }) {
  const t = useT();
  const { config, updateConfig } = studio;
  const isX = axis === "x";
  const steps = axisSteps(config, axis);
  const numbers: AxisNumbers = (isX ? config.xNumbers : config.yNumbers) ?? "all";
  const set = (xPart: Parameters<typeof updateConfig>[0], yPart: Parameters<typeof updateConfig>[0]) => updateConfig(isX ? xPart : yPart);

  return (
    <Section title={isX ? t("Horizontal axis") : t("Vertical axis")} testId={`graph-${axis}-axis`}>
      <TextField label={t("Label")} value={isX ? config.xLabel : config.yLabel} onChange={(v) => set({ xLabel: v }, { yLabel: v })} testId={`${axis}-label`} hint={t("u_C writes a subscript, 10^-4 a power (put several characters in braces).")} />
      <div className="grid grid-cols-2 gap-2">
        <NumberField label={t("Minimum")} value={isX ? config.xMin : config.yMin} onCommit={(v) => set({ xMin: v }, { yMin: v })} testId={`${axis}-min`} />
        <NumberField label={t("Maximum")} value={isX ? config.xMax : config.yMax} onCommit={(v) => set({ xMax: v }, { yMax: v })} testId={`${axis}-max`} />
        <NumberField label={t("Main step")} value={steps.major} onCommit={(v) => set({ xMajorStep: v }, { yMajorStep: v })} testId={`${axis}-major-step`} title={t("One main square of the paper (1 cm ↔ this value)")} />
        <NumberField label={t("Fine step")} value={steps.minor} onCommit={(v) => set({ xMinorStep: v }, { yMinorStep: v })} testId={`${axis}-minor-step`} />
      </div>
      <div className={config.showNumbers ? "" : "pointer-events-none opacity-50"}>
        <SelectField
          label={t("Numbers on the axis")}
          value={numbers}
          onChange={(v) => set({ xNumbers: v as AxisNumbers }, { yNumbers: v as AxisNumbers })}
          options={[
            { value: "all", label: t("Every main line") },
            { value: "scale", label: t("The scale only (first main line)") },
            { value: "none", label: t("None") },
          ]}
          testId={`${axis}-numbers`}
        />
      </div>
    </Section>
  );
}

// The right panel of the Graph Studio: the limits, the title, the scale and the numbers of each axis, the grid, the text, and the
// size of the paper. Every change redraws the paper at once; one that cannot be drawn says why under its field.
export default function GraphPanel({ studio }: { studio: GraphStudioState }) {
  const t = useT();
  const { config, updateConfig, issues } = studio;
  const warnings = issues.filter((i) => i === "dense-major" || i === "dense-minor" || i === "minor-larger");
  const [cellCm, setCellCm] = useState(1);
  const titleStyle = config.labelBold && config.labelItalic ? "bold-italic" : config.labelBold ? "bold" : config.labelItalic ? "italic" : "plain";

  const fit = () => {
    const paper = fitPaper(config, cellCm, CONTENT_WIDTH - 2 * PAPER_MARGIN);
    if (paper) updateConfig({ width: paper.width, height: paper.height });
  };
  const size = (key: "labelSize" | "numberSize") => (n: number) => {
    if (n >= 6 && n <= 60) updateConfig({ [key]: n });
    return null;
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-testid="graph-panel">
      {studio.selectedShape && (
        <div className="border-b border-line">
          <ShapeProperties
            key={studio.selectedShape.id}
            item={studio.selectedShape}
            geometry
            onChange={(patch) => studio.changeShape(studio.selectedShape!.id, patch, `shape:${studio.selectedShape!.id}:${Object.keys(patch).sort().join(",")}`)}
            onOrder={(order) => studio.orderShape(studio.selectedShape!.id, order)}
            onDuplicate={() => studio.duplicateShapeOf(studio.selectedShape!.id)}
            onDelete={() => studio.removeShapeById(studio.selectedShape!.id)}
          />
        </div>
      )}
      <CurvesPanel studio={studio} />
      <AnnotationsPanel studio={studio} />

      <AxisSection studio={studio} axis="x" />
      <AxisSection studio={studio} axis="y" />

      <Section title={t("Grid")} testId="graph-grid">
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={config.showGrid} onChange={(e) => updateConfig({ showGrid: e.target.checked })} data-testid="show-grid" className={check} />
          {t("Show the grid")}
        </label>
        <div className={`flex flex-col gap-2.5 ${config.showGrid ? "" : "pointer-events-none opacity-50"}`}>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={!!config.midGrid} onChange={(e) => updateConfig({ midGrid: e.target.checked || undefined })} data-testid="mid-grid" className={check} />
            {t("Medium lines halfway between the main ones")}
          </label>
          <label className="flex items-center justify-between gap-2 text-xs text-muted">
            {t("Grid colour")}
            <input type="color" value={config.gridColor} onChange={(e) => updateConfig({ gridColor: e.target.value })} data-testid="grid-color" className="h-7 w-10 cursor-pointer rounded border border-line bg-white p-0.5" />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={config.showNumbers} onChange={(e) => updateConfig({ showNumbers: e.target.checked })} data-testid="show-numbers" className={check} />
          {t("Show the numbers")}
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={!!config.decimalComma} onChange={(e) => updateConfig({ decimalComma: e.target.checked || undefined })} data-testid="decimal-comma" className={check} />
          {t("Decimal comma (1,5)")}
        </label>
        {warnings.map((w) => (
          <p key={w} role="status" data-testid={`graph-warning-${w}`} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
            <span className="grid size-4 shrink-0 place-items-center rounded-full bg-amber-600 text-[10px] font-bold text-white">!</span>
            {issueText(w, t)}
          </p>
        ))}
      </Section>

      <Section title={t("Text")} testId="graph-text">
        <SelectField
          label={t("Title style")}
          value={titleStyle}
          onChange={(v) => updateConfig({ labelBold: v.includes("bold") || undefined, labelItalic: v.includes("italic") || undefined })}
          options={[
            { value: "plain", label: t("Plain") },
            { value: "bold", label: t("Bold text") },
            { value: "italic", label: t("Italic") },
            { value: "bold-italic", label: t("Bold italic text") },
          ]}
          testId="title-style"
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t("Title size")} value={config.labelSize ?? 15} onCommit={size("labelSize")} testId="title-size" />
          <NumberField label={t("Numbers size")} value={config.numberSize ?? 11} onCommit={size("numberSize")} testId="numbers-size" />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={!!config.numberBold} onChange={(e) => updateConfig({ numberBold: e.target.checked || undefined })} data-testid="numbers-bold" className={check} />
          {t("Bold numbers")}
        </label>
      </Section>

      <Section title={t("Paper size")} testId="graph-size">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label={t("Width (px)")} value={config.width} onCommit={(n) => updateConfig({ width: Math.round(n) })} testId="paper-width" />
          <NumberField label={t("Height (px)")} value={config.height} onCommit={(n) => updateConfig({ height: Math.round(n) })} testId="paper-height" />
        </div>
        <p className="text-[11px] text-faint tabular-nums">
          {MIN_PAPER}–{MAX_PAPER} px · {t("{w} × {h} cm on the page", { w: round1(config.width / CM_PX), h: round1(config.height / CM_PX) })}
        </p>
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <NumberField
            label={t("Main square (cm)")}
            value={cellCm}
            onCommit={(n) => {
              if (n > 0 && n <= 20) setCellCm(n);
              return null;
            }}
            testId="cell-cm"
          />
          <button onClick={fit} data-testid="fit-paper" className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft">
            {t("Fit the paper")}
          </button>
        </div>
        <p className="text-[11px] text-faint">{t("Sizes the paper so that every main square is this many cm: the scale of the sheet is then the real one once printed.")}</p>
      </Section>
    </div>
  );
}
