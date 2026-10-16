import ExportRenderer from "@/app/_components/canvas/ExportRenderer";
import type { Feature } from "@/app/_features/core/types";

// Draws a clean copy of the pages off-screen while an export runs.
export const exportRendererOverlay: Feature = {
  id: "overlay.export-renderer",
  kind: "overlay",
  label: "Export renderer",
  render: ({ ctx }) => {
    const job = ctx.shell.exportJob;
    return job ? <ExportRenderer key={job.mode} doc={job.doc} mode={job.mode} onReady={job.resolve} /> : null;
  },
};
