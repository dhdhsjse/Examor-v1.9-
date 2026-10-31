"use client";

import { Check } from "lucide-react";
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
  "grid size-8 place-items-center rounded-[5px] text-muted transition-colors outline-none hover:bg-hover hover:text-ink focus-visible:ring-2 focus-visible:ring-accent";

// The slider is logarithmic: 10% → 100% takes the same room as 100% → 400%... roughly.
const LOG_MIN = Math.log(ZOOM_MIN);
const LOG_MAX = Math.log(ZOOM_MAX);
const toSlider = (z: number) => Math.round(((Math.log(z) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 1000);
const fromSlider = (v: number) => Math.exp(LOG_MIN + (v / 1000) * (LOG_MAX - LOG_MIN));

// Slim frosted bar (bottom-right): guides toggle, − slider + (pops out on hover), a typed % and a preset menu.
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
    <div className="group pointer-events-auto flex items-center gap-0.5 rounded-[10px] border border-line bg-surface p-1 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.16)]">
      <button
        onClick={onToggleGuides}
        title={t("Guides and snapping")}
        aria-label={t("Guides and snapping")}
        aria-pressed={showGuides}
        className={`grid size-8 place-items-center rounded-[5px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${
          showGuides ? "bg-hover text-ink" : "text-muted hover:bg-hover hover:text-ink"
        }`}
      >
        <svg width="16" height="16" aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2.5" y="2.5" width="11" height="11" rx="1" strokeDasharray="2 2" />
          <path d="M8 1v14" />
        </svg>
      </button>

      <div className="mx-0.5 h-5 w-px bg-line" />

      {/* Only shown while the mouse is on the bar (or the slider is in use), to save room */}
      <div
        className={`flex items-center gap-0.5 overflow-hidden transition-all duration-200 ease-out group-focus-within:max-w-48 group-focus-within:opacity-100 group-hover:max-w-48 group-hover:opacity-100 ${
          open ? "max-w-48 opacity-100" : "max-w-0 opacity-0"
        }`}
      >
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
          onPointerUp={(e) => e.currentTarget.blur() /* let the bar fold again */}
          title={t("Drag to zoom")}
          aria-label={t("Zoom")}
          className="h-1 w-24 cursor-pointer accent-indigo-600"
        />

        <button className={iconBtn} onClick={() => onZoom(zoom * 1.2)} title={`${t("Zoom in")} (Ctrl +)`}>
          <svg width="12" height="12" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M2.5 6h7M6 2.5v7" />
          </svg>
        </button>
      </div>

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
          aria-label={t("Zoom")}
          className="h-8 w-12 rounded-[5px] bg-transparent text-center text-xs font-semibold tabular-nums text-ink outline-none hover:bg-hover focus:bg-white focus:ring-2 focus:ring-accent"
        />
        <button onClick={() => setOpen(!open)} className="grid h-8 w-4 place-items-center rounded-[5px] text-muted outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent" title={t("Zoom presets")} aria-label={t("Zoom presets")} aria-expanded={open}>
          <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor">
            <path d="M1 2.5h6L4 6z" />
          </svg>
        </button>

        {open && (
          <div className="absolute end-0 bottom-full mb-2 w-36 rounded-md bg-neutral-900 p-1 text-xs text-white shadow-lg">
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
      className={`flex h-7 w-full items-center justify-between rounded-[5px] px-2 text-start outline-none hover:bg-accent focus-visible:bg-accent ${active ? "font-semibold" : ""}`}
    >
      {children}
      {active ? <Check size={12} strokeWidth={2.5} aria-hidden /> : hint && <span className="text-[11px] text-white/60">{hint}</span>}
    </button>
  );
}
