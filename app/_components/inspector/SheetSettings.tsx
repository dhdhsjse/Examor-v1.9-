"use client";

import { ChevronRight, Minus, Plus, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DEFAULT_SIZE } from "@/app/_lib/blockLayout";
import type { SheetFix, SheetReport } from "@/app/_lib/sheet/links";
import { formatMark } from "@/app/_lib/sheet/marks";
import type { SheetScores } from "@/app/_lib/sheet/marks";
import { defaultSheet, type HeadingScope, type SheetConfig, type SheetPaper } from "@/app/_lib/sheet/model";
import type { ExamMeta } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import InfoTip from "../InfoTip";
import { ColorGrid } from "../rich/FormatBar";
import { Segmented, SmallButton } from "./fields";

const round = (n: number) => Math.round(n * 1000) / 1000;

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2 px-3 py-3">
      {title && <h3 className="flex h-5 items-center text-[11px] font-semibold text-ink">{title}</h3>}
      {children}
    </section>
  );
}

const Hint = ({ children }: { children: ReactNode }) => <p className="text-[11px] leading-snug text-faint">{children}</p>;

// The right panel while the correction sheet is shown and nothing is selected: its paper (free, or bordered like an official answer key with a column
// of marks and a column of totals), what it adds up to, and its look. The columns and the edges of the frame are dragged on the page (FrameHandles).
export default function SheetSettings({ sheet, scores, full, onFullMark, onGoTo, meta, report, fix, onChange, onMeta, onDelete }: {
  sheet: SheetConfig;
  scores: SheetScores;
  full: number;
  onFullMark: (value: number) => void;
  onGoTo: (id: string) => void;
  meta: ExamMeta;
  report: SheetReport | null;
  fix: SheetFix;
  onChange: (patch: Partial<SheetConfig>, key?: string) => void;
  onMeta: (patch: Partial<ExamMeta>, key?: string) => void;
  onDelete: () => void;
}) {
  const t = useT();
  const [sure, setSure] = useState(false);
  const [draft, setDraft] = useState<string | null>(null); // the full mark as it is being typed
  const bordered = sheet.paper === "bordered";
  const dflt = defaultSheet(meta.lang);
  const over = scores.total > full;
  // (rows with several marks that show no total: the sticker is easy to forget when the marks are stamped one by one)
  const noTotal = sheet.total ? scores.rows.filter((r) => r.totals.length === 0 && r.marks.filter((m) => m.kind === "number").length >= 2).length : 0;
  const size = meta.answerSize ?? meta.fontSize ?? DEFAULT_SIZE;
  const setSize = (v: number) => {
    onMeta({ answerSize: v }, "answerSize");
    fix.restyle({ size: v });
  };
  const stepBtn = "grid size-8 place-items-center rounded-md text-ink outline-none transition-[transform,background-color] duration-100 ease-out hover:bg-hover active:scale-90 focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-35 disabled:active:scale-100";
  const ok = scores.rows.length > 0 && scores.total === full;
  const papers: { value: SheetPaper; label: string }[] = [
    { value: "bordered", label: t("Bordered") },
    { value: "free", label: t("Free paper") },
  ];
  const scopes: { value: HeadingScope; label: string }[] = [
    { value: "first", label: t("First page") },
    { value: "all", label: t("Every page") },
    { value: "none", label: t("None") },
  ];

  return (
    <div className="flex flex-col" data-testid="sheet-settings">
      <div className="flex h-10 items-center gap-1.5 border-b border-line px-3">
        <h2 className="text-xs font-semibold text-ink">{t("Correction sheet")}</h2>
        <InfoTip label={t("More info")} text={t("Put the stickers of the left toolbox on the page: the marks between two lines are added up, and the total sticker shows the result.")} />
      </div>
      <div className="flex flex-col divide-y divide-line">
        <Section title={t("Marks")}>
          <div className="flex justify-center py-2">
            <span
              data-testid="sheet-total"
              className={`flex items-baseline gap-2 text-4xl font-semibold tracking-[-0.03em] tabular-nums ${over ? "text-red-700" : ok ? "text-emerald-700" : "text-ink"}`}
              title={over ? t("The marks add up to more than the full mark!") : t("What the marks of the sheet add up to / the full mark of the exam")}
            >
              {over && <TriangleAlert size={20} strokeWidth={2} aria-hidden className="self-center" />}
              <span>{formatMark(scores.total, sheet.pad)}</span>
              <span className="flex items-baseline gap-0.5 text-2xl font-medium text-faint">
                <span aria-hidden>/</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={200}
                  step={1}
                  value={draft ?? round(full)}
                  aria-label={t("Full mark")}
                  title={t("Full mark")}
                  data-testid="sheet-full-mark"
                  style={{ width: `${String(draft ?? round(full)).length + 2}ch` }}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    const v = Number(e.target.value);
                    if (e.target.value.trim() !== "" && Number.isFinite(v) && v >= 1) onFullMark(v);
                  }}
                  onBlur={() => setDraft(null)}
                  className="rounded-lg bg-transparent px-1 text-center text-2xl font-medium text-ink tabular-nums outline-none [appearance:textfield] hover:bg-subtle focus:bg-subtle focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-inner-spin-button]:appearance-none"
                />
              </span>
            </span>
          </div>
          {scores.issues.map((issue, i) => (
            <button
              key={i}
              type="button"
              data-testid="sheet-issue"
              title={t("Show")}
              onClick={() => onGoTo(issue.id)}
              className="flex w-full items-start gap-1.5 rounded-xl bg-amber-50 px-2.5 py-2 text-start text-[11px] leading-snug text-amber-900 ring-1 ring-amber-200 transition-[transform,background-color] duration-100 outline-none hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.985]"
            >
              <TriangleAlert size={12} strokeWidth={2} aria-hidden className="mt-px shrink-0" />
              <span className="min-w-0 flex-1">
                {issue.kind === "two-totals"
                  ? t("Two totals in the same row: only the first counts.")
                  : t("The total you typed ({typed}) is not the marks of its row ({auto}).", { typed: formatMark(issue.typed, sheet.pad), auto: formatMark(issue.auto, sheet.pad) })}
              </span>
              <ChevronRight size={13} strokeWidth={2} aria-hidden className="mt-px shrink-0 rtl:rotate-180" />
            </button>
          ))}
          {noTotal > 0 && (
            <div className="flex flex-col gap-1.5 rounded-[5px] bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-900 ring-1 ring-amber-200" data-testid="rows-without-total">
              <p className="flex items-start gap-1.5">
                <TriangleAlert size={12} strokeWidth={2} aria-hidden className="mt-px shrink-0" />
                {noTotal === 1 ? t("One row has several marks and no total.") : t("{n} rows have several marks and no total.", { n: noTotal })}
              </p>
              <div>
                <button
                  type="button"
                  data-testid="add-totals"
                  onClick={fix.addTotals}
                  className="h-6 rounded-[5px] bg-white px-2 text-[11px] font-medium text-ink ring-1 ring-amber-300 transition-colors outline-none hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {t("Add the totals")}
                </button>
              </div>
            </div>
          )}
        </Section>

        {report?.linked && (
          <Section title={t("Rows")}>
            <SmallButton onClick={fix.refit} title={t("Wraps the answers and the copies to the answer column again, after you moved its columns or edges. The rows under make room.")}>
              {t("Fit the answers to the frame")}
            </SmallButton>
            <SmallButton onClick={fix.pack} title={t("Lays the rows out again from the first one, page after page: rows pushed to the next page come back when they fit, and empty pages go.")}>
              {t("Close up the rows")}
            </SmallButton>
          </Section>
        )}

        {/* (a copy of the exam draws its answers in the exam's color and size for model answers; on a sheet of the answers they are text blocks, restyled one by one) */}
        {report?.linked && (
          <Section title={t("Answers")}>
            <div className="flex flex-col gap-1.5">
              <span className="px-0.5 text-[11px] font-medium tracking-[-0.005em] text-muted">{t("Color of the answers")}</span>
              <ColorGrid
                value={meta.answerColor}
                autoLabel={report.template === "answers" ? t("Black") : t("Green")}
                onChange={(answerColor) => {
                  onMeta({ answerColor });
                  fix.restyle({ color: answerColor });
                }}
              />
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl bg-subtle p-1.5 ps-3">
              <span className="text-xs font-medium tracking-[-0.01em] text-ink">{t("Size of the answers")}</span>
              <div className="flex items-center gap-0.5 rounded-lg bg-white p-0.5 shadow-sm ring-1 ring-line">
                <button type="button" aria-label={t("Decrease")} disabled={size <= 9} onClick={() => setSize(size - 1)} className={stepBtn}>
                  <Minus size={14} strokeWidth={2} aria-hidden />
                </button>
                <output className="w-9 text-center text-sm font-semibold tabular-nums text-ink" data-testid="answer-size">{size}</output>
                <button type="button" aria-label={t("Increase")} disabled={size >= 28} onClick={() => setSize(size + 1)} className={stepBtn}>
                  <Plus size={14} strokeWidth={2} aria-hidden />
                </button>
              </div>
            </div>
          </Section>
        )}

        <Section title={t("Paper")}>
          <Segmented value={sheet.paper} options={papers} onChange={(paper) => onChange({ paper })} />
          <Hint>{bordered ? t("A frame with a column for the marks and one for the totals. Drag its columns and edges on the page.") : t("No frame: put the stickers and the lines where you want.")}</Hint>
        </Section>

        {bordered && (
          <>
            <Section title={t("Columns")}>
              <div className="flex items-start gap-3">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <label className="flex min-h-8 cursor-pointer items-start gap-2 text-xs leading-tight font-medium tracking-[-0.01em] text-ink select-none active:scale-[0.98] transition-transform duration-100 ease-out">
                    <input
                      type="checkbox"
                      checked={!!sheet.marks}
                      onChange={(e) => onChange({ marks: e.target.checked ? (dflt.marks && { ...dflt.marks }) : null })}
                      className="mt-px size-4 shrink-0 accent-accent"
                    />
                    <span>{t("Column of the marks")}</span>
                  </label>
                  <input
                    dir="auto"
                    value={sheet.marks?.title ?? ""}
                    disabled={!sheet.marks}
                    aria-label={t("Title of the column")}
                    placeholder={t("Title of the column")}
                    onChange={(e) => onChange({ marks: sheet.marks && { ...sheet.marks, title: e.target.value } }, "marks-title")}
                    className="h-9 w-full min-w-0 rounded-lg border border-transparent bg-subtle px-2.5 text-center text-xs font-medium tracking-[-0.01em] text-ink transition-colors duration-150 outline-none placeholder:font-normal placeholder:text-faint hover:border-line focus:border-accent focus:bg-white disabled:opacity-40 disabled:hover:border-transparent"
                  />
                </div>
                <div className="mt-0.5 w-px self-stretch bg-line" aria-hidden />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <label className="flex min-h-8 cursor-pointer items-start gap-2 text-xs leading-tight font-medium tracking-[-0.01em] text-ink select-none active:scale-[0.98] transition-transform duration-100 ease-out">
                    <input
                      type="checkbox"
                      checked={!!sheet.total}
                      onChange={(e) => onChange({ total: e.target.checked ? (dflt.total && { ...dflt.total }) : null })}
                      className="mt-px size-4 shrink-0 accent-accent"
                    />
                    <span>{t("Column of the totals")}</span>
                  </label>
                  <input
                    dir="auto"
                    value={sheet.total?.title ?? ""}
                    disabled={!sheet.total}
                    aria-label={t("Title of the column")}
                    placeholder={t("Title of the column")}
                    onChange={(e) => onChange({ total: sheet.total && { ...sheet.total, title: e.target.value } }, "total-title")}
                    className="h-9 w-full min-w-0 rounded-lg border border-transparent bg-subtle px-2.5 text-center text-xs font-medium tracking-[-0.01em] text-ink transition-colors duration-150 outline-none placeholder:font-normal placeholder:text-faint hover:border-line focus:border-accent focus:bg-white disabled:opacity-40 disabled:hover:border-transparent"
                  />
                </div>
              </div>
            </Section>

            <Section title={t("Titles of the columns")}>
              <Segmented value={sheet.headings} options={scopes} onChange={(headings) => onChange({ headings })} />
              {sheet.headings !== "none" && (
                <div className="flex flex-col gap-3 pt-1">
                  <label className="flex flex-col gap-1.5">
                    <span className="px-0.5 text-[11px] font-medium tracking-[-0.005em] text-muted">{t("Title of the answers")}</span>
                    <input
                      dir="auto"
                      value={sheet.answerTitle}
                      placeholder={t("Title of the answers")}
                      onChange={(e) => onChange({ answerTitle: e.target.value }, "answer-title")}
                      className="h-9 w-full rounded-lg border border-transparent bg-subtle px-2.5 text-xs font-medium tracking-[-0.01em] text-ink transition-colors duration-150 outline-none placeholder:font-normal placeholder:text-faint hover:border-line focus:border-accent focus:bg-white"
                    />
                  </label>
                  {sheet.marks && sheet.total && (
                  <label className="flex flex-col gap-1.5">
                    <span className="px-0.5 text-[11px] font-medium tracking-[-0.005em] text-muted">{t("Title over both columns")}</span>
                    <input
                      dir="auto"
                      value={sheet.markTitle}
                      placeholder={t("Title over both columns")}
                      onChange={(e) => onChange({ markTitle: e.target.value }, "mark-title")}
                      className="h-9 w-full rounded-lg border border-transparent bg-subtle px-2.5 text-xs font-medium tracking-[-0.01em] text-ink transition-colors duration-150 outline-none placeholder:font-normal placeholder:text-faint hover:border-line focus:border-accent focus:bg-white"
                    />
                  </label>
                  )}
                </div>
              )}
            </Section>
          </>
        )}

        <Section>
          {sure ? (
            <div className="flex flex-col gap-2">
              <Hint>{t("Delete the correction sheet? Its pages and marks go (Ctrl+Z brings them back).")}</Hint>
              <div className="flex gap-1.5">
                <SmallButton danger onClick={onDelete}>
                  {t("Delete")}
                </SmallButton>
                <SmallButton onClick={() => setSure(false)}>{t("Cancel")}</SmallButton>
              </div>
            </div>
          ) : (
            <SmallButton danger onClick={() => setSure(true)}>
              {t("Delete the correction sheet")}
            </SmallButton>
          )}
        </Section>
      </div>
    </div>
  );
}
