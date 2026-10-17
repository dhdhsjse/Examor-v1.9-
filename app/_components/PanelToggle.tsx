"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

// The small tab on the inner edge of a side panel, used by every panel that can close (toolbox,
// page thumbnails, properties). The chevron points the way the panel will move: toward the window
// edge to close it ("‹" on a left panel, "›" on the right one), back toward the page to open it.
// Mirrored in right-to-left. Its parent must be `relative`.
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
      className={`absolute z-30 grid h-11 w-5 place-items-center rounded-full border border-line bg-surface text-muted shadow-sm transition-colors hover:border-indigo-300 hover:text-accent focus-visible:outline-2 focus-visible:outline-accent ${edge} ${y}`}
    >
      <Icon size={13} strokeWidth={2.2} aria-hidden />
    </button>
  );
}
