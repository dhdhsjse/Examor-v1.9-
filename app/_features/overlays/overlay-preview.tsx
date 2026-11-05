import ExportPreview from "@/app/_components/export/ExportPreview";
import type { Feature } from "@/app/_features/core/types";

export const previewOverlay: Feature = {
  id: "overlay.preview",
  kind: "overlay",
  label: "Print preview",
  render: ({ ctx }) => {
    if (!ctx.shell.preview) return null;
    // (what is checked and printed is the whole file, whichever of the exam and its correction sheet is shown)
    const { fullDoc } = ctx.shell;
    return (
      <ExportPreview
        doc={fullDoc}
        busy={ctx.shell.busy}
        renderPages={(m) => ctx.shell.renderPages(m, 1.25, 0.85)}
        onExport={(w) => ctx.shell.exportPdf(w)}
        onMakeSheet={() => {
          ctx.shell.closePreview();
          ctx.shell.openSheetWizard(false);
        }}
        onClose={ctx.shell.closePreview}
      />
    );
  },
};
