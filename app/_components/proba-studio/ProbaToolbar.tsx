"use client";

import { MousePointer2 } from "lucide-react";
import { ShapesMenuButton } from "@/app/_components/shapes/ShapeGallery";
import { PLACE_KINDS, newItem, type PlaceKind } from "@/app/_lib/proba/ops";
import { drawItem, FONT, INK, type Prim } from "@/app/_lib/proba/scene";
import { useT } from "@/app/_lib/uiLang";
import type { ProbaStudioState } from "./useProbaStudio";

export const PLACE_NAMES: Record<PlaceKind, string> = {
  tree: "Probability tree",
  venn2: "Venn diagram (2 sets)",
  venn3: "Venn diagram (3 sets)",
  urn: "Urn",
  dice: "Dice",
  coin: "Coins",
  spinner: "Spinner",
  cards: "Cards",
};

const pts = (p: number[]) => Array.from({ length: p.length / 2 }, (_, i) => `${p[2 * i]},${p[2 * i + 1]}`).join(" ");

/** A list of prims as svg elements (for the little pictures of the tiles). */
function SvgPrims({ prims }: { prims: Prim[] }) {
  return (
    <>
      {prims.map((p, i) => {
        switch (p.k) {
          case "line":
            return p.closed ? <polygon key={i} points={pts(p.pts)} fill={p.fill ?? "none"} stroke={p.color ?? INK} strokeWidth={p.w} /> : <polyline key={i} points={pts(p.pts)} fill="none" stroke={p.color ?? INK} strokeWidth={p.w} strokeLinecap="round" />;
          case "circle":
            return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={p.w ?? 1.5} />;
          case "rect":
            return <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.radius} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={p.sw ?? 1.5} />;
          case "path":
            return <path key={i} d={p.d} fill={p.fill ?? "none"} stroke={p.stroke} strokeWidth={p.w ?? 1.5} />;
          case "text":
            return (
              <text key={i} x={p.x} y={p.y} dy="0.35em" textAnchor={p.anchor} fontSize={p.size} fontWeight={p.bold ? "bold" : undefined} fill={p.color ?? INK} fontFamily={FONT}>
                {p.text}
              </text>
            );
          default:
            return null;
        }
      })}
    </>
  );
}

/** The little picture of a tile: what it puts on the sheet, shrunk. */
export function PlaceGlyph({ kind, width = 56, height = 34 }: { kind: PlaceKind; width?: number; height?: number }) {
  const d = drawItem(newItem(kind, 0, 0));
  const pad = 6;
  return (
    // (`ink-glyph`: in dark mode the ink turns light and the white faces of dice and cards see-through, globals.css)
    <svg width={width} height={height} className="ink-glyph shrink-0" viewBox={`${d.bounds.x - pad} ${d.bounds.y - pad} ${d.bounds.w + 2 * pad} ${d.bounds.h + 2 * pad}`} aria-hidden="true">
      <SvgPrims prims={d.prims} />
    </svg>
  );
}

// One row of the list: a small picture (or icon) and the name; the tool in hand is tinted.
const row = (on: boolean) => `flex min-h-8 w-full items-center gap-2 rounded px-2 py-1 text-start text-xs leading-tight ${on ? "bg-accent-soft font-medium text-accent-strong" : "text-ink hover:bg-hover"}`;

// The left panel of the Probability Studio: the things to put on the sheet (a tree, a Venn diagram, an urn…), and the shapes.
export default function ProbaToolbar({ studio }: { studio: ProbaStudioState }) {
  const t = useT();
  const { tool, setTool } = studio;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2">
      <section className="flex flex-col gap-1" aria-label={t("Add to the drawing")} data-testid="proba-tiles">
        <h3 className="px-2 pb-1 pt-1 text-xs font-semibold text-muted">{t("Add to the drawing")}</h3>
        <button onClick={() => setTool("select")} aria-pressed={tool === "select"} data-tool="select" title={t("Select and move")} className={row(tool === "select")}>
          <span className="grid w-8 shrink-0 place-items-center">
            <MousePointer2 size={14} />
          </span>
          {t("Select and move")}
        </button>
        {PLACE_KINDS.map((kind) => (
          <button key={kind} onClick={() => setTool(tool === kind ? "select" : kind)} aria-pressed={tool === kind} data-place={kind} title={t("Click the drawing to put it there · Esc to stop")} className={row(tool === kind)}>
            <PlaceGlyph kind={kind} width={32} height={20} />
            {t(PLACE_NAMES[kind])}
          </button>
        ))}
      </section>

      <section className="flex flex-col gap-1 border-t border-line pt-2" aria-label={t("Shapes")} data-testid="proba-shapes">
        <ShapesMenuButton active={tool === "shape"} current={tool === "shape" ? studio.shapeKind : null} onPick={studio.pickShape} />
      </section>
    </div>
  );
}
