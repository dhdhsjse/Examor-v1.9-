import { PAGE_HEIGHT, PAGE_WIDTH } from "@/app/_lib/a4";
import type { PageMargins } from "@/app/_lib/types";

// A small A4 sheet with its printable area dashed and the margins shaded.
// `rtl` mirrors it, so a wide binding margin shows on the right.
export default function MiniA4({ margins, width = 84, rtl = false }: { margins: PageMargins; width?: number; rtl?: boolean }) {
  const k = width / PAGE_WIDTH;
  const height = PAGE_HEIGHT * k;
  const left = (rtl ? margins.right : margins.left) * k;
  const right = (rtl ? margins.left : margins.right) * k;
  const top = margins.top * k;
  const bottom = margins.bottom * k;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="shrink-0 drop-shadow-sm">
      <rect width={width} height={height} fill="#e2e8f0" stroke="#94a3b8" />
      <rect x={left} y={top} width={width - left - right} height={height - top - bottom} fill="#ffffff" stroke="#6366f1" strokeDasharray="3 2" />
    </svg>
  );
}
