"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { changeFigure, figureDef, figureParams, renderFigure, type FigureParam, type Params } from "@/app/_lib/figures";
import { svgSize, svgUrl } from "@/app/_lib/library";
import type { FigureSpec, FigureValue, ImageBlock, Lang } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { ColorGrid } from "../rich/FormatBar";
import { MenuSelect, NumberInput, Segmented, TextInput, Toggle } from "./fields";
import type { OnChange } from "./QuestionEditors";

// Settings of a library figure (the angles of a triangle, the lamps of a circuit…).
// Each change redraws the picture; its width stays, its height follows the new shape.
export function FigureEditor({ b, figure, lang, onChange }: { b: ImageBlock; figure: FigureSpec; lang: Lang; onChange: OnChange }) {
  const t = useT();
  const def = figureDef(figure.id);
  if (!def) return null;
  const params = renderFigure(def.id, figure.params, lang)?.params ?? figure.params;

  const apply = (next: Params, field: string) => {
    const r = renderFigure(def.id, next, lang);
    if (!r) return;
    const { w, h } = svgSize(r.svg);
    const ratio = w / Math.max(1, h);
    onChange({ figure: { id: def.id, params: r.params }, src: svgUrl(r.svg), ratio, layout: { height: b.layout.width / ratio } }, field);
  };
  const set = (key: string, value: FigureValue) => apply(changeFigure(def, params, key, value), `figure-${key}`);

  // Settings sharing a `row` sit side by side.
  const rows: FigureParam[][] = [];
  for (const p of figureParams(def).filter((p) => !p.when || p.when(params))) {
    const last = rows[rows.length - 1];
    if (p.row && last?.[0]?.row === p.row) last.push(p);
    else rows.push([p]);
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[5px] border border-line p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink">
          <SlidersHorizontal size={12} strokeWidth={2} aria-hidden className="text-muted" />
          {t(def.name)}
        </span>
        <button
          type="button"
          onClick={() => apply(def.defaults(lang), "figure-reset")}
          title={t("Back to the default settings")}
          className="grid size-6 place-items-center rounded-md text-muted hover:bg-white hover:text-ink"
        >
          <RotateCcw size={13} aria-hidden />
        </button>
      </div>
      {def.hint && <p className="text-[11px] leading-snug text-indigo-900/70">{t(def.hint)}</p>}
      {rows.map((row) =>
        row.length > 1 ? (
          <div key={row[0].key} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
            {row.map((p) => (
              <Control key={p.key} p={p} params={params} set={set} compact />
            ))}
          </div>
        ) : (
          <Control key={row[0].key} p={row[0]} params={params} set={set} />
        ),
      )}
    </div>
  );
}

function Control({ p, params, set, compact }: { p: FigureParam; params: Params; set: (key: string, v: FigureValue) => void; compact?: boolean }) {
  const t = useT();
  const label = t(p.label, p.vars?.(params));
  const value = params[p.key];
  const caption = <span className={`text-[11px] font-semibold text-muted ${compact ? "truncate" : ""}`}>{label}</span>;

  switch (p.kind) {
    case "bool":
      return <Toggle checked={value === true} onChange={(v) => set(p.key, v)} label={label} />;
    case "number":
      return (
        <label className="flex min-w-0 flex-col gap-1" title={label}>
          {caption}
          <span className="flex items-center gap-1 text-[11px] text-muted [&_input]:w-full [&_input]:min-w-0">
            <NumberInput value={Number(value) || 0} min={p.min} max={p.max} step={p.step} onChange={(v) => set(p.key, v)} />
            {p.unit}
          </span>
        </label>
      );
    case "text":
      return (
        <label className="flex min-w-0 flex-col gap-1" title={label}>
          {caption}
          <TextInput value={typeof value === "string" ? value : ""} placeholder={p.placeholder} onChange={(v) => set(p.key, v)} />
        </label>
      );
    case "select": {
      const options = p.options.map((o) => ({ value: o.value, label: t(o.label) }));
      return (
        <div className="flex min-w-0 flex-col gap-1" role="group" aria-label={label}>
          {caption}
          {options.length <= 3 ? (
            <Segmented value={String(value)} options={options} onChange={(v) => set(p.key, v)} />
          ) : (
            <MenuSelect label={label} value={String(value)} options={options} onChange={(v) => set(p.key, v)} />
          )}
        </div>
      );
    }
    case "color":
      return (
        <div className="flex flex-col gap-1" role="group" aria-label={label}>
          {caption}
          <ColorGrid value={typeof value === "string" ? value : undefined} onChange={(v) => v && set(p.key, v)} />
        </div>
      );
  }
}
