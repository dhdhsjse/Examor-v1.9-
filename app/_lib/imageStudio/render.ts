"use client";

// The picture an image block shows after the Image Studio: the part of the picture kept, with the drawings over it, drawn into a picture of
// the same kind (a photo stays a JPEG). Untouched, the picture is given back as it was.
import { CONTENT_WIDTH } from "@/app/_lib/a4";
import { loadImage } from "@/app/_lib/images";
import { svgUrl } from "@/app/_lib/library";
import { shapesSvg } from "@/app/_lib/shapes";
import type { ImageBlock } from "@/app/_lib/types";
import type { BlockPatch } from "@/app/_lib/useExam";
import { fullCrop, isFullCrop } from "./crop";
import type { ImageEdit } from "./types";

const OUTPUT_MAX = 2400; // (the longest side of the picture made, px)
const SHARPNESS = 2; // (px of the picture made per px of the sheet, at least: drawings stay sharp when printed)

/** The drawings over the part `c` of the sheet, as an SVG of `w` × `h` px */
export function drawingsSvg(edit: Pick<ImageEdit, "shapes">, c: { x: number; y: number; w: number; h: number }, w: number, h: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${c.x} ${c.y} ${c.w} ${c.h}" preserveAspectRatio="none">${shapesSvg(edit.shapes)}</svg>`;
}

// (not kept in the shared cache: each drawing is used once)
function loadOnce(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** The picture for the page and its width / height. */
export async function renderEditedImage(edit: ImageEdit): Promise<{ src: string; ratio: number }> {
  const c = edit.crop ?? fullCrop(edit.width, edit.height);
  const cropped = !isFullCrop(c, edit.width, edit.height);
  if (!cropped && !edit.shapes?.length) return { src: edit.base, ratio: edit.width / edit.height };

  const img = await loadImage(edit.base);
  const own = (img.naturalWidth || edit.width) / edit.width; // (px of the picture per px of the sheet)
  const k = Math.min(Math.max(own, SHARPNESS), OUTPUT_MAX / Math.max(c.w, c.h));
  const w = Math.max(1, Math.round(c.w * k));
  const h = Math.max(1, Math.round(c.h * k));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  const jpeg = /^data:image\/jpe?g/i.test(edit.base);
  if (jpeg) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  // (the whole picture, moved and scaled, the canvas keeping only the part: a vector picture is drawn sharp at that size)
  ctx.drawImage(img, -c.x * k, -c.y * k, edit.width * k, edit.height * k);
  if (edit.shapes?.length) ctx.drawImage(await loadOnce(svgUrl(drawingsSvg(edit, c, w, h))), 0, 0, w, h);
  return { src: jpeg ? canvas.toDataURL("image/jpeg", 0.92) : canvas.toDataURL("image/png"), ratio: c.w / c.h };
}

/** The sheet of the Studio for an image block: what it was edited with last, or the picture at its size on the page. */
export function imageEditOf(b: ImageBlock): ImageEdit {
  if (b.imageEdit) return b.imageEdit;
  const width = Math.max(1, Math.round(b.layout.width));
  return { base: b.src, width, height: Math.max(1, Math.round(width / b.ratio)) };
}

/** The change of the block: its new picture, at the same scale on the page (a picture cropped gets smaller, not bigger), within the page. */
export function imageEditPatch(b: ImageBlock, edit: ImageEdit, image: { src: string; ratio: number }): BlockPatch {
  const before = imageEditOf(b);
  const shownBefore = before.crop?.w ?? before.width;
  const scale = b.layout.width / shownBefore; // (page px per px of the sheet)
  const shown = edit.crop?.w ?? edit.width;
  const width = Math.min(CONTENT_WIDTH, Math.max(16, shown * scale));
  const untouched = !edit.crop && !edit.shapes?.length;
  // A figure of the library or a picture of another Studio that is cropped or drawn on is a plain picture from then on: its settings would
  // redraw it without what was done here (and double-click would open that Studio).
  const plain = untouched ? {} : { figure: undefined, molecule: undefined, drawing: undefined, graphStudio: undefined, circuitStudio: undefined, chartStudio: undefined, probaStudio: undefined, srcAnswer: undefined };
  return { src: image.src, ratio: image.ratio, imageEdit: untouched ? undefined : edit, ...plain, layout: { width, height: width / image.ratio } };
}

/** Whether the picture of `b` is redrawn from settings of its own (a figure of the library, or a picture made in another Studio) */
export const madeElsewhere = (b: ImageBlock) => !!(b.figure || b.molecule || b.drawing || b.graphStudio || b.circuitStudio || b.chartStudio || b.probaStudio);
