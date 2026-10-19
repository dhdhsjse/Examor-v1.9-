"use client";

import { Baseline, MousePointerClick } from "lucide-react";
import { hasFontControls } from "@/app/_components/inspector/FontControls";
import type { Ctx } from "@/app/_features/core/types";
import { AlignButtons, ColorButton, FontFamily, FontSize, LineSpacing, RibbonGroup, StyleToggles, VerticalAlign } from "@/app/_features/inspectors/format/FormatControls";
import { isFormatted, resetFormatting, useFormatTarget } from "@/app/_features/inspectors/format/formatTarget";
import { DEFAULT_FONT } from "@/app/_lib/fonts";

const HEADER_FOOTER = "inspector.layout.header-footer";

// Home → Formatting, in the right panel: font, size, bold / italic / underline / strikethrough, color,
// alignment, vertical position (text boxes) and line spacing of the selected block, like the Word ribbon.
// It stays open while other blocks are selected (Feature.followsSelection). The whole block is formatted;
// while a text box is being typed in, its selected words. Other blocks' single words are styled on the
// page, in the bar above the text being typed.
export default function FormattingInspector({ ctx }: { ctx: Ctx }) {
  const { t, shell, doc } = ctx;
  const b = shell.selected;
  const target = useFormatTarget(ctx, b);

  if (!b || !target || !hasFontControls(b)) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <MousePointerClick size={28} strokeWidth={1.4} className="text-faint" />
        <p className="text-sm text-muted">{t("Select a text block on the page to format it.")}</p>
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
    // data-text-format: clicking here keeps the text box editor on the page open
    <div data-text-format className="flex flex-col gap-4">
      <p className="text-xs text-muted">{target.words ? t("The selected words in the text box.") : t("The whole block. To style a few words, select them on the page.")}</p>

      <RibbonGroup title={t("Font")}>
        <FontFamily t={t} target={target} defaultLabel={`${t("Exam font")} (${doc.meta.fontFamily ?? DEFAULT_FONT})`} />
        <div className="flex items-center justify-between gap-1.5">
          <FontSize t={t} target={target} />
          <ColorButton title={t("Text color")} icon={<Baseline size={15} />} value={target.colorSet} shown={target.color} autoLabel={t("Auto")} onChange={target.setColor} />
        </div>
        <StyleToggles t={t} target={target} />
      </RibbonGroup>

      <RibbonGroup title={t("Paragraph")}>
        <AlignButtons t={t} target={target} />
        {b.type === "textbox" && <VerticalAlign ctx={ctx} b={b} />}
        <LineSpacing ctx={ctx} b={b} />
      </RibbonGroup>

      {isFormatted(b) && (
        <button type="button" onClick={() => resetFormatting(ctx, b)} className="self-start text-xs text-indigo-600 hover:underline">
          {t("Reset formatting")}
        </button>
      )}
    </div>
  );
}
