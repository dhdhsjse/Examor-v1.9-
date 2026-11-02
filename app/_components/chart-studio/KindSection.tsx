"use client";

import { isStacked } from "@/app/_lib/chart/catalog";
import type { ChartModel } from "@/app/_lib/chart/data";
import type { ChartConfig, QuartileMethod } from "@/app/_lib/chart/types";
import { useT } from "@/app/_lib/uiLang";
import { Check, ColorField, Group, Num, Pick, Row } from "./controls";
import type { PanelProps } from "./ChartSection";

/** Whether a kind of chart has settings of its own (bars with a gap, slices, classes, boxes, steps) */
export const hasKindOptions = (c: ChartConfig) => ["column", "bar", "combo", "histogram", "box", "funnel", "waterfall", "pie"].includes(c.family);

// What belongs to the kind of chart: the room between bars, the first slice and the hole of a doughnut, the classes of a histogram, the way
// quartiles are found, the totals of a waterfall.
export default function KindSection({ c, edit, model }: PanelProps & { model: ChartModel }) {
  const t = useT();
  const f = c.family;
  const set = (patch: Partial<ChartConfig>, key: string) => edit((x) => ({ ...x, ...patch }), key);
  const hist = (patch: Partial<ChartConfig["histogram"]>, key: string) => edit((x) => ({ ...x, histogram: { ...x.histogram, ...patch } }), `histogram:${key}`);
  const box = (patch: Partial<ChartConfig["box"]>, key: string) => edit((x) => ({ ...x, box: { ...x.box, ...patch } }), `box:${key}`);
  const pie = (patch: Partial<ChartConfig["pie"]>, key: string) => edit((x) => ({ ...x, pie: { ...x.pie, ...patch } }), `pie:${key}`);
  const wf = (patch: Partial<ChartConfig["waterfall"]>, key: string) => edit((x) => ({ ...x, waterfall: { ...x.waterfall, ...patch } }), `waterfall:${key}`);
  const bars = f === "column" || f === "bar" || f === "combo" || f === "histogram" || f === "box" || f === "funnel" || f === "waterfall";
  const clustered = (f === "column" || f === "bar" || f === "combo") && !isStacked(c.variant);

  return (
    <>
      {bars && (
        <Group>
          <Row label={t("Gap between the bars (%)")}>
            <Num value={c.gap} min={0} max={500} onCommit={(gap) => set({ gap: gap ?? 0 }, "gap")} className="w-20" testId="gap" />
          </Row>
          {clustered && (
            <Row label={t("Overlap of the bars (%)")}>
              <Num value={c.overlap} min={-100} max={100} onCommit={(overlap) => set({ overlap: overlap ?? 0 }, "overlap")} className="w-20" testId="overlap" />
            </Row>
          )}
          {clustered && <p className="text-[11px] leading-snug text-faint">{t("A very large gap makes sticks (bar diagram of a discrete series).")}</p>}
        </Group>
      )}

      {f === "pie" && (
        <Group>
          <Row label={t("Angle of the first slice (°)")}>
            <Num value={c.pie.firstAngle} min={0} max={359} onCommit={(firstAngle) => pie({ firstAngle: firstAngle ?? 0 }, "angle")} className="w-20" testId="pie-angle" />
          </Row>
          {c.variant === "doughnut" && (
            <Row label={t("Size of the hole (%)")}>
              <Num value={c.pie.hole} min={10} max={85} onCommit={(hole) => pie({ hole: hole ?? 55 }, "hole")} className="w-20" testId="pie-hole" />
            </Row>
          )}
          <Row label={t("Pull all the slices out (%)")}>
            <Num value={c.pie.explode} min={0} max={50} onCommit={(explode) => pie({ explode: explode ?? 0 }, "explode")} className="w-20" testId="pie-explode" />
          </Row>
        </Group>
      )}

      {f === "histogram" && (
        <Group title={t("Classes")}>
          {c.variant === "raw" ? (
            <>
              <Row label={t("Width of the classes")}>
                <Pick value={c.histogram.bins} onChange={(bins) => hist({ bins }, "bins")} options={[{ value: "auto", label: t("Automatic") }, { value: "width", label: t("A width") }, { value: "count", label: t("A number of classes") }]} testId="hist-bins" />
              </Row>
              {c.histogram.bins === "width" && <Num label={t("Width")} value={c.histogram.width} min={1e-9} onCommit={(width) => width && hist({ width }, "width")} className="w-28" testId="hist-width" />}
              {c.histogram.bins === "count" && <Num label={t("Number of classes")} value={c.histogram.count} min={1} max={200} onCommit={(count) => count && hist({ count: Math.round(count) }, "count")} className="w-28" testId="hist-count" />}
              <Num label={t("First class starts at")} value={c.histogram.start} auto placeholder={t("The smallest value")} onCommit={(start) => hist({ start }, "start")} className="w-40" testId="hist-start" />
            </>
          ) : (
            <p className="text-[11px] leading-snug text-faint">{t("The table gives the classes: the lower end, the upper end and the number of each.")}</p>
          )}
          <div className="flex flex-col gap-1.5">
            <Check checked={c.histogram.cumulative} onChange={(cumulative) => hist({ cumulative }, "cumulative")} label={t("Cumulative numbers")} testId="hist-cumulative" />
            <Check checked={c.histogram.relative} onChange={(relative) => hist({ relative }, "relative")} label={t("Frequencies (% of the total)")} testId="hist-relative" />
            <Check checked={c.histogram.polygon} onChange={(polygon) => hist({ polygon }, "polygon")} label={c.histogram.cumulative ? t("Draw the cumulative polygon") : t("Draw the polygon of the numbers")} testId="hist-polygon" />
          </div>
          <Row label={t("Write the classes as")}>
            <Pick value={c.histogram.intervals} onChange={(intervals) => hist({ intervals }, "intervals")} options={[{ value: "french", label: "[a;b[" }, { value: "plain", label: "a–b" }]} testId="hist-intervals" />
          </Row>
        </Group>
      )}

      {f === "box" && (
        <Group title={t("Box and whisker")}>
          <Row label={t("Quartiles")}>
            <Pick
              value={c.box.method}
              onChange={(method) => box({ method: method as QuartileMethod }, "method")}
              options={[{ value: "lycee", label: t("Programme (rank ⌈n/4⌉)") }, { value: "inclusive", label: t("Excel, inclusive") }, { value: "exclusive", label: t("Excel, exclusive") }]}
              testId="box-method"
            />
          </Row>
          <Check checked={c.box.mean} onChange={(mean) => box({ mean }, "mean")} label={t("Mark the mean")} testId="box-mean" />
          <Check checked={c.box.outliers} onChange={(outliers) => box({ outliers }, "outliers")} label={t("Show the outliers apart")} hint={t("Beyond 1.5 × the interquartile range.")} testId="box-outliers" />
          <Check checked={c.box.points} onChange={(points) => box({ points }, "points")} label={t("Show every value")} testId="box-points" />
        </Group>
      )}

      {f === "waterfall" && (
        <Group title={t("Steps")}>
          <p className="text-[11px] leading-snug text-faint">{t("A total shows the running total (or the number written in its row). The other rows add to it or take away from it.")}</p>
          <div className="flex max-h-48 flex-col gap-1 overflow-y-auto" data-testid="waterfall-totals">
            {model.categories.map((name, k) => (
              <Check key={k} checked={c.waterfall.totals.includes(k)} onChange={(on) => wf({ totals: on ? [...c.waterfall.totals, k].sort((a, b) => a - b) : c.waterfall.totals.filter((x) => x !== k) }, "totals")} label={`${t("Total")}: ${name}`} testId={`waterfall-total-${k}`} />
            ))}
          </div>
          <Check checked={c.waterfall.connectors} onChange={(connectors) => wf({ connectors }, "connectors")} label={t("Lines between the steps")} testId="waterfall-connectors" />
          <div className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <ColorField value={c.waterfall.up} onChange={(up) => up && wf({ up }, "up")} label={t("Rise")} />
              {t("Rise")}
            </span>
            <span className="flex items-center gap-1.5">
              <ColorField value={c.waterfall.down} onChange={(down) => down && wf({ down }, "down")} label={t("Fall")} />
              {t("Fall")}
            </span>
            <span className="flex items-center gap-1.5">
              <ColorField value={c.waterfall.total} onChange={(total) => total && wf({ total }, "total")} label={t("Total")} />
              {t("Total")}
            </span>
          </div>
        </Group>
      )}
    </>
  );
}
