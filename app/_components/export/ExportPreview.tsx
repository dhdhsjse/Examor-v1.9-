"use client";

import { FileDown, FileText, Printer } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { blankAnswers } from "@/app/_lib/blockLayout";
import { isQuestion } from "@/app/_lib/blocks";
import { examFullMark } from "@/app/_lib/examMark";
import { linkReport } from "@/app/_lib/sheet/links";
import { sheetScores } from "@/app/_lib/sheet/marks";
import { viewOf } from "@/app/_lib/sheet/part";
import { checkFonts, type FontReport } from "@/app/_lib/fontCheck";
import { getPageMm } from "@/app/_lib/pageFormats";
import { MAX_VERSIONS, NO_VERSIONS, type VersionPlan } from "@/app/_lib/examVersions";
import { DEFAULT_PRINT_LAYOUT, sheetsOf, type Paper, type PerSheet, type PrintLayout } from "@/app/_lib/printLayout";
import type { ExamDoc, HeaderBlock, Page, ViewMode } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";

interface Props {
  doc: ExamDoc; // the whole file: the exam, and its correction sheet if it has one
  busy: boolean; // a PDF is being written, or the pages made for the printer
  renderCopy: (which: Copy, plan: VersionPlan) => Promise<{ images: string[]; pages: Page[] }>; // the pages exactly as they go out
  onExport: (which: Copy, layout: PrintLayout, plan: VersionPlan) => void;
  onPrint: (which: Copy, layout: PrintLayout, plan: VersionPlan) => void;
  onWord: (which: Copy, plan: VersionPlan) => void;
  onMakeSheet: () => void; // the Correction copy has nothing to show until there is a correction sheet: make it
  onClose: () => void;
}

type Status = "ok" | "warn" | "info";
interface Check {
  status: Status;
  title: string;
  detail?: string;
}

type Copy = ViewMode | "both";

// How the pages go on paper is the teacher's habit (their printer, their school): kept in this browser
const LAYOUT_KEY = "examBuilder.printLayout";
function loadLayout(): PrintLayout {
  try {
    const v = JSON.parse(localStorage.getItem(LAYOUT_KEY) ?? "null") as Partial<PrintLayout> | null;
    return { perSheet: v?.perSheet === 2 ? 2 : 1, paper: v?.paper === "A3" ? "A3" : "A4", color: v?.color !== false };
  } catch {
    return DEFAULT_PRINT_LAYOUT;
  }
}
function storeLayout(layout: PrintLayout) {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // (no storage: the choice lasts while the preview is open)
  }
}

// (the versions too: one class, its neighbours)
const VERSIONS_KEY = "examBuilder.printVersions";
function loadPlan(): VersionPlan {
  try {
    const v = JSON.parse(localStorage.getItem(VERSIONS_KEY) ?? "null") as Partial<VersionPlan> | null;
    return { count: Math.min(MAX_VERSIONS, Math.max(1, Math.round(v?.count ?? 1))), questions: v?.questions !== false, choices: v?.choices !== false };
  } catch {
    return NO_VERSIONS;
  }
}
function storePlan(plan: VersionPlan) {
  try {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(plan));
  } catch {
    // (no storage)
  }
}

const ARABIC_RE = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

// Print preview: the real pages as they will be in the PDF, plus a checklist
// (fonts, points, correction answers) before exporting.
export default function ExportPreview({ doc, busy, renderCopy, onExport, onPrint, onWord, onMakeSheet, onClose }: Props) {
  const t = useT();
  // The correction sheet as a document of its own (null: there is none, and the correction copy has nothing to show)
  const sheet = useMemo(() => (doc.correction ? viewOf(doc, "sheet") : null), [doc]);
  const [mode, setMode] = useState<Copy>("exam");
  const [plan, setPlanState] = useState<VersionPlan>(loadPlan);
  const setPlan = (patch: Partial<VersionPlan>) => {
    const next = { ...plan, ...patch };
    setPlanState(next);
    storePlan(next);
  };
  // (the correction copy, or both, with no correction sheet yet; with versions each one's correction is that version with its answers)
  const noSheet = mode !== "exam" && !sheet && plan.count <= 1;
  const [layout, setLayoutState] = useState<PrintLayout>(loadLayout);
  const setLayout = (patch: Partial<PrintLayout>) => {
    const next = { ...layout, ...patch };
    setLayoutState(next);
    storeLayout(next);
  };
  const [drawn, setDrawn] = useState<Record<string, { images: string[]; pages: Page[] }>>({});
  const key = `${mode}|${plan.count > 1 ? `${plan.count}${plan.questions ? "q" : ""}${plan.choices ? "c" : ""}` : 1}`;
  const [fonts, setFonts] = useState<FontReport | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    checkFonts().then(setFonts);
  }, []);

  // Draw the pages of the chosen copy and versions (once each).
  useEffect(() => {
    if (noSheet || drawn[key]) return;
    let alive = true;
    renderCopy(mode, plan)
      .then((out) => alive && setDrawn((d) => ({ ...d, [key]: out })))
      .catch((e) => alive && setFailed(String(e)));
    return () => {
      alive = false;
    };
    // renderCopy changes on every render of the editor; the doc can't change while this is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, noSheet]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
      // (Ctrl+P here: straight to the printer)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p" && !busy && !noSheet) {
        e.preventDefault();
        onPrint(mode, layout, plan);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose, onPrint, mode, layout, plan, noSheet]);

  const checks = useMemo(() => {
    const out: Check[] = [];
    const questions = doc.blocks.filter(isQuestion);
    const total = questions.reduce((s, q) => s + q.points, 0);
    const hasArabic = doc.meta.lang === "ar" || ARABIC_RE.test(JSON.stringify(doc.blocks.filter((b) => b.type !== "image")));

    // Fonts
    if (fonts) {
      out.push(
        fonts.latin
          ? { status: "ok", title: t("Latin font: {font}", { font: fonts.latin }) }
          : { status: "warn", title: t("No main font found"), detail: t("The text uses the system's default font.") },
      );
      if (hasArabic) {
        out.push(
          fonts.arabic
            ? { status: "ok", title: t("Arabic font: {font}", { font: fonts.arabic }), detail: t("Arabic letters are joined and drawn right-to-left — check the pages on the left.") }
            : { status: "warn", title: t("No Arabic font found"), detail: t("Arabic letters may look wrong. Install “Segoe UI” or “Tahoma”, then reopen the app.") },
        );
      }
    }
    out.push({
      status: "ok",
      title: t("Fonts are embedded in the PDF"),
      detail: t("Every page is saved as a 290 DPI picture of exactly what you see here, so it prints the same on any computer or printer — nothing to install."),
    });

    // Points
    const header = doc.blocks.find((b): b is HeaderBlock => b.type === "header");
    if (header) {
      const outOf = header.fields.autoOutOf && total > 0 ? total : header.fields.outOf;
      out.push(
        total === outOf
          ? { status: "ok", title: t("Points: {total} = graded out of {outOf}", { total, outOf }) }
          : {
              status: "warn",
              title: t("Questions add up to {total} pts, the header says /{outOf}", { total, outOf }),
              detail: t("Change the points, or tick “Use the total of the questions” in Page layout → Header and footer."),
            },
      );
    } else {
      out.push({ status: "info", title: questions.length === 1 ? t("1 question, {total} pts in all", { total }) : t("{n} questions, {total} pts in all", { n: questions.length, total }) });
    }

    // Correction sheet: the marks of its stickers against the full mark of the exam
    if (sheet) {
      const scores = sheetScores(sheet, sheet.sheet?.autoTotals !== false);
      const outOf = examFullMark(doc);
      const report = linkReport(doc);
      out.push(
        scores.rows.length === 0
          ? { status: "info", title: t("The correction sheet has no marks yet") }
          : scores.total === outOf
            ? { status: "ok", title: t("Correction sheet: {total} = graded out of {outOf}", { total: scores.total, outOf }) }
            : {
                status: "warn",
                title: t("The correction sheet adds up to {total} pts, the exam is out of {outOf}", { total: scores.total, outOf }),
                detail: t("Change the marks of the stickers, or the full mark of the exam."),
              },
      );
      // (made from the exam: its marks against the points of the questions, and the questions it lacks)
      if (report?.diffs.length) out.push({ status: "warn", title: t("{n} question(s) have other marks in the correction sheet than the points in the exam", { n: report.diffs.length }), detail: t("Open the correction sheet: its settings show which, and how to make them agree.") });
      if (report?.missing.length) out.push({ status: "warn", title: t("{n} question(s) of the exam are not in the correction sheet", { n: report.missing.length }) });
      if (report?.stale.length) out.push({ status: "warn", title: t("{n} block(s) of the correction sheet changed in the exam since it was made", { n: report.stale.length }), detail: t("Open the correction sheet: its settings bring them up to date.") });
    } else {
      // Correction sheet (the exam with its answers)
      const noAnswer = questions.filter((q) => q.type === "open" && !(q.parts?.length ? q.parts.every((p) => p.answer.trim()) : q.answer.trim())).length;
      const noBlanks = questions.filter((q) => q.type === "blank" && blankAnswers(q.content).length === 0).length;
      if (noAnswer) out.push({ status: "warn", title: t("{n} open question(s) without a model answer", { n: noAnswer }), detail: t("The correction sheet will show empty lines for them.") });
      if (noBlanks) out.push({ status: "warn", title: t("{n} fill-in-the-blank question(s) without [answers]", { n: noBlanks }) });
      if (!noAnswer && !noBlanks && questions.length) out.push({ status: "ok", title: t("Every question has its answer for the correction sheet") });
    }

    const emptyEq = doc.blocks.filter((b) => b.type === "equation" && !b.latex.trim()).length;
    if (emptyEq) out.push({ status: "info", title: t("{n} empty equation(s) — not printed", { n: emptyEq }) });
    return out;
  }, [doc, sheet, fonts, t]);

  // the pages of the copy shown, their images (none: not drawn yet), and the sheets of paper they go on
  const imgs = drawn[key]?.images;
  const printed: Page[] = useMemo(() => drawn[key]?.pages ?? [], [drawn, key]);
  const sheets = useMemo(() => sheetsOf(printed.map((p) => getPageMm(p.format)), layout, doc.meta.lang === "ar"), [printed, layout, doc.meta.lang]);

  return (
    <div className="fixed inset-0 z-50 flex bg-black/50 p-4 backdrop-blur-sm sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="mx-auto flex h-full w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Pages */}
        <div className="flex min-w-0 flex-1 flex-col bg-canvas">
          <div className="flex items-center gap-3 border-b border-line bg-white px-5 py-3">
            <h2 className="text-base font-semibold text-ink">{t("Print preview")}</h2>
            <div className="flex rounded-md bg-subtle p-0.5 ring-1 ring-line">
              {(["exam", "key", "both"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    mode === m ? (m === "key" ? "bg-emerald-600 font-semibold text-white" : "bg-white font-semibold text-ink shadow-sm") : "text-muted hover:text-ink"
                  }`}
                >
                  {m === "exam" ? t("Exam (student copy)") : m === "key" ? t("Correction sheet") : t("Both")}
                </button>
              ))}
            </div>
            <span className="ms-auto text-xs text-muted" data-testid="preview-count">
              {layout.perSheet === 2
                ? t("{n} sheet(s) of {paper}", { n: sheets.length, paper: layout.paper })
                : t(printed.every((p) => !p.format || (p.format.size === "A4" && p.format.orientation === "portrait")) ? "{n} A4 page(s)" : "{n} page(s)", { n: printed.length })}
            </span>
          </div>
          <div data-paper="" className="studio-desk flex-1 overflow-y-auto p-6">
            {noSheet ? (
              <div className="mx-auto mt-10 flex max-w-sm flex-col items-center gap-3 text-center" data-testid="preview-no-sheet">
                <p className="text-sm font-semibold text-ink">{t("There is no correction sheet yet")}</p>
                <p className="text-xs text-muted">{t("Make it first: it is printed here, with the marks beside the answers.")}</p>
                <button type="button" onClick={onMakeSheet} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700">
                  {t("Make the correction sheet…")}
                </button>
              </div>
            ) : failed ? (
              <p className="pt-10 text-center text-sm text-red-700">{failed}</p>
            ) : !imgs ? (
              <p className="pt-10 text-center text-sm text-muted">{t("Drawing the pages…")}</p>
            ) : (
              <div className="flex flex-col items-center gap-6" data-testid="preview-sheets">
                {sheets.map((s, i) => (
                  <figure key={i} className={`flex w-full flex-col items-center gap-1.5 ${s.width > s.height ? "max-w-[760px]" : "max-w-[560px]"}`}>
                    <div className="paper-shadow relative w-full overflow-hidden bg-white" style={{ aspectRatio: `${s.width} / ${s.height}` }} data-testid="preview-sheet">
                      {s.slots.map((slot) => (
                        // eslint-disable-next-line @next/next/no-img-element -- generated page image
                        <img
                          key={slot.page}
                          src={imgs[slot.page]}
                          alt={t("Page {n}", { n: slot.page + 1 })}
                          className={`absolute ${s.slots.length > 1 ? "ring-1 ring-black/10" : ""} ${layout.color ? "" : "grayscale"}`}
                          style={{ left: `${(slot.x / s.width) * 100}%`, top: `${(slot.y / s.height) * 100}%`, width: `${(slot.width / s.width) * 100}%`, height: `${(slot.height / s.height) * 100}%` }}
                        />
                      ))}
                    </div>
                    <figcaption className="text-xs text-muted">
                      {s.slots.length > 1 ? t("Pages {a}–{b}", { a: s.slots[0].page + 1, b: s.slots[s.slots.length - 1].page + 1 }) : t("Page {n}", { n: s.slots[0].page + 1 })}
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Checks + export */}
        <aside className="flex w-[320px] shrink-0 flex-col border-s border-line">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <h3 className="text-sm font-semibold text-ink">{t("Before you print")}</h3>
            <button onClick={onClose} disabled={busy} className="grid size-7 place-items-center rounded-md text-muted hover:bg-subtle hover:text-ink" title={t("Close (Esc)")}>
              ✕
            </button>
          </div>
          <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            {!fonts && <li className="text-xs text-muted">{t("Checking fonts…")}</li>}
            {checks.map((c, i) => (
              <CheckRow key={i} status={c.status} title={c.title}>
                {c.detail}
              </CheckRow>
            ))}
          </ul>
          <div className="flex flex-col gap-3 border-t border-line p-4">
            <Choice label={t("Versions")}>
              {Array.from({ length: MAX_VERSIONS }, (_, i) => i + 1).map((n) => (
                <Seg key={n} on={plan.count === n} onClick={() => setPlan({ count: n })} testId={`versions-${n}`}>
                  {n}
                </Seg>
              ))}
            </Choice>
            {plan.count > 1 && (
              <div className="flex flex-col gap-1.5">
                <Switch on={plan.questions} onChange={(on) => setPlan({ questions: on })} testId="mix-questions">
                  {t("Mix the questions")}
                </Switch>
                <Switch on={plan.choices} onChange={(on) => setPlan({ choices: on })} testId="mix-choices">
                  {t("Mix the answers")}
                </Switch>
              </div>
            )}
            <Choice label={t("Print in")}>
              <Seg on={layout.color} onClick={() => setLayout({ color: true })} testId="print-color">
                {t("Color")}
              </Seg>
              <Seg on={!layout.color} onClick={() => setLayout({ color: false })} testId="print-gray">
                {t("Black & white")}
              </Seg>
            </Choice>
            <Choice label={t("Pages per sheet")}>
              {([1, 2] as PerSheet[]).map((n) => (
                <Seg key={n} on={layout.perSheet === n} onClick={() => setLayout({ perSheet: n })} testId={`per-sheet-${n}`}>
                  {n}
                </Seg>
              ))}
            </Choice>
            {layout.perSheet === 2 && (
              <Choice label={t("Paper")}>
                {(["A4", "A3"] as Paper[]).map((p) => (
                  <Seg key={p} on={layout.paper === p} onClick={() => setLayout({ paper: p })} testId={`paper-${p}`}>
                    {p}
                  </Seg>
                ))}
              </Choice>
            )}
            <div className="flex gap-2">
              <button
                disabled={busy || noSheet}
                onClick={() => onPrint(mode, layout, plan)}
                data-testid="preview-print"
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-strong disabled:opacity-60"
              >
                <Printer size={15} aria-hidden />
                {busy ? t("Preparing…") : t("Print")}
              </button>
              <button
                disabled={busy || noSheet}
                onClick={() => onExport(mode, layout, plan)}
                title={t("Save as PDF")}
                data-testid="preview-export"
                className="flex items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60"
              >
                <FileDown size={15} aria-hidden />
                PDF
              </button>
              <button
                disabled={busy || noSheet}
                onClick={() => onWord(mode, plan)}
                title={t("Save as a Word document (editable)")}
                data-testid="preview-word"
                className="flex items-center justify-center gap-1.5 rounded-md border border-line px-3 py-2 text-sm font-medium text-ink hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60"
              >
                <FileText size={15} aria-hidden />
                Word
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Choice({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-ink">{label}</span>
      <div className="flex rounded-md bg-subtle p-0.5 ring-1 ring-line">{children}</div>
    </div>
  );
}

function Seg({ on, onClick, testId, children }: { on: boolean; onClick: () => void; testId: string; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} data-testid={testId} className={`min-w-9 rounded px-2.5 py-1 text-xs transition-colors ${on ? "bg-white font-semibold text-ink shadow-sm" : "text-muted hover:text-ink"}`}>
      {children}
    </button>
  );
}

function Switch({ on, onChange, testId, children }: { on: boolean; onChange: (on: boolean) => void; testId: string; children: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-xs text-ink">
      {children}
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} data-testid={testId} className="size-3.5 accent-[var(--color-accent)]" />
    </label>
  );
}

const ICONS: Record<Status, { icon: string; cls: string }> = {
  ok: { icon: "✓", cls: "bg-emerald-100 text-emerald-700" },
  warn: { icon: "!", cls: "bg-amber-100 text-amber-700" },
  info: { icon: "i", cls: "bg-slate-100 text-slate-700" },
};

function CheckRow({ status, title, children }: { status: Status; title: string; children?: ReactNode }) {
  const s = ICONS[status];
  return (
    <li className="flex gap-2.5 rounded-lg bg-subtle/70 p-2.5 ring-1 ring-line">
      <span className={`grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold ${s.cls}`}>{s.icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-snug text-ink">{title}</p>
        {children && <p className="mt-0.5 text-xs leading-snug text-muted">{children}</p>}
      </div>
    </li>
  );
}
