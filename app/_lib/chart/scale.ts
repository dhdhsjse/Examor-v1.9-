// The scale of an axis: where it starts and ends, the numbers on it (and the fine lines between them), chosen from the data unless the teacher
// fixes them; linear or logarithmic; and how its numbers are written. Pure functions, unit-tested (__tests__/chart-scale.test.ts).
import { niceStep } from "@/app/_lib/graphMath";
import { formatNumber, type NumberFormat } from "@/app/_lib/table/format";
import type { AxisOptions } from "./types";

export interface Scale {
  min: number;
  max: number;
  /** The distance between the numbers (a power of ten on a logarithmic scale) */
  unit: number;
  ticks: number[];
  /** The fine lines (not the ones of `ticks`) */
  minor: number[];
  log: boolean;
}

const MAX_TICKS = 120;

export interface ScaleWish {
  /** What the data covers */
  lo: number;
  hi: number;
  /** The scale starts at zero or goes below it if the data does (columns, bars, areas) */
  includeZero?: boolean;
  /** About how many numbers there should be */
  target?: number;
}

/** A number cleaned of floating point noise, for a tick (0.30000000000000004 → 0.3) */
const clean = (v: number) => Number(v.toPrecision(12));

/** The scale for data that goes from `lo` to `hi`, with what the axis fixes (min, max, unit, log). */
export function niceScale(wish: ScaleWish, axis: Pick<AxisOptions, "min" | "max" | "unit" | "minorUnit" | "log">): Scale {
  let lo = Number.isFinite(wish.lo) ? wish.lo : 0;
  let hi = Number.isFinite(wish.hi) ? wish.hi : 1;
  if (lo > hi) [lo, hi] = [hi, lo];

  if (axis.log) {
    const pos = Math.max(lo, 1e-300);
    let min = axis.min && axis.min > 0 ? axis.min : 10 ** Math.floor(Math.log10(pos > 0 ? pos : 1));
    let max = axis.max && axis.max > 0 ? axis.max : 10 ** Math.ceil(Math.log10(Math.max(hi, min * 10)));
    if (max <= min) max = min * 10;
    min = clean(min);
    const ticks: number[] = [];
    const minor: number[] = [];
    for (let e = Math.floor(Math.log10(min)); 10 ** e <= max * 1.0000001 && ticks.length < MAX_TICKS; e++) {
      if (10 ** e >= min * 0.9999999) ticks.push(clean(10 ** e));
      for (let k = 2; k <= 9; k++) {
        const v = clean(k * 10 ** e);
        if (v > min && v < max) minor.push(v);
      }
    }
    return { min, max, unit: 10, ticks, minor, log: true };
  }

  if (wish.includeZero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  if (hi - lo < 1e-12) {
    const pad = Math.abs(hi) > 1e-12 ? Math.abs(hi) * 0.1 : 1;
    lo -= pad;
    hi += pad;
    if (wish.includeZero) lo = Math.min(lo, 0);
  }
  let unit = axis.unit && axis.unit > 0 ? axis.unit : niceStep(hi - lo, wish.target ?? 6);
  const span = (axis.max ?? Math.ceil(hi / unit - 1e-9) * unit) - (axis.min ?? Math.floor(lo / unit + 1e-9) * unit);
  if (span / unit > MAX_TICKS) unit = niceStep(span, MAX_TICKS / 2);
  const min = axis.min ?? clean(Math.floor(lo / unit + 1e-9) * unit);
  let max = axis.max ?? clean(Math.ceil(hi / unit - 1e-9) * unit);
  if (max <= min) max = min + unit;
  const ticks: number[] = [];
  for (let k = Math.ceil(min / unit - 1e-9); k * unit <= max + unit * 1e-9 && ticks.length <= MAX_TICKS; k++) ticks.push(clean(k * unit));
  const minorUnit = axis.minorUnit && axis.minorUnit > 0 ? axis.minorUnit : unit / 5;
  const minor: number[] = [];
  if ((max - min) / minorUnit <= 400) {
    for (let k = Math.ceil(min / minorUnit - 1e-9); k * minorUnit <= max + minorUnit * 1e-9; k++) {
      const v = clean(k * minorUnit);
      if (!ticks.some((t) => Math.abs(t - v) < minorUnit * 1e-6)) minor.push(v);
    }
  }
  return { min, max, unit, ticks, minor, log: false };
}

/** Where a value is on the scale: 0 at its start, 1 at its end (it can be outside). */
export function fraction(scale: Scale, v: number): number {
  if (scale.log) return (Math.log10(Math.max(v, 1e-300)) - Math.log10(scale.min)) / (Math.log10(scale.max) - Math.log10(scale.min));
  return (v - scale.min) / (scale.max - scale.min);
}

/** How many decimals show every number of a scale with this unit (0.5 → 1, 0.25 → 2, 20 → 0) */
export function autoDecimals(unit: number): number {
  for (let d = 0; d <= 8; d++) if (Math.abs(Number(unit.toFixed(d)) - unit) < unit * 1e-9) return d;
  return 8;
}

/** The text of a number on an axis: the format the teacher chose, with as many decimals as the unit needs unless he says. */
export function axisText(v: number, fmt: NumberFormat, unit: number, mark: string): string {
  const f: NumberFormat = fmt.decimals === undefined || fmt.decimals === null ? { ...fmt, decimals: fmt.percent ? Math.max(0, autoDecimals(unit * 100)) : autoDecimals(unit) } : fmt;
  return formatNumber(v, f, mark).replace(/^-/, "−");
}

/** The text of a number in a label or a table: the format if there is one, else the number as it is (at most 6 decimals). */
export function valueText(v: number, fmt: NumberFormat, mark: string): string {
  const f: NumberFormat = fmt.decimals === undefined || fmt.decimals === null ? { ...fmt, decimals: undefined } : fmt;
  const rounded = f.decimals === undefined ? Math.round(v * 1e6) / 1e6 : v;
  return formatNumber(rounded, f, mark).replace(/^-/, "−");
}

/** Excel's rule: a scale starts at zero when the data does not leave more than a sixth of its top out */
export const startsAtZero = (lo: number, hi: number) => lo >= 0 && hi > 0 && (hi - lo) / hi > 1 / 6;
