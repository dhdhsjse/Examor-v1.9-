"use client";

import type { ReactNode } from "react";
import type { Ctx } from "@/app/_features/core/types";
import type { Block } from "@/app/_lib/types";
import ClipboardGroup from "./ClipboardGroup";
import EditingGroup from "./EditingGroup";
import FontGroup from "./FontGroup";
import type { FormatTarget } from "./formatTarget";
import { useFormatPainter } from "./painter";
import ParagraphGroup from "./ParagraphGroup";

// What the buttons act on, in a line above them.
function scopeHint(ctx: Ctx, b: Block, target: FormatTarget) {
  const { t } = ctx;
  if (target.engine === "tiptap") return t("The selected words: select others in the box to format them.");
  if (target.engine === "rich") return t("The selected words in the text being typed.");
  return b.type === "textbox" ? t("The whole box. Click in it on the page to type, and select words to format only them.") : t("The whole block. To style a few words, select them on the page.");
}

// The ribbon of the right panel, like the Home tab of Word: the font and the paragraph of the selected words, or of the
// whole block. Clicking in it keeps the text being typed in open (data-text-format). `children`: more groups under it.
export default function TextRibbon({ ctx, b, target, children }: { ctx: Ctx; b: Block; target: FormatTarget; children?: ReactNode }) {
  useFormatPainter(target);
  return (
    <div data-text-format className="flex flex-col gap-3">
      <p className="text-xs text-muted">{scopeHint(ctx, b, target)}</p>
      <ClipboardGroup ctx={ctx} clip={target.clip} capture={target.capture} />
      <FontGroup ctx={ctx} target={target} />
      <ParagraphGroup ctx={ctx} para={target.para} />
      <EditingGroup ctx={ctx} target={target} />
      {children}
    </div>
  );
}
