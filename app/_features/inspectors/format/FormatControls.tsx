"use client";

import { ArrowDownToLine, ArrowUpToLine, FoldVertical } from "lucide-react";
import type { Ctx } from "@/app/_features/core/types";
import type { TextboxBlock } from "@/app/_lib/types";

// The controls of the text box panel that are not text formatting (that is the ribbon: TextRibbon.tsx).

const toggleCls = (on: boolean) =>
  `grid h-8 flex-1 place-items-center rounded-md border transition-colors ${on ? "border-indigo-500 bg-indigo-50 text-accent" : "border-line bg-white text-ink hover:border-indigo-300"}`;

// Where the text sits in a text box.
export function VerticalAlign({ ctx, b }: { ctx: Ctx; b: TextboxBlock }) {
  const v = b.valign ?? "top";
  const options = [
    { value: "top", label: "Top", Icon: ArrowUpToLine },
    { value: "middle", label: "Middle", Icon: FoldVertical },
    { value: "bottom", label: "Bottom", Icon: ArrowDownToLine },
  ] as const;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-muted">{ctx.t("In the box")}</span>
      <div className="flex gap-1.5" role="group" aria-label={ctx.t("In the box")}>
        {options.map(({ value, label, Icon }) => (
          <button key={value} type="button" aria-pressed={v === value} title={ctx.t(label)} aria-label={ctx.t(label)} onClick={() => ctx.shell.updateBlock(b.id, { valign: value }, "valign")} className={toggleCls(v === value)}>
            <Icon size={15} />
          </button>
        ))}
      </div>
    </div>
  );
}
