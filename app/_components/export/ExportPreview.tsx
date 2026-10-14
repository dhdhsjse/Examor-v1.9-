"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { blankAnswers } from "@/app/_lib/blockLayout";
import { isQuestion } from "@/app/_lib/blocks";
import { checkFonts, type FontReport } from "@/app/_lib/fontCheck";
import type { ExamDoc, HeaderBlock, ViewMode } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";

interface Props {
  doc: ExamDoc;
  busy: boolean; // a PDF is being written
  renderPages: (mode: ViewMode) => Promise<string[]>; // page images exactly as they go in the PDF
  onExport: (which: ViewMode | "both") => void;
  onClose: () => void;
}

type Status = "ok" | "warn" | "info";
interface Check {
  status: Status;
  title: string;
  detail?: string;
}

const ARABIC_RE = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;

// Print preview: the real pages as they will be in the PDF, plus a checklist
// (fonts, points, correction answers) before exporting.
export default function ExportPreview({ doc, busy, renderPages, onExport, onClose }: Props) {
  const t = useT();
  const [mode, setMode] = useState<ViewMode>("exam");
  const [pages, setPages] = useState<Partial<Record<ViewMode, string[]>>>({});
  const [fonts, setFonts] = useState<FontReport | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    checkFonts().then(setFonts);
  }, []);

  // Draw the pages of the chosen copy (once per copy).
  useEffect(() => {
    if (pages[mode]) return;
    let alive = true;
    renderPages(mode)
      .then((imgs) => alive && setPages((p) => ({ ...p, [mode]: imgs })))
      .catch((e) => alive && setFailed(String(e)));
    return () => {
      alive = false;
    };
    // renderPages changes on every render of the editor; the doc can't change while this is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, pages]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

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
              detail: t("Change the points, or tick “Use the total of the questions” in the header's properties."),
            },
      );
    } else {
      out.push({ status: "info", title: t("{n} questions, {total} pts in all", { n: questions.length, total }) });
    }

    // Correction sheet
    const noAnswer = questions.filter((q) => q.type === "open" && !(q.parts?.length ? q.parts.every((p) => p.answer.trim()) : q.answer.trim())).length;
    const noBlanks = questions.filter((q) => q.type === "blank" && blankAnswers(q.content).length === 0).length;
    if (noAnswer) out.push({ status: "warn", title: t("{n} open question(s) without a model answer", { n: noAnswer }), detail: t("The correction sheet will show empty lines for them.") });
    if (noBlanks) out.push({ status: "warn", title: t("{n} fill-in-the-blank question(s) without [answers]", { n: noBlanks }) });
    if (!noAnswer && !noBlanks && questions.length) out.push({ status: "ok", title: t("Every question has its answer for the correction sheet") });

    const emptyEq = doc.blocks.filter((b) => b.type === "equation" && !b.latex.trim()).length;
    if (emptyEq) out.push({ status: "info", title: t("{n} empty equation(s) — not printed", { n: emptyEq }) });
    return out;
  }, [doc, fonts, t]);

  const imgs = pages[mode];

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-900/50 p-4 backdrop-blur-sm sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div className="mx-auto flex h-full w-full max-w-6xl overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Pages */}
        <div className="flex min-w-0 flex-1 flex-col bg-canvas">
          <div className="flex items-center gap-3 border-b border-line bg-white px-5 py-3">
            <h2 className="text-base font-semibold text-ink">{t("Print preview")}</h2>
            <div className="flex rounded-md bg-subtle p-0.5 ring-1 ring-line">
              {(["exam", "key"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded px-2.5 py-1 text-xs transition-colors ${
                    mode === m ? (m === "key" ? "bg-emerald-600 font-semibold text-white" : "bg-white font-semibold text-ink shadow-sm") : "text-muted hover:text-ink"
                  }`}
                >
                  {m === "exam" ? t("Exam (student copy)") : t("Correction sheet")}
                </button>
              ))}
            </div>
            <span className="ms-auto text-xs text-muted">{t("{n} A4 page(s)", { n: doc.pages.length })}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {failed ? (
              <p className="pt-10 text-center text-sm text-red-600">{failed}</p>
            ) : !imgs ? (
              <p className="pt-10 text-center text-sm text-muted">{t("Drawing the pages…")}</p>
            ) : (
              <div className="flex flex-col items-center gap-6">
                {imgs.map((src, i) => (
                  <figure key={i} className="flex w-full max-w-[560px] flex-col items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element -- generated page image */}
                    <img src={src} alt={t("Page {n}", { n: i + 1 })} className="paper-shadow w-full bg-white" />
                    <figcaption className="text-[11px] text-muted">{t("Page {n}", { n: i + 1 })}</figcaption>
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
          <div className="flex flex-col gap-2 border-t border-line p-4">
            <button
              disabled={busy}
              onClick={() => onExport(mode)}
              className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-accent-strong disabled:opacity-60"
            >
              {busy ? t("Exporting…") : mode === "key" ? t("Export the correction sheet") : t("Export the exam")}
            </button>
            <button
              disabled={busy}
              onClick={() => onExport("both")}
              className="rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-60"
            >
              {t("Export both (2 files)")}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

const ICONS: Record<Status, { icon: string; cls: string }> = {
  ok: { icon: "✓", cls: "bg-emerald-100 text-emerald-700" },
  warn: { icon: "!", cls: "bg-amber-100 text-amber-700" },
  info: { icon: "i", cls: "bg-slate-100 text-slate-600" },
};

function CheckRow({ status, title, children }: { status: Status; title: string; children?: ReactNode }) {
  const s = ICONS[status];
  return (
    <li className="flex gap-2.5 rounded-lg bg-subtle/70 p-2.5 ring-1 ring-line">
      <span className={`grid size-5 shrink-0 place-items-center rounded-full text-[11px] font-bold ${s.cls}`}>{s.icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-snug text-ink">{title}</p>
        {children && <p className="mt-0.5 text-[11px] leading-snug text-muted">{children}</p>}
      </div>
    </li>
  );
}
