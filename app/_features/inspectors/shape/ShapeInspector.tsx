"use client";

import ShapeProperties, { type ShapeFields } from "@/app/_components/shapes/ShapeProperties";
import type { Ctx } from "@/app/_features/core/types";
import type { BlockPatch } from "@/app/_lib/useExam";

// The properties of the shape selected on the page: which shape, fill, outline, text, flips and size. The size is the block's own
// (`layout`); the rest is the block's shape style.
export default function ShapeInspector({ ctx }: { ctx: Ctx }) {
  const { t, shell } = ctx;
  const b = shell.selected;
  if (b?.type !== "shape") return <p className="p-4 text-sm text-muted">{t("Select a shape on the page.")}</p>;

  const change = (patch: Partial<ShapeFields>) => {
    const { w, h, ...style } = patch;
    const layout = { ...(w !== undefined ? { width: w } : {}), ...(h !== undefined ? { height: h } : {}) };
    shell.updateBlock(b.id, { ...style, ...(Object.keys(layout).length ? { layout } : {}) } as BlockPatch, `shape:${Object.keys(patch).sort().join(",")}`);
  };
  return (
    <div data-testid="shape-inspector">
      <ShapeProperties key={b.id} item={{ ...b, w: b.layout.width, h: b.layout.height }} size onChange={change} onDuplicate={() => shell.duplicateBlock(b.id)} onDelete={() => shell.deleteBlock(b.id)} />
    </div>
  );
}
