"use client";

import ShapeProperties, { type ShapeFields } from "@/app/_components/shapes/ShapeProperties";
import type { Ctx } from "@/app/_features/core/types";
import type { BlockPatch } from "@/app/_lib/useExam";

// The properties of the shape selected on the page: which shape, flips, fill, outline, text and Position (in front / behind). Its size is set with its handles on
// the page; the rest is the block's shape style.
export default function ShapeInspector({ ctx }: { ctx: Ctx }) {
  const { t, shell } = ctx;
  const b = shell.selected;
  if (b?.type !== "shape") return <p className="text-xs text-muted">{t("Select a shape on the page.")}</p>;

  const change = (patch: Partial<ShapeFields>) => shell.updateBlock(b.id, patch as BlockPatch, `shape:${Object.keys(patch).sort().join(",")}`);
  return (
    <div data-testid="shape-inspector">
      <ShapeProperties key={b.id} item={b} onChange={change} position={{ behind: !!b.behind, onChange: (behind) => shell.orderBlock(b.id, behind ? "back" : "front") }} onDuplicate={() => shell.duplicateBlock(b.id)} onDelete={() => shell.deleteBlock(b.id)} />
    </div>
  );
}
