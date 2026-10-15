import type { Feature } from "@/app/_features/core/types";

// Footer of the toolbox: question count, points and page count.
export const examSummaryPanel: Feature = {
  id: "panel.exam-summary",
  kind: "panel",
  label: "Exam summary",
  render: ({ ctx }) => {
    const { questions, points, pages } = ctx.shell.stats;
    const t = ctx.t;
    return (
      <div className="flex items-center justify-between gap-2 border-t border-line px-3.5 py-2 text-[11px] text-muted">
        <span>
          <b className="font-semibold text-ink">{questions}</b> {questions === 1 ? t("question") : t("questions")}
        </span>
        <span>
          <b className="font-semibold text-ink">{points}</b> {t("pts")}
        </span>
        <span>
          <b className="font-semibold text-ink">{pages}</b> {pages === 1 ? t("page") : t("pages")}
        </span>
      </div>
    );
  },
};
