"use client";

import { MousePointerClick } from "lucide-react";
import { hasFontControls } from "@/app/_components/inspector/FontControls";
import type { Ctx } from "@/app/_features/core/types";
import { VerticalAlign } from "@/app/_features/inspectors/format/FormatControls";
import { blockClip } from "@/app/_features/inspectors/format/clipboardTargets";
import ClipboardGroup from "@/app/_features/inspectors/format/ClipboardGroup";
import { useFormatTarget } from "@/app/_features/inspectors/format/formatTarget";
import { RibbonGroup } from "@/app/_features/inspectors/format/ribbonUi";
import TextRibbon from "@/app/_features/inspectors/format/TextRibbon";

const HEADER_FOOTER = "inspector.layout.header-footer";

// Home → Formatting, in the right panel: the Word ribbon for the selected block (TextRibbon): font, size, style, color,
// case, lists, indent, alignment, direction, spacing, shading and borders. It stays open while other blocks are selected
// (Feature.followsSelection). The whole block is formatted; while a text is being typed in, its selected words.
export default function FormattingInspector({ ctx }: { ctx: Ctx }) {
  const { t, shell } = ctx;
  const b = shell.selected;
  const target = useFormatTarget(ctx, b);

  if (!b || !target || !hasFontControls(b)) {
    // (the clipboard still works: a block or text can be pasted, and a block that is selected copied)
    return (
      <div data-text-format className="flex flex-col gap-3">
        <ClipboardGroup ctx={ctx} clip={target?.clip ?? blockClip(ctx)} />
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <MousePointerClick size={28} strokeWidth={1.4} className="text-faint" />
          <p className="text-sm text-muted">{t("Select a text block on the page to format it.")}</p>
        </div>
      </div>
    );
  }
  // Headers and footers come from their settings: formatted there.
  if (b.type === "header" || b.meta?.role) {
    return (
      <div className="flex flex-col gap-3 text-sm text-muted">
        <p>{t("The header and footer are formatted in Page layout → Header and footer, or with the bar under them on the page.")}</p>
        <button type="button" onClick={() => ctx.openInspector(HEADER_FOOTER)} className="self-start rounded-md border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink hover:border-indigo-300">
          {t("Header and footer")}
        </button>
      </div>
    );
  }

  return (
    <TextRibbon ctx={ctx} b={b} target={target}>
      {b.type === "textbox" && (
        <RibbonGroup title={t("Text box")}>
          <VerticalAlign ctx={ctx} b={b} />
        </RibbonGroup>
      )}
    </TextRibbon>
  );
}
