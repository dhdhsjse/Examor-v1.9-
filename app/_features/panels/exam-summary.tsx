import { TriangleAlert } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import { fullMark } from "@/app/_lib/blocks";

const round = (n: number) => Math.round(n * 100) / 100;

// Status bar at the foot of the toolbox: question count, points / full mark, page count.
// The points turn green when they match the full mark and red when they go over it.
export const examSummaryPanel: Feature = {
  id: "panel.exam-summary",
  kind: "panel",
  label: "Exam summary",
  render: ({ ctx }) => {
    const { questions, points, pages, sheet } = ctx.shell.stats;
    // (on the correction sheet: the exam's full mark, and the rows that carry a mark instead of the questions)
    const full = ctx.shell.stats.full ?? fullMark(ctx.doc).value;
    const t = ctx.t;
    const over = points > full;
    const tone = over ? "text-red-700" : points === full ? "text-emerald-700" : "text-ink";
    // (on the correction sheet: what differs from the exam — answers that changed, marks, questions that are missing or gone)
    const report = sheet ? ctx.shell.sheetReport : null;
    const todo = report ? report.stale.length + report.missing.length + report.diffs.length + report.orphans.length : 0;
    return (
      <div className="flex h-8 items-center justify-between gap-2 border-t border-line bg-surface px-3 text-xs whitespace-nowrap text-muted" data-testid="exam-summary">
        <span>
          <b className="font-semibold text-ink">{questions}</b> {sheet ? (questions === 1 ? t("row") : t("rows")) : questions === 1 ? t("question") : t("questions")}
        </span>
        {todo > 0 && (
          <button
            type="button"
            data-testid="sheet-todo"
            aria-label={t("{n} to check", { n: todo })}
            title={t("The sheet and the exam differ: its settings show how to bring them in step.")}
            onClick={() => ctx.shell.selectNone()}
            className="flex items-center gap-1 rounded bg-amber-50 px-1.5 font-semibold text-amber-800 tabular-nums ring-1 ring-amber-200 outline-none hover:bg-amber-100 focus-visible:ring-2 focus-visible:ring-accent"
          >
            <TriangleAlert size={11} strokeWidth={2} aria-hidden />
            {todo}
          </button>
        )}
        <span
          className={over ? "flex items-center gap-1 rounded bg-red-50 px-1 ring-1 ring-red-200" : undefined}
          title={sheet ? (over ? t("The marks add up to more than the full mark!") : t("What the marks of the sheet add up to / the full mark of the exam")) : over ? t("The questions add up to more than the full mark!") : t("Points of all the questions / full mark")}
        >
          {over && <TriangleAlert size={11} strokeWidth={2} className="text-red-700" aria-hidden />}
          <b className={`font-semibold tabular-nums ${tone}`}>
            {round(points)}/{round(full)}
          </b>{" "}
          {t("pts")}
        </span>
        <span>
          <b className="font-semibold text-ink">{pages}</b> {pages === 1 ? t("page") : t("pages")}
        </span>
      </div>
    );
  },
};
