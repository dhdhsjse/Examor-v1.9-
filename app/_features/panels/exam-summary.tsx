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
    const { questions, points, pages } = ctx.shell.stats;
    const full = fullMark(ctx.doc).value;
    const t = ctx.t;
    const over = points > full;
    const tone = over ? "text-red-700" : points === full ? "text-emerald-700" : "text-ink";
    return (
      <div className="flex h-8 items-center justify-between gap-2 border-t border-line bg-surface px-3 text-[11px] whitespace-nowrap text-muted">
        <span>
          <b className="font-semibold text-ink">{questions}</b> {questions === 1 ? t("question") : t("questions")}
        </span>
        <span
          className={over ? "flex items-center gap-1 rounded bg-red-50 px-1 ring-1 ring-red-200" : undefined}
          title={over ? t("The questions add up to more than the full mark!") : t("Points of all the questions / full mark")}
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
