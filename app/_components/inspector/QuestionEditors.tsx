"use client";

import { useRef, useState } from "react";
import { PART_NUMBERINGS, blankAnswers, partLabel } from "@/app/_lib/blockLayout";
import { addPart, movePart, patchPart, removePart } from "@/app/_lib/blocks";
import { insertText } from "@/app/_lib/richText";
import type { BlankBlock, Lang, McqBlock, OpenBlock, OpenPart, QuestionBlock, TrueFalseBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch } from "@/app/_lib/useExam";
import type { RichHandle } from "../rich/RichEditable";
import { AddRowButton, Field, NumberInput, RemoveButton, RichInput, Segmented, TextInput } from "./fields";

export type OnChange = (patch: BlockPatch, field: string) => void;

// Question text + points (same for every question type).
export function QuestionBasics({ b, onChange, lockPoints }: { b: QuestionBlock; onChange: OnChange; lockPoints?: boolean }) {
  const t = useT();
  return (
    <>
      <Field label={t("Question")} hint={t("Tip: click the question on the page and type there.")}>
        <RichInput value={b.text} onChange={(text) => onChange({ text }, "text")} rows={3} multiline />
      </Field>
      <Field label={t("Points")} hint={lockPoints ? t("Total of the sub-questions.") : undefined}>
        {lockPoints ? (
          <span className="text-sm font-semibold text-ink">{b.points}</span>
        ) : (
          <NumberInput value={b.points} min={0} max={100} step={0.25} onChange={(points) => onChange({ points }, "points")} />
        )}
      </Field>
    </>
  );
}

export function McqEditor({ b, onChange }: { b: McqBlock; onChange: OnChange }) {
  const t = useT();
  const setOption = (i: number, v: string) => onChange({ options: b.options.map((o, k) => (k === i ? v : o)) }, `option${i}`);
  const remove = (i: number) =>
    onChange({ options: b.options.filter((_, k) => k !== i), correct: b.correct === i ? 0 : b.correct > i ? b.correct - 1 : b.correct }, "options");

  return (
    <>
      <QuestionBasics b={b} onChange={onChange} />
      <Field label={t("Options")} hint={t("Select the circle of the correct answer — it appears on the correction sheet.")}>
        <div className="flex flex-col gap-1.5">
          {b.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                type="radio"
                name={`correct-${b.id}`}
                checked={b.correct === i}
                onChange={() => onChange({ correct: i }, "correct")}
                className="size-4 shrink-0 accent-emerald-600"
                title={t("Correct answer")}
              />
              <RichInput value={opt} onChange={(v) => setOption(i, v)} />
              {b.options.length > 2 && <RemoveButton onClick={() => remove(i)} title={t("Remove")} />}
            </div>
          ))}
          {b.options.length < 6 && (
            <AddRowButton onClick={() => onChange({ options: [...b.options, `${t("Option")} ${b.options.length + 1}`] }, "options")}>{t("Add option")}</AddRowButton>
          )}
        </div>
      </Field>
    </>
  );
}

export function TrueFalseEditor({ b, onChange }: { b: TrueFalseBlock; onChange: OnChange }) {
  const t = useT();
  const set = (i: number, patch: Partial<TrueFalseBlock["statements"][number]>) =>
    onChange({ statements: b.statements.map((s, k) => (k === i ? { ...s, ...patch } : s)) }, `statement${i}`);

  return (
    <>
      <QuestionBasics b={b} onChange={onChange} />
      <Field label={t("Statements")} hint={t("Click T / F to set the correct answer of each statement.")}>
        <div className="flex flex-col gap-1.5">
          {b.statements.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <RichInput value={s.text} onChange={(text) => set(i, { text })} />
              <button
                type="button"
                onClick={() => set(i, { answer: !s.answer })}
                title={t("Correct answer")}
                className={`w-8 shrink-0 rounded-md py-1.5 text-xs font-bold ${s.answer ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
              >
                {s.answer ? t("T") : t("F")}
              </button>
              {b.statements.length > 1 && (
                <RemoveButton title={t("Remove")} onClick={() => onChange({ statements: b.statements.filter((_, k) => k !== i) }, "statements")} />
              )}
            </div>
          ))}
          <AddRowButton onClick={() => onChange({ statements: [...b.statements, { text: "", answer: true }] }, "statements")}>{t("Add statement")}</AddRowButton>
        </div>
      </Field>
    </>
  );
}

export function BlankEditor({ b, onChange }: { b: BlankBlock; onChange: OnChange }) {
  const t = useT();
  const ref = useRef<RichHandle>(null);
  const answers = blankAnswers(b.content);

  // Wrap the selected words in [brackets] to turn them into a blank.
  const makeBlank = () => {
    const sel = ref.current?.selection();
    if (!sel || sel.start === sel.end) return;
    const content = insertText(insertText(b.content, sel.end, "]"), sel.start, "[");
    onChange({ content }, "content-blank");
  };

  return (
    <>
      <QuestionBasics b={b} onChange={onChange} />
      <Field label={t("Text with blanks")} hint={t("Put each answer in [brackets], or select words and click “Make blank”.")}>
        <RichInput ref={ref} value={b.content} onChange={(content) => onChange({ content }, "content")} rows={4} multiline />
      </Field>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault() /* keep the text selection */}
        onClick={makeBlank}
        className="self-start rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
      >
        {t("Make blank from selection")}
      </button>
      {answers.length > 0 && (
        <p className="text-[11px] text-muted">
          {t("Answers:")} <span className="font-medium text-emerald-700">{answers.join(" · ")}</span>
        </p>
      )}
    </>
  );
}

export function OpenEditor({ b, onChange, number, lang }: { b: OpenBlock; onChange: OnChange; number: number; lang: Lang }) {
  const t = useT();
  const parts = b.parts ?? [];
  const setPart = (i: number, patch: Partial<OpenPart>, field: string) => onChange(patchPart(parts, i, patch), `part${i}-${field}`);
  const [armed, setArmed] = useState<number | null>(null); // grabbed by its handle
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const reset = () => {
    setArmed(null);
    setDrag(null);
    setOver(null);
  };
  // The automatic name of part i (what an empty name shows).
  const autoLabel = (i: number) => partLabel({ ...b, parts: parts.map((p) => ({ ...p, label: "" })) }, number, i, lang) || "—";

  return (
    <>
      <QuestionBasics b={b} onChange={onChange} lockPoints={parts.length > 0} />
      <Field label={t("Answer lines")} hint={parts.length ? t("Lines right under the question (often 0 when there are sub-questions).") : undefined}>
        <NumberInput value={b.lines} min={0} max={30} onChange={(lines) => onChange({ lines }, "lines")} />
      </Field>
      {(b.lines > 0 || !parts.length) && (
        <Field label={t("Model answer")} hint={t("Shown only on the correction sheet.")}>
          <RichInput value={b.answer} onChange={(answer) => onChange({ answer }, "answer")} rows={3} multiline />
        </Field>
      )}

      <Field label={t("Sub-questions")} hint={t("Split the question into parts: 1a), 1b)… Each part has its own lines, points and answer.")}>
        <div className="flex flex-col gap-2">
          {parts.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-muted">{t("Numbering")}</span>
              <Segmented value={b.partNumbering ?? "1a"} onChange={(partNumbering) => onChange({ partNumbering }, "numbering")} options={PART_NUMBERINGS} />
            </div>
          )}
          {parts.map((p, i) => (
            <div
              key={i}
              draggable={armed === i}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
                setDrag(i);
              }}
              onDragOver={(e) => {
                if (drag === null) return;
                e.preventDefault();
                setOver(i);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (drag !== null && drag !== i) onChange(movePart(b, drag, i), "parts-order");
                reset();
              }}
              onDragEnd={reset}
              className={`flex flex-col gap-1.5 rounded-lg border bg-subtle/60 p-2 transition-colors ${drag === i ? "opacity-40" : ""} ${
                over === i && drag !== i ? "border-indigo-400 bg-indigo-50" : "border-line"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span
                  onMouseDown={() => setArmed(i)}
                  onMouseUp={() => setArmed(null)}
                  className="cursor-grab px-0.5 text-sm leading-none text-faint select-none hover:text-indigo-600 active:cursor-grabbing"
                  title={t("Drag to reorder")}
                >
                  ⋮⋮
                </span>
                <div className="w-14 shrink-0" title={t("Name of the sub-question (empty = automatic)")}>
                  <TextInput value={p.label ?? ""} placeholder={autoLabel(i)} onChange={(label) => setPart(i, { label }, "label")} />
                </div>
                <RichInput value={p.text} placeholder={t("Sub-question…")} onChange={(text) => setPart(i, { text }, "text")} />
                <RemoveButton title={t("Remove")} onClick={() => onChange(removePart(b, i), "parts")} />
              </div>
              <div className="flex items-center gap-2 ps-6 text-[11px] text-muted">
                {t("Lines")}
                <NumberInput value={p.lines} min={0} max={20} onChange={(lines) => setPart(i, { lines }, "lines")} />
                {t("Points")}
                <NumberInput value={p.points} min={0} max={100} step={0.25} onChange={(points) => setPart(i, { points }, "points")} />
              </div>
              <div className="ps-6">
                <RichInput value={p.answer} placeholder={t("Answer (correction sheet)…")} onChange={(answer) => setPart(i, { answer }, "answer")} multiline />
              </div>
            </div>
          ))}
          {parts.length < 12 && <AddRowButton onClick={() => onChange(addPart(b), "parts")}>{t("Add sub-question")}</AddRowButton>}
        </div>
      </Field>
    </>
  );
}
