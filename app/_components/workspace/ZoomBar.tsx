"use client";

import { useEffect, useRef, useState } from "react";
import { ZOOM_PRESETS } from "@/app/_lib/useZoom";

interface Props {
  zoom: number;
  fitMode: boolean;
  showGuides: boolean;
  onZoom: (z: number) => void;
  onFitPage: () => void;
  onToggleGuides: () => void;
}

const iconBtn =
  "grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-black/5 hover:text-ink";

// Slim frosted bar (bottom-right): guides toggle, − zoom% +, and a preset dropdown.
export default function ZoomBar({ zoom, fitMode, showGuides, onZoom, onFitPage, onToggleGuides }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const percent = Math.round(zoom * 100);

  // Close the dropdown when clicking anywhere else.
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const pick = (action: () => void) => {
    action();
    setOpen(false);
  };

  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-white/70 bg-white/80 p-1 shadow-[0_6px_20px_-6px_rgba(16,24,40,0.25)] backdrop-blur-md">
      <button
        onClick={onToggleGuides}
        title="Guides and snapping"
        className={`grid size-7 place-items-center rounded-md transition-colors ${
          showGuides ? "bg-indigo-50 text-indigo-600" : "text-muted hover:bg-black/5"
        }`}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2.5" y="2.5" width="11" height="11" rx="1" strokeDasharray="2 2" />
          <path d="M8 1v14" />
        </svg>
      </button>

      <div className="mx-1 h-4 w-px bg-line" />

      <button className={iconBtn} onClick={() => onZoom(zoom - 0.1)} title="Zoom out">
        <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M2.5 6h7" />
        </svg>
      </button>

      {/* Zoom % opens the preset menu */}
      <div ref={menuRef} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex h-7 w-16 items-center justify-center gap-1 rounded-md text-xs font-semibold tabular-nums text-ink hover:bg-black/5"
        >
          {percent}%
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor" className="text-faint">
            <path d="M1 2.5h6L4 6z" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 bottom-full mb-2 w-32 rounded-lg border border-line bg-white p-1 text-xs shadow-lg">
            <MenuItem active={fitMode} onClick={() => pick(onFitPage)}>Fit page</MenuItem>
            <div className="my-1 h-px bg-line" />
            {ZOOM_PRESETS.map((z) => (
              <MenuItem key={z} active={!fitMode && zoom === z} onClick={() => pick(() => onZoom(z))}>
                {z * 100}%
              </MenuItem>
            ))}
          </div>
        )}
      </div>

      <button className={iconBtn} onClick={() => onZoom(zoom + 0.1)} title="Zoom in">
        <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M2.5 6h7M6 2.5v7" />
        </svg>
      </button>
    </div>
  );
}

function MenuItem({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left hover:bg-subtle ${
        active ? "font-semibold text-indigo-600" : "text-ink"
      }`}
    >
      {children}
      {active && <span>✓</span>}
    </button>
  );
}
