"use client";

import { PaintBucket, Square } from "lucide-react";
import { SmallButton, Stepper } from "@/app/_components/inspector/fields";
import { BookmarkIcon, CopyIcon, TrashIcon } from "@/app/_components/icons";
import type { Ctx } from "@/app/_features/core/types";
import { VerticalAlign } from "@/app/_features/inspectors/format/FormatControls";
import { useFormatTarget } from "@/app/_features/inspectors/format/formatTarget";
import { ColorMenu, RibbonGroup } from "@/app/_features/inspectors/format/ribbonUi";
import TextRibbon from "@/app/_features/inspectors/format/TextRibbon";
import { TEXTBOX_MAX_PAD, TEXTBOX_PAD, textboxPad } from "@/app/_lib/blockLayout";
import { FILL_COLORS, TEXT_COLORS } from "@/app/_lib/fonts";

// The selected text box's ribbon, in place of its Properties (like Word's tab for a selected shape): the same ribbon as
// Home → Formatting (TextRibbon), on the selected words and paragraphs while the box is being typed in (its Tiptap
// editor on the page), else on the whole box; then the box's own settings (place of the text, inner margin, fill,
// border). It opens when a text box is selected (Feature.edits) and gives way when it no longer is.
export default function TextboxInspector({ ctx }: { ctx: Ctx }) {
  const { t, shell } = ctx;
  const b = shell.selected;
  const target = useFormatTarget(ctx, b);
  if (b?.type !== "textbox" || !target) return <p className="text-sm text-muted">{t("Select a text box on the page.")}</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-end gap-1">
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

      <TextRibbon ctx={ctx} b={b} target={target}>
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
            <div className="flex gap-1">
              <ColorMenu title={t("Fill color")} icon={<PaintBucket size={15} />} value={b.background} initial="#fef08a" autoLabel={t("No fill")} colors={FILL_COLORS} toggle onChange={(background) => shell.updateBlock(b.id, { background }, "background")} />
              <ColorMenu title={t("Border color")} icon={<Square size={15} />} value={b.border} initial="#111827" autoLabel={t("No border")} colors={TEXT_COLORS} toggle onChange={(border) => shell.updateBlock(b.id, { border }, "border")} />
            </div>
          </div>
          <p className="text-[10px] leading-snug text-faint">{t("Drag the edge of the box to move it, and its handles to resize it: the text wraps to fit.")}</p>
        </RibbonGroup>
      </TextRibbon>
    </div>
  );
}
