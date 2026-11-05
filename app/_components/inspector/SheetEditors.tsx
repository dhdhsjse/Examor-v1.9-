"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { MARK_STEP, formatMark, snapMark } from "@/app/_lib/sheet/marks";
import type { ExamMeta, MarkBlock, MarkKind, MarkLook, MarkOp, RuleBlock, RuleLine, TotalPlace } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { ColorGrid } from "../rich/FormatBar";
import { Field, Segmented, Stepper, TextInput, Toggle, inputCls } from "./fields";
import type { OnChange } from "./QuestionEditors";

const QUICK = [0.25, 0.5, 1, 2];

// A mark typed in a box: what is typed counts at once (brought to a multiple of 0.125); the box shows what was typed until it is left, so "0." can
// become "0.5". The buttons step by 0.125.
function MarkField({ value, pad, onChange }: { value: number; pad: boolean; onChange: (v: number) => void }) {
  const t = useT();
  const [draft, setDraft] = useState(String(value));
  const [seen, setSeen] = useState(value);
  // (the mark changed from outside, by a button or by undo: the box follows)
  if (seen !== value) {
    setSeen(value);
    if (snapMark(Number(draft)) !== value) setDraft(String(value));
  }
  const step = "grid size-7 place-items-center rounded-[5px] text-muted outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-35";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        <button type="button" className={step} aria-label={t("Decrease")} disabled={value <= 0} onClick={() => onChange(snapMark(value - MARK_STEP))}>
          <Minus size={12} strokeWidth={2} aria-hidden />
        </button>
        <input
          type="number"
          min={0}
          step={MARK_STEP}
          value={draft}
          aria-label={t("Mark")}
          data-testid="mark-value"
          onChange={(e) => {
            setDraft(e.target.value);
            const v = Number(e.target.value);
            if (e.target.value.trim() !== "" && Number.isFinite(v)) onChange(snapMark(v));
          }}
          onBlur={() => setDraft(String(value))}
          className={`${inputCls} w-20 text-center`}
        />
        <button type="button" className={step} aria-label={t("Increase")} onClick={() => onChange(snapMark(value + MARK_STEP))}>
          <Plus size={12} strokeWidth={2} aria-hidden />
        </button>
        <span className="ms-1 text-[11px] text-muted tabular-nums">{formatMark(value, pad)}</span>
      </div>
      <div className="flex gap-1">
        {QUICK.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => onChange(q)}
            className={`h-6 flex-1 rounded-[5px] text-[11px] tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${value === q ? "bg-emerald-600 font-semibold text-white" : "bg-subtle text-ink hover:bg-hover"}`}
          >
            {formatMark(q, pad)}
          </button>
        ))}
      </div>
    </div>
  );
}

// Properties of a sticker of the correction sheet: what it is (a mark, a sign, a total, a few words), its value, where a total sits in its row, its look.
export function MarkEditor({ b, meta, pad, shown, onChange }: { b: MarkBlock; meta: ExamMeta; pad: boolean; shown?: number; onChange: OnChange }) {
  const t = useT();
  const kinds: { value: MarkKind; label: string }[] = [
    { value: "number", label: t("Mark") },
    { value: "op", label: t("Sign") },
    { value: "total", label: t("Total") },
    { value: "text", label: t("Text") },
  ];
  const places: { value: TotalPlace; label: string }[] = [
    { value: "center", label: t("Middle") },
    { value: "top", label: t("Top") },
    { value: "bottom", label: t("Bottom") },
    { value: "free", label: t("Free") },
  ];
  const looks: { value: MarkLook; label: string }[] = [
    { value: "plain", label: t("Plain") },
    { value: "circle", label: t("Circle") },
    { value: "box", label: t("Box") },
  ];
  const ops: { value: MarkOp; label: string }[] = [
    { value: "+", label: "+" },
    { value: "×", label: "×" },
    { value: "−", label: "−" },
  ];
  // (the other kind starts with what it needs)
  const become = (kind: MarkKind) => onChange({ kind, ...(kind === "number" ? { value: b.value ?? 1 } : kind === "op" ? { op: b.op ?? "+" } : kind === "text" ? { text: b.text ?? "…" } : {}) }, "kind");

  return (
    <>
      <Field label={t("Sticker")} group>
        <Segmented value={b.kind} options={kinds} onChange={become} />
      </Field>

      {b.kind === "number" && (
        <Field label={t("Mark")} group>
          <MarkField value={b.value ?? 0} pad={pad} onChange={(value) => onChange({ value }, "value")} />
        </Field>
      )}

      {b.kind === "op" && (
        <Field label={t("Sign")} group>
          <Segmented value={b.op ?? "+"} options={ops} onChange={(op) => onChange({ op }, "op")} />
        </Field>
      )}

      {b.kind === "total" && (
        <>
          <p className="text-[11px] leading-snug text-muted">
            {b.manual ? t("The total you typed.") : t("The total of the marks of its row: {total}", { total: formatMark(shown ?? 0, pad) })}
          </p>
          <Toggle checked={!!b.manual} onChange={(manual) => onChange({ manual, ...(manual ? { value: shown ?? b.value ?? 0 } : {}) }, "manual")} label={t("Type the total myself")} />
          {b.manual && (
            <Field label={t("Total")} group>
              <MarkField value={b.value ?? 0} pad={pad} onChange={(value) => onChange({ value }, "value")} />
            </Field>
          )}
          <Field label={t("Place in its row")} group>
            <Segmented value={b.place ?? "center"} options={places} onChange={(place) => onChange({ place }, "place")} />
          </Field>
        </>
      )}

      {b.kind === "text" && (
        <Field label={t("Text")}>
          <TextInput value={b.text ?? ""} onChange={(text) => onChange({ text }, "text")} />
        </Field>
      )}

      <Field label={t("Look")} group>
        <Segmented value={b.look ?? "plain"} options={looks} onChange={(look) => onChange({ look }, "look")} />
      </Field>
      <Field label={t("Color")} group>
        <ColorGrid value={b.color} autoLabel={t("Black")} onChange={(color) => onChange({ color }, "color")} />
      </Field>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <span className="text-[11px] text-muted">{t("Size")}</span>
        <Stepper value={b.size ?? meta.fontSize ?? 14} min={9} max={40} onChange={(size) => onChange({ size }, "size")} />
      </div>
    </>
  );
}

// Properties of a line across the correction sheet: what it closes (a row, an exercise) or that it is not drawn, and its color.
export function RuleEditor({ b, onChange }: { b: RuleBlock; onChange: OnChange }) {
  const t = useT();
  const lines: { value: RuleLine; label: string }[] = [
    { value: "row", label: t("Between rows") },
    { value: "exercise", label: t("Between exercises") },
    { value: "hidden", label: t("Hidden") },
  ];
  return (
    <>
      <Field label={t("Line")} group>
        <Segmented value={b.line ?? "row"} options={lines} onChange={(line) => onChange({ line }, "line")} />
      </Field>
      <p className="text-[11px] leading-snug text-muted">{t("The marks above it and under it are two rows, each with its own total.")}</p>
      <Field label={t("Color")} group>
        <ColorGrid value={b.color} autoLabel={t("Sheet color")} onChange={(color) => onChange({ color }, "color")} />
      </Field>
    </>
  );
}
