"use client";

import type { Ctx } from "@/app/_features/core/types";
import { useFormatTarget } from "@/app/_features/inspectors/format/formatTarget";
import { RibbonGroup } from "@/app/_features/inspectors/format/ribbonUi";
import SymbolPicker from "@/app/_features/inspectors/format/SymbolPicker";

// Home → Symbols, in the right panel: letters and signs to click, put in the text being typed in where the cursor is. Clicking in
// the panel keeps the text open (data-text-format).
export default function SymbolsInspector({ ctx }: { ctx: Ctx }) {
  const { t, shell } = ctx;
  const target = useFormatTarget(ctx, shell.selected);
  const insert = target?.insertText;
  return (
    <div data-text-format className="flex flex-col gap-3">
      <RibbonGroup title={t("Symbols")}>
        <SymbolPicker t={t} onPick={(symbol) => insert?.(symbol)} disabled={!insert} />
      </RibbonGroup>
      {!insert && <p className="text-xs text-muted">{t("Click in the text where the symbol goes")}</p>}
    </div>
  );
}
