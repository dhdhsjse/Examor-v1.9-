"use client";

import { useState } from "react";
import ShapeProperties from "@/app/_components/shapes/ShapeProperties";
import { CONTENT_WIDTH } from "@/app/_lib/a4";
import { CM_PX, MAX_PAPER, MIN_PAPER, PAPER_MARGIN, fitPaper } from "@/app/_lib/graph/grid";
import { axisSteps, type AxisNumbers } from "@/app/_lib/graph/types";
import { useT } from "@/app/_lib/uiLang";
import AnnotationsPanel from "./AnnotationsPanel";
import CurvesPanel from "./CurvesPanel";
import Disclosure from "./Disclosure";
import { ColorRow, Group, Notice, NumberField, SelectField, SwitchRow, TextField, issueText } from "./fields";
import type { GraphStudioState } from "./useGraphStudio";

const round1 = (v: number) => Math.round(v * 10) / 10;
// A setting that does nothing while what it belongs to is off
const when = (on: boolean) => (on ? "" : "pointer-events-none opacity-45");

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
    <Disclosure title={isX ? t("Horizontal axis") : t("Vertical axis")} testId={`graph-${axis}-axis`} defaultOpen={false}>
      <Group>
        <TextField label={t("Label")} value={isX ? config.xLabel : config.yLabel} onChange={(v) => set({ xLabel: v }, { yLabel: v })} testId={`${axis}-label`} hint={t("u_C writes a subscript, 10^-4 a power (put several characters in braces).")} />
        <NumberField label={t("Minimum")} value={isX ? config.xMin : config.yMin} onCommit={(v) => set({ xMin: v }, { yMin: v })} testId={`${axis}-min`} />
        <NumberField label={t("Maximum")} value={isX ? config.xMax : config.yMax} onCommit={(v) => set({ xMax: v }, { yMax: v })} testId={`${axis}-max`} />
        <NumberField label={t("Main step")} value={steps.major} onCommit={(v) => set({ xMajorStep: v }, { yMajorStep: v })} testId={`${axis}-major-step`} title={t("One main square of the paper (1 cm ↔ this value)")} />
        <NumberField label={t("Fine step")} value={steps.minor} onCommit={(v) => set({ xMinorStep: v }, { yMinorStep: v })} testId={`${axis}-minor-step`} />
        <div className={when(config.showNumbers)}>
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
      </Group>
    </Disclosure>
  );
}

// The right panel of the Graph Studio: the curves and the annotations on the paper, then the limits, the title, the scale and the numbers of each axis, the grid, the
// text, and the size of the paper. Every section has its title in sight and folds; every change redraws the paper at once, and one that cannot be drawn says why
// under its field.
export default function GraphPanel({ studio }: { studio: GraphStudioState }) {
  const t = useT();
  const { config, updateConfig, issues } = studio;
  const warnings = issues.filter((i) => i === "dense-major" || i === "dense-minor" || i === "minor-larger");
  const [cellCm, setCellCm] = useState(1);
  const titleStyle = config.labelBold && config.labelItalic ? "bold-italic" : config.labelBold ? "bold" : config.labelItalic ? "italic" : "plain";
  const fitHint = t("Sizes the paper so that every main square is this many cm: the scale of the sheet is then the real one once printed.");

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
        <div className="border-b border-line/70">
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

      <Disclosure title={t("Grid")} testId="graph-grid" defaultOpen={false}>
        <Group>
          <SwitchRow label={t("Show the grid")} checked={config.showGrid} onChange={(v) => updateConfig({ showGrid: v })} testId="show-grid" />
          <div className={when(config.showGrid)}>
            <SwitchRow label={t("Medium lines halfway between the main ones")} checked={!!config.midGrid} onChange={(v) => updateConfig({ midGrid: v || undefined })} testId="mid-grid" />
          </div>
          <div className={when(config.showGrid)}>
            <ColorRow label={t("Grid colour")} value={config.gridColor} onChange={(v) => updateConfig({ gridColor: v })} testId="grid-color" />
          </div>
          <SwitchRow label={t("Show the numbers")} checked={config.showNumbers} onChange={(v) => updateConfig({ showNumbers: v })} testId="show-numbers" />
          <SwitchRow label={t("Decimal comma (1,5)")} checked={!!config.decimalComma} onChange={(v) => updateConfig({ decimalComma: v || undefined })} testId="decimal-comma" />
        </Group>
        {warnings.map((w) => (
          <Notice key={w} testId={`graph-warning-${w}`}>
            {issueText(w, t)}
          </Notice>
        ))}
      </Disclosure>

      <Disclosure title={t("Text")} testId="graph-text" defaultOpen={false}>
        <Group>
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
          <NumberField label={t("Title size")} value={config.labelSize ?? 15} onCommit={size("labelSize")} testId="title-size" />
          <NumberField label={t("Numbers size")} value={config.numberSize ?? 11} onCommit={size("numberSize")} testId="numbers-size" />
          <SwitchRow label={t("Bold numbers")} checked={!!config.numberBold} onChange={(v) => updateConfig({ numberBold: v || undefined })} testId="numbers-bold" />
        </Group>
      </Disclosure>

      <Disclosure title={t("Paper size")} testId="graph-size" defaultOpen={false}>
        <Group>
          <NumberField label={t("Width (px)")} value={config.width} onCommit={(n) => updateConfig({ width: Math.round(n) })} testId="paper-width" />
          <NumberField label={t("Height (px)")} value={config.height} onCommit={(n) => updateConfig({ height: Math.round(n) })} testId="paper-height" />
        </Group>
        <p className="px-1 text-xs text-muted tabular-nums" title={`${MIN_PAPER}–${MAX_PAPER} px`}>
          {t("{w} × {h} cm on the page", { w: round1(config.width / CM_PX), h: round1(config.height / CM_PX) })}
        </p>
        <Group>
          <NumberField
            label={t("Main square (cm)")}
            value={cellCm}
            onCommit={(n) => {
              if (n > 0 && n <= 20) setCellCm(n);
              return null;
            }}
            testId="cell-cm"
            title={fitHint}
          />
        </Group>
        <button
          onClick={fit}
          data-testid="fit-paper"
          title={fitHint}
          className="h-9 rounded-xl bg-subtle text-[13px] font-medium tracking-[-0.01em] text-ink transition-[transform,background-color] duration-100 ease-out outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]"
        >
          {t("Fit the paper")}
        </button>
      </Disclosure>
    </div>
  );
}
