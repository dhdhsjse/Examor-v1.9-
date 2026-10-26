import { graphImage, graphPreset } from "@/app/_components/graph-studio/graphPreset";
import GraphStudio from "@/app/_components/graph-studio/GraphStudio";
import type { Feature } from "@/app/_features/core/types";

// The Graph Studio, full screen over the app. A new graph is inserted as an image block that carries its configuration;
// double-clicking such a block reopens the Studio on it, and Update puts the graph back. Closing returns to the page.
// Each of Insert and Update is one step of the exam's undo history.
export const graphStudioOverlay: Feature = {
  id: "overlay.graph-studio",
  kind: "overlay",
  label: "Graph Studio",
  render: ({ ctx }) => {
    const { graphStudio, closeGraphStudio, runTool, updateBlock } = ctx.shell;
    if (!graphStudio.open) return null;
    const block = graphStudio.blockId ? ctx.doc.blocks.find((b) => b.id === graphStudio.blockId) : undefined;
    const editing = block?.type === "image" ? (block.graphStudio ?? null) : null;
    return (
      <GraphStudio
        key={graphStudio.blockId ?? "new"}
        editing={editing}
        onClose={closeGraphStudio}
        onInsert={(config, view) => {
          const preset = graphPreset(config, view);
          if (preset) runTool({ kind: "block", type: "image", preset });
          closeGraphStudio();
        }}
        onUpdate={(config, view) => {
          const image = graphImage(config, view);
          if (block && image) updateBlock(block.id, { src: image.src, ratio: image.ratio, graphStudio: config, layout: { width: image.width, height: image.height } }, "graph");
          closeGraphStudio();
        }}
      />
    );
  },
};
