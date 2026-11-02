"use client";

import { Omega, Search } from "lucide-react";
import type { Ctx } from "@/app/_features/core/types";
import type { FormatTarget } from "./formatTarget";
import { MenuButton, RibbonButton } from "./ribbonUi";
import SymbolPicker from "./SymbolPicker";

// Find and replace, and the symbols: the "Editing" tools of the ribbon (a line of "More options").
export default function EditingButtons({ ctx, target }: { ctx: Ctx; target: FormatTarget }) {
  const { t } = ctx;
  const can = !!target.insertText;
  return (
    <>
      <RibbonButton title={t("Find and replace")} shortcut="Ctrl+F" icon={<Search size={15} />} onClick={() => ctx.openInspector("inspector.home.find")} />
      <MenuButton title={can ? t("Symbol") : `${t("Symbol")} — ${t("Click in the text where the symbol goes")}`} icon={<Omega size={16} />} disabled={!can} width={290}>
        {() => <SymbolPicker t={t} onPick={(symbol) => target.insertText?.(symbol)} />}
      </MenuButton>
    </>
  );
}
