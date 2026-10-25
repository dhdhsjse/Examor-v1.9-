import { drawingImage, drawingPreset } from "@/app/_components/molecule-studio/drawingPreset";
import MoleculeStudio from "@/app/_components/molecule-studio/MoleculeStudio";
import { moleculePreset } from "@/app/_components/molecule/moleculePreset";
import type { Feature } from "@/app/_features/core/types";

// The drawing Studio, full screen over the app. A new drawing is inserted as an image block that carries
// its graph; double-clicking such a block reopens the Studio on it, and Update puts the drawing back.
// Closing returns to the page. Each of Insert and Update is one step of the exam's undo history.
export const moleculeLabOverlay: Feature = {
  id: "overlay.molecule-lab",
  kind: "overlay",
  label: "Molecule Studio",
  render: ({ ctx }) => {
    const { moleculeLab, closeMoleculeLab, runTool, updateBlock } = ctx.shell;
    if (!moleculeLab.open) return null;
    const block = moleculeLab.blockId ? ctx.doc.blocks.find((b) => b.id === moleculeLab.blockId) : undefined;
    const editing = block?.type === "image" ? (block.drawing ?? null) : null;
    return (
      <MoleculeStudio
        key={moleculeLab.blockId ?? "new"}
        editing={editing}
        onClose={closeMoleculeLab}
        onInsert={(graph, view) => {
          const preset = drawingPreset(graph, view);
          if (preset) runTool({ kind: "block", type: "image", preset });
          closeMoleculeLab();
        }}
        onInsertMolecule={(molecule) => {
          runTool({ kind: "block", type: "image", preset: moleculePreset(molecule) });
          closeMoleculeLab();
        }}
        onUpdate={(graph, view) => {
          const image = drawingImage(graph, view);
          if (block && image) updateBlock(block.id, { src: image.src, ratio: image.ratio, drawing: graph, layout: { width: image.width, height: image.height } }, "drawing");
          closeMoleculeLab();
        }}
      />
    );
  },
};
