"use client";

import { ChevronDown, Shapes } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Popover } from "@/app/_features/inspectors/format/ribbonUi";
import { SHAPE_CATEGORIES, localExtent, paintFill, resolveStyle, shapeDef, shapeParts, shapesIn, type ShapeStyle } from "@/app/_lib/shapes";
import { useT } from "@/app/_lib/uiLang";
import { rememberShape, useRecentShapes } from "./recentShapes";

const PREVIEW_FILL = "#dbeafe";
const PREVIEW_STROKE = "#1e3a8a";

// A small picture of a shape (a button of the gallery, the name of the shape in a panel).
export function ShapeThumb({ shape, size = 28, style }: { shape: string; size?: number; style?: Partial<ShapeStyle> }) {
  const def = shapeDef(shape);
  const [bw, bh] = def.size ?? [120, 90];
  // the picture is drawn in a box about 24 px across, whatever its proportions
  const k = 24 / Math.max(bw, bh, 1);
  const w = def.line ? Math.max(bw * k, 0) : Math.max(bw * k, 6);
  const h = def.line ? Math.max(bh * k, 0) : Math.max(bh * k, 6);
  const s: ShapeStyle = { shape, fill: PREVIEW_FILL, stroke: PREVIEW_STROKE, strokeWidth: 1.4, ...style };
  const e = localExtent(s, w, h);
  const pad = 2.5;
  const vw = e.maxX - e.minX + 2 * pad;
  const vh = e.maxY - e.minY + 2 * pad;
  const { stroke, strokeWidth } = resolveStyle(s);
  return (
    <svg width={size} height={size} viewBox={`${e.minX - pad} ${e.minY - pad} ${vw} ${vh}`} aria-hidden="true">
      {shapeParts(s, w, h).map((p, i) => (
        <path key={i} d={p.d} fill={paintFill(p.paint, s) ?? "none"} stroke={stroke ?? "none"} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function Tile({ shape, selected, onPick }: { shape: string; selected?: boolean; onPick: (shape: string) => void }) {
  const t = useT();
  const label = t(shapeDef(shape).label);
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={selected}
      data-shape={shape}
      onClick={() => onPick(shape)}
      className={`grid size-9 place-items-center rounded-md border text-ink transition-colors hover:border-accent hover:bg-accent-soft ${selected ? "border-accent bg-accent-soft" : "border-transparent"}`}
    >
      <ShapeThumb shape={shape} size={26} />
    </button>
  );
}

/**
 * The gallery of shapes, like PowerPoint's: the ones used lately first, then each category with its shapes. A click on one
 * hands it to `onPick` (and remembers it); what is done with it (draw it on the page, in the Studio) is up to the caller.
 */
export function ShapeGallery({ onPick, current }: { onPick: (shape: string) => void; current?: string | null }) {
  const t = useT();
  const recent = useRecentShapes();
  const pick = useCallback(
    (shape: string) => {
      rememberShape(shape);
      onPick(shape);
    },
    [onPick],
  );
  return (
    <div data-testid="shape-gallery" className="flex flex-col gap-2.5">
      {recent.length > 0 && (
        <section data-testid="shape-gallery-recent">
          <h4 className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-faint">{t("Recently used shapes")}</h4>
          <div className="flex flex-wrap gap-0.5">
            {recent.map((id) => (
              <Tile key={id} shape={id} selected={id === current} onPick={pick} />
            ))}
          </div>
        </section>
      )}
      {SHAPE_CATEGORIES.map((category) => (
        <section key={category} data-category={category}>
          <h4 className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-faint">{t(category)}</h4>
          <div className="flex flex-wrap gap-0.5">
            {shapesIn(category).map((s) => (
              <Tile key={s.id} shape={s.id} selected={s.id === current} onPick={pick} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

/** A button that opens the gallery under it (the Studios' toolbars). */
export function ShapesMenuButton({ onPick, active, current, testId = "shapes-menu" }: { onPick: (shape: string) => void; active?: boolean; current?: string | null; testId?: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  return (
    <div ref={anchor} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-pressed={active}
        data-testid={testId}
        title={t("Shapes")}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-sm font-medium transition-colors ${active ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-white text-ink hover:border-accent"}`}
      >
        <Shapes size={16} />
        <span className="flex-1 text-start">{t("Shapes")}</span>
        <ChevronDown size={14} className="text-muted" />
      </button>
      {open && (
        <Popover anchor={anchor} onClose={close} width={300}>
          <div className="p-1.5">
            <ShapeGallery
              current={current}
              onPick={(shape) => {
                close();
                onPick(shape);
              }}
            />
          </div>
        </Popover>
      )}
    </div>
  );
}
