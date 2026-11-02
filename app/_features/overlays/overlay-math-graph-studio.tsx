import { graphPatch, graphPreset } from "@/app/_components/math-graph-studio/mathGraphPreset";
import MathGraphStudio from "@/app/_components/math-graph-studio/MathGraphStudio";
import type { Feature } from "@/app/_features/core/types";

// The Function Studio, full screen over the app. A new graph is inserted as an ordinary graph block (one step of the exam's undo history);
// double-clicking a graph block, or the button of its Properties panel, reopens the Studio on it, and Update puts the graph back.
export const mathGraphStudioOverlay: Feature = {
  id: "overlay.math-graph-studio",
  kind: "overlay",
  label: "Function Studio",
  render: ({ ctx }) => {
    const { mathGraphStudio, closeMathGraphStudio, runTool, updateBlock } = ctx.shell;
    if (!mathGraphStudio.open) return null;
    const block = mathGraphStudio.blockId ? ctx.doc.blocks.find((b) => b.id === mathGraphStudio.blockId) : undefined;
    const editing = block?.type === "graph" ? block : null;
    return (
      <MathGraphStudio
        key={mathGraphStudio.blockId ?? "new"}
        editing={editing}
        onClose={closeMathGraphStudio}
        onInsert={(graph) => {
          runTool({ kind: "block", type: "graph", preset: graphPreset(graph) });
          closeMathGraphStudio();
        }}
        onUpdate={(graph) => {
          if (editing) updateBlock(editing.id, graphPatch(graph), "graph-studio");
          closeMathGraphStudio();
        }}
      />
    );
  },
};
