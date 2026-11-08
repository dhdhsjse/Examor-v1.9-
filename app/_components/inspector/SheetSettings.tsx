"use client";

import { ChevronDown, MoreHorizontal, TriangleAlert } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DEFAULT_SIZE } from "@/app/_lib/blockLayout";
import type { SheetFix, SheetReport } from "@/app/_lib/sheet/links";
import { formatMark } from "@/app/_lib/sheet/marks";
import type { SheetScores } from "@/app/_lib/sheet/marks";
import { defaultSheet, type HeadingScope, type SheetConfig, type SheetPaper } from "@/app/_lib/sheet/model";
import { marksForTotal } from "@/app/_lib/sheet/totals";
import type { ExamMeta } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import Dropdown, { type MenuItem } from "@/app/_features/core/Dropdown";
import { ColorGrid } from "../rich/FormatBar";
import { MenuSelect, Segmented, SmallButton, Stepper } from "./fields";

const round = (n: number) => Math.round(n * 1000) / 1000;

// A group of settings, divided from the next by a line (same as the exam's settings).
function Section({ title, children }: { title?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 px-3 py-2">
      {title && <h3 className="flex h-5 items-center gap-1.5 text-xs font-semibold text-ink">{title}</h3>}
      {children}
    </section>
  );
}

// A label on the left, its control on the right (every row of the frame block is one of these, 32px high).
function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-h-8 items-center justify-between gap-3" role="group" aria-label={label}>
      <span className="shrink-0 text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

// An on/off setting: a small switch (the emerald of the correction sheet when on).
function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      role="switch"
      checked={checked}
      aria-label={label}
      onChange={(e) => onChange(e.target.checked)}
      className="relative h-4 w-7 shrink-0 cursor-pointer appearance-none rounded-full bg-muted/40 transition-colors outline-none before:absolute before:top-0.5 before:left-0.5 before:size-3 before:rounded-full before:bg-[#fff] before:shadow-sm before:transition-transform before:content-[''] checked:bg-emerald-600 checked:before:translate-x-3 focus-visible:ring-2 focus-visible:ring-accent rtl:before:right-0.5 rtl:before:left-auto rtl:checked:before:-translate-x-3"
    />
  );
}

// (the frame block is closed at first; once opened it stays open while the app is, even when the panel shows something else for a while)
let frameOpen = false;

// Something on the sheet that needs a look, and the buttons that fix it (or show it).
interface Check {
  key: string;
  text: string;
  hint?: string;
  actions: { label: string; run: () => void }[];
}

const actionBtn =
  "h-5 shrink-0 rounded-[4px] px-1.5 text-[11px] font-medium text-accent transition-colors outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent";

// The right panel while the correction sheet is shown and nothing is selected. Most used first: what the marks add up to, what needs a look (and
// the button that fixes it), the rows (fit the answers to the frame, close them up), the frame, the look. Make it again and delete are in the ⋯ menu.
export default function SheetSettings({ sheet, scores, full, onFullMark, onGoTo, meta, report, fix, onChange, onMeta, onRemake, onDelete }: {
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
  onRemake: () => void;
  onDelete: () => void;
}) {
  const t = useT();
  const [sure, setSure] = useState(false);
  const [open, setOpen] = useState(frameOpen);
  const [draft, setDraft] = useState<string | null>(null); // the full mark as it is being typed
  const bordered = sheet.paper === "bordered";
  const dflt = defaultSheet(meta.lang);
  const linked = !!report?.linked;
  const fromExam = linked && report.template !== "blank";
  const over = scores.total > full;
  const ok = scores.rows.length > 0 && Math.abs(scores.total - full) < 1e-6;
  const size = meta.answerSize ?? meta.fontSize ?? DEFAULT_SIZE;
  const fmt = (v: number) => formatMark(v, sheet.pad);
  const qs = (ns: number[]) => ns.map((n) => t("Q{n}", { n })).join(" + ");

  // ---- What needs a look ----
  // (a short line each; the full sentence shows on hover)
  const checks: Check[] = [];
  scores.issues.forEach((issue, i) =>
    checks.push(
      issue.kind === "two-totals"
        ? {
            key: `issue-${i}`,
            text: t("2 totals in one row"),
            hint: t("Two totals in the same row: only the first counts."),
            actions: [{ label: t("Show"), run: () => onGoTo(issue.id) }],
          }
        : {
            key: `issue-${i}`,
            text: t("Total {typed} ≠ marks {auto}", { typed: fmt(issue.typed), auto: fmt(issue.auto) }),
            hint: t("The total you typed ({typed}) is not the marks of its row ({auto}).", { typed: fmt(issue.typed), auto: fmt(issue.auto) }),
            actions: [{ label: t("Show"), run: () => onGoTo(issue.id) }],
          },
    ),
  );
  // (rows that show no total: one was deleted, or the marks were stamped one by one; on free paper only a row of several marks asks for one)
  const least = marksForTotal(sheet);
  const noTotal = sheet.total ? scores.rows.filter((r) => r.totals.length === 0 && r.marks.filter((m) => m.kind === "number").length >= least).length : 0;
  if (noTotal > 0)
    checks.push({
      key: "no-total",
      text: noTotal === 1 ? t("1 row without total") : t("{n} rows without total", { n: noTotal }),
      actions: [{ label: t("Add"), run: fix.addTotals }],
    });
  if (report && fromExam) {
    if (report.missing.length) {
      const list = qs(report.missing.map((m) => m.n));
      checks.push({
        key: "missing",
        text: t("Missing: {qs}", { qs: list }),
        hint: t("Not on the sheet yet: {qs}", { qs: list }),
        actions: [{ label: t("Add"), run: () => fix.addMissing() }],
      });
    }
    if (report.stale.length) {
      const n = report.stale.length;
      checks.push({
        key: "stale",
        text: n === 1 ? t("1 answer changed") : t("{n} answers changed", { n }),
        hint: n === 1 ? t("One answer changed in the exam since the sheet was made.") : t("{n} answers changed in the exam since the sheet was made.", { n }),
        actions: [{ label: t("Update"), run: () => fix.refresh() }],
      });
    }
  }
  if (report && linked) {
    for (const d of report.diffs) {
      const ids = d.questions.map((q) => q.id);
      const vals = { qs: qs(d.questions.map((q) => q.n)), sheet: fmt(d.sheet), exam: fmt(d.exam) };
      checks.push({
        key: `diff-${ids.join("-")}`,
        text: t("{qs}: sheet {sheet}, exam {exam}", vals),
        hint: t("{qs}: {sheet} on the sheet, {exam} in the exam", vals),
        actions: [
          { label: t("Use exam"), run: () => fix.resetMarks(ids) },
          ...(d.adoptable ? [{ label: t("Use sheet"), run: () => fix.adoptMarks(ids) }] : []),
        ],
      });
    }
    if (report.orphans.length) {
      const n = report.orphans.length;
      checks.push({
        key: "orphans",
        text: n === 1 ? t("1 row of a deleted question") : t("{n} rows of deleted questions", { n }),
        hint: n === 1 ? t("One row is of a question the exam no longer has.") : t("{n} rows are of questions the exam no longer has.", { n }),
        actions: [{ label: t("Remove"), run: fix.removeOrphans }],
      });
    }
  }

  // ---- The ⋯ menu ----
  const menu: MenuItem[] = [
    { label: t("Make it again…"), onClick: onRemake },
    { label: t("Delete the correction sheet…"), separator: true, onClick: () => setSure(true) },
  ];

  const papers: { value: SheetPaper; label: string }[] = [
    { value: "bordered", label: t("Bordered") },
    { value: "free", label: t("Free paper") },
  ];
  const scopes: { value: HeadingScope; label: string }[] = [
    { value: "first", label: t("First page") },
    { value: "all", label: t("Every page") },
    { value: "none", label: t("None") },
  ];
  const tone = over ? "text-red-700" : ok ? "text-emerald-700" : "text-ink";

  return (
    <div className="flex flex-col" data-testid="sheet-settings">
      <div className="flex h-8 items-center justify-between gap-2 border-b border-line ps-3 pe-1">
        <h2 className="truncate text-xs font-semibold text-ink">{t("Correction sheet")}</h2>
        <Dropdown
          alignEnd
          items={menu}
          className="[&>button]:w-7 [&>button]:justify-center [&>button]:px-0 [&>button]:text-muted [&>button:hover]:text-ink"
          trigger={
            <>
              <span className="sr-only">{t("More")}</span>
              <MoreHorizontal size={16} strokeWidth={1.5} aria-hidden />
            </>
          }
        />
      </div>

      {sure && (
        <div className="flex flex-col gap-1.5 border-b border-line bg-red-50 px-3 py-2" role="alertdialog" aria-label={t("Delete the correction sheet…")}>
          <p className="text-xs leading-snug text-red-900">{t("Delete the correction sheet? Its pages and marks go (Ctrl+Z brings them back).")}</p>
          <div className="flex gap-1.5">
            <button type="button" onClick={onDelete} className="h-6 rounded-[5px] bg-red-600 px-2 text-xs font-medium text-white outline-none hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-accent">
              {t("Delete")}
            </button>
            <button type="button" onClick={() => setSure(false)} className="h-6 rounded-[5px] px-2 text-xs font-medium text-ink outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent">
              {t("Cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col divide-y divide-line">
        {/* What the marks add up to, out of the full mark (typed here), big in the middle */}
        <Section>
          <div className="flex justify-center py-2">
            <span
              data-testid="sheet-total-line"
              className={`flex items-baseline gap-2 text-4xl font-semibold tracking-[-0.03em] tabular-nums ${tone}`}
              title={over ? t("The marks add up to more than the full mark!") : t("What the marks of the sheet add up to / the full mark of the exam")}
            >
              {over && <TriangleAlert size={20} strokeWidth={2} aria-hidden className="self-center" />}
              <span data-testid="sheet-total">{fmt(scores.total)}</span>
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
        </Section>

        {/* (any sheet: its answers wrapped to the frame again, its rows closed up) */}
        <Section title={t("Rows")}>
          <SmallButton onClick={fix.refit} title={t("Wraps the answers and the copies to the answer column again, after you moved its columns or edges. The rows under make room.")}>
            {t("Fit the answers to the frame")}
          </SmallButton>
          <SmallButton onClick={fix.pack} title={t("Lays the rows out again from the first one, page after page: rows pushed to the next page come back when they fit, and empty pages go.")}>
            {t("Close up the rows")}
          </SmallButton>
        </Section>

        {checks.length > 0 && (
          <section className="flex flex-col px-3 py-1.5" aria-label={t("To check")}>
            <h3 className="flex h-5 items-center gap-1 text-[11px] font-medium text-muted">
              <TriangleAlert size={11} strokeWidth={2} aria-hidden className="text-amber-600" />
              {t("To check")}
              <span className="tabular-nums text-faint">· {checks.length}</span>
            </h3>
            <ul className="flex flex-col" data-testid="sheet-checks">
              {checks.map((c) => (
                <li key={c.key} data-testid="sheet-issue" className="flex min-h-6 items-center gap-1.5">
                  <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span className="min-w-0 flex-1 truncate text-xs text-ink" title={c.hint ?? c.text}>
                    {c.text}
                  </span>
                  {c.actions.map((a) => (
                    <button key={a.label} type="button" onClick={a.run} className={actionBtn} data-testid={c.key === "no-total" ? "add-totals" : undefined}>
                      {a.label}
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* The frame and the look of the answers: one block, closed at first (set once, seldom touched again) */}
        <section aria-label={t("Frame")} className="px-3 py-2">
          <button
            type="button"
            aria-expanded={open}
            data-testid="sheet-frame-toggle"
            onClick={() => {
              frameOpen = !open;
              setOpen(!open);
            }}
            className="flex h-5 w-full items-center justify-between gap-2 rounded-[4px] text-xs font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("Frame")}
            <span className="flex min-w-0 items-center gap-1.5 font-normal text-faint">
              {!open && <span className="truncate">{bordered ? t("Bordered") : t("Free paper")}</span>}
              <ChevronDown size={12} strokeWidth={2} aria-hidden className={`shrink-0 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
            </span>
          </button>

          {open && (
            <div className="flex flex-col pt-1" data-testid="sheet-frame">
              <Row label={t("Paper")}>
                <div className="w-40">
                  <Segmented value={sheet.paper} options={papers} onChange={(paper) => onChange({ paper })} />
                </div>
              </Row>
              {bordered && (
                <>
                  <Row label={t("Marks column")}>
                    <Switch checked={!!sheet.marks} label={t("Marks column")} onChange={(on) => onChange({ marks: on ? dflt.marks && { ...dflt.marks } : null })} />
                  </Row>
                  <Row label={t("Totals column")}>
                    <Switch checked={!!sheet.total} label={t("Totals column")} onChange={(on) => onChange({ total: on ? dflt.total && { ...dflt.total } : null })} />
                  </Row>
                  <Row label={t("Column titles")}>
                    <MenuSelect value={sheet.headings} options={scopes} label={t("Column titles")} onChange={(headings) => onChange({ headings })} />
                  </Row>
                </>
              )}

              {/* (a copy of the exam draws its answers in the exam's color and size for model answers; on a sheet of the answers they are text blocks, restyled one by one) */}
              {linked && report && (
                <>
                  <div className="my-1 h-px bg-line" />
                  <Row label={t("Answer size")}>
                    <span data-testid="answer-size">
                      <Stepper
                        value={size}
                        min={9}
                        max={28}
                        onChange={(v) => {
                          onMeta({ answerSize: v }, "answerSize");
                          fix.restyle({ size: v });
                        }}
                      />
                    </span>
                  </Row>
                  <div className="flex flex-col gap-1.5 pt-1 pb-0.5" role="group" aria-label={t("Answer color")}>
                    <span className="text-xs text-muted">{t("Answer color")}</span>
                    <ColorGrid
                      value={meta.answerColor}
                      autoLabel={report.template === "answers" ? t("Black") : t("Green")}
                      onChange={(answerColor) => {
                        onMeta({ answerColor });
                        fix.restyle({ color: answerColor });
                      }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
