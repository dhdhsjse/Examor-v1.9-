import ChartStudio from "@/app/_components/chart-studio/ChartStudio";
import { chartPatch, chartPreset } from "@/app/_components/chart-studio/chartPreset";
import type { Feature } from "@/app/_features/core/types";

// The Chart Studio, full screen over the app. A new chart is inserted as an image block that carries its configuration (one step of the exam's
// undo history); double-clicking the chart, or the button of its Properties panel, reopens the Studio on it, and Update puts the chart back.
export const chartStudioOverlay: Feature = {
  id: "overlay.chart-studio",
  kind: "overlay",
  label: "Chart Studio",
  render: ({ ctx }) => {
    const { chartStudio, closeChartStudio, runTool, updateBlock } = ctx.shell;
    if (!chartStudio.open) return null;
    const block = chartStudio.blockId ? ctx.doc.blocks.find((b) => b.id === chartStudio.blockId) : undefined;
    const editing = block?.type === "image" ? (block.chartStudio ?? null) : null;
    const lang = ctx.doc.meta.lang;
    return (
      <ChartStudio
        key={chartStudio.blockId ?? "new"}
        meta={ctx.doc.meta}
        editing={editing}
        onClose={closeChartStudio}
        onInsert={(config) => {
          runTool({ kind: "block", type: "image", preset: chartPreset(config, lang) });
          closeChartStudio();
        }}
        onUpdate={(config) => {
          if (block) updateBlock(block.id, chartPatch(config, lang), "chart-studio");
          closeChartStudio();
        }}
      />
    );
  },
};
