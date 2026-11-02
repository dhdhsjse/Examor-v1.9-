"use client";

import { isStacked } from "@/app/_lib/chart/catalog";
import type { ChartConfig, DataLabels, LabelPosition, Side } from "@/app/_lib/chart/types";
import { useT } from "@/app/_lib/uiLang";
import { Check, ColorField, Group, Num, NumberFormatEditor, Pick, Row } from "./controls";
import type { PanelProps } from "./ChartSection";

type T = (key: string) => string;

/** The places a label can go, for a kind of chart (the same word does not mean the same on a bar, on a line and on a slice) */
export function positionsFor(c: ChartConfig, t: T): { value: LabelPosition; label: string }[] | null {
  const auto = { value: "auto" as const, label: t("Automatic") };
  switch (c.family) {
    case "column":
    case "bar":
      return isStacked(c.variant)
        ? [auto, { value: "inside", label: t("Inside end") }, { value: "center", label: t("Center") }, { value: "base", label: t("Inside base") }]
        : [auto, { value: "outside", label: t("Outside end") }, { value: "inside", label: t("Inside end") }, { value: "center", label: t("Center") }, { value: "base", label: t("Inside base") }];
    case "line":
    case "scatter":
    case "area":
    case "radar":
    case "combo":
      return [auto, { value: "above", label: t("Above") }, { value: "below", label: t("Below") }, { value: "left", label: t("Left") }, { value: "right", label: t("Right") }, { value: "center", label: t("Center") }];
    case "pie":
      return [{ value: "auto", label: t("Best fit") }, { value: "outside", label: t("Outside") }, { value: "inside", label: t("Inside") }, { value: "center", label: t("Center") }];
    default:
      return null;
  }
}

// The labels written on the data (the values, the names, the shares), and the legend and the table of the data.
export default function LabelsSection({ c, edit }: PanelProps) {
  const t = useT();
  const o = c.labels;
  const set = (patch: Partial<DataLabels>, key: string) => edit((x) => ({ ...x, labels: { ...x.labels, ...patch } }), `labels:${key}`);
  const positions = positionsFor(c, t);
  const shares = c.family === "pie" || c.family === "funnel";
  const table = c.family === "column" || c.family === "line" || c.family === "area" || c.family === "combo";

  return (
    <>
      <Group title={t("Data labels")}>
        <Check checked={o.show} onChange={(show) => set({ show }, "show")} label={t("Show the labels")} testId="labels-show" />
        {o.show && (
          <>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <Check checked={o.value} onChange={(value) => set({ value }, "value")} label={t("The value")} testId="labels-value" />
              <Check checked={o.category} onChange={(category) => set({ category }, "category")} label={t("The category name")} testId="labels-category" />
              <Check checked={o.series} onChange={(series) => set({ series }, "series")} label={t("The series name")} testId="labels-series" />
              {shares && <Check checked={o.percent} onChange={(percent) => set({ percent }, "percent")} label={t("The percentage")} testId="labels-percent" />}
            </div>
            {positions && (
              <Row label={t("Position")}>
                <Pick value={o.position} onChange={(position) => set({ position }, "position")} options={positions} testId="labels-position" />
              </Row>
            )}
            <Row label={t("Separator")}>
              <Pick value={o.separator} onChange={(separator) => set({ separator }, "separator")} options={[{ value: "; ", label: t("Semicolon") }, { value: ", ", label: t("Comma") }, { value: " ", label: t("Space") }, { value: " - ", label: t("Dash") }]} testId="labels-separator" />
            </Row>
            <Group title={t("Numbers in the labels")}>
              <NumberFormatEditor value={o.format} onChange={(format) => set({ format }, "format")} testId="labels-format" />
            </Group>
            <Row label={t("Text size")}>
              <Num value={o.size} min={6} max={32} onCommit={(size) => size && set({ size }, "size")} className="w-20" testId="labels-size" />
            </Row>
            <div className="flex items-center gap-4">
              <Check checked={o.bold} onChange={(bold) => set({ bold }, "bold")} label={t("Bold text")} />
              <ColorField value={o.color} onChange={(color) => set({ color }, "color")} auto label={t("Text color")} />
            </div>
          </>
        )}
      </Group>

      <Group title={t("Legend")}>
        <Check checked={c.legend.show} onChange={(show) => edit((x) => ({ ...x, legend: { ...x.legend, show } }), "legend:show")} label={t("Show the legend")} testId="legend-show" />
        {c.family === "pie" && (
          <Row label={t("Name the parts by")} hint={t("Numbers, names and texts are written in the parts: with numbers the legend lists them, otherwise there is no legend. Type your own texts in the Series part.")}>
            <Pick
              value={c.legend.identify ?? "color"}
              onChange={(identify) => edit((x) => ({ ...x, legend: { ...x.legend, identify: identify === "color" ? undefined : identify } }), "legend:identify")}
              options={[{ value: "color", label: t("Colors") }, { value: "number", label: t("Numbers") }, { value: "name", label: t("Names") }, { value: "text", label: t("Text of your own") }]}
              testId="legend-identify"
            />
          </Row>
        )}
        {c.family === "pie" && c.legend.identify && (
          <Check checked={!!c.pie.plain} onChange={(plain) => edit((x) => ({ ...x, pie: { ...x.pie, plain } }), "pie:plain")} label={t("Slices without color")} testId="pie-plain" />
        )}
        {c.legend.show && (
          <Row label={t("Position")}>
            <Pick
              value={c.legend.position}
              onChange={(position) => edit((x) => ({ ...x, legend: { ...x.legend, position: position as Side } }), "legend:position")}
              options={[{ value: "top", label: t("Top") }, { value: "bottom", label: t("Bottom") }, { value: "left", label: t("Left") }, { value: "right", label: t("Right") }]}
              testId="legend-position"
            />
          </Row>
        )}
      </Group>

      {table && (
        <Group title={t("Table of the data")}>
          <Check checked={c.dataTable} onChange={(dataTable) => edit((x) => ({ ...x, dataTable }), "dataTable")} label={t("Show the table of the data under the chart")} testId="data-table" />
        </Group>
      )}
    </>
  );
}
