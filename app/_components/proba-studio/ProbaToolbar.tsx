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
export function PlaceGlyph({ kind }: { kind: PlaceKind }) {
  const d = drawItem(newItem(kind, 0, 0));
  const pad = 6;
  return (
    <svg width="56" height="34" viewBox={`${d.bounds.x - pad} ${d.bounds.y - pad} ${d.bounds.w + 2 * pad} ${d.bounds.h + 2 * pad}`} aria-hidden="true">
      <SvgPrims prims={d.prims} />
    </svg>
  );
}

const tile = (on: boolean) => `flex flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-medium leading-tight transition-colors ${on ? "border-accent bg-accent-soft text-accent-strong ring-1 ring-accent" : "border-line bg-white text-ink hover:border-accent hover:bg-accent-soft"}`;

// The left panel of the Probability Studio: the things to put on the sheet (a tree, a Venn diagram, an urn…), and the shapes.
export default function ProbaToolbar({ studio }: { studio: ProbaStudioState }) {
  const t = useT();
  const { tool, setTool } = studio;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
      <section className="flex flex-col gap-2" aria-label={t("Add to the drawing")} data-testid="proba-tiles">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Add to the drawing")}</h3>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setTool("select")} aria-pressed={tool === "select"} data-tool="select" title={t("Select and move")} className={`${tile(tool === "select")} col-span-2 flex-row`}>
            <MousePointer2 size={16} />
            {t("Select and move")}
          </button>
          {PLACE_KINDS.map((kind) => (
            <button key={kind} onClick={() => setTool(tool === kind ? "select" : kind)} aria-pressed={tool === kind} data-place={kind} title={t("Click the drawing to put it there · Esc to stop")} className={tile(tool === kind)}>
              <PlaceGlyph kind={kind} />
              {t(PLACE_NAMES[kind])}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-label={t("Shapes")} data-testid="proba-shapes">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Shapes")}</h3>
        <ShapesMenuButton active={tool === "shape"} current={tool === "shape" ? studio.shapeKind : null} onPick={studio.pickShape} />
      </section>
    </div>
  );
}
