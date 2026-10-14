"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/app/_lib/uiLang";
import { ZOOM_MAX, ZOOM_MIN, ZOOM_PRESETS, clampZoom, type FitMode } from "@/app/_lib/useZoom";

interface Props {
  zoom: number;
  fitMode: FitMode;
  showGuides: boolean;
  onZoom: (z: number) => void;
  onFitPage: () => void;
  onFitWidth: () => void;
  onToggleGuides: () => void;
}

const iconBtn =
  "grid size-7 place-items-center rounded-md text-muted transition-colors hover:bg-black/5 hover:text-ink";

// The slider is logarithmic: 10% → 100% takes the same room as 100% → 400%... roughly.
const LOG_MIN = Math.log(ZOOM_MIN);
const LOG_MAX = Math.log(ZOOM_MAX);
const toSlider = (z: number) => Math.round(((Math.log(z) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 1000);
const fromSlider = (v: number) => Math.exp(LOG_MIN + (v / 1000) * (LOG_MAX - LOG_MIN));

// Slim frosted bar (bottom-right): guides toggle, − slider +, a typed % and a preset menu.
export default function ZoomBar({ zoom, fitMode, showGuides, onZoom, onFitPage, onFitWidth, onToggleGuides }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null); // the % being typed
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

  // Typed value: any whole or decimal percentage, e.g. "137" or "137%".
  const commitDraft = () => {
    const v = parseFloat((draft ?? "").replace(",", "."));
    if (Number.isFinite(v) && v > 0) onZoom(clampZoom(v / 100));
    setDraft(null);
  };

  return (
    <div className="pointer-events-auto flex items-center gap-0.5 rounded-lg border border-white/70 bg-white/80 p-1 shadow-[0_6px_20px_-6px_rgba(16,24,40,0.25)] backdrop-blur-md">
      <button
        onClick={onToggleGuides}
        title={t("Guides and snapping")}
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

      <button className={iconBtn} onClick={() => onZoom(zoom / 1.2)} title={`${t("Zoom out")} (Ctrl −)`}>
        <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M2.5 6h7" />
        </svg>
      </button>

      <input
        type="range"
        min={0}
        max={1000}
        value={toSlider(zoom)}
        onChange={(e) => onZoom(fromSlider(Number(e.target.value)))}
        title={t("Drag to zoom")}
        aria-label={t("Zoom")}
        className="h-1 w-24 cursor-pointer accent-indigo-600"
      />

      <button className={iconBtn} onClick={() => onZoom(zoom * 1.2)} title={`${t("Zoom in")} (Ctrl +)`}>
        <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M2.5 6h7M6 2.5v7" />
        </svg>
      </button>

      {/* Type any % — the arrow opens the presets */}
      <div ref={menuRef} className="relative flex items-center">
        <input
          value={draft ?? `${percent}%`}
          onFocus={(e) => {
            setDraft(String(percent));
            requestAnimationFrame(() => e.target.select());
          }}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitDraft}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
            if (e.key === "Escape") {
              setDraft(null);
              requestAnimationFrame(() => (document.activeElement as HTMLElement | null)?.blur());
            }
          }}
          title={t("Type a zoom level")}
          className="h-7 w-12 rounded-md bg-transparent text-center text-xs font-semibold tabular-nums text-ink outline-none hover:bg-black/5 focus:bg-white focus:ring-2 focus:ring-indigo-200"
        />
        <button onClick={() => setOpen(!open)} className="grid h-7 w-4 place-items-center rounded-md text-faint hover:bg-black/5" title={t("Zoom presets")}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <path d="M1 2.5h6L4 6z" />
          </svg>
        </button>

        {open && (
          <div className="absolute end-0 bottom-full mb-2 w-36 rounded-lg border border-line bg-white p-1 text-xs shadow-lg">
            <MenuItem active={fitMode === "page"} onClick={() => pick(onFitPage)} hint="Ctrl 0">
              {t("Fit page")}
            </MenuItem>
            <MenuItem active={fitMode === "width"} onClick={() => pick(onFitWidth)}>
              {t("Fit width")}
            </MenuItem>
            <div className="my-1 h-px bg-line" />
            {ZOOM_PRESETS.map((z) => (
              <MenuItem key={z} active={!fitMode && Math.abs(zoom - z) < 0.001} onClick={() => pick(() => onZoom(z))} hint={z === 1 ? "Ctrl 1" : undefined}>
                {z * 100}%
              </MenuItem>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MenuItem({ active, onClick, hint, children }: { active: boolean; onClick: () => void; hint?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-start hover:bg-subtle ${
        active ? "font-semibold text-indigo-600" : "text-ink"
      }`}
    >
      {children}
      {active ? <span>✓</span> : hint && <span className="text-[10px] text-faint">{hint}</span>}
    </button>
  );
}
