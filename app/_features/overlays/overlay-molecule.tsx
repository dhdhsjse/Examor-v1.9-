import MoleculeStudio from "@/app/_components/molecule/MoleculeStudio";
import { moleculeImage, moleculePreset } from "@/app/_components/molecule/moleculePreset";
import type { Feature } from "@/app/_features/core/types";

// The Molecule Studio: a new molecule is inserted as an image block that carries its molecule data,
// and double-clicking such a block reopens it here to update it.
export const moleculeOverlay: Feature = {
  id: "overlay.molecule",
  kind: "overlay",
  label: "Molecule Studio",
  render: ({ ctx }) => {
    const { molecule, closeMolecule, runTool, updateBlock } = ctx.shell;
    if (!molecule.open) return null;
    const block = molecule.blockId ? ctx.doc.blocks.find((b) => b.id === molecule.blockId) : undefined;
    const editing = block?.type === "image" ? (block.molecule ?? null) : null;
    return (
      <MoleculeStudio
        key={molecule.blockId ?? "new"}
        editing={editing}
        onClose={closeMolecule}
        onInsert={(m) => {
          runTool({ kind: "block", type: "image", preset: moleculePreset(m) });
          closeMolecule();
        }}
        // The student version and the answer key, the second under the first (it can be moved to another page).
        onInsertBoth={(student, answer) => {
          runTool({ kind: "blocks", items: [student, answer].map((m) => ({ type: "image" as const, preset: moleculePreset(m) })) });
          closeMolecule();
        }}
        onUpdate={(m) => {
          if (block) {
            const img = moleculeImage(m);
            updateBlock(block.id, { src: img.src, ratio: img.ratio, molecule: m, layout: { width: img.width, height: img.height } }, "molecule");
          }
          closeMolecule();
        }}
        // The justification of a geometry, as a paragraph of the exam (the Studio stays open).
        onInsertText={(text) => runTool({ kind: "block", type: "text", preset: { text, style: "body" } })}
      />
    );
  },
};
