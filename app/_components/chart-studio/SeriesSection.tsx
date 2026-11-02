"use client";

import { isStacked } from "@/app/_lib/chart/catalog";
import type { ChartModel } from "@/app/_lib/chart/data";
import { paletteColor } from "@/app/_lib/chart/palette";
import type { Dash, ErrorBars, MarkerShape, SeriesKind, SeriesStyle, TrendKind, Trendline } from "@/app/_lib/chart/types";
import { useT } from "@/app/_lib/uiLang";
import { Check, ColorField, Group, Num, Pick, Row, inputCls } from "./controls";
import type { PanelProps } from "./ChartSection";

export const DEFAULT_TREND: Trendline = { kind: "linear", order: 2, period: 2, forward: 0, backward: 0, equation: false, r2: false, color: null, dash: "dashed" };
export const DEFAULT_ERROR: ErrorBars = { kind: "fixed", value: 1, direction: "both", cap: true };

/** A series' settings without the ones that say nothing (so a series that is as the chart has it keeps no entry) */
export function cleanStyle(s: SeriesStyle): SeriesStyle {
  const out: SeriesStyle = { ...s };
  for (const k of Object.keys(out) as (keyof SeriesStyle)[]) {
    if (out[k] === undefined || out[k] === false || (k === "name" && out[k] === "")) delete out[k];
  }
  if (out.points && !Object.keys(out.points).length) delete out.points;
  if (out.labels && !Object.keys(out.labels).length) delete out.labels;
  return out;
}

/** The list of series styles with one changed (the list is kept as short as it can be) */
export function withSeries(list: readonly SeriesStyle[], index: number, patch: Partial<SeriesStyle>): SeriesStyle[] {
  const next = [...list];
  while (next.length <= index) next.push({});
  next[index] = cleanStyle({ ...next[index], ...patch });
  while (next.length && !Object.keys(next[next.length - 1]).length) next.pop();
  return next;
}

const MARKERS: MarkerShape[] = ["circle", "square", "diamond", "triangle", "x", "cross"];

// The series of the chart: pick one (or click it in the chart), and set its name, color, line, markers, labels, trendline and error bars.
export default function SeriesSection({ c, edit, model, selected, onSelect }: PanelProps & { model: ChartModel; selected: number; onSelect: (i: number) => void }) {
  const t = useT();
  const f = c.family;
  const list = model.series;
  const s = list.find((x) => x.index === selected) ?? list[0];
  if (!s) return <p className="text-sm text-muted">{t("The table has no series yet.")}</p>;
  const idx = s.index;
  const st = c.series[idx] ?? {};
  const pos = list.filter((x) => !x.style.hidden).findIndex((x) => x.index === idx);
  const last = pos >= 0 && pos === list.filter((x) => !x.style.hidden).length - 1 && list.length > 1;
  const set = (patch: Partial<SeriesStyle>, key: string) => edit((x) => ({ ...x, series: withSeries(x.series, idx, patch) }), `series:${idx}:${key}`);
  const color = st.color ?? paletteColor(c.palette, idx);
  const lineKinds = f === "line" || f === "scatter" || f === "radar" || f === "combo";
  const asLine = lineKinds && (f !== "combo" || st.kind === "line" || (st.kind === undefined && c.variant !== "custom" && last));
  const areaLike = f === "area" || f === "combo" || (f === "radar" && c.variant === "filled");
  const withPoints = f === "column" || f === "bar" || f === "pie" || f === "funnel";
  const canTrend = (f === "column" || f === "line" || f === "scatter" || f === "area" || f === "combo") && !isStacked(c.variant);
  const canError = f === "column" || f === "bar" || f === "line" || f === "scatter" || f === "combo";
  const markerName: Record<MarkerShape, string> = { circle: t("Circle"), square: t("Square"), diamond: t("Diamond"), triangle: t("Triangle"), x: t("Cross (×)"), cross: t("Plus (+)") };
  const trend = st.trendline;
  const error = st.error;
  const categories = model.categories;
  const point = (k: number, patch: { color?: string | null; explode?: number; text?: string }) =>
    set(
      {
        points: (() => {
          const cur = { ...(st.points ?? {}) };
          const next = { ...(cur[k] ?? {}), ...patch } as { color?: string; explode?: number; text?: string };
          if (patch.color === null) delete next.color;
          if (!next.explode) delete next.explode;
          if (!next.text) delete next.text;
          if (Object.keys(next).length) cur[k] = next;
          else delete cur[k];
          return cur;
        })(),
      },
      `point:${k}`,
    );

  return (
    <>
      <div role="group" aria-label={t("Series")} data-testid="series-list" className="flex flex-wrap gap-1.5">
        {list.map((x) => (
          <button
            key={x.index}
            type="button"
            aria-pressed={x.index === idx}
            data-series-index={x.index}
            onClick={() => onSelect(x.index)}
            className={`flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${x.index === idx ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-white text-ink hover:border-accent"} ${x.style.hidden ? "opacity-50" : ""}`}
          >
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: x.style.color ?? paletteColor(c.palette, x.index) }} />
            <span className="truncate">{x.name}</span>
          </button>
        ))}
      </div>

      <Group>
        <input value={st.name ?? ""} onChange={(e) => set({ name: e.target.value }, "name")} placeholder={t("Name from the table")} aria-label={t("Name of the series")} data-testid="series-name" className={inputCls} />
        {!(f === "pie" || f === "funnel") && (
          <Row label={t("Color")}>
            <ColorField value={color} onChange={(col) => set({ color: col ?? undefined }, "color")} auto testId="series-color" />
          </Row>
        )}
        <Check checked={!st.hidden} onChange={(show) => set({ hidden: show ? undefined : true }, "hidden")} label={t("Show this series")} testId="series-visible" />
      </Group>

      {f === "combo" && (
        <Group title={t("Combination")}>
          <Row label={t("Drawn as")}>
            <Pick
              value={st.kind ?? "auto"}
              onChange={(kind) => set({ kind: kind === "auto" ? undefined : (kind as SeriesKind) }, "kind")}
              options={[{ value: "auto", label: t("As the chart says") }, { value: "column", label: t("Columns") }, { value: "line", label: t("Line") }, { value: "area", label: t("Area") }]}
              testId="series-kind"
            />
          </Row>
          <Check checked={st.secondary ?? (c.variant === "columnLineSecondary" && last)} onChange={(secondary) => set({ secondary }, "secondary")} label={t("On the second value axis")} testId="series-secondary" />
        </Group>
      )}

      {asLine && (
        <Group title={t("Line and markers")}>
          <div className="grid grid-cols-2 gap-2.5">
            <Num label={t("Line width")} value={st.width ?? 2.25} min={0.5} max={12} onCommit={(width) => set({ width: width ?? undefined }, "width")} testId="series-width" />
            <Num label={t("Marker size")} value={st.markerSize ?? 7} min={3} max={20} onCommit={(markerSize) => set({ markerSize: markerSize ?? undefined }, "markerSize")} testId="series-marker-size" />
          </div>
          <Row label={t("Line style")}>
            <Pick value={st.dash ?? "solid"} onChange={(dash) => set({ dash: dash === "solid" ? undefined : (dash as Dash) }, "dash")} options={[{ value: "solid", label: t("Solid line") }, { value: "dashed", label: t("Dashed line") }, { value: "dotted", label: t("Dotted line") }]} testId="series-dash" />
          </Row>
          <Row label={t("Marker")}>
            <Pick
              value={st.marker ?? "auto"}
              onChange={(m) => set({ marker: m === "auto" ? undefined : (m as MarkerShape | "none") }, "marker")}
              options={[{ value: "auto", label: t("As the chart says") }, { value: "none", label: t("None") }, ...MARKERS.map((m) => ({ value: m, label: markerName[m] }))]}
              testId="series-marker"
            />
          </Row>
          {f !== "radar" && <Check checked={!!st.smooth} onChange={(smooth) => set({ smooth }, "smooth")} label={t("Smooth line")} testId="series-smooth" />}
        </Group>
      )}

      {areaLike && (
        <Row label={t("Opacity (%)")}>
          <Num value={Math.round((st.opacity ?? (f === "radar" ? 0.35 : 0.75)) * 100)} min={5} max={100} onCommit={(o) => set({ opacity: o === null ? undefined : o / 100 }, "opacity")} className="w-20" testId="series-opacity" />
        </Row>
      )}

      {withPoints && (
        <Group title={f === "pie" || f === "funnel" ? t("Colors of the slices") : t("Colors of the bars")}>
          {(f === "column" || f === "bar") && list.length === 1 && <Check checked={c.varyColors} onChange={(varyColors) => edit((x) => ({ ...x, varyColors }), "varyColors")} label={t("A color for each category")} testId="vary-colors" />}
          <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto pe-1" data-testid="point-colors">
            {categories.map((name, k) => (
              <div key={k} className="flex items-center gap-2">
                <ColorField value={st.points?.[k]?.color ?? (f === "pie" || f === "funnel" || c.varyColors ? paletteColor(c.palette, k) : color)} onChange={(col) => point(k, { color: col })} auto testId={`point-color-${k}`} />
                <span className="min-w-0 flex-1 truncate text-xs text-ink">{name}</span>
                {f === "pie" && c.legend.identify === "text" && <input value={st.points?.[k]?.text ?? ""} onChange={(e) => point(k, { text: e.target.value })} placeholder={t("Text in the slice")} aria-label={`${t("Text in the slice")}: ${name}`} className={`${inputCls} !w-32 !py-1`} data-testid={`point-text-${k}`} />}
                {f === "pie" && <Num value={st.points?.[k]?.explode ?? 0} min={0} max={80} onCommit={(explode) => point(k, { explode: explode ?? 0 })} className="w-16" testId={`point-explode-${k}`} />}
              </div>
            ))}
          </div>
          {f === "pie" && <p className="text-[11px] text-faint">{t("The number next to a slice pulls it out (% of the radius).")}</p>}
        </Group>
      )}

      <Group title={t("Labels of this series")}>
        <Pick
          value={st.labels?.show === undefined ? "inherit" : st.labels.show ? "show" : "hide"}
          onChange={(v) => set({ labels: v === "inherit" ? undefined : { show: v === "show" } }, "labels")}
          options={[{ value: "inherit", label: t("As the chart says") }, { value: "show", label: t("Show the labels") }, { value: "hide", label: t("Hide the labels") }]}
          testId="series-labels"
          className="!max-w-full"
        />
      </Group>

      {canTrend && (
        <Group title={t("Trendline")}>
          <Check checked={!!trend} onChange={(on) => set({ trendline: on ? DEFAULT_TREND : undefined }, "trend")} label={t("Add a trendline")} testId="trend-on" />
          {trend && (
            <>
              <Row label={t("Kind")}>
                <Pick
                  value={trend.kind}
                  onChange={(kind) => set({ trendline: { ...trend, kind: kind as TrendKind } }, "trend")}
                  options={[{ value: "linear", label: t("Linear") }, { value: "exp", label: t("Exponential") }, { value: "log", label: t("Logarithmic") }, { value: "poly", label: t("Polynomial") }, { value: "power", label: t("Power") }, { value: "moving", label: t("Moving average") }]}
                  testId="trend-kind"
                />
              </Row>
              {trend.kind === "poly" && <Num label={t("Degree")} value={trend.order} min={2} max={6} onCommit={(order) => order && set({ trendline: { ...trend, order: Math.round(order) } }, "trend")} className="w-24" testId="trend-order" />}
              {trend.kind === "moving" && <Num label={t("Period")} value={trend.period} min={2} max={50} onCommit={(period) => period && set({ trendline: { ...trend, period: Math.round(period) } }, "trend")} className="w-24" testId="trend-period" />}
              {trend.kind !== "moving" && (
                <div className="grid grid-cols-2 gap-2.5">
                  <Num label={t("Forecast forward")} value={trend.forward} min={0} onCommit={(forward) => set({ trendline: { ...trend, forward: forward ?? 0 } }, "trend")} testId="trend-forward" />
                  <Num label={t("Forecast backward")} value={trend.backward} min={0} onCommit={(backward) => set({ trendline: { ...trend, backward: backward ?? 0 } }, "trend")} testId="trend-backward" />
                </div>
              )}
              {trend.kind !== "moving" && (
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <Check checked={trend.equation} onChange={(equation) => set({ trendline: { ...trend, equation } }, "trend")} label={t("Show the equation")} testId="trend-equation" />
                  <Check checked={trend.r2} onChange={(r2) => set({ trendline: { ...trend, r2 } }, "trend")} label={t("Show R²")} testId="trend-r2" />
                </div>
              )}
              <Row label={t("Line style")}>
                <Pick value={trend.dash} onChange={(dash) => set({ trendline: { ...trend, dash: dash as Dash } }, "trend")} options={[{ value: "solid", label: t("Solid line") }, { value: "dashed", label: t("Dashed line") }, { value: "dotted", label: t("Dotted line") }]} testId="trend-dash" />
              </Row>
              <Row label={t("Color")}>
                <ColorField value={trend.color} onChange={(col) => set({ trendline: { ...trend, color: col } }, "trend")} auto />
              </Row>
            </>
          )}
        </Group>
      )}

      {canError && (
        <Group title={t("Error bars")}>
          <Check checked={!!error} onChange={(on) => set({ error: on ? DEFAULT_ERROR : undefined }, "error")} label={t("Add error bars")} testId="error-on" />
          {error && (
            <>
              <Row label={t("Size")}>
                <Pick
                  value={error.kind}
                  onChange={(kind) => set({ error: { ...error, kind: kind as ErrorBars["kind"] } }, "error")}
                  options={[{ value: "fixed", label: t("Fixed value") }, { value: "percent", label: t("Percentage") }, { value: "stdev", label: t("Standard deviations") }]}
                  testId="error-kind"
                />
              </Row>
              <Num label={error.kind === "percent" ? t("Percent") : error.kind === "stdev" ? t("Number of deviations") : t("Value")} value={error.value} min={0} onCommit={(value) => set({ error: { ...error, value: value ?? 0 } }, "error")} className="w-28" testId="error-value" />
              <Row label={t("Direction")}>
                <Pick value={error.direction} onChange={(direction) => set({ error: { ...error, direction: direction as ErrorBars["direction"] } }, "error")} options={[{ value: "both", label: t("Both ways") }, { value: "plus", label: t("Up") }, { value: "minus", label: t("Down") }]} testId="error-direction" />
              </Row>
              <Check checked={error.cap} onChange={(cap) => set({ error: { ...error, cap } }, "error")} label={t("End caps")} testId="error-cap" />
            </>
          )}
        </Group>
      )}
    </>
  );
}
