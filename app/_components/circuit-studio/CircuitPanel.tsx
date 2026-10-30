"use client";

import { RotateCcw, RotateCw, Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { COMPONENT_SPECS, UNITS, withUnit } from "@/app/_lib/circuit/symbols";
import { MAX_AREA, MIN_AREA, type LabelSide } from "@/app/_lib/circuit/types";
import ShapeProperties from "@/app/_components/shapes/ShapeProperties";
import { useT } from "@/app/_lib/uiLang";
import type { CircuitStudioState } from "./useCircuitStudio";

const input = "w-full rounded-lg border border-line bg-subtle px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent";

function Section({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-2.5 border-b border-line px-4 py-3.5 last:border-b-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-faint">{title}</h4>
      {children}
    </section>
  );
}

function TextField({ label, value, onChange, testId, placeholder }: { label: string; value: string; onChange: (s: string) => void; testId: string; placeholder?: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} data-testid={testId} className={input} />
    </div>
  );
}

// A whole number the teacher types (the size of the drawing area): what is typed is theirs while the field has the focus.
function SizeField({ label, value, onCommit, testId }: { label: string; value: number; onCommit: (n: number) => void; testId: string }) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState<string | null>(null);
  const n = Number((text ?? "").replace(",", "."));
  const bad = text !== null && (!Number.isFinite(n) || n < MIN_AREA || n > MAX_AREA);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={text ?? String(value)}
        onFocus={() => setText(String(value))}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value.replace(",", "."));
          if (Number.isFinite(v) && v >= MIN_AREA && v <= MAX_AREA) onCommit(v);
        }}
        onBlur={() => setText(null)}
        aria-invalid={bad ? true : undefined}
        data-testid={testId}
        className={`${input} tabular-nums ${bad ? "border-red-400" : ""}`}
      />
      {bad && (
        <p role="alert" data-testid={`${testId}-error`} className="text-[11px] text-red-600">
          {t("The size must be between {min} and {max} px.", { min: MIN_AREA, max: MAX_AREA })}
        </p>
      )}
    </div>
  );
}

const iconButton = "grid size-8 place-items-center rounded-lg border border-line bg-white text-ink hover:border-accent hover:bg-accent-soft";

// The right panel of the Circuit Studio: the properties of what is selected (a component: its label, its value, its turn, the
// state of a switch; a wire), or, with nothing selected, the size of the drawing area.
export default function CircuitPanel({ studio }: { studio: CircuitStudioState }) {
  const t = useT();
  const { config, selectedComponent: comp, selectedWire: wire, selectedShape: shape, updateComponentProps, rotate, deleteSelected, setArea, numberTheLabels } = studio;
  const sides: { id: LabelSide; name: string }[] = [
    { id: "auto", name: t("Automatic") },
    { id: "top", name: t("Above") },
    { id: "bottom", name: t("Below") },
    { id: "left", name: t("Left") },
    { id: "right", name: t("Right") },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-testid="circuit-panel">
      {comp && (
        <Section title={t(COMPONENT_SPECS[comp.type].name)} testId="component-properties">
          <TextField label={t("Label")} value={comp.label} onChange={(label) => updateComponentProps(comp.id, { label })} testId="component-label" />
          <TextField label={t("Value")} value={comp.value} onChange={(value) => updateComponentProps(comp.id, { value })} testId="component-value" placeholder={t("e.g. 10 kΩ")} />
          {UNITS[comp.type].length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5" data-testid="unit-chips">
              <span className="text-xs text-muted">{t("Unit")}</span>
              {UNITS[comp.type].map((unit) => (
                <button key={unit} onClick={() => updateComponentProps(comp.id, { value: withUnit(comp.value, unit) })} data-unit={unit} className="rounded-lg border border-line bg-white px-2 py-0.5 text-xs font-medium text-ink hover:border-accent hover:bg-accent-soft">
                  {unit}
                </button>
              ))}
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" checked={comp.showValue !== false} onChange={(e) => updateComponentProps(comp.id, { showValue: e.target.checked })} data-testid="show-value" className="size-4 accent-indigo-600" />
            {t("Show the value")}
          </label>
          <label className="flex items-center justify-between gap-3 text-xs text-muted">
            {t("Label position")}
            <select value={comp.labelSide ?? "auto"} onChange={(e) => updateComponentProps(comp.id, { labelSide: e.target.value as LabelSide })} data-testid="label-side" className="w-32 rounded-lg border border-line bg-subtle px-2 py-1.5 text-sm text-ink outline-none focus:border-accent">
              {sides.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {comp.type === "switch" && (
            <label className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={!!comp.closed} onChange={(e) => updateComponentProps(comp.id, { closed: e.target.checked })} data-testid="switch-closed" className="size-4 accent-indigo-600" />
              {t("Closed")}
            </label>
          )}
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">{t("Rotation")}</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => rotate(-90)} aria-label={t("Turn a quarter anticlockwise")} title={t("Turn a quarter anticlockwise")} data-testid="rotate-left" className={iconButton}>
                <RotateCcw size={15} />
              </button>
              <span className="min-w-9 text-center text-sm tabular-nums text-ink" data-testid="rotation-value">
                {comp.rotation}°
              </span>
              <button onClick={() => rotate(90)} aria-label={t("Turn a quarter")} title={`${t("Turn a quarter")} (R)`} data-testid="rotate-right" className={iconButton}>
                <RotateCw size={15} />
              </button>
            </div>
          </div>
          <button onClick={deleteSelected} data-testid="delete-selected" className="flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50">
            <Trash2 size={14} />
            {t("Delete")}
          </button>
        </Section>
      )}

      {wire && (
        <Section title={t("Wire")} testId="wire-properties">
          <p className="text-xs text-muted tabular-nums" data-testid="wire-info">
            {t("Corners: {count}", { count: Math.max(0, wire.points.length / 2 - 2) })}
          </p>
          <p className="text-xs text-muted">{t("Drag it to move it. It is connected to a terminal when its end is on it.")}</p>
          <button onClick={deleteSelected} data-testid="delete-selected" className="flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:border-red-300 hover:bg-red-50">
            <Trash2 size={14} />
            {t("Delete")}
          </button>
        </Section>
      )}

      {shape && (
        <ShapeProperties
          key={shape.id}
          item={shape}
          geometry
          onChange={(patch) => studio.changeShape(shape.id, patch, `shape:${shape.id}:${Object.keys(patch).sort().join(",")}`)}
          onOrder={(order) => studio.orderShape(shape.id, order)}
          onDuplicate={() => studio.duplicateShapeOf(shape.id)}
          onDelete={deleteSelected}
        />
      )}

      {!comp && !wire && !shape && (
        <Section title={t("Drawing area")} testId="area-properties">
          <div className="grid grid-cols-2 gap-2">
            <SizeField label={t("Width (px)")} value={config.width} onCommit={(w) => setArea(w, config.height)} testId="area-width" />
            <SizeField label={t("Height (px)")} value={config.height} onCommit={(h) => setArea(config.width, h)} testId="area-height" />
          </div>
          <p className="text-xs text-muted tabular-nums">
            {t("{components} components, {wires} wires", { components: config.components.length, wires: config.wires.length })}
          </p>
          <button onClick={numberTheLabels} disabled={config.components.length < 2} title={t("R, R → R1, R2: the labels that are still the plain letter")} data-testid="number-labels" className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:bg-accent-soft disabled:opacity-40">
            {t("Number the labels (R1, R2…)")}
          </button>
          <p className="text-xs text-faint">{t("Click a component or a wire to change it.")}</p>
        </Section>
      )}
    </div>
  );
}
