// What Insert Chart remembers for the teacher: the kinds picked lately ("Recent") and the looks saved by name ("Templates"). A template keeps how a
// chart looks (its kind, colors, fonts, grid, legend, labels, size) and nothing of what it says (its table, its texts, its scales), so the same
// look can start any other chart. Nothing here is React or the browser: the storage is in app/_components/chart-studio/chartMemory.ts.
import { changeKind, normalizeChart } from "./catalog";
import { CHART_FAMILIES, type AxisOptions, type ChartConfig, type ChartFamily, type SeriesStyle } from "./types";

export interface KindRef {
  family: ChartFamily;
  variant: string;
}

export const RECENT_LIMIT = 8;
export const TEMPLATE_LIMIT = 24;

/** The kinds used lately: the newest first, each once */
export function pushRecentKind(list: readonly KindRef[], kind: KindRef, limit = RECENT_LIMIT): KindRef[] {
  return [kind, ...list.filter((k) => k.family !== kind.family || k.variant !== kind.variant)].slice(0, limit);
}

/** A chart without its table: how it looks */
export type Look = Omit<ChartConfig, "data">;

export interface ChartTemplate {
  id: string;
  name: string;
  look: Look;
}

const stripData = (c: ChartConfig): Look => {
  const look: Partial<ChartConfig> = { ...c };
  delete look.data;
  return look as Look;
};

// What belongs to the data and not to the look: the title and the scale of an axis, the name of a series, the points picked out, the steps of a waterfall…
const SCALE_FREE: Pick<AxisOptions, "title" | "min" | "max" | "unit" | "minorUnit" | "every"> = { title: "", min: null, max: null, unit: null, minorUnit: null, every: null };

const withoutData = (s: SeriesStyle): SeriesStyle => {
  const out = { ...s };
  delete out.name;
  delete out.hidden;
  delete out.points;
  return out;
};

/** The look of a chart: everything but its table, its texts and its scales */
export function lookOf(c: ChartConfig): Look {
  return {
    ...stripData(c),
    title: { ...c.title, text: "" },
    axes: { x: { ...c.axes.x, ...SCALE_FREE }, y: { ...c.axes.y, ...SCALE_FREE }, y2: { ...c.axes.y2, ...SCALE_FREE } },
    series: c.series.map(withoutData),
    histogram: { ...c.histogram, bins: "auto", start: null },
    waterfall: { ...c.waterfall, totals: [] },
    blank: false,
  };
}

/**
 * A chart dressed in a look: the look of the template, and from `target` its table, its words, its scales and which students' picture it is (a new chart is
 * the sample of the kind of the template, so what it says is the sample's). The kind is the template's: the chart changes kind as Change Chart Type does.
 */
export function dress(target: ChartConfig, look: Look): ChartConfig {
  const own = changeKind(target, look.family, look.variant);
  const base = normalizeChart({ ...look, data: own.data });
  const axis = (mine: AxisOptions, shaped: AxisOptions): AxisOptions => ({ ...shaped, title: mine.title, min: mine.min, max: mine.max, unit: mine.unit, minorUnit: mine.minorUnit, every: mine.every });
  const series = Array.from({ length: Math.max(base.series.length, own.series.length) }, (_, i): SeriesStyle => {
    const mine = own.series[i] ?? {};
    const kept: SeriesStyle = {};
    if (mine.name !== undefined) kept.name = mine.name;
    if (mine.hidden !== undefined) kept.hidden = mine.hidden;
    if (mine.points !== undefined) kept.points = mine.points;
    return { ...(base.series[i] ?? {}), ...kept };
  });
  return {
    ...base,
    title: { ...base.title, text: own.title.text },
    axes: { x: axis(own.axes.x, base.axes.x), y: axis(own.axes.y, base.axes.y), y2: axis(own.axes.y2, base.axes.y2) },
    series,
    histogram: { ...base.histogram, bins: own.histogram.bins, width: own.histogram.width, count: own.histogram.count, start: own.histogram.start },
    waterfall: { ...base.waterfall, totals: own.waterfall.totals },
    blank: own.blank,
  };
}

/** A template added to the list: one with the same name (whatever its case) is replaced, the newest is first, and only a few are kept */
export function pushTemplate(list: readonly ChartTemplate[], template: ChartTemplate, limit = TEMPLATE_LIMIT): ChartTemplate[] {
  const same = template.name.trim().toLowerCase();
  return [template, ...list.filter((x) => x.name.trim().toLowerCase() !== same)].slice(0, limit);
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** The templates read back from the browser: what is not one is left out, and a look from an earlier version gets the settings it lacks */
export function readTemplates(raw: unknown, limit = TEMPLATE_LIMIT): ChartTemplate[] {
  if (!Array.isArray(raw)) return [];
  const out: ChartTemplate[] = [];
  for (const item of raw) {
    if (!isObject(item) || typeof item.id !== "string" || typeof item.name !== "string" || !item.name.trim() || !isObject(item.look)) continue;
    if (!(CHART_FAMILIES as readonly string[]).includes(item.look.family as string)) continue;
    out.push({ id: item.id, name: item.name, look: stripData(normalizeChart(item.look)) });
  }
  return out.slice(0, limit);
}

/** The kinds read back from the browser: only the ones that exist, each once */
export function readRecentKinds(raw: unknown, exists: (k: KindRef) => boolean, limit = RECENT_LIMIT): KindRef[] {
  if (!Array.isArray(raw)) return [];
  const out: KindRef[] = [];
  for (const item of raw) {
    if (!isObject(item) || typeof item.family !== "string" || typeof item.variant !== "string") continue;
    const kind = { family: item.family as ChartFamily, variant: item.variant };
    if (exists(kind) && !out.some((k) => k.family === kind.family && k.variant === kind.variant)) out.push(kind);
  }
  return out.slice(0, limit);
}
