import VersionHistory from "@/app/_components/history/VersionHistory";
import type { Feature } from "@/app/_features/core/types";

export const historyOverlay: Feature = {
  id: "overlay.history",
  kind: "overlay",
  label: "Version history",
  // (a version keeps the whole file: the exam and its correction sheet, whichever is shown)
  render: ({ ctx }) =>
    ctx.shell.history ? <VersionHistory current={ctx.shell.fullDoc} onRestore={ctx.shell.restore} onClose={ctx.shell.closeHistory} /> : null,
};
