"use client";

import { useRef, useState, type ReactNode } from "react";
import { PART_NUMBERINGS, blankAnswers, partLabel } from "@/app/_lib/blockLayout";
import { MAX_OPTIONS, addPart, insertOption, mcqAnswers, movePart, patchPart, removeOption, removePart, toggleMcq } from "@/app/_lib/blocks";
import { insertText } from "@/app/_lib/richText";
import { mixedOrder } from "@/app/_lib/shuffle";
import type { AnswerStyle, BlankBlock, Lang, McqBlock, OpenBlock, OpenPart, QuestionBlock, TrueFalseBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch } from "@/app/_lib/useExam";
import type { RichHandle } from "../rich/RichEditable";
import { AddRowButton, ChoiceGrid, Field, NumberInput, RemoveButton, RichInput, Segmented, SmallButton, TextInput, Toggle } from "./fields";

export type OnChange = (patch: BlockPatch, field: string) => void;

// Question text + points (same for every question type).
export function QuestionBasics({ b, onChange, lockPoints }: { b: QuestionBlock; onChange: OnChange; lockPoints?: boolean }) {
  const t = useT();
  return (
    <>
      <Field label={t("Question")} hint={t("Tip: click the question on the page and type there.")}>
        <RichInput value={b.text} placeholder={t("Type the question…")} onChange={(text) => onChange({ text }, "text")} rows={3} multiline />
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

// A framed group of settings inside an editor.
export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-subtle/60 p-2.5">
      {title && <span className="text-[11px] font-semibold text-muted">{title}</span>}
      {children}
    </div>
  );
}

export function McqEditor({ b, onChange }: { b: McqBlock; onChange: OnChange }) {
  const t = useT();
  const answers = mcqAnswers(b);
  const setOption = (i: number, v: string) => onChange({ options: b.options.map((o, k) => (k === i ? v : o)) }, `option${i}`);
  // Mix the options; the correct answers follow them.
  const shuffle = () => {
    const p = mixedOrder(b.options.length);
    onChange(
      { options: p.map((i) => b.options[i]), correct: p.indexOf(b.correct), ...(b.multi ? { corrects: answers.map((c) => p.indexOf(c)).sort((x, y) => x - y) } : {}) },
      "shuffle",
    );
  };
  const setMulti = (multi: boolean) => onChange(multi ? { multi, corrects: [b.correct] } : { multi, correct: answers[0] ?? 0 }, "multi");

  return (
    <>
      <QuestionBasics b={b} onChange={onChange} />
      <Panel>
        <Field group label={t("Correct answers")}>
          <Segmented
            value={b.multi ? "multi" : "one"}
            onChange={(v) => setMulti(v === "multi")}
            options={[
              { value: "one", label: t("One answer") },
              { value: "multi", label: t("Several answers") },
            ]}
          />
        </Field>
        <Field group label={t("Options per row")}>
          <Segmented value={String(b.columns ?? 1)} onChange={(v) => onChange({ columns: Number(v) }, "columns")} options={["1", "2", "3", "4"].map((v) => ({ value: v, label: v }))} />
        </Field>
      </Panel>
      <Field group
        label={t("Options")}
        hint={b.multi ? t("Tick every correct answer — they appear on the correction sheet.") : t("Select the circle of the correct answer — it appears on the correction sheet.")}
      >
        <div className="flex flex-col gap-1.5">
          {b.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                type={b.multi ? "checkbox" : "radio"}
                name={`correct-${b.id}`}
                checked={answers.includes(i)}
                onChange={() => onChange(toggleMcq(b, i), "correct")}
                className="size-4 shrink-0 accent-emerald-600"
                title={t("Correct answer")}
              />
              <RichInput value={opt} placeholder={`${t("Option")} ${i + 1}`} onChange={(v) => setOption(i, v)} />
              {b.options.length > 2 && <RemoveButton onClick={() => onChange(removeOption(b, i), "options")} title={t("Remove")} />}
            </div>
          ))}
          {b.options.length < MAX_OPTIONS && <AddRowButton onClick={() => onChange(insertOption(b, b.options.length), "options")}>{t("Add option")}</AddRowButton>}
        </div>
      </Field>
      <SmallButton onClick={shuffle} title={t("Mix the options (the correct answers follow)")}>
        {t("Shuffle options")}
      </SmallButton>
    </>
  );
}

export function TrueFalseEditor({ b, onChange }: { b: TrueFalseBlock; onChange: OnChange }) {
  const t = useT();
  const set = (i: number, patch: Partial<TrueFalseBlock["statements"][number]>, field = "") =>
    onChange({ statements: b.statements.map((s, k) => (k === i ? { ...s, ...patch } : s)) }, `statement${i}${field}`);

  return (
    <>
      <QuestionBasics b={b} onChange={onChange} />
      <Toggle checked={!!b.justify} onChange={(justify) => onChange({ justify }, "justify")} label={t("Ask to correct the false statements")} hint={t("Adds a line under each statement.")} />
      <Field group label={t("Statements")} hint={t("Click T / F to set the correct answer of each statement.")}>
        <div className="flex flex-col gap-1.5">
          {b.statements.map((s, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <RichInput value={s.text} placeholder={t("Statement…")} onChange={(text) => set(i, { text })} />
                <button
                  type="button"
                  onClick={() => set(i, { answer: !s.answer }, "answer")}
                  title={t("Correct answer")}
                  className={`w-8 shrink-0 rounded-md py-1.5 text-xs font-bold ${s.answer ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                >
                  {s.answer ? t("T") : t("F")}
                </button>
                {b.statements.length > 1 && (
                  <RemoveButton title={t("Remove")} onClick={() => onChange({ statements: b.statements.filter((_, k) => k !== i) }, "statements")} />
                )}
              </div>
              {b.justify && !s.answer && (
                <div className="ps-3">
                  <RichInput value={s.fix ?? ""} placeholder={t("Corrected statement (correction sheet)…")} onChange={(fix) => set(i, { fix }, "fix")} />
                </div>
              )}
            </div>
          ))}
          <AddRowButton onClick={() => onChange({ statements: [...b.statements, { text: "", answer: true }] }, "statements")}>{t("Add statement")}</AddRowButton>
        </div>
      </Field>
    </>
  );
}

// "a, b , c" → ["a", "b", "c"] (Arabic commas too).
const splitList = (s: string) => s.split(/[,،;]/).map((w) => w.trim());

export function BlankEditor({ b, onChange }: { b: BlankBlock; onChange: OnChange }) {
  const t = useT();
  const ref = useRef<RichHandle>(null);
  const answers = blankAnswers(b.content);
  // Keep what is being typed (with its trailing comma) until it is a full list.
  const [extra, setExtra] = useState((b.distractors ?? []).join(", "));

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
        <RichInput ref={ref} value={b.content} placeholder={t("e.g. The sun rises in the [east].")} onChange={(content) => onChange({ content }, "content")} rows={4} multiline />
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
      <Panel>
        <Toggle checked={!!b.wordBank} onChange={(wordBank) => onChange({ wordBank }, "wordBank")} label={t("Give the words in a box")} hint={t("The answers are printed mixed up above the text.")} />
        {b.wordBank && (
          <Field label={t("Extra words (wrong answers)")} hint={t("Separate them with commas.")}>
            <TextInput
              value={splitList(extra).filter(Boolean).join(",") === (b.distractors ?? []).join(",") ? extra : (b.distractors ?? []).join(", ")}
              placeholder={t("e.g. nord, sud")}
              onChange={(v) => {
                setExtra(v);
                onChange({ distractors: splitList(v).filter(Boolean) }, "distractors");
              }}
            />
          </Field>
        )}
      </Panel>
    </>
  );
}

// The answer area looks, each with a tiny drawing.
function answerStyleOptions(t: ReturnType<typeof useT>): { value: AnswerStyle; label: string; preview: ReactNode }[] {
  const lines = (dash?: string) => (
    <svg width="34" height="20" viewBox="0 0 34 20" aria-hidden>
      {[5, 11, 17].map((y) => (
        <path key={y} d={`M2 ${y}H32`} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray={dash} />
      ))}
    </svg>
  );
  return [
    { value: "dotted", label: t("Dotted"), preview: lines("1.5 2.5") },
    { value: "lines", label: t("Lines"), preview: lines() },
    {
      value: "grid",
      label: t("Squares"),
      preview: (
        <svg width="34" height="20" viewBox="0 0 34 20" aria-hidden>
          <path d="M2 2H32M2 8H32M2 14H32M2 20H32M2 2V20M8 2V20M14 2V20M20 2V20M26 2V20M32 2V20" stroke="#94a3b8" strokeWidth="0.8" />
        </svg>
      ),
    },
    {
      value: "box",
      label: t("Frame"),
      preview: (
        <svg width="34" height="20" viewBox="0 0 34 20" aria-hidden>
          <rect x="2" y="2" width="30" height="16" rx="2" fill="none" stroke="#94a3b8" strokeWidth="1.2" />
        </svg>
      ),
    },
    { value: "none", label: t("Blank"), preview: <span className="text-[9px] text-faint">—</span> },
  ];
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
      <Field label={t("Statement (optional)")} hint={t("Data, a short text or a situation, printed under the question.")}>
        <RichInput value={b.context ?? ""} placeholder={t("e.g. Let ABC be a right triangle at A…")} onChange={(context) => onChange({ context }, "context")} rows={2} multiline />
      </Field>
      <Field group label={t("Answer space")}>
        <ChoiceGrid value={b.answerStyle ?? "dotted"} onChange={(answerStyle) => onChange({ answerStyle }, "answerStyle")} options={answerStyleOptions(t)} cols={5} />
      </Field>
      <Field group label={t("Answer lines")} hint={parts.length ? t("Lines right under the question (often 0 when there are sub-questions).") : undefined}>
        <div className="flex flex-wrap items-center gap-1.5">
          <NumberInput value={b.lines} min={0} max={30} onChange={(lines) => onChange({ lines }, "lines")} />
          {[2, 4, 8, 15].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ lines: n }, "lines")}
              className={`rounded-md px-2 py-1 text-[11px] font-medium ring-1 ${b.lines === n ? "bg-indigo-50 text-indigo-700 ring-indigo-200" : "text-muted ring-line hover:text-ink"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </Field>
      {(b.lines > 0 || !parts.length) && (
        <Field label={t("Model answer")} hint={t("Shown only on the correction sheet.")}>
          <RichInput value={b.answer} onChange={(answer) => onChange({ answer }, "answer")} rows={3} multiline />
        </Field>
      )}

      <Field group label={t("Sub-questions")} hint={t("Split the question into parts: 1a), 1b)… Each part has its own lines, points and answer.")}>
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
