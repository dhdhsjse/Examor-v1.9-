"use client";

import { ArrowDown, ArrowUp, BringToFront, SendToBack, type LucideIcon } from "lucide-react";
import type { BlockOrder } from "@/app/_lib/blockOrder";
import { useT } from "@/app/_lib/uiLang";
import { Row, iconButtonCls } from "./fields";

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
    <div data-testid="block-order">
      <Row label={t("Arrange")}>
        {buttons.map(({ order, icon: Icon, label }) => (
          <button key={order} type="button" title={label} aria-label={label} data-testid={`block-${order}`} onClick={() => onOrder(order)} className={iconButtonCls}>
            <Icon size={14} aria-hidden />
          </button>
        ))}
      </Row>
    </div>
  );
}
