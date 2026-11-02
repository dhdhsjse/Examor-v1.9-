"use client";

import { ClipboardPaste, ClipboardType, Copy, Paintbrush, Scissors, Type } from "lucide-react";
import type { Ctx } from "@/app/_features/core/types";
import type { ClipboardTarget } from "./clipboardTargets";
import { painterStore, usePainter, type CopiedFormat } from "./painter";
import { Menu, MenuButton, MenuItem, RibbonButton, RibbonGroup, RibbonRow } from "./ribbonUi";

// Paste, Cut and Copy: the "Clipboard" group of the Word ribbon. They work on the selected words of the text being typed in, with
// their formatting; with a block selected, on the block.
export default function ClipboardGroup({ ctx, clip, capture }: { ctx: Ctx; clip: ClipboardTarget; capture?: () => CopiedFormat }) {
  return (
    <RibbonGroup title={ctx.t("Clipboard")}>
      <RibbonRow className="gap-1">
        <ClipboardButtons ctx={ctx} clip={clip} capture={capture} withLabel />
      </RibbonRow>
    </RibbonGroup>
  );
}

// The buttons alone (`withLabel`: "Paste" is written next to its icon).
export function ClipboardButtons({ ctx, clip, capture, withLabel }: { ctx: Ctx; clip: ClipboardTarget; capture?: () => CopiedFormat; withLabel?: boolean }) {
  const { t } = ctx;
  const painter = usePainter();
  return (
    <>
      <MenuButton title={t("Paste")} shortcut="Ctrl+V" label={withLabel ? t("Paste") : undefined} icon={<ClipboardPaste size={16} />} onMain={() => clip.paste()} width={230}>
        {(close) => (
          <Menu label={t("Paste")}>
            <MenuItem
              label={t("Keep source formatting")}
              icon={<ClipboardPaste size={15} />}
              onSelect={() => {
                clip.paste("source");
                close();
              }}
            />
            <MenuItem
              label={t("Merge formatting")}
              icon={<ClipboardType size={15} />}
              onSelect={() => {
                clip.paste("merge");
                close();
              }}
            />
            <MenuItem
              label={t("Keep text only")}
              icon={<Type size={15} />}
              onSelect={() => {
                clip.paste("text");
                close();
              }}
            />
          </Menu>
        )}
      </MenuButton>
      <RibbonButton title={t("Cut")} shortcut="Ctrl+X" icon={<Scissors size={15} />} disabled={!clip.canCopy} onClick={clip.cut} />
      <RibbonButton title={t("Copy")} shortcut="Ctrl+C" icon={<Copy size={15} />} disabled={!clip.canCopy} onClick={clip.copy} />
      {capture && (
        <RibbonButton
          title={`${t("Format painter")} — ${t("click, then select words; double-click to keep painting (Esc stops)")}`}
          icon={<Paintbrush size={15} />}
          pressed={!!painter}
          onClick={(e) => (painter && e.detail < 2 ? painterStore.clear() : painterStore.arm(capture(), e.detail >= 2))}
        />
      )}
    </>
  );
}
