"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";
import type { Ctx } from "@/app/_features/core/types";
import type { Block } from "@/app/_lib/types";
import { ClipboardButtons } from "./ClipboardGroup";
import EditingButtons from "./EditingGroup";
import FontGroup, { FontExtras } from "./FontGroup";
import type { FormatTarget } from "./formatTarget";
import { useFormatPainter } from "./painter";
import ParagraphGroup, { ParagraphExtras } from "./ParagraphGroup";
import { RibbonGroup, RibbonLine } from "./ribbonUi";

// What the buttons act on (the tooltip of the little "i" next to "Text").
function scopeHint(ctx: Ctx, b: Block, target: FormatTarget) {
  const { t } = ctx;
  if (target.engine === "tiptap") return t("The selected words: select others in the box to format them.");
  if (target.engine === "rich") return t("The selected words in the text being typed.");
  return b.type === "textbox" ? t("The whole box. Click in it on the page to type, and select words to format only them.") : t("The whole block. To style a few words, select them on the page.");
}

// The ribbon of the right panel, laid out like the panels of design apps: flat sections with the controls used every time
// (text, paragraph), then `children` (the box's own settings), and last, folded, the tools used less often. Clicking in it
// keeps the text being typed in open (data-text-format).
// `ownSpacing`: `children` set the line and paragraph spacing (the text box's settings).
export default function TextRibbon({ ctx, b, target, children, ownSpacing }: { ctx: Ctx; b: Block; target: FormatTarget; children?: ReactNode; ownSpacing?: boolean }) {
  useFormatPainter(target);
  const { t } = ctx;
  const hint = scopeHint(ctx, b, target);
  return (
    <div data-text-format className="flex flex-col">
      <FontGroup ctx={ctx} target={target} aside={<span title={hint} aria-label={hint} className="flex-none cursor-help text-faint hover:text-muted"><Info size={13} /></span>} />
      <ParagraphGroup ctx={ctx} b={b} para={target.para} ownSpacing={ownSpacing} />
      {children}
      <RibbonGroup title={t("More options")} collapsible>
        <RibbonLine label={t("Text")}>
          <FontExtras ctx={ctx} target={target} />
        </RibbonLine>
        <RibbonLine label={t("Paragraph")}>
          <ParagraphExtras ctx={ctx} para={target.para} />
        </RibbonLine>
        <RibbonLine label={t("Clipboard")}>
          <ClipboardButtons ctx={ctx} clip={target.clip} capture={target.capture} />
        </RibbonLine>
        <RibbonLine label={t("Editing")}>
          <EditingButtons ctx={ctx} target={target} />
        </RibbonLine>
      </RibbonGroup>
    </div>
  );
}
