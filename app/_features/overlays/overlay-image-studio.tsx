import ImageStudio from "@/app/_components/image-studio/ImageStudio";
import type { Feature } from "@/app/_features/core/types";
import { imageEditOf, imageEditPatch, madeElsewhere } from "@/app/_lib/imageStudio/render";

// The Image Studio, full screen over the app, on a picture of the page (the pencil over its preview in the Properties panel): draw on it,
// crop it. Update puts the new picture in the block (one step of the exam's undo history), with what it was made of, to edit it again.
export const imageStudioOverlay: Feature = {
  id: "overlay.image-studio",
  kind: "overlay",
  label: "Image Studio",
  render: ({ ctx }) => {
    const { imageStudio, closeImageStudio, updateBlock } = ctx.shell;
    if (!imageStudio.open) return null;
    const block = ctx.doc.blocks.find((b) => b.id === imageStudio.blockId);
    if (block?.type !== "image") return null;
    return (
      <ImageStudio
        key={block.id}
        editing={imageEditOf(block)}
        madeElsewhere={madeElsewhere(block)}
        onClose={closeImageStudio}
        onUpdate={(edit, image) => {
          updateBlock(block.id, imageEditPatch(block, edit, image), "image-studio");
          closeImageStudio();
        }}
      />
    );
  },
};
