"use client";

import { useState } from "react";
import { PART_NUMBERINGS, blankAnswers, partLabel } from "@/app/_lib/blockLayout";
import { addPart, movePart, patchPart, removePart } from "@/app/_lib/blocks";
import type { EditField } from "@/app/_lib/editRegions";
import { isRtl, optionLabel, words } from "@/app/_lib/i18n";
import { plainText } from "@/app/_lib/richText";
import type { BlankBlock, Lang, OpenBlock, QuestionBlock, ViewMode } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch } from "@/app/_lib/useExam";

interface Props {
  block: QuestionBlock;
  number: number;
  lang: Lang;
  mode: ViewMode;
  open: boolean;
  onToggle: () => void;
  onPatch: (patch: BlockPatch, field: string) => void;
  onEdit: (field: EditField) => void; // start typing a text of the question on the page
  onShowCorrection: () => void;
}

const chip = (on: boolean) =>
  `min-w-7 rounded-md px-2 py-1 text-xs font-semibold transition-colors ${
    on ? "bg-emerald-600 text-white shadow-sm" : "bg-white text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-100"
  }`;
const input =
  "w-full rounded-md border border-emerald-200 bg-white px-2 py-1 text-xs text-emerald-900 outline-none placeholder:text-emerald-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100";
const pointsInput =
  "w-12 rounded-md border border-emerald-200 bg-white px-1.5 py-0.5 text-end text-xs outline-none focus:border-emerald-400 disabled:opacity-60";
const addBtn =
  "shrink-0 rounded-md border border-dashed border-emerald-300 px-2 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:border-emerald-500 hover:bg-white";

// Change the n-th [answer] of a fill-in-the-blank text.
function setBlank(b: BlankBlock, n: number, value: string): string {
  let k = 0;
  return b.content.replace(/\[([^\]]*)\]/g, (m) => (k++ === n ? `[${value.replace(/[[\]]/g, "")}]` : m));
}

// Small green bar under the selected question: correct answer, points, and adding
// options / statements / sub-questions right there on the page.
export default function AnswerBar({ block: b, number, lang, mode, open, onToggle, onPatch, onEdit, onShowCorrection }: Props) {
  const t = words(lang);
  const ui = useT();
  const hasParts = b.type === "open" && !!b.parts?.length;

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
  const newPart = () => {
    if (b.type !== "open") return;
    onPatch(addPart(b), "parts");
    onEdit({ kind: "part", i: b.parts?.length ?? 0 });
  };

  return (
    <div
      className="pointer-events-auto rounded-lg border border-emerald-200 bg-emerald-50/95 text-emerald-900 shadow-[0_8px_24px_-10px_rgba(5,150,105,0.45)] backdrop-blur"
      onMouseDown={(e) => e.stopPropagation()}
      dir={isRtl(lang) ? "rtl" : "ltr"}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <button onClick={onToggle} className="flex shrink-0 items-center gap-1.5 text-xs font-semibold" title={open ? ui("Hide") : ui("Show")}>
          <span className="grid size-4 place-items-center rounded-full bg-emerald-600 text-[10px] text-white">✓</span>
          {ui("Answer")}
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className={`transition-transform ${open ? "" : "-rotate-90"}`}>
            <path d="M1 2.5h6L4 6z" />
          </svg>
        </button>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {open &&
            b.type === "mcq" &&
            b.options.map((_, i) => (
              <button key={i} className={chip(b.correct === i)} onClick={() => onPatch({ correct: i }, "correct")} title={plainText(b.options[i])}>
                {optionLabel(i, lang)}
              </button>
            ))}

          {open &&
            b.type === "truefalse" &&
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

          {open &&
            b.type === "blank" &&
            (blankAnswers(b.content).length ? (
              blankAnswers(b.content).map((a, i) => (
                <input key={i} dir="auto" value={a} onChange={(e) => onPatch({ content: setBlank(b, i, e.target.value) }, `blank${i}`)} className={`${input} w-24!`} />
              ))
            ) : (
              <span className="text-[11px] text-emerald-700">{ui("Click the sentence and put answers in [brackets]")}</span>
            ))}

          {/* Open questions: the model answer is written on the lines of the correction sheet */}
          {open && b.type === "open" && mode === "exam" && (
            <button onClick={onShowCorrection} className="rounded-md px-1.5 py-1 text-[11px] text-emerald-700 underline decoration-emerald-300 underline-offset-2 hover:text-emerald-900">
              {ui("Write the answers in Correction view")}
            </button>
          )}

          {/* "Add" buttons are always there, even when the bar is folded */}
          {b.type === "mcq" && b.options.length < 6 && (
            <button className={addBtn} onClick={addOption} title={ui("Add an option and type it on the page")}>
              + {ui("Option")}
            </button>
          )}
          {b.type === "truefalse" && (
            <button className={addBtn} onClick={addStatement} title={ui("Add a statement and type it on the page")}>
              + {ui("Statement")}
            </button>
          )}
          {b.type === "open" && (b.parts?.length ?? 0) < 12 && (
            <button className={addBtn} onClick={newPart} title={ui("Add a sub-question and type it on the page")}>
              + {ui("Sub-question")}
            </button>
          )}
        </div>

        <label className="ms-auto flex shrink-0 items-center gap-1 text-[11px]" title={hasParts ? ui("Total of the sub-questions.") : ui("Points")}>
          <input
            type="number"
            min={0}
            step={0.25}
            value={b.points}
            disabled={hasParts}
            onChange={(e) => onPatch({ points: Math.max(0, Number(e.target.value) || 0) }, "points")}
            className={pointsInput}
          />
          {ui("pts")}
        </label>
      </div>

      {/* Sub-questions: name, order (drag), points */}
      {open && b.type === "open" && hasParts && <PartList b={b} number={number} lang={lang} onPatch={onPatch} onEdit={onEdit} />}
    </div>
  );
}

function PartList({ b, number, lang, onPatch, onEdit }: { b: OpenBlock; number: number; lang: Lang; onPatch: Props["onPatch"]; onEdit: Props["onEdit"] }) {
  const ui = useT();
  const parts = b.parts ?? [];
  const [armed, setArmed] = useState<number | null>(null); // grabbed by its handle
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const reset = () => {
    setArmed(null);
    setDrag(null);
    setOver(null);
  };

  return (
    <div className="flex flex-col gap-1 border-t border-emerald-200/70 px-2.5 py-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-700">
        {ui("Numbering")}
        <div className="flex rounded-md bg-white/70 p-0.5 ring-1 ring-emerald-100">
          {PART_NUMBERINGS.map((n) => (
            <button
              key={n.value}
              onClick={() => onPatch({ partNumbering: n.value }, "numbering")}
              className={`rounded px-1.5 py-0.5 text-[10px] ${(b.partNumbering ?? "1a") === n.value ? "bg-emerald-600 text-white" : "hover:bg-emerald-100"}`}
            >
              {n.label}
            </button>
          ))}
        </div>
        <span className="ms-auto font-normal text-emerald-600/80">{ui("Drag ⋮⋮ to reorder")}</span>
      </div>

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
            if (drag !== null && drag !== i) onPatch(movePart(b, drag, i), "parts-order");
            reset();
          }}
          onDragEnd={reset}
          className={`flex items-center gap-1.5 rounded-md transition-colors ${drag === i ? "opacity-40" : ""} ${over === i && drag !== i ? "bg-emerald-100 ring-1 ring-emerald-400" : ""}`}
        >
          <span
            onMouseDown={() => setArmed(i)}
            onMouseUp={() => setArmed(null)}
            className="cursor-grab px-0.5 text-sm leading-none text-emerald-500 select-none active:cursor-grabbing"
            title={ui("Drag to reorder")}
          >
            ⋮⋮
          </span>
          <input
            dir="auto"
            value={p.label ?? ""}
            placeholder={partLabel({ ...b, parts: parts.map((x) => ({ ...x, label: "" })) }, number, i, lang) || "—"}
            onChange={(e) => onPatch(patchPart(parts, i, { label: e.target.value }), `part${i}-label`)}
            className={`${input} w-20! shrink-0 text-center font-semibold`}
            title={ui("Name of the sub-question (empty = automatic)")}
          />
          <button onClick={() => onEdit({ kind: "part", i })} className="min-w-0 flex-1 truncate text-start text-[11px] text-emerald-900 hover:underline" title={ui("Type it on the page")}>
            {plainText(p.text).trim() || <span className="text-emerald-400">{ui("Sub-question…")}</span>}
          </button>
          <input
            type="number"
            min={0}
            step={0.25}
            value={p.points}
            onChange={(e) => onPatch(patchPart(parts, i, { points: Math.max(0, Number(e.target.value) || 0) }), `part${i}`)}
            className={pointsInput}
            title={ui("Points")}
          />
          <button onClick={() => onPatch(removePart(b, i), "parts")} className="grid size-5 shrink-0 place-items-center rounded text-emerald-500 hover:bg-red-50 hover:text-red-600" title={ui("Remove")}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
