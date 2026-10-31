"use client";

import type { InkTool } from "@/app/_lib/ink/engine";

const LINE = "#3f3f46"; // the outline, like the other icons of the bar
const BODY = "#f4f4f5";
const BAND = "#d4d4d8";

// The three drawing tools as flat little pictures standing in the tool bar: a brush, a pencil and a highlighter, outlined, with
// the part that touches the paper in the color it draws with. 28×64, upright with the tip at the top.
export default function InkToolArt({ tool, color, className }: { tool: InkTool; color: string; className?: string }) {
  return (
    <svg viewBox="0 0 28 64" width="28" height="64" className={className} fill="none" stroke={LINE} strokeWidth="1.4" strokeLinejoin="round" aria-hidden>
      {tool === "pencil" && (
        <g>
          <path d="M7 26 L14 5 L21 26 Z" fill={BODY} />
          <path d="M11.4 12.8 L14 5 L16.6 12.8 Z" fill={color} />
          <rect x="7" y="26" width="14" height="40" fill={BODY} />
          <path d="M14 26 V66" strokeOpacity="0.35" />
        </g>
      )}

      {tool === "brush" && (
        <g>
          <path d="M8 26 C8 16 10.5 8 14 4 C17.5 8 20 16 20 26 Z" fill={color} />
          <rect x="7" y="26" width="14" height="10" rx="1" fill={BAND} />
          <path d="M8 36 H20 L19 66 H9 Z" fill={BODY} />
        </g>
      )}

      {tool === "highlighter" && (
        <g>
          <path d="M10 15 V8 L18 4 V15 Z" fill={color} />
          <rect x="8" y="15" width="12" height="6" rx="1" fill={BAND} />
          <rect x="6" y="21" width="16" height="45" rx="2.5" fill={BODY} />
          <rect x="6" y="26" width="16" height="6" fill={color} />
        </g>
      )}
    </svg>
  );
}
