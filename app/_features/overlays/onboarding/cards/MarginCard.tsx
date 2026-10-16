import type { Ctx } from "@/app/_features/core/types";
import type { MarginTemplate } from "@/app/_lib/onboardingTypes";
import { cardClass } from "./cardStyle";
import MiniA4 from "./MiniA4";

const mm = (px: number) => Math.round((px * 25.4) / 96);

interface Props {
  ctx: Ctx;
  template: MarginTemplate;
  selected: boolean;
  onSelect: () => void;
}

// One margin preset: a page showing its printable area, its name, and its size in mm (top · right · bottom · left).
export default function MarginCard({ ctx, template, selected, onSelect }: Props) {
  const m = template.margins;
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className={cardClass(selected)}>
      <div className="flex justify-center bg-subtle p-4">
        <MiniA4 margins={m} width={72} rtl={ctx.dir === "rtl"} />
      </div>
      <div className="flex flex-col gap-1 px-3 py-3">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{ctx.t(template.nameKey)}</span>
          {template.recommended && <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">{ctx.t("Recommended")}</span>}
        </span>
        <span className="text-[11px] text-muted" dir="ltr">
          {mm(m.top)} · {mm(m.right)} · {mm(m.bottom)} · {mm(m.left)} mm
        </span>
      </div>
    </button>
  );
}
