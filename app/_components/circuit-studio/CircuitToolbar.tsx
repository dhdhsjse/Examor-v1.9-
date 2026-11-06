"use client";

import { drawComponent, COMPONENT_SPECS, COMPONENT_TYPES } from "@/app/_lib/circuit/symbols";
import type { ComponentType } from "@/app/_lib/circuit/types";
import { ShapesMenuButton } from "@/app/_components/shapes/ShapeGallery";
import { useT } from "@/app/_lib/uiLang";
import type { CircuitStudioState, CircuitTool } from "./useCircuitStudio";

// A component as a small sketch for its button: its own symbol, with the terminals at (±40, 0), shrunk to fit.
export function ComponentGlyph({ type }: { type: ComponentType }) {
  const d = drawComponent({ id: "glyph", type, x: 0, y: 0, rotation: 0, label: "", value: "" });
  const pts = (p: number[]) => Array.from({ length: p.length / 2 }, (_, i) => `${p[2 * i]},${p[2 * i + 1]}`).join(" ");
  return (
    <svg width="48" height="26" viewBox="-44 -22 88 44" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      {d.shapes.map((s, i) =>
        s.kind === "circle" ? <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill={s.fill ? "currentColor" : "none"} /> : s.kind === "line" ? <polyline key={i} points={pts(s.points)} /> : <polygon key={i} points={pts(s.points)} fill={s.kind === "poly" ? "currentColor" : "none"} />,
      )}
      {d.texts.map((text, i) => (
        <text key={i} x={text.x} y={text.y} dy="0.35em" textAnchor="middle" fontSize={text.size + 6} fontWeight="bold" fill="currentColor" stroke="none">
          {text.text}
        </text>
      ))}
    </svg>
  );
}

const TOOL_HINTS: Record<CircuitTool, string> = {
  select: "Click a component or a wire to select it, drag it to move it · Delete: remove the section of the wire clicked",
  draw: "Drag on the drawing to draw freely · Esc to stop",
  textbox: "Drag on the drawing to draw a text box, then type in it · Esc to stop",
  eraser: "Drag over a drawing or a shape to rub it out · Esc to stop",
  shape: "Drag on the drawing to draw the shape (Shift: a square or a 45° line, Alt: from the centre), or click to put it at its usual size · Esc to stop",
  wire: "Click to start a wire, click again at each corner; click a terminal (or double-click) to end it. Shift: the other way round",
  battery: "Click the drawing to put it there · R, a right-click or the round handle turns it · Esc to stop",
  resistor: "Click the drawing to put it there · R, a right-click or the round handle turns it · Esc to stop",
  capacitor: "Click the drawing to put it there · R, a right-click or the round handle turns it · Esc to stop",
  inductor: "Click the drawing to put it there · R, a right-click or the round handle turns it · Esc to stop",
  switch: "Click the drawing to put it there · R, a right-click or the round handle turns it · Esc to stop",
  lamp: "Click the drawing to put it there · R, a right-click or the round handle turns it · Esc to stop",
  diode: "Click the drawing to put it there · R, a right-click or the round handle turns it · Esc to stop",
  ammeter: "Click the drawing to put it there · R, a right-click or the round handle turns it · Esc to stop",
  voltmeter: "Click the drawing to put it there · R, a right-click or the round handle turns it · Esc to stop",
};
export { TOOL_HINTS };

// The little picture of the Wire tile: a wire with a corner, between two terminals.
function WireGlyph() {
  return (
    <svg width="48" height="26" viewBox="-44 -22 88 44" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="-34,12 -34,-12 34,-12 34,12" />
      <circle cx="-34" cy="12" r="4" fill="currentColor" />
      <circle cx="34" cy="12" r="4" fill="currentColor" />
    </svg>
  );
}

const button = (on: boolean) => `flex flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 text-xs font-medium leading-tight transition-colors ${on ? "border-accent bg-accent-soft text-accent-strong ring-1 ring-accent" : "border-line bg-white text-ink hover:border-accent hover:bg-accent-soft"}`;

// The left panel of the Circuit Studio: the components to put on the drawing (the wire first), and the shapes. Select, draw, text
// box and eraser are on the floating bar of the drawing; R, a right-click or the round handle turns a component.
export default function CircuitToolbar({ studio }: { studio: CircuitStudioState }) {
  const t = useT();
  const { tool, setTool } = studio;
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
      <section className="flex flex-col gap-2" aria-label={t("Components")} data-testid="circuit-components">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Components")}</h3>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setTool(tool === "wire" ? "select" : "wire")} aria-pressed={tool === "wire"} data-tool="wire" title={t(TOOL_HINTS.wire)} className={button(tool === "wire")}>
            <WireGlyph />
            {t("Wire")}
          </button>
          {COMPONENT_TYPES.map((type) => (
            <button key={type} onClick={() => setTool(tool === type ? "select" : type)} aria-pressed={tool === type} data-component={type} title={t(TOOL_HINTS[type])} className={button(tool === type)}>
              <ComponentGlyph type={type} />
              {t(COMPONENT_SPECS[type].name)}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2" aria-label={t("Shapes")} data-testid="circuit-shapes">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Shapes")}</h3>
        <ShapesMenuButton active={tool === "shape"} current={tool === "shape" ? studio.shapeKind : null} onPick={studio.pickShape} />
      </section>
    </div>
  );
}
