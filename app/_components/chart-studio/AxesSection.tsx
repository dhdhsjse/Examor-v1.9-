"use client";

import type { AxisOptions, ChartConfig } from "@/app/_lib/chart/types";
import { useT } from "@/app/_lib/uiLang";
import type { ChartModel } from "@/app/_lib/chart/data";
import { Check, Group, Num, NumberFormatEditor, Pick, Row, inputCls } from "./controls";
import type { PanelProps } from "./ChartSection";

type AxisKey = "x" | "y" | "y2";

/** Which axes a kind of chart has: the number scale ones (the values, or the x of a scatter), the categories, and a second value axis */
export function axesOf(c: ChartConfig, model: ChartModel) {
  const f = c.family;
  const secondary = f === "combo" && (c.variant === "columnLineSecondary" || c.series.some((s) => s.secondary)) && model.series.length > 1;
  return {
    category: f !== "pie" && f !== "radar" && f !== "funnel",
    categoryNames: f === "funnel",
    values: f !== "pie" && f !== "funnel",
    numericX: f === "scatter",
    secondary,
    gridX: f === "scatter",
    gridValues: f !== "pie" && f !== "funnel",
  };
}

// The axes of the chart: the one of the categories (or the x of a scatter), the one of the values, a second one, and the gridlines.
export default function AxesSection({ c, edit, model }: PanelProps & { model: ChartModel }) {
  const t = useT();
  const a = axesOf(c, model);
  const horizontal = c.family === "bar";
  const set = (axis: AxisKey, patch: Partial<AxisOptions>, key: string) => edit((x) => ({ ...x, axes: { ...x.axes, [axis]: { ...x.axes[axis], ...patch } } }), `axis:${axis}:${key}`);
  const grid = (patch: Partial<ChartConfig["grid"]>, key: string) => edit((x) => ({ ...x, grid: { ...x.grid, ...patch } }), `grid:${key}`);

  const titleField = (axis: AxisKey) => (
    <input value={c.axes[axis].title} onChange={(e) => set(axis, { title: e.target.value }, "title")} placeholder={t("Axis title")} aria-label={t("Axis title")} data-testid={`axis-title-${axis}`} className={inputCls} />
  );

  const scaleFields = (axis: AxisKey) => {
    const o = c.axes[axis];
    return (
      <>
        <div className="grid grid-cols-2 gap-2.5">
          <Num label={t("Minimum")} value={o.min} auto onCommit={(min) => set(axis, { min }, "min")} testId={`axis-min-${axis}`} />
          <Num label={t("Maximum")} value={o.max} auto onCommit={(max) => set(axis, { max }, "max")} testId={`axis-max-${axis}`} />
          <Num label={t("Main unit")} value={o.unit} min={1e-9} auto onCommit={(unit) => set(axis, { unit }, "unit")} testId={`axis-unit-${axis}`} />
          <Num label={t("Fine unit")} value={o.minorUnit} min={1e-9} auto onCommit={(minorUnit) => set(axis, { minorUnit }, "minor")} testId={`axis-minor-${axis}`} />
        </div>
        <Group title={t("Numbers on the axis")}>
          <NumberFormatEditor value={o.format} onChange={(format) => set(axis, { format }, "format")} testId={`axis-format-${axis}`} />
        </Group>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <Check checked={o.log} onChange={(log) => set(axis, { log }, "log")} label={t("Logarithmic scale")} testId={`axis-log-${axis}`} />
          <Check checked={o.reverse} onChange={(reverse) => set(axis, { reverse }, "reverse")} label={t("Reverse the direction")} testId={`axis-reverse-${axis}`} />
        </div>
      </>
    );
  };

  const common = (axis: AxisKey) => (
    <>
      <Check checked={c.axes[axis].show} onChange={(show) => set(axis, { show }, "show")} label={t("Show the axis")} testId={`axis-show-${axis}`} />
      {titleField(axis)}
      <Row label={t("Tick marks")}>
        <Pick value={c.axes[axis].ticks} onChange={(ticks) => set(axis, { ticks }, "ticks")} options={[{ value: "out", label: t("Outside") }, { value: "in", label: t("Inside") }, { value: "none", label: t("None") }]} testId={`axis-ticks-${axis}`} />
      </Row>
      <Check checked={c.axes[axis].line} onChange={(line) => set(axis, { line }, "line")} label={t("Line of the axis")} testId={`axis-line-${axis}`} />
    </>
  );

  return (
    <>
      {a.categoryNames && <Check checked={c.axes.x.show} onChange={(show) => set("x", { show }, "show")} label={t("Show the names of the stages")} testId="axis-show-x" />}

      {a.category && (
        <Group title={a.numericX ? t("X axis") : t("Category axis")}>
          {common("x")}
          {a.numericX ? (
            scaleFields("x")
          ) : (
            <>
              <Row label={t("Tilt of the names")}>
                <Pick value={c.axes.x.labelAngle} onChange={(labelAngle) => set("x", { labelAngle }, "angle")} options={[{ value: "auto", label: t("Automatic") }, { value: 0, label: "0°" }, { value: 45, label: "45°" }, { value: 90, label: "90°" }]} testId="axis-angle-x" />
              </Row>
              {!horizontal && <Num label={t("Write one name in…")} value={c.axes.x.every} min={1} max={100} auto placeholder={t("As many as fit")} onCommit={(every) => set("x", { every: every === null ? null : Math.round(every) }, "every")} testId="axis-every-x" />}
              <Check checked={c.axes.x.reverse} onChange={(reverse) => set("x", { reverse }, "reverse")} label={t("Reverse the order of the categories")} testId="axis-reverse-x" />
            </>
          )}
        </Group>
      )}

      {c.family === "histogram" && (
        <Row label={t("Names under the bars")}>
          <Pick value={c.histogram.axisLabels} onChange={(axisLabels) => edit((x) => ({ ...x, histogram: { ...x.histogram, axisLabels } }), "histogram:axisLabels")} options={[{ value: "classes", label: t("The classes") }, { value: "limits", label: t("The limits of the classes") }]} testId="histogram-axis-labels" />
        </Row>
      )}

      {a.values && (
        <Group title={a.numericX ? t("Y axis") : t("Value axis")}>
          {common("y")}
          {scaleFields("y")}
        </Group>
      )}

      {a.secondary && (
        <Group title={t("Second value axis")}>
          {common("y2")}
          {scaleFields("y2")}
        </Group>
      )}

      {a.gridValues && (
        <Group title={t("Gridlines")}>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <Check checked={c.grid.y} onChange={(y) => grid({ y }, "y")} label={horizontal ? t("Main, along the values") : t("Main, horizontal")} testId="grid-y" />
            <Check checked={c.grid.yMinor} onChange={(yMinor) => grid({ yMinor }, "yMinor")} label={horizontal ? t("Fine, along the values") : t("Fine, horizontal")} testId="grid-y-minor" />
            {a.gridX && <Check checked={c.grid.x} onChange={(x) => grid({ x }, "x")} label={t("Main, vertical")} testId="grid-x" />}
            {a.gridX && <Check checked={c.grid.xMinor} onChange={(xMinor) => grid({ xMinor }, "xMinor")} label={t("Fine, vertical")} testId="grid-x-minor" />}
          </div>
        </Group>
      )}
    </>
  );
}
