"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { changeFigure, figureDef, figureParams, fullFigureParams, renderFigure, type FigureParam, type Params } from "@/app/_lib/figures";
import { svgSize, svgUrl } from "@/app/_lib/library";
import type { FigureSpec, FigureValue, ImageBlock, Lang } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { ColorGrid } from "../rich/FormatBar";
import { Field, Group, MenuSelect, NumberInput, Segmented, TextInput, Toggle, iconButtonCls } from "./fields";
import type { OnChange } from "./QuestionEditors";

// Settings of a library figure (the angles of a triangle, the lamps of a circuit…).
// Each change redraws the picture; its width stays, its height follows the new shape.
export function FigureEditor({ b, figure, lang, onChange }: { b: ImageBlock; figure: FigureSpec; lang: Lang; onChange: OnChange }) {
  const t = useT();
  const def = figureDef(figure.id);
  if (!def) return null;
  // (the settings only: the drawing is made when one changes)
  const params = fullFigureParams(def, figure.params, lang);

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
    <Group
      label={t(def.name)}
      title={
        <>
          <SlidersHorizontal size={12} strokeWidth={2} aria-hidden className="shrink-0 text-muted" />
          <span className="truncate">{t(def.name)}</span>
        </>
      }
      hint={def.hint ? t(def.hint) : undefined}
      action={
        <button type="button" onClick={() => apply(def.defaults(lang), "figure-reset")} title={t("Back to the default settings")} aria-label={t("Back to the default settings")} className={`${iconButtonCls} size-6!`}>
          <RotateCcw size={13} aria-hidden />
        </button>
      }
    >
      {rows.map((row) =>
        row.length > 1 ? (
          <div key={row[0].key} className="grid gap-2" style={{ gridTemplateColumns: `repeat(${row.length}, minmax(0, 1fr))` }}>
            {row.map((p) => (
              <Control key={p.key} p={p} params={params} set={set} />
            ))}
          </div>
        ) : (
          <Control key={row[0].key} p={row[0]} params={params} set={set} />
        ),
      )}
    </Group>
  );
}

function Control({ p, params, set }: { p: FigureParam; params: Params; set: (key: string, v: FigureValue) => void }) {
  const t = useT();
  const label = t(p.label, p.vars?.(params));
  const value = params[p.key];

  switch (p.kind) {
    case "bool":
      return <Toggle checked={value === true} onChange={(v) => set(p.key, v)} label={label} />;
    case "number":
      return (
        <Field label={label}>
          <span className="flex min-w-0 items-center gap-1 text-xs text-muted">
            <NumberInput value={Number(value) || 0} min={p.min} max={p.max} step={p.step} ariaLabel={label} onChange={(v) => set(p.key, v)} />
            {p.unit && <span className="shrink-0">{p.unit}</span>}
          </span>
        </Field>
      );
    case "text":
      return (
        <Field label={label}>
          <TextInput value={typeof value === "string" ? value : ""} placeholder={p.placeholder} onChange={(v) => set(p.key, v)} />
        </Field>
      );
    case "select": {
      const options = p.options.map((o) => ({ value: o.value, label: t(o.label) }));
      return (
        <Field group label={label}>
          {options.length <= 3 ? (
            <Segmented value={String(value)} options={options} onChange={(v) => set(p.key, v)} />
          ) : (
            <MenuSelect full label={label} value={String(value)} options={options} onChange={(v) => set(p.key, v)} />
          )}
        </Field>
      );
    }
    case "color":
      return (
        <Field group label={label}>
          <ColorGrid value={typeof value === "string" ? value : undefined} onChange={(v) => v && set(p.key, v)} />
        </Field>
      );
  }
}
