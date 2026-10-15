import { DownloadIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";

// Export always goes through the print preview.
export const exportButtonPanel: Feature = {
  id: "panel.export",
  kind: "panel",
  label: "Export PDF",
  hotkey: "Ctrl+P",
  render: ({ ctx }) => (
    <button
      disabled={ctx.shell.busy}
      onClick={ctx.shell.showPreview}
      title={`${ctx.t("Print preview & export…")} (Ctrl+P)`}
      className="flex h-7 items-center gap-1.5 rounded-md bg-accent px-3 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-accent-strong disabled:opacity-60"
    >
      <DownloadIcon /> {ctx.shell.busy ? ctx.t("Exporting…") : ctx.t("Export PDF")}
    </button>
  ),
};
