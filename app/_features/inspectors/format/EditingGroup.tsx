"use client";

import { Omega, Search } from "lucide-react";
import type { Ctx } from "@/app/_features/core/types";
import type { FormatTarget } from "./formatTarget";
import { MenuButton, RibbonButton, RibbonGroup, RibbonRow } from "./ribbonUi";
import SymbolPicker from "./SymbolPicker";

// Find and replace, and the symbols: the "Editing" group of the ribbon.
export default function EditingGroup({ ctx, target }: { ctx: Ctx; target: FormatTarget }) {
  const { t } = ctx;
  const can = !!target.insertText;
  return (
    <RibbonGroup title={t("Editing")}>
      <RibbonRow className="gap-1">
        <RibbonButton title={t("Find and replace")} shortcut="Ctrl+F" label={t("Find")} icon={<Search size={15} />} onClick={() => ctx.openInspector("inspector.home.find")} />
        <MenuButton title={can ? t("Symbol") : `${t("Symbol")} — ${t("Click in the text where the symbol goes")}`} label={t("Symbol")} icon={<Omega size={16} />} disabled={!can} width={290}>
          {() => <SymbolPicker t={t} onPick={(symbol) => target.insertText?.(symbol)} />}
        </MenuButton>
      </RibbonRow>
    </RibbonGroup>
  );
}
