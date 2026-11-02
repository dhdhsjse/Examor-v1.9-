"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { tryCompile } from "@/app/_lib/graphMath";
import { addLine, fitY, removeLine, setLine, zoomWindow } from "@/app/_lib/mathGraph";
import type { GraphLine } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { NumField, inputCls } from "./fields";
import { MAX_SIZE, MIN_SIZE, type StudioGraph } from "./mathGraphPreset";

interface Props {
  graph: StudioGraph;
  apply: (changes: Partial<StudioGraph>, key: string) => void;
}

const DEFAULT_WINDOW = { xMin: -5, xMax: 5, yMin: -4, yMax: 6 };

// What is true of the whole graph: the window (the part of the plane shown), the grid, the size on the page, and the lines of the
// teacher's own (x = a, y = b, y = mx + p).
export default function WindowPanel({ graph, apply }: Props) {
  const t = useT();
  const fns = useMemo(() => graph.functions.flatMap((src, i) => (graph.curves?.[i]?.hidden ? [] : (tryCompile(src).fn ?? []))), [graph.functions, graph.curves]);
  const range = (key: "xMin" | "xMax" | "yMin" | "yMax", v: number) => {
    const next = { ...graph, [key]: v };
    if (next.xMin < next.xMax && next.yMin < next.yMax) apply({ [key]: v }, `window:${key}`);
  };
  const line = (i: number, l: GraphLine) => apply(setLine(graph, i, l), `line:${i}`);
  const lines = graph.lines ?? [];

  return (
    <div className="flex flex-col gap-5 p-4" data-testid="window-panel">
      <section className="flex flex-col gap-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Window")}</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <NumField label={t("x from")} value={graph.xMin} onCommit={(v) => range("xMin", v)} testId="x-min" />
          <NumField label={t("x to")} value={graph.xMax} onCommit={(v) => range("xMax", v)} testId="x-max" />
          <NumField label={t("y from")} value={graph.yMin} onCommit={(v) => range("yMin", v)} testId="y-min" />
          <NumField label={t("y to")} value={graph.yMax} onCommit={(v) => range("yMax", v)} testId="y-max" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            data-testid="fit-window"
            onClick={() => {
              const fit = fitY(fns, graph.xMin, graph.xMax);
              if (fit) apply(fit, "window:fit");
            }}
            className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-accent hover:bg-accent-soft"
          >
            {t("Fit to the curves")}
          </button>
          <button type="button" data-testid="reset-window" onClick={() => apply(DEFAULT_WINDOW, "window:reset")} className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-accent hover:bg-accent-soft">
            {t("Usual window")}
          </button>
          <button type="button" aria-label={t("Zoom in")} title={t("Zoom in")} onClick={() => apply(zoomWindow(graph, 0.5, (graph.xMin + graph.xMax) / 2, (graph.yMin + graph.yMax) / 2), "window:zoom")} className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-accent hover:bg-accent-soft">
            +
          </button>
          <button type="button" aria-label={t("Zoom out")} title={t("Zoom out")} onClick={() => apply(zoomWindow(graph, 2, (graph.xMin + graph.xMax) / 2, (graph.yMin + graph.yMax) / 2), "window:zoom")} className="rounded-md border border-line px-2.5 py-1 text-xs font-medium text-ink hover:border-accent hover:bg-accent-soft">
            −
          </button>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={graph.grid} onChange={(e) => apply({ grid: e.target.checked }, "grid")} data-testid="grid-toggle" className="accent-indigo-600" />
          {t("Show grid")}
        </label>
      </section>

      <section className="flex flex-col gap-2.5">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Size on the page")}</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <NumField label={t("Width (px)")} value={graph.width} min={MIN_SIZE} max={MAX_SIZE} onCommit={(width) => apply({ width }, "width")} testId="graph-width" />
          <NumField label={t("Height (px)")} value={graph.height} min={MIN_SIZE} max={MAX_SIZE} onCommit={(height) => apply({ height }, "height")} testId="graph-height" />
        </div>
      </section>

      <section className="flex flex-col gap-2.5" data-testid="lines-section">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Lines of your own")}</h3>
        {lines.map((l, i) => (
          <div key={i} data-testid={`line-${i}`} className="flex items-end gap-1.5">
            <select
              value={l.kind}
              aria-label={t("Kind of line")}
              onChange={(e) => line(i, e.target.value === "v" ? { kind: "v", a: 0 } : e.target.value === "h" ? { kind: "h", b: 0 } : { kind: "o", m: 1, p: 0 })}
              className={`${inputCls} !w-[88px] shrink-0 !px-1.5`}
            >
              <option value="v">x = a</option>
              <option value="h">y = b</option>
              <option value="o">y = mx + p</option>
            </select>
            {l.kind === "v" && <NumField value={l.a} onCommit={(a) => line(i, { ...l, a })} className="min-w-0 flex-1" testId={`line-a-${i}`} />}
            {l.kind === "h" && <NumField value={l.b} onCommit={(b) => line(i, { ...l, b })} className="min-w-0 flex-1" testId={`line-b-${i}`} />}
            {l.kind === "o" && (
              <>
                <NumField value={l.m} onCommit={(m) => line(i, { ...l, m })} className="min-w-0 flex-1" testId={`line-m-${i}`} label="m" />
                <NumField value={l.p} onCommit={(p) => line(i, { ...l, p })} className="min-w-0 flex-1" testId={`line-p-${i}`} label="p" />
              </>
            )}
            <button type="button" onClick={() => apply(removeLine(graph, i), `line:${Date.now()}`)} title={t("Remove")} aria-label={t("Remove")} className="mb-0.5 grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-red-50 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" data-testid="add-line" onClick={() => apply(addLine(graph, { kind: "v", a: 0 }), `line:${Date.now()}`)} className="flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-ink hover:border-accent hover:bg-accent-soft/40">
          <Plus size={14} />
          {t("Add a line")}
        </button>
      </section>
    </div>
  );
}
