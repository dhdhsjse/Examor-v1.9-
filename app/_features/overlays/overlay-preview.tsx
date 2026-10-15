import ExportPreview from "@/app/_components/export/ExportPreview";
import type { Feature } from "@/app/_features/core/types";

export const previewOverlay: Feature = {
  id: "overlay.preview",
  kind: "overlay",
  label: "Print preview",
  render: ({ ctx }) =>
    ctx.shell.preview ? (
      <ExportPreview
        doc={ctx.doc}
        busy={ctx.shell.busy}
        renderPages={(m) => ctx.shell.renderPages(m, 1.25, 0.85)}
        onExport={(w) => ctx.shell.exportPdf(w)}
        onClose={ctx.shell.closePreview}
      />
    ) : null,
};
