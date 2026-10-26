import { circuitImage, circuitPreset } from "@/app/_components/circuit-studio/circuitPreset";
import CircuitStudio from "@/app/_components/circuit-studio/CircuitStudio";
import type { Feature } from "@/app/_features/core/types";

// The Circuit Studio, full screen over the app. A new circuit is inserted as an image block that carries its drawing; double-
// clicking such a block reopens the Studio on it, and Update puts the circuit back. Closing returns to the page. Each of Insert
// and Update is one step of the exam's undo history.
export const circuitStudioOverlay: Feature = {
  id: "overlay.circuit-studio",
  kind: "overlay",
  label: "Circuit Studio",
  render: ({ ctx }) => {
    const { circuitStudio, closeCircuitStudio, runTool, updateBlock } = ctx.shell;
    if (!circuitStudio.open) return null;
    const block = circuitStudio.blockId ? ctx.doc.blocks.find((b) => b.id === circuitStudio.blockId) : undefined;
    const editing = block?.type === "image" ? (block.circuitStudio ?? null) : null;
    return (
      <CircuitStudio
        key={circuitStudio.blockId ?? "new"}
        editing={editing}
        onClose={closeCircuitStudio}
        onInsert={(config) => {
          const preset = circuitPreset(config);
          if (preset) runTool({ kind: "block", type: "image", preset });
          closeCircuitStudio();
        }}
        onUpdate={(config) => {
          const image = circuitImage(config);
          if (block && image) updateBlock(block.id, { src: image.src, ratio: image.ratio, circuitStudio: config, layout: { width: image.width, height: image.height } }, "circuit");
          closeCircuitStudio();
        }}
      />
    );
  },
};
