"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// The small tab on the inner edge of a side panel, used by every panel that can close (toolbox,
// page thumbnails, properties). The chevron points the way the panel will move: toward the window
// edge to close it ("‹" on a left panel, "›" on the right one), back toward the page to open it.
// Mirrored in right-to-left. Its parent must be `relative`, and `group/edge`: while the panel is open the tab
// only shows when the pointer is over that parent (or the tab has the keyboard focus), so it doesn't clutter
// the edges; a closed panel always shows it.
export function PanelToggle({ side, open, dir, title, controls, onToggle, placement = "center" }: {
  side: "start" | "end"; // where the panel sits (start = left in LTR)
  open: boolean;
  dir: "ltr" | "rtl";
  title: string;
  controls?: string; // id of the panel content
  onToggle: () => void;
  placement?: "center" | "top"; // vertically centered, or near the top (when two panels sit side by side)
}) {
  const towardStart = side === "start" ? open : !open;
  const Icon = towardStart === (dir === "ltr") ? ChevronLeft : ChevronRight;
  const edge = side === "start" ? "end-0 translate-x-1/2 rtl:-translate-x-1/2" : "start-0 -translate-x-1/2 rtl:translate-x-1/2";
  const y = placement === "center" ? "top-1/2 -translate-y-1/2" : "top-2";
  return (
    <button
      type="button"
      onClick={onToggle}
      title={title}
      aria-label={title}
      aria-expanded={open}
      aria-controls={controls}
      className={`absolute z-30 grid h-8 w-4 place-items-center rounded-[5px] border border-line bg-surface text-muted shadow-sm transition-[color,opacity] hover:text-ink focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-accent ${
        open ? "opacity-0 group-hover/edge:opacity-100" : ""
      } ${edge} ${y}`}
    >
      <Icon size={12} strokeWidth={2} aria-hidden />
    </button>
  );
}
