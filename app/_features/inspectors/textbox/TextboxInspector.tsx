"use client";

import { Baseline, Highlighter, PaintBucket, Square } from "lucide-react";
import { SmallButton, Stepper } from "@/app/_components/inspector/fields";
import { BookmarkIcon, CopyIcon, TrashIcon } from "@/app/_components/icons";
import type { Ctx } from "@/app/_features/core/types";
import { AlignButtons, ColorButton, FontFamily, FontSize, LineSpacing, RibbonGroup, StyleToggles, VerticalAlign } from "@/app/_features/inspectors/format/FormatControls";
import { isFormatted, resetFormatting, useFormatTarget } from "@/app/_features/inspectors/format/formatTarget";
import { TEXTBOX_MAX_PAD, TEXTBOX_PAD, textboxPad } from "@/app/_lib/blockLayout";
import { DEFAULT_FONT, FILL_COLORS, TEXT_COLORS } from "@/app/_lib/fonts";

// The selected text box's ribbon, in place of its Properties (like Word's tab for a selected shape).
// While the box is being typed in (its Tiptap editor on the page), Font and Paragraph format the selected
// words and paragraphs; otherwise the whole box. Box settings (place of the text, inner margin, fill,
// border) are the box's. It opens when a text box is selected (Feature.edits) and gives way when it no
// longer is. Clicking in it keeps the editor on the page open (data-text-format).
export default function TextboxInspector({ ctx }: { ctx: Ctx }) {
  const { t, shell, doc } = ctx;
  const b = shell.selected;
  const target = useFormatTarget(ctx, b);
  if (b?.type !== "textbox" || !target) return <p className="text-sm text-muted">{t("Select a text box on the page.")}</p>;

  return (
    <div data-text-format className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {target.words ? t("The selected words: select others in the box to format them.") : t("The whole box. Click in it on the page to type, and select words to format only them.")}
        </p>
        <div className="flex flex-none gap-1">
          <SmallButton title={t("Save to my library (reuse it in other exams)")} onClick={() => shell.saveToLibrary(b)}>
            <BookmarkIcon />
          </SmallButton>
          <SmallButton title={`${t("Duplicate")} (Ctrl+D)`} onClick={() => shell.duplicateBlock(b.id)}>
            <CopyIcon />
          </SmallButton>
          <SmallButton danger title={`${t("Delete")} (Del)`} onClick={() => shell.deleteBlock(b.id)}>
            <TrashIcon />
          </SmallButton>
        </div>
      </div>

      <RibbonGroup title={t("Font")}>
        <FontFamily t={t} target={target} defaultLabel={`${t("Exam font")} (${doc.meta.fontFamily ?? DEFAULT_FONT})`} />
        <div className="flex items-center gap-1.5">
          <FontSize t={t} target={target} />
          <span className="flex-1" />
          <ColorButton title={t("Text color")} icon={<Baseline size={15} />} value={target.colorSet} shown={target.color} autoLabel={t("Auto")} onChange={target.setColor} />
          <ColorButton
            title={t("Highlight color")}
            icon={<Highlighter size={15} />}
            value={target.highlight}
            shown={target.highlight ?? "transparent"}
            autoLabel={t("None")}
            colors={FILL_COLORS}
            onChange={target.setHighlight}
          />
        </div>
        <StyleToggles t={t} target={target} />
      </RibbonGroup>

      <RibbonGroup title={t("Paragraph")}>
        <AlignButtons t={t} target={target} />
        <LineSpacing ctx={ctx} b={b} />
      </RibbonGroup>

      <RibbonGroup title={t("Box settings")}>
        <VerticalAlign ctx={ctx} b={b} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted">{t("Inner margin")}</span>
          <Stepper
            value={Math.round(textboxPad(b))}
            min={0}
            max={TEXTBOX_MAX_PAD}
            title={t("Room between the edge of the box and its text (px)")}
            onChange={(v) => shell.updateBlock(b.id, { padding: v === TEXTBOX_PAD ? undefined : v }, "padding")}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted">{t("Fill and border")}</span>
          <div className="flex gap-1.5">
            <ColorButton
              title={t("Fill color")}
              icon={<PaintBucket size={15} />}
              value={b.background}
              shown={b.background ?? "transparent"}
              autoLabel={t("No fill")}
              colors={FILL_COLORS}
              onChange={(background) => shell.updateBlock(b.id, { background }, "background")}
            />
            <ColorButton
              title={t("Border color")}
              icon={<Square size={15} />}
              value={b.border}
              shown={b.border ?? "transparent"}
              autoLabel={t("No border")}
              colors={TEXT_COLORS}
              onChange={(border) => shell.updateBlock(b.id, { border }, "border")}
            />
          </div>
        </div>
        <p className="text-[10px] leading-snug text-faint">{t("Drag the edge of the box to move it, and its handles to resize it: the text wraps to fit.")}</p>
      </RibbonGroup>

      {isFormatted(b) && (
        <button type="button" onClick={() => resetFormatting(ctx, b)} className="self-start text-xs text-indigo-600 hover:underline">
          {t("Reset formatting")}
        </button>
      )}
    </div>
  );
}
