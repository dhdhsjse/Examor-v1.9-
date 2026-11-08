"use client";

import { useEffect, useState, type RefObject } from "react";
import { formatMark } from "@/app/_lib/sheet/marks";
import type { ToolAction } from "@/app/_lib/tools";

// What a sticker in hand looks like next to the pointer: its mark or word, a line, or Σ for a total
function labelOf(stamp: ToolAction, pad: boolean): string {
  if (stamp.kind !== "block") return "•";
  if (stamp.type === "rule") return "—";
  const p = (stamp.preset ?? {}) as { kind?: string; value?: number; text?: string };
  if (p.kind === "number" && typeof p.value === "number") return formatMark(p.value, pad);
  if (p.kind === "text") return p.text ?? "";
  if (p.kind === "total") return "Σ";
  return "•";
}

// The Stamp tool in hand (a sticker of the correction sheet): the sticker rides along with the pointer over the pages, so the teacher always
// sees what a click puts down. Screen size, under the pointer's tip, never catching the mouse.
export default function StampCursor({ stamp, pad, area }: { stamp: ToolAction; pad: boolean; area: RefObject<HTMLElement | null> }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const move = (e: PointerEvent) => setAt({ x: e.clientX, y: e.clientY });
    const leave = () => setAt(null);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerleave", leave);
    };
  }, [area]);
  if (!at) return null;
  return (
    <div
      aria-hidden
      data-testid="stamp-cursor"
      className="pointer-events-none fixed z-50 rounded-[5px] bg-emerald-600 px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums shadow-md ring-1 ring-white"
      style={{ left: at.x + 12, top: at.y + 14 }}
    >
      {labelOf(stamp, pad)}
    </div>
  );
}
