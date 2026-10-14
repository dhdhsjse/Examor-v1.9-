"use client";

import { useRef } from "react";
import { blankAnswers, partLabel } from "@/app/_lib/blockLayout";
import { patchPart } from "@/app/_lib/blocks";
import type { BlankBlock, Lang, McqBlock, OpenBlock, OpenPart, QuestionBlock, TrueFalseBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch } from "@/app/_lib/useExam";
import { AddRowButton, Field, NumberInput, RemoveButton, TextArea, TextInput } from "./fields";

export type OnChange = (patch: BlockPatch, field: string) => void;

// Question text + points (same for every question type).
export function QuestionBasics({ b, onChange, lockPoints }: { b: QuestionBlock; onChange: OnChange; lockPoints?: boolean }) {
  const t = useT();
  return (
    <>
      <Field label={t("Question")} hint={t("Tip: click the question on the page and type there.")}>
        <TextArea value={b.text} onChange={(text) => onChange({ text }, "text")} rows={3} />
      </Field>
      <Field label={t("Points")} hint={lockPoints ? t("Total of the sub-questions.") : undefined}>
        {lockPoints ? (
          <span className="text-sm font-semibold text-ink">{b.points}</span>
        ) : (
          <NumberInput value={b.points} min={0} max={100} step={0.5} onChange={(points) => onChange({ points }, "points")} />
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
              <TextInput value={opt} onChange={(v) => setOption(i, v)} />
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
              <TextInput value={s.text} onChange={(text) => set(i, { text })} />
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
  const ref = useRef<HTMLTextAreaElement>(null);
  const answers = blankAnswers(b.content);

  // Wrap the selected words in [brackets] to turn them into a blank.
  const makeBlank = () => {
    const el = ref.current;
    if (!el || el.selectionStart === el.selectionEnd) return;
    const { selectionStart: s, selectionEnd: e } = el;
    onChange({ content: `${b.content.slice(0, s)}[${b.content.slice(s, e)}]${b.content.slice(e)}` }, "content-blank");
  };

  return (
    <>
      <QuestionBasics b={b} onChange={onChange} />
      <Field label={t("Text with blanks")} hint={t("Put each answer in [brackets], or select words and click “Make blank”.")}>
        <TextArea ref={ref} value={b.content} onChange={(content) => onChange({ content }, "content")} rows={4} />
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

  // The first sub-question takes the place of the main answer lines.
  const addPart = () => {
    const next = [...parts, { text: "", lines: 2, answer: "", points: 1 }];
    onChange({ parts: next, points: next.reduce((s, p) => s + p.points, 0), ...(parts.length ? {} : { lines: 0 }) }, "parts");
  };
  const removePart = (i: number) => {
    const next = parts.filter((_, k) => k !== i);
    onChange({ parts: next, ...(next.length ? { points: next.reduce((s, p) => s + p.points, 0) } : { lines: 4 }) }, "parts");
  };

  return (
    <>
      <QuestionBasics b={b} onChange={onChange} lockPoints={parts.length > 0} />
      <Field label={t("Answer lines")} hint={parts.length ? t("Lines right under the question (often 0 when there are sub-questions).") : undefined}>
        <NumberInput value={b.lines} min={0} max={30} onChange={(lines) => onChange({ lines }, "lines")} />
      </Field>
      {(b.lines > 0 || !parts.length) && (
        <Field label={t("Model answer")} hint={t("Shown only on the correction sheet.")}>
          <TextArea value={b.answer} onChange={(answer) => onChange({ answer }, "answer")} rows={3} />
        </Field>
      )}

      <Field label={t("Sub-questions")} hint={t("Split the question into parts: 1a), 1b)… Each part has its own lines, points and answer.")}>
        <div className="flex flex-col gap-2">
          {parts.map((p, i) => (
            <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-line bg-subtle/60 p-2">
              <div className="flex items-center gap-1.5">
                <span className="w-9 shrink-0 text-xs font-bold text-indigo-600">{partLabel(number, i, lang)}</span>
                <TextInput value={p.text} placeholder={t("Sub-question…")} onChange={(text) => setPart(i, { text }, "text")} />
                <RemoveButton title={t("Remove")} onClick={() => removePart(i)} />
              </div>
              <div className="flex items-center gap-2 ps-10 text-[11px] text-muted">
                {t("Lines")}
                <NumberInput value={p.lines} min={0} max={20} onChange={(lines) => setPart(i, { lines }, "lines")} />
                {t("Points")}
                <NumberInput value={p.points} min={0} max={100} step={0.5} onChange={(points) => setPart(i, { points }, "points")} />
              </div>
              <div className="ps-10">
                <TextInput value={p.answer} placeholder={t("Answer (correction sheet)…")} onChange={(answer) => setPart(i, { answer }, "answer")} />
              </div>
            </div>
          ))}
          {parts.length < 8 && <AddRowButton onClick={addPart}>{t("Add sub-question")}</AddRowButton>}
        </div>
      </Field>
    </>
  );
}
