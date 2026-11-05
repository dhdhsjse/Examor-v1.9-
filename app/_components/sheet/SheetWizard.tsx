"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { formatMark } from "@/app/_lib/sheet/marks";
import type { SheetChoice, SheetPaper, SheetTemplate } from "@/app/_lib/sheet/model";
import { useT } from "@/app/_lib/uiLang";

interface Props {
  /** A correction sheet is there: the new one replaces it */
  rebuild: boolean;
  /** How many questions the exam has, what their points add up to, and what the exam is graded out of */
  questions: number;
  points: number;
  fullMark: number;
  /** What the choice starts at (the sheet that is being replaced, else the usual) */
  initial?: Partial<SheetChoice>;
  onMake: (choice: SheetChoice) => void;
  onClose: () => void;
}

// The little pictures of the three ways (the lines are the text, the small boxes on the right are the marks)
const Sketch = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 120 70" width="100%" height="70" aria-hidden className="rounded-lg bg-white ring-1 ring-black/5">
    <rect x="8" y="6" width="104" height="58" fill="none" stroke="#9ca3af" strokeWidth="1" />
    <line x1="80" y1="6" x2="80" y2="64" stroke="#9ca3af" strokeWidth="1" />
    <line x1="96" y1="6" x2="96" y2="64" stroke="#9ca3af" strokeWidth="1" />
    {children}
  </svg>
);

const SKETCHES: Record<SheetTemplate, ReactNode> = {
  answers: (
    <Sketch>
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x="13" y={13 + i * 17} width="9" height="3" fill="#111827" />
          <rect x="25" y={13 + i * 17} width="44" height="3" fill="#6b7280" />
          <rect x="85" y={13 + i * 17} width="6" height="3" fill="#111827" />
          <line x1="8" y1={22 + i * 17} x2="112" y2={22 + i * 17} stroke="#9ca3af" strokeWidth="0.8" />
        </g>
      ))}
    </Sketch>
  ),
  copy: (
    <Sketch>
      <rect x="13" y="11" width="55" height="3" fill="#111827" />
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <circle cx="17" cy={22 + i * 7} r="2" fill="none" stroke="#6b7280" strokeWidth="0.8" />
          <rect x="23" y={21 + i * 7} width={30 + i * 6} height="2.4" fill="#6b7280" />
        </g>
      ))}
      <circle cx="17" cy="29" r="2" fill="#15803d" />
      <line x1="8" y1="44" x2="112" y2="44" stroke="#9ca3af" strokeWidth="0.8" />
      <rect x="13" y="50" width="48" height="3" fill="#111827" />
      <rect x="85" y="11" width="6" height="3" fill="#111827" />
      <rect x="85" y="50" width="6" height="3" fill="#111827" />
    </Sketch>
  ),
  blank: <Sketch>{null}</Sketch>,
};

const card = (on: boolean) =>
  `flex flex-col gap-2.5 rounded-2xl p-4 text-start transition-[transform,background-color,box-shadow] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.985] ${
    on ? "bg-white shadow-[0_0_0_2px_#10b981,0_6px_20px_rgba(16,185,129,0.18)]" : "bg-subtle hover:bg-hover"
  }`;

// The window that makes the correction sheet: what it is made from (the questions with their answers, the whole exam with its answers, nothing) and the
// paper it is written on (bordered like an official answer key, or free), and whether the marks of the questions go on it.
export default function SheetWizard({ rebuild, questions, points, fullMark, initial, onMake, onClose }: Props) {
  const t = useT();
  const [template, setTemplate] = useState<SheetTemplate>(initial?.template ?? "answers");
  const [paper, setPaper] = useState<SheetPaper>(initial?.paper ?? "bordered");
  const [marks, setMarks] = useState(initial?.marks ?? true);
  const dialog = useRef<HTMLDivElement>(null);

  // Esc closes it, Ctrl+Enter makes the sheet; focus starts on the way chosen and goes back to where it was when the window closes
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.querySelector<HTMLElement>("[role=radio][aria-checked=true]")?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) dialog.current?.querySelector<HTMLButtonElement>("[data-testid=wizard-make]")?.click();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [onClose]);

  const templates: { id: SheetTemplate; title: string; hint: string }[] = [
    { id: "answers", title: t("Questions and answers"), hint: t("One row per question: its number, its model answer and its marks.") },
    { id: "copy", title: t("The exam with its answers"), hint: t("The whole exam in the answer column, with the answers under the questions and the marks beside them.") },
    { id: "blank", title: t("An empty sheet"), hint: t("Start from nothing: put the answers, the marks and the lines yourself.") },
  ];
  const papers: { id: SheetPaper; title: string; hint: string }[] = [
    { id: "bordered", title: t("Bordered"), hint: t("A frame with a column for the marks and one for the totals, like an official answer key.") },
    { id: "free", title: t("Free paper"), hint: t("No frame: put the stickers and the lines where you want.") },
  ];
  const fromExam = template !== "blank";
  const mismatch = fromExam && marks && questions > 0 && Math.abs(points - fullMark) > 1e-6;

  // The arrow keys move between the ways of a group, as in any group of radio buttons (the one chosen is the one the Tab key stops at)
  const arrows = <V extends string>(e: KeyboardEvent<HTMLElement>, ids: V[], current: V, set: (v: V) => void) => {
    const rtl = getComputedStyle(e.currentTarget).direction === "rtl";
    const step = e.key === "ArrowDown" || e.key === (rtl ? "ArrowLeft" : "ArrowRight") ? 1 : e.key === "ArrowUp" || e.key === (rtl ? "ArrowRight" : "ArrowLeft") ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = ids[(ids.indexOf(current) + step + ids.length) % ids.length];
    set(next);
    queueMicrotask(() => dialog.current?.querySelector<HTMLElement>(`[data-radio="${next}"]`)?.focus());
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-6 backdrop-blur-md" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialog} data-testid="sheet-wizard" role="dialog" aria-modal="true" aria-label={t("Correction sheet")} className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
        <div className="flex items-start justify-between px-8 pt-7 pb-3">
          <div>
            <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-ink">{rebuild ? t("Make the correction sheet again") : t("Make the correction sheet")}</h2>
            <p className="mt-1 text-[13px] tracking-[-0.01em] text-muted">{t("Choose what it is made from and the paper it is written on. You can change everything afterwards.")}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-full bg-subtle text-muted transition-[transform,background-color] duration-100 outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent active:scale-90" title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-6 overflow-y-auto px-8 py-4">
          <section aria-label={t("What goes on it?")}>
            <h3 className="mb-2.5 text-[13px] font-semibold tracking-[-0.01em] text-ink">{t("What goes on it?")}</h3>
            <div role="radiogroup" aria-label={t("What goes on it?")} className="grid gap-3.5 sm:grid-cols-3">
              {templates.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={template === o.id}
                  tabIndex={template === o.id ? 0 : -1}
                  data-radio={o.id}
                  data-testid={`wizard-template-${o.id}`}
                  onClick={() => setTemplate(o.id)}
                  onKeyDown={(e) => arrows(e, templates.map((x) => x.id), template, setTemplate)}
                  className={card(template === o.id)}
                >
                  {SKETCHES[o.id]}
                  <span className="text-[15px] font-semibold tracking-[-0.015em] text-ink">{o.title}</span>
                  <span className="text-xs leading-snug tracking-[-0.005em] text-muted">{o.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <section aria-label={t("Paper")}>
            <h3 className="mb-2.5 text-[13px] font-semibold tracking-[-0.01em] text-ink">{t("Paper")}</h3>
            <div role="radiogroup" aria-label={t("Paper")} className="grid gap-3.5 sm:grid-cols-2">
              {papers.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={paper === o.id}
                  tabIndex={paper === o.id ? 0 : -1}
                  data-radio={o.id}
                  data-testid={`wizard-paper-${o.id}`}
                  onClick={() => setPaper(o.id)}
                  onKeyDown={(e) => arrows(e, papers.map((x) => x.id), paper, setPaper)}
                  className={card(paper === o.id)}
                >
                  <span className="text-[15px] font-semibold tracking-[-0.015em] text-ink">{o.title}</span>
                  <span className="text-xs leading-snug tracking-[-0.005em] text-muted">{o.hint}</span>
                </button>
              ))}
            </div>
          </section>

          <label className={`flex cursor-pointer items-center justify-between gap-4 rounded-2xl bg-subtle px-4 py-3 ${fromExam ? "text-ink" : "text-faint"}`}>
            <span className="flex flex-col gap-0.5 text-[15px] font-medium tracking-[-0.015em]">
              {t("Put the marks of the questions")}
              <span className="text-xs leading-snug font-normal tracking-[-0.005em] text-muted">{t("The points of each question become a mark beside its answer, with a total when it has several.")}</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              data-testid="wizard-marks"
              checked={fromExam && marks}
              disabled={!fromExam}
              onChange={(e) => setMarks(e.target.checked)}
              className="relative h-[26px] w-[44px] shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition-colors duration-200 outline-none before:absolute before:top-[2px] before:left-[2px] before:size-[22px] before:rounded-full before:bg-white before:shadow before:transition-transform before:duration-200 before:content-[''] checked:bg-emerald-500 checked:before:translate-x-[18px] focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-40 rtl:before:right-[2px] rtl:before:left-auto rtl:checked:before:-translate-x-[18px]"
            />
          </label>

          {fromExam && questions > 0 && (
            <p className="px-1 text-[13px] text-muted tabular-nums" data-testid="wizard-count">
              {t("{count} question(s) · {points} pts", { count: questions, points: formatMark(points) })}
            </p>
          )}
          {mismatch && (
            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900" data-testid="wizard-mismatch">
              {t("The questions add up to {points} pts and the exam is out of {out}.", { points: formatMark(points), out: formatMark(fullMark) })}
            </p>
          )}
          {fromExam && questions === 0 && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">{t("The exam has no questions yet: the sheet will only have its title.")}</p>}
          {rebuild && <p className="rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900">{t("This replaces the correction sheet you have (the settings of its frame are kept). Ctrl+Z brings the old one back.")}</p>}
        </div>

        <div className="flex items-center justify-end gap-2.5 px-8 pt-3 pb-7">
          <button type="button" data-testid="wizard-cancel" onClick={onClose} className="h-10 rounded-full bg-subtle px-5 text-[13px] font-medium tracking-[-0.01em] text-ink transition-[transform,background-color] duration-100 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]">
            {t("Cancel")}
          </button>
          <button
            type="button"
            data-testid="wizard-make"
            title="Ctrl+Enter"
            onClick={() => onMake({ template, paper, marks: fromExam && marks })}
            className="h-10 rounded-full bg-emerald-600 px-6 text-[13px] font-semibold tracking-[-0.01em] text-white shadow-[0_1px_2px_rgba(5,150,105,0.4)] transition-[transform,background-color] duration-100 outline-none hover:bg-emerald-700 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 active:scale-[0.97]"
          >
            {rebuild ? t("Replace the correction sheet") : t("Make the correction sheet")}
          </button>
        </div>
      </div>
    </div>
  );
}
