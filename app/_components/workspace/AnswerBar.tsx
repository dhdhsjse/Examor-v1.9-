"use client";

import { blankAnswers, partLabel } from "@/app/_lib/blockLayout";
import type { EditField } from "@/app/_lib/editRegions";
import { isRtl, optionLabel, words } from "@/app/_lib/i18n";
import { patchPart } from "@/app/_lib/blocks";
import type { BlankBlock, Lang, OpenPart, QuestionBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch } from "@/app/_lib/useExam";

interface Props {
  block: QuestionBlock;
  number: number;
  lang: Lang;
  open: boolean;
  onToggle: () => void;
  onPatch: (patch: BlockPatch, field: string) => void;
  onEdit: (field: EditField) => void; // start typing a text of the question on the page
}

const chip = (on: boolean) =>
  `min-w-7 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
    on ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
  }`;
const input =
  "w-full rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs text-emerald-900 outline-none placeholder:text-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";

// Change the n-th [answer] of a fill-in-the-blank text.
function setBlank(b: BlankBlock, n: number, value: string): string {
  let k = 0;
  return b.content.replace(/\[([^\]]*)\]/g, (m) => (k++ === n ? `[${value.replace(/[[\]]/g, "")}]` : m));
}

const addBtn =
  "rounded-md border border-dashed border-emerald-300 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:border-emerald-500 hover:bg-white";

// Small green bar under the selected question: set the correct answer and the points,
// and add options / statements / sub-questions right there on the page.
export default function AnswerBar({ block: b, number, lang, open, onToggle, onPatch, onEdit }: Props) {
  const t = words(lang);
  const ui = useT();

  // Add an item and start typing it on the page.
  const addOption = () => {
    if (b.type !== "mcq") return;
    onPatch({ options: [...b.options, ""] }, "options");
    onEdit({ kind: "option", i: b.options.length });
  };
  const addStatement = () => {
    if (b.type !== "truefalse") return;
    onPatch({ statements: [...b.statements, { text: "", answer: true }] }, "statements");
    onEdit({ kind: "statement", i: b.statements.length });
  };
  const addPart = () => {
    if (b.type !== "open") return;
    const parts = b.parts ?? [];
    const next = [...parts, { text: "", lines: 2, answer: "", points: 1 }];
    onPatch({ parts: next, points: next.reduce((s, p) => s + p.points, 0), ...(parts.length ? {} : { lines: 0 }) }, "parts");
    onEdit({ kind: "part", i: parts.length });
  };

  return (
    <div
      className="pointer-events-auto rounded-lg border border-emerald-200 bg-emerald-50/95 text-emerald-900 shadow-[0_8px_24px_-10px_rgba(5,150,105,0.45)] backdrop-blur"
      onMouseDown={(e) => e.stopPropagation()}
      dir={isRtl(lang) ? "rtl" : "ltr"}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button onClick={onToggle} className="flex items-center gap-1.5 text-xs font-semibold" title={open ? ui("Hide") : ui("Show")}>
          <span className="grid size-4 place-items-center rounded-full bg-emerald-600 text-[10px] text-white">✓</span>
          {ui("Answer")}
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={`transition-transform ${open ? "" : "-rotate-90"}`}>
            <path d="M1 2.5h6L4 6z" />
          </svg>
        </button>

        {open && (
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
            {b.type === "mcq" &&
              b.options.map((_, i) => (
                <button key={i} className={chip(b.correct === i)} onClick={() => onPatch({ correct: i }, "correct")} title={b.options[i]}>
                  {optionLabel(i, lang)}
                </button>
              ))}
            {b.type === "mcq" && b.options.length < 6 && (
              <button className={addBtn} onClick={addOption} title={ui("Add an option and type it on the page")}>
                + {ui("Option")}
              </button>
            )}

            {b.type === "truefalse" &&
              b.statements.map((s, i) => (
                <span key={i} className="flex items-center gap-0.5 rounded-md bg-white/70 py-0.5 ps-1.5 pe-0.5 text-[11px] ring-1 ring-emerald-100">
                  {i + 1}
                  {[true, false].map((v) => (
                    <button
                      key={String(v)}
                      className={chip(s.answer === v)}
                      onClick={() => onPatch({ statements: b.statements.map((x, k) => (k === i ? { ...x, answer: v } : x)) }, `statement${i}`)}
                    >
                      {v ? t.true : t.false}
                    </button>
                  ))}
                </span>
              ))}
            {b.type === "truefalse" && (
              <button className={addBtn} onClick={addStatement} title={ui("Add a statement and type it on the page")}>
                + {ui("Statement")}
              </button>
            )}

            {b.type === "blank" &&
              (blankAnswers(b.content).length ? (
                blankAnswers(b.content).map((a, i) => (
                  <input key={i} dir="auto" value={a} onChange={(e) => onPatch({ content: setBlank(b, i, e.target.value) }, `blank${i}`)} className={`${input} w-24!`} />
                ))
              ) : (
                <span className="text-[11px] text-emerald-700">{ui("Click the sentence and put answers in [brackets]")}</span>
              ))}

            {b.type === "open" && !b.parts?.length && (
              <input dir="auto" value={b.answer} placeholder={ui("Model answer (correction sheet)…")} onChange={(e) => onPatch({ answer: e.target.value }, "answer")} className={`${input} flex-1`} />
            )}
            {b.type === "open" && (b.parts?.length ?? 0) < 8 && (
              <button className={addBtn} onClick={addPart} title={ui("Add a sub-question and type it on the page")}>
                + {ui("Sub-question")}
              </button>
            )}
          </div>
        )}

        <label className="ms-auto flex shrink-0 items-center gap-1 text-[11px]">
          <input
            type="number"
            min={0}
            step={0.5}
            value={b.points}
            disabled={b.type === "open" && !!b.parts?.length}
            onChange={(e) => onPatch({ points: Math.max(0, Number(e.target.value) || 0) }, "points")}
            className="w-12 rounded-md border border-emerald-200 bg-white px-1.5 py-0.5 text-end text-xs outline-none focus:border-emerald-400 disabled:opacity-60"
          />
          {ui("pts")}
        </label>
      </div>

      {/* Sub-questions: one answer per part */}
      {open && b.type === "open" && !!b.parts?.length && (
        <div className="flex flex-col gap-1 border-t border-emerald-200/70 px-2.5 py-1.5">
          {b.parts.map((p, i) => (
            <PartAnswer key={i} placeholder={ui("Answer…")} pointsTitle={ui("Points")} label={partLabel(number, i, lang)} part={p} onChange={(patch) => onPatch(patchPart(b.parts!, i, patch), `part${i}`)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PartAnswer({ label, part, onChange, placeholder, pointsTitle }: {
  label: string;
  part: OpenPart;
  onChange: (patch: Partial<OpenPart>) => void;
  placeholder: string;
  pointsTitle: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-9 shrink-0 text-[11px] font-semibold">{label}</span>
      <input dir="auto" value={part.answer} placeholder={placeholder} onChange={(e) => onChange({ answer: e.target.value })} className={`${input} flex-1`} />
      <input
        type="number"
        min={0}
        step={0.5}
        value={part.points}
        onChange={(e) => onChange({ points: Math.max(0, Number(e.target.value) || 0) })}
        className="w-12 rounded-md border border-emerald-200 bg-white px-1.5 py-0.5 text-end text-xs outline-none focus:border-emerald-400"
        title={pointsTitle}
      />
    </div>
  );
}
