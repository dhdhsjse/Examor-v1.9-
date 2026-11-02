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
      className="ui-icon flex h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[5px] bg-accent px-2.5 text-xs font-semibold text-white transition-colors outline-none hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:opacity-60"
    >
      <DownloadIcon /> {ctx.shell.busy ? ctx.t("Exporting…") : ctx.t("Export PDF")}
    </button>
  ),
};
