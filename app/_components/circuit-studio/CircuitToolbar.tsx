"use client";

import { MousePointer2, Pencil, RotateCw } from "lucide-react";
import { drawComponent, COMPONENT_SPECS, COMPONENT_TYPES } from "@/app/_lib/circuit/symbols";
import type { ComponentType } from "@/app/_lib/circuit/types";
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
  select: "Click a component or a wire to select it, drag it to move it",
  wire: "Click to start a wire, click again at each corner; click a terminal (or double-click) to end it. Shift: the other way round",
  battery: "Click the drawing to put it there · R turns it before you click · Esc to stop",
  resistor: "Click the drawing to put it there · R turns it before you click · Esc to stop",
  capacitor: "Click the drawing to put it there · R turns it before you click · Esc to stop",
  inductor: "Click the drawing to put it there · R turns it before you click · Esc to stop",
  switch: "Click the drawing to put it there · R turns it before you click · Esc to stop",
  lamp: "Click the drawing to put it there · R turns it before you click · Esc to stop",
  diode: "Click the drawing to put it there · R turns it before you click · Esc to stop",
  ammeter: "Click the drawing to put it there · R turns it before you click · Esc to stop",
  voltmeter: "Click the drawing to put it there · R turns it before you click · Esc to stop",
};
export { TOOL_HINTS };

const button = (on: boolean) => `flex flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-2 text-[11px] font-medium leading-tight transition-colors ${on ? "border-accent bg-accent-soft text-accent-strong ring-1 ring-accent" : "border-line bg-white text-ink hover:border-accent hover:bg-accent-soft"}`;

// The left panel of the Circuit Studio: the components to put on the drawing, and the tools (select, wire, rotate).
export default function CircuitToolbar({ studio }: { studio: CircuitStudioState }) {
  const t = useT();
  const { tool, setTool, rotate, selectedComponent } = studio;
  const placing = tool !== "select" && tool !== "wire";
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
      <section className="flex flex-col gap-2" aria-label={t("Tools")} data-testid="circuit-tools">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Tools")}</h3>
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setTool("select")} aria-pressed={tool === "select"} data-tool="select" title={t("Select and move")} className={button(tool === "select")}>
            <MousePointer2 size={18} />
            {t("Select")}
          </button>
          <button onClick={() => setTool(tool === "wire" ? "select" : "wire")} aria-pressed={tool === "wire"} data-tool="wire" title={t(TOOL_HINTS.wire)} className={button(tool === "wire")}>
            <Pencil size={18} />
            {t("Wire")}
          </button>
          <button onClick={() => rotate(90)} disabled={!placing && !selectedComponent} data-tool="rotate" title={`${t("Turn a quarter")} (R)`} className={`${button(false)} disabled:opacity-40`}>
            <RotateCw size={18} />
            {t("Rotate")}
          </button>
        </div>
        <p className="text-xs text-muted" data-testid="circuit-tool-hint">
          {t(TOOL_HINTS[tool])}
        </p>
      </section>

      <section className="flex flex-col gap-2" aria-label={t("Components")} data-testid="circuit-components">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-faint">{t("Components")}</h3>
        <div className="grid grid-cols-2 gap-2">
          {COMPONENT_TYPES.map((type) => (
            <button key={type} onClick={() => setTool(tool === type ? "select" : type)} aria-pressed={tool === type} data-component={type} className={button(tool === type)}>
              <ComponentGlyph type={type} />
              {t(COMPONENT_SPECS[type].name)}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
