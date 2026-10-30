"use client";

import { ShapeGallery } from "@/app/_components/shapes/ShapeGallery";
import type { Ctx } from "@/app/_features/core/types";

// Insert → Shapes: the gallery. Choosing a shape puts the Shapes tool in hand: drag on the page to draw it, or click to put it at its
// usual size. The drawn shape is selected and its properties open (inspector-shape).
export default function ShapesInspector({ ctx }: { ctx: Ctx }) {
  const { t, shell } = ctx;
  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-xs text-muted">{t("Choose a shape, then drag on the page to draw it (Shift: a square or a 45° line), or click to put it at its usual size.")}</p>
      <ShapeGallery current={shell.canvasTool === "shape" ? shell.shapeToDraw : null} onPick={shell.drawShape} />
    </div>
  );
}
