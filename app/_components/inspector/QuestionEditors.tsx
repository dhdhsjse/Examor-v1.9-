"use client";

import { GripVertical, ListTree, Plus, Shuffle } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { PART_NUMBERINGS, blankAnswers, partLabel, partNumberingOf } from "@/app/_lib/blockLayout";
import { MAX_OPTIONS, addPart, insertOption, mcqAnswers, movePart, patchPart, removeOption, removePart, toggleMcq } from "@/app/_lib/blocks";
import { insertText } from "@/app/_lib/richText";
import { mixedOrder } from "@/app/_lib/shuffle";
import type { AnswerStyle, BlankBlock, Lang, McqBlock, OpenBlock, OpenPart, QuestionBlock, TrueFalseBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch } from "@/app/_lib/useExam";
import type { RichHandle } from "../rich/RichEditable";
import { AddRowButton, ChoiceGrid, Field, Group, NumberInput, RemoveButton, RichInput, Row, Segmented, TextAction, TextInput, Toggle } from "./fields";

export type OnChange = (patch: BlockPatch, field: string) => void;

// Question text + points (same for every question type).
export function QuestionBasics({ b, onChange, lockPoints }: { b: QuestionBlock; onChange: OnChange; lockPoints?: boolean }) {
  const t = useT();
  return (
    <>
      <Field label={t("Question")}>
        <RichInput value={b.text} placeholder={t("Type the question…")} onChange={(text) => onChange({ text }, "text")} rows={3} multiline />
      </Field>
      <Row label={t("Points")} hint={lockPoints ? t("Total of the sub-questions.") : undefined}>
        {lockPoints ? (
          <span className="pe-1 text-xs font-semibold tabular-nums text-ink">{b.points}</span>
        ) : (
          <NumberInput value={b.points} min={0} max={100} step={0.25} ariaLabel={t("Points")} className="w-16" onChange={(points) => onChange({ points }, "points")} />
        )}
      </Row>
    </>
  );
}

// A group of settings inside an editor, set off by a hairline (no card). (The shared Group of fields.tsx, under its old name.)
export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return <Group title={title}>{children}</Group>;
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
      <Field
        group
        label={t("Options")}
        action={
          <TextAction onClick={shuffle} title={t("Mix the options (the correct answers follow)")}>
            <Shuffle size={12} strokeWidth={2} aria-hidden />
            {t("Shuffle")}
          </TextAction>
        }
      >
        <div className="flex flex-col gap-1.5">
          {b.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-1.5">
              {/* (in a 28px cell: the circle sits on the middle of the option's first line) */}
              <span className="grid h-7 w-4 shrink-0 place-items-center self-start">
                <input
                  type={b.multi ? "checkbox" : "radio"}
                  name={`correct-${b.id}`}
                  checked={answers.includes(i)}
                  onChange={() => onChange(toggleMcq(b, i), "correct")}
                  className="size-3.5 cursor-pointer accent-emerald-600"
                  title={t("Correct answer")}
                  aria-label={`${t("Correct answer")} ${i + 1}`}
                />
              </span>
              <RichInput value={opt} placeholder={`${t("Option")} ${i + 1}`} onChange={(v) => setOption(i, v)} />
              {b.options.length > 2 && <RemoveButton onClick={() => onChange(removeOption(b, i), "options")} title={t("Remove")} />}
            </div>
          ))}
          {b.options.length < MAX_OPTIONS && <AddRowButton onClick={() => onChange(insertOption(b, b.options.length), "options")}>{t("Add option")}</AddRowButton>}
        </div>
      </Field>
      <Group>
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
      </Group>
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
      <Field group label={t("Statements")} hint={t("Click T / F to set the correct answer of each statement.")}>
        <div className="flex flex-col gap-1.5">
          {b.statements.map((s, i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className="flex items-start gap-1.5">
                <RichInput value={s.text} placeholder={t("Statement…")} onChange={(text) => set(i, { text })} />
                <button
                  type="button"
                  onClick={() => set(i, { answer: !s.answer }, "answer")}
                  title={t("Correct answer")}
                  aria-pressed={s.answer}
                  className={`h-7 w-7 shrink-0 rounded-[5px] text-xs font-bold outline-none focus-visible:ring-2 focus-visible:ring-accent ${s.answer ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}
                >
                  {s.answer ? t("T") : t("F")}
                </button>
                {b.statements.length > 1 && (
                  <RemoveButton title={t("Remove")} onClick={() => onChange({ statements: b.statements.filter((_, k) => k !== i) }, "statements")} />
                )}
              </div>
              {b.justify && !s.answer && (
                <div className="border-s-2 border-line ps-2">
                  <RichInput value={s.fix ?? ""} placeholder={t("Corrected statement (correction sheet)…")} onChange={(fix) => set(i, { fix }, "fix")} />
                </div>
              )}
            </div>
          ))}
          <AddRowButton onClick={() => onChange({ statements: [...b.statements, { text: "", answer: true }] }, "statements")}>{t("Add statement")}</AddRowButton>
        </div>
      </Field>
      <Group>
        <Toggle checked={!!b.justify} onChange={(justify) => onChange({ justify }, "justify")} label={t("Ask to correct the false statements")} hint={t("Adds a line under each statement.")} />
      </Group>
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
      <Field
        label={t("Text with blanks")}
        hint={t("Put each answer in [brackets], or select words and click “Make blank”.")}
        action={
          <TextAction onMouseDown={(e) => e.preventDefault() /* keep the text selection */} onClick={makeBlank} title={t("Make blank from selection")}>
            {t("Make blank")}
          </TextAction>
        }
      >
        <RichInput ref={ref} value={b.content} placeholder={t("e.g. The sun rises in the [east].")} onChange={(content) => onChange({ content }, "content")} rows={4} multiline />
      </Field>
      {answers.length > 0 && (
        <p className="text-xs leading-snug text-muted">
          {t("Answers:")} <span className="font-medium text-emerald-700">{answers.join(" · ")}</span>
        </p>
      )}
      <Group>
        <Toggle checked={!!b.wordBank} onChange={(wordBank) => onChange({ wordBank }, "wordBank")} label={t("Give the words in a box")} hint={t("The answers are printed mixed up above the text.")} />
        {b.wordBank && (
          <Field label={t("Extra words (wrong answers)")}>
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
      </Group>
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

      {/* Sub-questions: splitting a question into a), b)… is the main choice here */}
      <Group
        label={t("Sub-questions")}
        title={
          <>
            <ListTree size={14} strokeWidth={1.75} aria-hidden className="text-muted" />
            {t("Sub-questions")}
            {parts.length > 0 && <span className="rounded bg-hover px-1 text-[11px] font-semibold tabular-nums text-ink">{parts.length}</span>}
          </>
        }
        hint={t("Split the question into parts: a), b)… Each part has its own lines, points and answer.")}
      >
        {parts.length > 0 && (
          <Field group label={t("Numbering")}>
            <Segmented value={partNumberingOf(b)} onChange={(partNumbering) => onChange({ partNumbering }, "numbering")} options={PART_NUMBERINGS} />
          </Field>
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
            // One sub-question, top to bottom: its name, points and remove; its text; its answer lines; its model answer.
            // (the panel's own surface, not bg-white: in dark mode that is the grey of the fields, which would vanish in it)
            className={`flex flex-col gap-1.5 rounded-[5px] border bg-surface p-1.5 transition-colors ${drag === i ? "opacity-40" : ""} ${
              over === i && drag !== i ? "border-accent" : "border-line"
            }`}
          >
            <div className="flex items-center gap-1">
              <span
                onMouseDown={() => setArmed(i)}
                onMouseUp={() => setArmed(null)}
                className="grid h-7 w-4 shrink-0 cursor-grab place-items-center text-faint select-none hover:text-ink active:cursor-grabbing"
                title={t("Drag to reorder")}
              >
                <GripVertical size={12} strokeWidth={2} aria-hidden />
              </span>
              <TextInput
                value={p.label ?? ""}
                placeholder={autoLabel(i)}
                title={t("Name of the sub-question (empty = automatic)")}
                ariaLabel={t("Name of the sub-question (empty = automatic)")}
                className="w-12 font-semibold"
                onChange={(label) => setPart(i, { label }, "label")}
              />
              <span className="flex-1" />
              <NumberInput value={p.points} min={0} max={100} step={0.25} ariaLabel={t("Points")} className="w-14" onChange={(points) => setPart(i, { points }, "points")} />
              <span className="text-xs text-muted">{t("pts")}</span>
              <RemoveButton title={t("Remove")} onClick={() => onChange(removePart(b, i), "parts")} />
            </div>
            <RichInput value={p.text} placeholder={t("Sub-question…")} onChange={(text) => setPart(i, { text }, "text")} rows={2} multiline />
            <Row label={t("Answer lines")}>
              <NumberInput value={p.lines} min={0} max={20} ariaLabel={t("Answer lines")} className="w-14" onChange={(lines) => setPart(i, { lines }, "lines")} />
            </Row>
            <RichInput value={p.answer} placeholder={t("Answer (correction sheet)…")} onChange={(answer) => setPart(i, { answer }, "answer")} rows={2} multiline />
          </div>
        ))}
        {parts.length < 12 && (
          <button
            type="button"
            onClick={() => onChange(addPart(b), "parts")}
            className="flex h-7 w-full items-center justify-center gap-1.5 rounded-[5px] bg-subtle text-xs font-medium text-ink transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent"
          >
            <Plus size={12} strokeWidth={2} aria-hidden /> {t("Add sub-question")}
          </button>
        )}
      </Group>

      <Group>
        <Field group label={t("Answer space")}>
          <ChoiceGrid value={b.answerStyle ?? "dotted"} onChange={(answerStyle) => onChange({ answerStyle }, "answerStyle")} options={answerStyleOptions(t)} cols={5} />
        </Field>
        <Field group label={t("Answer lines")} hint={parts.length ? t("Lines right under the question (often 0 when there are sub-questions).") : undefined}>
          <div className="flex items-center gap-1">
          <NumberInput value={b.lines} min={0} max={30} ariaLabel={t("Answer lines")} className="me-0.5 w-14" onChange={(lines) => onChange({ lines }, "lines")} />
          {[2, 4, 8, 15].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange({ lines: n }, "lines")}
              aria-pressed={b.lines === n}
              className={`h-7 min-w-7 rounded-[5px] px-1.5 text-xs tabular-nums transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${b.lines === n ? "bg-hover font-semibold text-ink" : "text-muted hover:bg-subtle hover:text-ink"}`}
            >
              {n}
            </button>
          ))}
          </div>
        </Field>
        {(b.lines > 0 || !parts.length) && (
          <Field label={t("Model answer")}>
            <RichInput value={b.answer} onChange={(answer) => onChange({ answer }, "answer")} rows={3} multiline placeholder={t("Shown only on the correction sheet.")} />
          </Field>
        )}
      </Group>
    </>
  );
}
