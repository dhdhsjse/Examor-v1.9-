"use client";

import { ANNOTATION_SPECS, DEFAULT_FONT_SIZE, curveName, freeFromCurve, guideTarget, markerY, readout, resolveAnnotation, tangentOf, triangleDeltas } from "@/app/_lib/graph/annotations";
import { buildScene } from "@/app/_lib/graph/grid";
import { formatNumber, isMathFunction } from "@/app/_lib/graph/mathUtils";
import type { GraphAnnotation, GraphConfig, TextFrame } from "@/app/_lib/graph/types";
import { useT } from "@/app/_lib/uiLang";
import Disclosure from "./Disclosure";
import { ColorRow, DeleteButton, Group, Notice, NumberField, OptionalNumberField, PickRow, Row, SelectField, SwitchRow, TextField } from "./fields";
import type { GraphStudioState } from "./useGraphStudio";

const diff = (a: number, b: number) => Math.round((a - b) * 1e9) / 1e9; // (no float noise in a field)
const caption = "px-1 text-xs text-muted tabular-nums";

// The name of an annotation in the list ("Tangent", "Slope triangle"…), with what it is about when that tells them apart.
function useAnnotationLabel(config: GraphConfig) {
  const t = useT();
  return (a: GraphAnnotation) => {
    const base = t(ANNOTATION_SPECS[a.type].name);
    if (a.type === "text" || a.type === "curveLabel") return a.text ? `${base}: ${a.text}` : base;
    if (a.type === "asymptote") return `${base} ${a.orientation === "vertical" ? "x" : "y"} = ${formatNumber(a.value ?? 0)}`;
    if (a.type === "axisMark") return `${base} ${a.axis === "y" ? "y" : "x"} = ${formatNumber(a.value ?? 0)}`;
    const fn = a.curveId ? config.functions.find((f) => f.id === a.curveId) : undefined;
    if (!fn) return base;
    const { name, n } = curveName(config, fn);
    return `${base} · ${t(name)}${n ? ` ${n}` : ""}`;
  };
}

// The annotations of the paper (right panel, under the curves): the list of them, and for the selected one its own fields. The
// position of an annotation is in graph units; it can also be dragged on the paper by its handles.
export default function AnnotationsPanel({ studio }: { studio: GraphStudioState }) {
  const t = useT();
  const { config, selectedAnnotation: sel, selectAnnotation, updateAnnotation, removeAnnotation } = studio;
  const label = useAnnotationLabel(config);
  const set = (patch: Partial<GraphAnnotation>) => sel && updateAnnotation(sel.id, patch);
  const num = (key: "x" | "y" | "x2" | "y2" | "value" | "fontSize", testId: string, title: string, value: number | undefined) => (
    <NumberField
      label={title}
      value={value ?? 0}
      onCommit={(n) => {
        set({ [key]: n });
        return null;
      }}
      testId={testId}
    />
  );
  const scriptHint = t("u_C writes a subscript, 10^-4 a power (put several characters in braces).");

  // what is wrong with the selected one (it is then not drawn)
  const status = sel ? resolveAnnotation(sel, config, buildScene(config).origin).status : "ok";
  const optionsFor = (fns: GraphConfig["functions"]) =>
    fns.map((f) => {
      const { name, n } = curveName(config, f);
      return { value: f.id, label: `${t(name)}${n ? ` ${n}` : ""}` };
    });
  const curveOptions = optionsFor(config.functions.filter(isMathFunction));
  const everyCurveOptions = optionsFor(config.functions); // (the name of a curve may be of a series of measured points too)
  const freeOrCurve = [{ value: "", label: t("None (free)") }, ...curveOptions];
  const frameOptions = [
    { value: "none", label: t("Nothing") },
    { value: "box", label: t("White box") },
    { value: "circle", label: t("Circle") },
  ];
  const onCurve = !!sel?.curveId;
  const deltas = sel?.type === "triangle" ? triangleDeltas(sel, config) : null;
  const tangent = sel?.type === "tangent" ? tangentOf(sel, config) : null;
  const my = sel?.type === "marker" ? markerY(sel, config) : null;
  const guideAt = sel?.type === "axisMark" && sel.guides ? guideTarget(sel, config) : null;
  const complete = sel?.type === "line" && [sel.x, sel.y, sel.x2, sel.y2].every((v) => v !== undefined);

  return (
    <Disclosure title={t("Annotations")} testId="graph-annotations" count={config.annotations.length} empty={config.annotations.length === 0} reveal={sel?.id}>
      <Group role="listbox" label={t("Annotations")}>
        {config.annotations.map((a) => {
          const on = a.id === sel?.id;
          return (
            <PickRow key={a.id} on={on} onPick={() => selectAnnotation(on ? null : a.id)} color={a.color ?? "#000000"} hidden={a.hidden} attrs={{ "data-annotation": a.id }}>
              {label(a)}
            </PickRow>
          );
        })}
      </Group>

      {sel && (
        <div className="flex flex-col gap-3" data-testid="annotation-inspector" data-type={sel.type}>
          {sel.type === "text" && (
            <Group>
              <TextField label={t("Text")} value={sel.text ?? ""} onChange={(text) => set({ text })} testId="anno-text" hint={scriptHint} />
              {num("x", "anno-x", "x", sel.x)}
              {num("y", "anno-y", "y", sel.y)}
              {num("fontSize", "anno-size", t("Font size"), sel.fontSize ?? DEFAULT_FONT_SIZE)}
              <SelectField label={t("Behind the text")} value={sel.frame ?? "none"} onChange={(v) => set({ frame: v as TextFrame })} options={frameOptions} testId="anno-frame" />
            </Group>
          )}

          {sel.type === "asymptote" && (
            <Group>
              <SelectField
                label={t("Direction")}
                value={sel.orientation ?? "horizontal"}
                onChange={(v) => set({ orientation: v as "horizontal" | "vertical" })}
                options={[
                  { value: "horizontal", label: t("Horizontal (y = …)") },
                  { value: "vertical", label: t("Vertical (x = …)") },
                ]}
                testId="anno-orientation"
              />
              {num("value", "anno-value", sel.orientation === "vertical" ? "x" : "y", sel.value)}
              <TextField label={t("Label (optional)")} value={sel.text ?? ""} onChange={(text) => set({ text })} testId="anno-label" hint={scriptHint} />
            </Group>
          )}

          {sel.type === "tangent" && (
            <>
              <Group>
                <SelectField label={t("Curve")} value={sel.curveId ?? ""} onChange={(v) => set({ curveId: v })} options={curveOptions} testId="anno-curve" />
                {num("x", "anno-x", t("Point of contact (x)"), sel.x)}
                <SelectField
                  label={t("Draw the tangent")}
                  value={sel.side ?? "both"}
                  onChange={(v) => set({ side: v === "both" ? undefined : (v as "right" | "left") })}
                  options={[
                    { value: "both", label: t("On both sides") },
                    { value: "right", label: t("To the right of the point") },
                    { value: "left", label: t("To the left of the point") },
                  ]}
                  testId="anno-side"
                />
              </Group>
              {tangent && typeof tangent !== "string" && (
                <p className={caption} dir="ltr" data-testid="tangent-readout">
                  y = {readout(tangent.slope)}·x {tangent.y - tangent.slope * tangent.x < 0 ? "−" : "+"} {readout(Math.abs(tangent.y - tangent.slope * tangent.x))} · {t("Slope")} = {readout(tangent.slope)}
                </p>
              )}
            </>
          )}

          {sel.type === "triangle" && (
            <>
              <Group>
                <SelectField label={t("Curve")} value={sel.curveId ?? ""} onChange={(v) => set(v ? { curveId: v } : freeFromCurve(sel, config))} options={freeOrCurve} testId="anno-curve" />
                {num("x", "anno-x", "x", sel.x)}
                <NumberField
                  label="Δx"
                  value={sel.x2 !== undefined && sel.x !== undefined ? diff(sel.x2, sel.x) : 0}
                  onCommit={(dx) => {
                    set({ x2: (sel.x ?? 0) + dx });
                    return null;
                  }}
                  testId="anno-dx"
                />
                {!onCurve && num("y", "anno-y", "y", sel.y)}
                {!onCurve && (
                  <NumberField
                    label="Δy"
                    value={sel.y2 !== undefined && sel.y !== undefined ? diff(sel.y2, sel.y) : 0}
                    onCommit={(dy) => {
                      set({ y2: (sel.y ?? 0) + dy });
                      return null;
                    }}
                    testId="anno-dy"
                  />
                )}
                <SwitchRow label={t("Write the values of Δx and Δy")} checked={!!sel.showValues} onChange={(showValues) => set({ showValues })} testId="anno-show-values" />
              </Group>
              {deltas && (
                <p className={caption} dir="ltr" data-testid="triangle-readout">
                  Δx = {readout(deltas.dx)} · Δy = {readout(deltas.dy)}
                  {deltas.dx !== 0 && ` · ${t("Slope")} = ${readout(deltas.dy / deltas.dx)}`}
                </p>
              )}
            </>
          )}

          {sel.type === "marker" && (
            <Group>
              <SelectField label={t("Curve")} value={sel.curveId ?? ""} onChange={(v) => set(v ? { curveId: v } : freeFromCurve(sel, config))} options={freeOrCurve} testId="anno-curve" />
              {num("x", "anno-x", "x", sel.x)}
              {onCurve ? (
                <Row label="y">
                  <span className="text-[13px] text-ink tabular-nums" dir="ltr" data-testid="marker-y">
                    {my === null ? "—" : readout(my)}
                  </span>
                </Row>
              ) : (
                num("y", "anno-y", "y", sel.y)
              )}
              <SelectField
                label={t("Shape")}
                value={sel.shape ?? "cross"}
                onChange={(v) => set({ shape: v as "cross" | "plus" | "dot" })}
                options={[
                  { value: "cross", label: t("Cross") },
                  { value: "plus", label: t("Plus") },
                  { value: "dot", label: t("Dot") },
                ]}
                testId="anno-shape"
              />
              <TextField label={t("Label (optional)")} value={sel.text ?? ""} onChange={(text) => set({ text })} testId="anno-label" hint={scriptHint} />
              <SwitchRow label={t("Dashed lines to the axes")} checked={!!sel.guides} onChange={(guides) => set({ guides })} testId="anno-guides" />
            </Group>
          )}

          {sel.type === "axisMark" && (
            <>
              <Group>
                <SelectField
                  label={t("Axis")}
                  value={sel.axis ?? "x"}
                  onChange={(v) => set({ axis: v as "x" | "y" })}
                  options={[
                    { value: "x", label: t("Horizontal axis") },
                    { value: "y", label: t("Vertical axis") },
                  ]}
                  testId="anno-axis"
                />
                {num("value", "anno-value", t("Value"), sel.value)}
                <TextField label={t("Text (empty: the value)")} value={sel.text ?? ""} onChange={(text) => set({ text })} testId="anno-label" hint={scriptHint} />
                <SelectField label={t("Curve")} value={sel.curveId ?? ""} onChange={(v) => set({ curveId: v || undefined })} options={freeOrCurve} testId="anno-curve" />
                <SwitchRow label={t("Dashed line from the axis")} checked={!!sel.guides} onChange={(guides) => set({ guides })} testId="anno-guides" />
                {sel.guides && !onCurve && <OptionalNumberField label={t("The line ends at (other axis)")} value={sel.guideTo} onCommit={(guideTo) => set({ guideTo })} testId="anno-guide-to" />}
              </Group>
              {sel.guides && (
                <p className={caption} dir="ltr" data-testid="guide-readout">
                  {guideAt === null ? t("The line has nowhere to go: pick a curve or say where it ends.") : `${sel.axis === "y" ? "x" : "y"} = ${readout(guideAt)}`}
                </p>
              )}
            </>
          )}

          {sel.type === "curveLabel" && (
            <Group>
              <SelectField label={t("Curve")} value={sel.curveId ?? ""} onChange={(v) => set({ curveId: v })} options={everyCurveOptions} testId="anno-curve" />
              <TextField label={t("Text")} value={sel.text ?? ""} onChange={(text) => set({ text })} testId="anno-text" hint={t("(1), (2), A… Drag the name to move it; it goes with its curve.")} />
              <SelectField label={t("Behind the text")} value={sel.frame ?? "none"} onChange={(v) => set({ frame: v as TextFrame })} options={frameOptions} testId="anno-frame" />
              {num("x", "anno-x", "x", sel.x)}
              {num("y", "anno-y", "y", sel.y)}
              {num("fontSize", "anno-size", t("Font size"), sel.fontSize ?? DEFAULT_FONT_SIZE)}
            </Group>
          )}

          {sel.type === "line" && (
            <>
              <Group>
                {num("x", "anno-x", "x₁", sel.x)}
                {num("y", "anno-y", "y₁", sel.y)}
                {num("x2", "anno-x2", "x₂", sel.x2)}
                {num("y2", "anno-y2", "y₂", sel.y2)}
                <SwitchRow label={t("Carry the line to the edges of the paper")} checked={!!sel.extend} onChange={(extend) => set({ extend })} testId="anno-extend" />
                <SwitchRow label={t("Arrowhead at the end")} checked={!!sel.arrow} onChange={(arrow) => set({ arrow })} testId="anno-arrow" />
              </Group>
              {complete && sel.x2 !== sel.x && (
                <p className={caption} dir="ltr" data-testid="line-readout">
                  {t("Slope")} = {readout(((sel.y2 ?? 0) - (sel.y ?? 0)) / ((sel.x2 ?? 0) - (sel.x ?? 0)))}
                </p>
              )}
            </>
          )}

          <Group>
            <ColorRow label={t("Colour")} value={sel.color ?? "#000000"} onChange={(color) => set({ color })} testId="anno-color" />
            {ANNOTATION_SPECS[sel.type].dashable && <SwitchRow label={t("Dashed")} checked={sel.dashed ?? true} onChange={(dashed) => set({ dashed })} testId="anno-dashed" />}
          </Group>

          <Group>
            <SwitchRow label={t("Hide from the students")} checked={!!sel.hidden} onChange={(hidden) => set({ hidden })} testId="mask-annotation" />
          </Group>

          {status !== "ok" && <Notice testId={`anno-${status}`}>{status === "outside" ? t("This is outside the paper: change the axes or its position.") : t("It cannot be drawn with these values: the curve has no value there.")}</Notice>}
          <DeleteButton label={t("Delete")} onClick={() => removeAnnotation(sel.id)} testId="delete-annotation" />
        </div>
      )}
    </Disclosure>
  );
}
