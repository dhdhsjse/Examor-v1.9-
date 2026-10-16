import type { Ctx } from "@/app/_features/core/types";
import { cardClass } from "./cardStyle";

interface Props {
  ctx: Ctx;
  name: string;
  description: string;
  recommended?: boolean;
  selected: boolean;
  header: boolean;
  footer: boolean;
  onSelect: () => void;
}

// One header/footer option, drawn as a page with the bands that repeat on it.
export default function BuildCard({ ctx, name, description, recommended, selected, header, footer, onSelect }: Props) {
  const band = selected ? "#4f46e5" : "#94a3b8";
  return (
    <button type="button" aria-pressed={selected} onClick={onSelect} className={cardClass(selected)}>
      <div className={`flex justify-center p-4 ${selected ? "bg-indigo-50/60" : "bg-subtle"}`}>
        <svg width="72" height="100" viewBox="0 0 72 100" aria-hidden="true">
          <rect x="0.5" y="0.5" width="71" height="99" rx="2" fill="#fff" stroke="#cbd5e1" />
          {header && <rect x="12" y="10" width="48" height="9" rx="2" fill={band} />}
          {footer && <rect x="12" y="81" width="48" height="9" rx="2" fill={band} />}
        </svg>
      </div>
      <div className="flex flex-col gap-1 px-4 py-3">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{ctx.t(name)}</span>
          {recommended && <span className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] font-semibold text-white">{ctx.t("Recommended")}</span>}
        </span>
        <span className="text-xs text-muted">{ctx.t(description)}</span>
      </div>
    </button>
  );
}
