"use client";

import { Check, Type } from "lucide-react";
import { useMemo } from "react";
import { CONTENT_WIDTH } from "@/app/_lib/a4";
import { ANNOTATION_SPECS, ANNOTATION_TYPES } from "@/app/_lib/graph/annotations";
import { PAPER_MARGIN } from "@/app/_lib/graph/grid";
import { GRAPH_PRESETS, GRAPH_TEMPLATES, GRAPH_TEMPLATE_GROUPS, presetApplies } from "@/app/_lib/graph/presets";
import { FUNCTION_SPECS, FUNCTION_TYPES } from "@/app/_lib/graph/mathUtils";
import { plainLabel } from "@/app/_lib/graph/richLabel";
import type { AnnotationType, FunctionType } from "@/app/_lib/graph/types";
import { ShapesMenuButton } from "@/app/_components/shapes/ShapeGallery";
import { useT } from "@/app/_lib/uiLang";
import Disclosure from "./Disclosure";
import { Group, SwitchRow, held, idle, listRow, tileBase } from "./fields";
import type { GraphStudioState } from "./useGraphStudio";

// A curve of each kind as a small sketch for its button (30 × 18).
const GLYPHS: Record<FunctionType, string> = {
  linear: "M3 15 27 3",
  quadratic: "M3 15C9 -3 21 -3 27 15",
  exponential: "M3 3C7 12 13 14 27 15",
  logarithmic: "M3 15C5 6 11 4 27 3",
  sigmoid: "M3 15C14 15 16 3 27 3",
  oscillation: "M3 9C5 0 8 0 10 9S14 18 16 9 19 4 21 9 24 13 27 9",
  titration: "M3 15C10 14.5 13 14 14.5 10S15.5 4 20 3.5S25 3 27 3",
  formula: "",
  data: "M6 13h0M11 9h0M16 10h0M21 5h0",
};

// An annotation of each kind as a small sketch for its button.
function AnnotationGlyph({ type }: { type: AnnotationType }) {
  if (type === "text") return <Type size={16} />;
  return (
    <svg width="30" height="18" viewBox="0 0 30 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {type === "asymptote" && <path d="M3 5h24" strokeDasharray="3 3" />}
      {type === "asymptote" && <path d="M3 16C10 9 16 6.5 27 6" strokeWidth="1" opacity="0.5" />}
      {type === "tangent" && <path d="M3 14C10 14 16 9 27 4" strokeWidth="1" opacity="0.5" />}
      {type === "tangent" && <path d="M8 16 24 4" strokeDasharray="3 3" />}
      {type === "triangle" && <path d="M5 15h20V4z" />}
      {type === "marker" && <path d="M10 5l10 10M20 5 10 15" />}
      {type === "axisMark" && <path d="M3 15h24" strokeWidth="1" opacity="0.5" />}
      {type === "axisMark" && <path d="M15 12v6" />}
      {type === "axisMark" && <path d="M15 2v8" strokeDasharray="2 2" />}
      {type === "curveLabel" && <circle cx="15" cy="9" r="6.5" />}
      {type === "curveLabel" && (
        <text x="15" y="12.2" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor" stroke="none">
          1
        </text>
      )}
      {type === "line" && <path d="M4 15 26 3" />}
    </svg>
  );
}

function FunctionGlyph({ type }: { type: FunctionType }) {
  return (
    <svg width="30" height="18" viewBox="0 0 30 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 2v14h25" strokeWidth="1" opacity="0.5" />
      {type === "formula" ? (
        <text x="15.5" y="12" textAnchor="middle" fontSize="10" fontStyle="italic" fontFamily="serif" fill="currentColor" stroke="none">
          f(x)
        </text>
      ) : (
        <path d={GLYPHS[type]} strokeWidth={type === "data" ? 4 : undefined} />
      )}
    </svg>
  );
}

// A tool or a function as a tile: its little drawing and its name (the styles are shared with the Molecule Studio).
const tile = `${tileBase} h-12`;

// The left panel of the Graph Studio: the functions to plot (one click draws one on the paper, its parameters are on the right), the measured points, the
// annotation tools, the shapes, and the sheets a teacher starts from: the few general ones, and the physics sheets (a whole paper with its scales, curves and
// annotations). A sheet sets the limits, the labels and the grid; a general one keeps the curves, a physics one replaces the whole paper. What a tool in hand
// asks for is written on the paper itself, over its corner.
export default function GraphToolbar({ studio }: { studio: GraphStudioState }) {
  const t = useT();
  const { config, applyPreset, applyTemplate, addFunction, addSeries, tool, pickTool, snap, setSnap } = studio;
  // (what each physics sheet is about, written under its name)
  const templates = useMemo(() => GRAPH_TEMPLATES.map((tpl) => ({ tpl, values: tpl.build().values })), []);
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <Disclosure title={t("Functions")} testId="graph-functions">
        <div className="grid grid-cols-2 gap-2">
          {FUNCTION_TYPES.map((type) => (
            <button key={type} onClick={() => addFunction(type)} title={FUNCTION_SPECS[type].formula} data-function={type} className={`${tile} ${idle}`}>
              <FunctionGlyph type={type} />
              {t(FUNCTION_SPECS[type].name)}
            </button>
          ))}
        </div>
      </Disclosure>

      <Disclosure title={t("Measurements")} testId="graph-measurements">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={addSeries} data-testid="new-series" className={`${tile} ${idle}`}>
            <FunctionGlyph type="data" />
            {t("New series")}
          </button>
          <button onClick={() => pickTool("points")} aria-pressed={tool === "points"} data-testid="points-tool" className={`${tile} ${tool === "points" ? held : idle}`}>
            <svg width="30" height="18" viewBox="0 0 30 18" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
              <circle cx="15" cy="9" r="4" />
            </svg>
            {t("Add points")}
          </button>
        </div>
      </Disclosure>

      <Disclosure title={t("Annotations")} testId="graph-annotation-tools">
        <div className="grid grid-cols-2 gap-2">
          {ANNOTATION_TYPES.map((type) => (
            <button key={type} onClick={() => pickTool(type)} aria-pressed={tool === type} data-annotation-tool={type} className={`${tile} ${tool === type ? held : idle}`}>
              <AnnotationGlyph type={type} />
              {t(ANNOTATION_SPECS[type].name)}
            </button>
          ))}
        </div>
        <Group>
          <SwitchRow label={t("Snap to the grid")} checked={snap} onChange={setSnap} testId="snap" />
        </Group>
      </Disclosure>

      {/* (the button is its own title: no section around it) */}
      <div data-testid="graph-shapes" className="border-b border-line/70 px-4 py-3">
        <ShapesMenuButton variant="row" active={!!studio.shapeTool} current={studio.shapeTool} onPick={studio.pickShape} />
      </div>

      <Disclosure title={t("Examples")} testId="graph-presets" defaultOpen={false}>
        <Group>
          {GRAPH_PRESETS.map((p) => {
            const on = presetApplies(config, p);
            return (
              <button key={p.id} onClick={() => applyPreset(p)} aria-pressed={on} data-preset={p.id} className={listRow(on)}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[13px] font-medium tracking-[-0.01em]">{t(p.name)}</span>
                  <span className="text-[11px] text-muted tabular-nums" dir="ltr">
                    {p.values.xLabel} / {p.values.yLabel} · {p.values.xMin}→{p.values.xMax}, {p.values.yMin}→{p.values.yMax}
                  </span>
                </span>
                {on && <Check size={15} strokeWidth={2.4} aria-hidden className="shrink-0" />}
              </button>
            );
          })}
        </Group>
      </Disclosure>

      <Disclosure title={t("Physics sheets")} testId="graph-templates" defaultOpen={false}>
        {GRAPH_TEMPLATE_GROUPS.map((group) => (
          <div key={group} className="flex flex-col gap-1.5">
            <h4 className="px-1 text-[11px] font-medium tracking-[0.01em] text-muted">{t(group)}</h4>
            <Group>
              {templates
                .filter((x) => x.tpl.group === group)
                .map(({ tpl, values }) => (
                  <button key={tpl.id} onClick={() => applyTemplate(tpl, CONTENT_WIDTH - 2 * PAPER_MARGIN)} data-template={tpl.id} className={listRow(false)}>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[13px] font-medium tracking-[-0.01em]">{t(tpl.name)}</span>
                      <span className="text-[11px] text-muted" dir="ltr">
                        {plainLabel(values.xLabel ?? "")} / {plainLabel(values.yLabel ?? "")}
                      </span>
                    </span>
                  </button>
                ))}
            </Group>
          </div>
        ))}
      </Disclosure>
    </div>
  );
}
