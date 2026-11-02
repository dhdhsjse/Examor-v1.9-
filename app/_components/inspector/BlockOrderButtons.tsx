"use client";

import { ArrowDown, ArrowUp, BringToFront, SendToBack, type LucideIcon } from "lucide-react";
import type { BlockOrder } from "@/app/_lib/blockOrder";
import { useT } from "@/app/_lib/uiLang";

// Where a block sits among the blocks it overlaps: in front of them, behind them, or one layer up or down. Shown in the Properties
// of every block (a text box over a picture, a shape over a graph…). On the page, Alt+click picks the block under the one on top.
export default function BlockOrderButtons({ onOrder }: { onOrder: (order: BlockOrder) => void }) {
  const t = useT();
  const buttons: { order: BlockOrder; icon: LucideIcon; label: string }[] = [
    { order: "front", icon: BringToFront, label: t("Bring to front") },
    { order: "forward", icon: ArrowUp, label: t("Bring forward") },
    { order: "backward", icon: ArrowDown, label: t("Send backward") },
    { order: "back", icon: SendToBack, label: t("Send to back") },
  ];
  return (
    <div className="flex flex-col gap-1.5" data-testid="block-order">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted">{t("Arrange")}</span>
        <div className="flex gap-1">
          {buttons.map(({ order, icon: Icon, label }) => (
            <button
              key={order}
              type="button"
              title={label}
              aria-label={label}
              data-testid={`block-${order}`}
              onClick={() => onOrder(order)}
              className="grid size-7 place-items-center rounded-md border border-line bg-white text-muted transition-colors hover:border-indigo-300 hover:text-ink"
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>
      <p className="text-[10px] leading-snug text-faint">{t("Blocks can lie on top of each other. Alt+click on the page selects the one underneath.")}</p>
    </div>
  );
}
