import VersionHistory from "@/app/_components/history/VersionHistory";
import type { Feature } from "@/app/_features/core/types";

export const historyOverlay: Feature = {
  id: "overlay.history",
  kind: "overlay",
  label: "Version history",
  render: ({ ctx }) =>
    ctx.shell.history ? <VersionHistory current={ctx.doc} onRestore={ctx.shell.restore} onClose={ctx.shell.closeHistory} /> : null,
};
