import type { ShapeItem } from "@/app/_lib/shapes/types";

/** A part of the picture, in px of the Image Studio's sheet */
export type CropRect = { x: number; y: number; w: number; h: number };

// What an image block keeps of the Image Studio, so it can be opened there again with everything editable: the picture as it was
// before any edit, the part of it kept and what was drawn over it. The block's `src` is the picture they make together.
export interface ImageEdit {
  /** The picture before any edit (a data URL) */
  base: string;
  /** The size of the whole picture on the Studio's sheet, px (the drawings and the crop are in these px) */
  width: number;
  height: number;
  /** The part kept (missing = all of it) */
  crop?: CropRect;
  /** The drawings, text boxes and shapes over it */
  shapes?: ShapeItem[];
}

/** What the Studio changes (its undo history): the picture and the sheet stay as they are */
export type ImageEditDoc = { crop?: CropRect; shapes?: ShapeItem[] };
