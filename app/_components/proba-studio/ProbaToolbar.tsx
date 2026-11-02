"use client";

import { MousePointer2, Plus, Trash2, Wand2 } from "lucide-react";
import { useState } from "react";
import { ShapesMenuButton } from "@/app/_components/shapes/ShapeGallery";
import { PLACE_KINDS, newItem, type PlaceKind } from "@/app/_lib/proba/ops";
import { drawItem, FONT, INK, type Prim } from "@/app/_lib/proba/scene";
import { stagesOf } from "@/app/_lib/proba/tree";
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

const PRESETS: { name: string; stages: string[] }[] = [
  { name: "2 × 2", stages: ["A, !A", "B, !B"] },
  { name: "2 × 2 × 2", stages: ["A, !A", "B, !B", "C, !C"] },
  { name: "3 × 2", stages: ["U1, U2, U3", "R, !R"] },
  { name: "Coin ×3", stages: ["P, F", "P, F", "P, F"] },
];

const tile = (on: boolean) => `flex flex-col items-center justify-center gap-1 rounded-xl border px-1 py-2 text-[11px] font-medium leading-tight transition-colors ${on ? "border-accent bg-accent-soft text-accent-strong ring-1 ring-accent" : "border-line bg-white text-ink hover:border-accent hover:bg-accent-soft"}`;
const input = "min-w-0 flex-1 rounded-lg border border-line bg-subtle px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent";

// The left panel of the Probability Studio: the quick builder of a tree (its stages, one line each), the things to put on the
// sheet, and the shapes.
export default function ProbaToolbar({ studio }: { studio: ProbaStudioState }) {
  const t = useT();
  const { tool, setTool, selectedTree } = studio;
  const [stages, setStages] = useState<string[]>(["A, !A", "B, !B"]);

  // the builder shows the stages of the tree that is selected
  // (state adjusted while rendering when another tree is selected, not in an effect)
  const treeId = selectedTree?.id;
  const [shownFor, setShownFor] = useState(treeId);
  if (treeId !== shownFor) {
    setShownFor(treeId);
    const s = selectedTree ? stagesOf(selectedTree.root) : [];
    if (s.length) setStages(s);
  }

  const setStage = (i: number, text: string) => setStages((s) => s.map((x, j) => (j === i ? text : x)));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
      <section className="flex flex-col gap-2" aria-label={t("Quick tree")} data-testid="proba-builder">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Quick tree")}</h3>
        <p className="text-xs text-muted">{t("One line per stage, the events separated by commas. Write !A for Ā.")}</p>
        <div className="flex flex-col gap-1.5">
          {stages.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="w-5 shrink-0 text-center text-xs font-semibold tabular-nums text-faint">{i + 1}</span>
              <input
                value={s}
                onChange={(e) => setStage(i, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    studio.buildFromStages(stages);
                  }
                }}
                aria-label={t("Stage {n}", { n: i + 1 })}
                placeholder="A, !A"
                data-testid={`stage-${i}`}
                className={input}
              />
              <button onClick={() => setStages((x) => x.filter((_, j) => j !== i))} disabled={stages.length < 2} aria-label={t("Remove this stage")} title={t("Remove this stage")} className="grid size-7 shrink-0 place-items-center rounded-lg text-muted enabled:hover:bg-subtle enabled:hover:text-red-600 disabled:opacity-30">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setStages((s) => [...s, s[s.length - 1] ?? "A, !A"])} disabled={stages.length >= 6} data-testid="add-stage" className="flex items-center gap-1 rounded-lg border border-dashed border-line px-2 py-1 text-xs font-medium text-muted hover:border-accent hover:text-accent-strong disabled:opacity-40">
            <Plus size={13} />
            {t("Stage")}
          </button>
          {PRESETS.map((p) => (
            <button key={p.name} onClick={() => setStages(p.stages)} className="rounded-lg border border-line bg-white px-2 py-1 text-xs font-medium text-ink hover:border-accent hover:bg-accent-soft">
              {t(p.name)}
            </button>
          ))}
        </div>
        <button
          onClick={() => studio.buildFromStages(stages)}
          data-testid="build-tree"
          title={selectedTree ? t("The selected tree is made again from these stages (its probabilities are cleared)") : undefined}
          className="flex items-center justify-center gap-2 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-strong"
        >
          <Wand2 size={15} />
          {selectedTree ? t("Rebuild the selected tree") : t("Add this tree")}
        </button>
      </section>

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
