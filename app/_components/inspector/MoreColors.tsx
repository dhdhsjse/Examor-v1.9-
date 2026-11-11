"use client";

import { Plus } from "lucide-react";
import { useT } from "@/app/_lib/uiLang";
import ColorPopover from "./ColorPopover";

const RAINBOW = "conic-gradient(#ef4444, #f59e0b, #eab308, #22c55e, #06b6d4, #3b82f6, #8b5cf6, #ec4899, #ef4444)";
const HEX = /^#[0-9a-f]{6}$/i;

// The last round swatch of a row of colors: a rainbow ring with a +, that opens the color picker for any other color. A color picked there
// (one that is not in the row) shows inside the ring, selected.
export default function MoreColors({ value, colors, label, onPick, testId }: {
  /** The color chosen now (undefined: none) */
  value: string | undefined;
  /** The colors of the row (a value that is one of them is not shown here) */
  colors: readonly string[];
  /** What the color is for (read out by screen readers); the tooltip says "More colors" */
  label: string;
  onPick: (color: string) => void;
  testId?: string;
}) {
  const t = useT();
  const custom = !!value && HEX.test(value) && !colors.some((c) => c.toLowerCase() === value.toLowerCase());
  return (
    <ColorPopover
      value={value && HEX.test(value) ? value : "#3b82f6"}
      onChange={onPick}
      label={label}
      title={t("More colors")}
      testId={testId}
      className={`relative grid size-6 shrink-0 cursor-pointer place-items-center rounded-full p-[3px] outline-none transition-transform duration-100 focus-visible:ring-2 focus-visible:ring-accent active:scale-90 ${custom ? "ring-2 ring-accent ring-offset-2 ring-offset-subtle" : ""}`}
      style={{ background: RAINBOW }}
    >
      <span className="grid size-full place-items-center rounded-full bg-surface text-ink" style={custom ? { background: value } : undefined}>
        {!custom && <Plus size={11} strokeWidth={2.75} aria-hidden />}
      </span>
    </ColorPopover>
  );
}
