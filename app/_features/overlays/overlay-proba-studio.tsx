import { probaImage, probaPreset } from "@/app/_components/proba-studio/probaPreset";
import ProbaStudio from "@/app/_components/proba-studio/ProbaStudio";
import type { Feature } from "@/app/_features/core/types";

// The Probability Studio, full screen over the app. A new drawing is inserted as an image block that carries it; double-clicking
// such a block reopens the Studio on it, and Update puts it back. Closing returns to the page. Each of Insert and Update is one
// step of the exam's undo history.
export const probaStudioOverlay: Feature = {
  id: "overlay.proba-studio",
  kind: "overlay",
  label: "Probability Studio",
  render: ({ ctx }) => {
    const { probaStudio, closeProbaStudio, runTool, updateBlock } = ctx.shell;
    if (!probaStudio.open) return null;
    const block = probaStudio.blockId ? ctx.doc.blocks.find((b) => b.id === probaStudio.blockId) : undefined;
    const editing = block?.type === "image" ? (block.probaStudio ?? null) : null;
    return (
      <ProbaStudio
        key={probaStudio.blockId ?? "new"}
        editing={editing}
        onClose={closeProbaStudio}
        onInsert={(config) => {
          const preset = probaPreset(config);
          if (preset) runTool({ kind: "block", type: "image", preset });
          closeProbaStudio();
        }}
        onUpdate={(config) => {
          const image = probaImage(config);
          if (block && image) updateBlock(block.id, { src: image.src, ratio: image.ratio, probaStudio: config, layout: { width: image.width, height: image.height } }, "probability");
          closeProbaStudio();
        }}
      />
    );
  },
};
