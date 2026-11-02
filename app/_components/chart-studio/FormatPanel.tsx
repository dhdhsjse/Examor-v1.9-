"use client";

import { familyDef } from "@/app/_lib/chart/catalog";
import type { ChartModel } from "@/app/_lib/chart/data";
import { useT } from "@/app/_lib/uiLang";
import AxesSection, { axesOf } from "./AxesSection";
import ChartSection, { type PanelProps } from "./ChartSection";
import { Section } from "./controls";
import KindSection, { hasKindOptions } from "./KindSection";
import LabelsSection from "./LabelsSection";
import SeriesSection from "./SeriesSection";

interface Props extends PanelProps {
  model: ChartModel;
  selected: number;
  onSelect: (i: number) => void;
  open: ReadonlySet<string>;
  onToggle: (id: string) => void;
}

// The right side of the Studio: what is true of the chart and of its parts, in parts that open and close: the chart (title, size, colors), its axes,
// its series, its labels and legend, and what belongs to its kind. A click on a part of the chart opens the part that goes with it.
export default function FormatPanel({ c, edit, meta, model, selected, onSelect, open, onToggle }: Props) {
  const t = useT();
  const a = axesOf(c, model);
  const hasAxes = a.category || a.categoryNames || a.values;
  return (
    <div data-testid="format-panel" className="flex flex-col">
      <Section id="chart" title={t("Chart")} open={open.has("chart")} onToggle={onToggle}>
        <ChartSection c={c} edit={edit} meta={meta} />
      </Section>
      {hasAxes && (
        <Section id="axes" title={t("Axes")} open={open.has("axes")} onToggle={onToggle}>
          <AxesSection c={c} edit={edit} meta={meta} model={model} />
        </Section>
      )}
      <Section id="series" title={t("Series")} open={open.has("series")} onToggle={onToggle}>
        <SeriesSection c={c} edit={edit} meta={meta} model={model} selected={selected} onSelect={onSelect} />
      </Section>
      <Section id="labels" title={t("Labels and legend")} open={open.has("labels")} onToggle={onToggle}>
        <LabelsSection c={c} edit={edit} meta={meta} />
      </Section>
      {hasKindOptions(c) && (
        <Section id="kind" title={t(familyDef(c.family).label)} open={open.has("kind")} onToggle={onToggle}>
          <KindSection c={c} edit={edit} meta={meta} model={model} />
        </Section>
      )}
    </div>
  );
}
