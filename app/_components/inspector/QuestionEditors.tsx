"use client";

import { useRef } from "react";
import { blankAnswers } from "@/app/_lib/blockLayout";
import type { BlankBlock, McqBlock, OpenBlock, QuestionBlock, TrueFalseBlock } from "@/app/_lib/types";
import type { BlockPatch } from "@/app/_lib/useExam";
import { AddRowButton, Field, NumberInput, RemoveButton, TextArea, TextInput } from "./fields";

export type OnChange = (patch: BlockPatch, field: string) => void;

// Question text + points (same for every question type).
export function QuestionBasics({ b, onChange }: { b: QuestionBlock; onChange: OnChange }) {
  return (
    <>
      <Field label="Question">
        <TextArea value={b.text} onChange={(text) => onChange({ text }, "text")} rows={3} />
      </Field>
      <Field label="Points">
        <NumberInput value={b.points} min={0} max={100} step={0.5} onChange={(points) => onChange({ points }, "points")} />
      </Field>
    </>
  );
}

export function McqEditor({ b, onChange }: { b: McqBlock; onChange: OnChange }) {
  const setOption = (i: number, v: string) => onChange({ options: b.options.map((o, k) => (k === i ? v : o)) }, `option${i}`);
  const remove = (i: number) =>
    onChange({ options: b.options.filter((_, k) => k !== i), correct: b.correct === i ? 0 : b.correct > i ? b.correct - 1 : b.correct }, "options");

  return (
    <>
      <QuestionBasics b={b} onChange={onChange} />
      <Field label="Options" hint="Select the circle of the correct answer — it appears on the correction sheet.">
        <div className="flex flex-col gap-1.5">
          {b.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                type="radio"
                name={`correct-${b.id}`}
                checked={b.correct === i}
                onChange={() => onChange({ correct: i }, "correct")}
                className="size-4 shrink-0 accent-emerald-600"
                title="Correct answer"
              />
              <TextInput value={opt} onChange={(v) => setOption(i, v)} />
              {b.options.length > 2 && <RemoveButton onClick={() => remove(i)} />}
            </div>
          ))}
          {b.options.length < 6 && (
            <AddRowButton onClick={() => onChange({ options: [...b.options, `Option ${b.options.length + 1}`] }, "options")}>Add option</AddRowButton>
          )}
        </div>
      </Field>
    </>
  );
}

export function TrueFalseEditor({ b, onChange }: { b: TrueFalseBlock; onChange: OnChange }) {
  const set = (i: number, patch: Partial<TrueFalseBlock["statements"][number]>) =>
    onChange({ statements: b.statements.map((s, k) => (k === i ? { ...s, ...patch } : s)) }, `statement${i}`);

  return (
    <>
      <QuestionBasics b={b} onChange={onChange} />
      <Field label="Statements" hint="Click T / F to set the correct answer of each statement.">
        <div className="flex flex-col gap-1.5">
          {b.statements.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <TextInput value={s.text} onChange={(text) => set(i, { text })} />
              <button
                type="button"
                onClick={() => set(i, { answer: !s.answer })}
                title="Correct answer"
                className={`w-8 shrink-0 rounded-md py-1.5 text-xs font-bold ${s.answer ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
              >
                {s.answer ? "T" : "F"}
              </button>
              {b.statements.length > 1 && (
                <RemoveButton onClick={() => onChange({ statements: b.statements.filter((_, k) => k !== i) }, "statements")} />
              )}
            </div>
          ))}
          <AddRowButton onClick={() => onChange({ statements: [...b.statements, { text: "", answer: true }] }, "statements")}>
            Add statement
          </AddRowButton>
        </div>
      </Field>
    </>
  );
}

export function BlankEditor({ b, onChange }: { b: BlankBlock; onChange: OnChange }) {
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
      <Field label="Text with blanks" hint="Put each answer in [brackets], or select words and click “Make blank”.">
        <TextArea ref={ref}value={b.content} onChange={(content) => onChange({ content }, "content")} rows={4} />
      </Field>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault() /* keep the text selection */}
        onClick={makeBlank}
        className="self-start rounded-md bg-indigo-50 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
      >
        Make blank from selection
      </button>
      {answers.length > 0 && (
        <p className="text-[11px] text-muted">
          Answers: <span className="font-medium text-emerald-700">{answers.join(" · ")}</span>
        </p>
      )}
    </>
  );
}

export function OpenEditor({ b, onChange }: { b: OpenBlock; onChange: OnChange }) {
  return (
    <>
      <QuestionBasics b={b} onChange={onChange} />
      <Field label="Answer lines">
        <NumberInput value={b.lines} min={0} max={30} onChange={(lines) => onChange({ lines }, "lines")} />
      </Field>
      <Field label="Model answer" hint="Shown only on the correction sheet.">
        <TextArea value={b.answer} onChange={(answer) => onChange({ answer }, "answer")} rows={4} />
      </Field>
    </>
  );
}
