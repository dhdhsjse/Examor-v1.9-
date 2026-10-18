import { A4 } from "@/app/_lib/pageFormats";
import type { PageMargins } from "@/app/_lib/types";

const pct = (px: number, of: number) => `${(px / of) * 100}%`;

// A small A4 sheet: the printable area is white with a dashed edge, the margins around it are shaded.
export default function MiniA4({ margins, isSelected }: { margins: PageMargins; isSelected: boolean }) {
  return (
    <span aria-hidden className={`relative block aspect-[210/297] w-12 rounded border bg-subtle ${isSelected ? "border-indigo-300" : "border-line"}`}>
      <span
        className={`absolute border border-dashed bg-white transition-all duration-150 ${isSelected ? "border-indigo-500" : "border-slate-400"}`}
        style={{
          top: pct(margins.top, A4.height),
          right: pct(margins.right, A4.width),
          bottom: pct(margins.bottom, A4.height),
          left: pct(margins.left, A4.width),
        }}
      />
    </span>
  );
}
