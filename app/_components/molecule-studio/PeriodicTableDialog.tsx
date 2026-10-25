"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { ELEMENTS, PERIODIC_TABLE, elementName, tableCell, textColor, type ElementData } from "@/app/_lib/chemistry/periodicTable";
import { useUi } from "@/app/_lib/uiLang";

interface Props {
  selected: string;
  onPick: (symbol: string) => void;
  onClose: () => void;
}

// Rows 1–7 are the periods, row 8 a gap, rows 9–10 the lanthanides and actinides (see tableCell).
const ROW_SIZES = "repeat(7, minmax(0, 1fr)) 14px repeat(2, minmax(0, 1fr))";

// The periodic table as a dialog: pick any of the 118 elements.
export default function PeriodicTableDialog({ selected, onPick, onClose }: Props) {
  const { t, lang, rtl } = useUi();
  const [hover, setHover] = useState<string | null>(null);
  const shown = PERIODIC_TABLE[hover ?? selected];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={t("Periodic table")} dir="ltr" className="flex max-h-full w-full max-w-[1180px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center gap-4 border-b border-line px-5 py-3" dir={rtl ? "rtl" : "ltr"}>
          <h3 className="shrink-0 text-base font-semibold text-ink">{t("Periodic table")}</h3>
          <Details element={shown} lang={lang} hovering={hover !== null} />
          <button autoFocus onClick={onClose} className="ms-auto grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink" title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
            <X size={18} />
          </button>
        </header>

        <div className="min-h-0 overflow-auto p-4">
          <div data-testid="periodic-table" className="mx-auto grid min-w-[860px] gap-1" style={{ gridTemplateColumns: "repeat(18, minmax(0, 1fr))", gridTemplateRows: ROW_SIZES }}>
            {ELEMENTS.map((e) => (
              <Tile key={e.symbol} element={e} lang={lang} active={e.symbol === selected} onPick={onPick} onHover={setHover} />
            ))}
            {/* The f-block is drawn below the table; these two cells say where it belongs. */}
            <Marker row={6} label="57–71" />
            <Marker row={7} label="89–103" />
            <RowLabel row={9} label={t("Lanthanides")} />
            <RowLabel row={10} label={t("Actinides")} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ element: e, lang, active, onPick, onHover }: { element: ElementData; lang: "en" | "fr" | "ar"; active: boolean; onPick: (s: string) => void; onHover: (s: string | null) => void }) {
  const { row, col } = tableCell(e.atomicNumber);
  const name = elementName(e, lang);
  return (
    <button
      onClick={() => onPick(e.symbol)}
      onMouseEnter={() => onHover(e.symbol)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(e.symbol)}
      onBlur={() => onHover(null)}
      aria-pressed={active}
      aria-label={`${e.symbol} — ${name}`}
      data-symbol={e.symbol}
      style={{ gridRow: row, gridColumn: col }}
      className={`flex min-h-[54px] min-w-0 flex-col items-center justify-center rounded-md border px-0.5 py-1 leading-none transition-colors ${active ? "border-accent bg-accent-soft ring-1 ring-accent" : "border-line bg-subtle hover:border-accent hover:bg-accent-soft"}`}
    >
      <span className="self-start ps-0.5 text-[9px] tabular-nums text-faint">{e.atomicNumber}</span>
      <span className="text-[17px] font-bold" style={{ color: textColor(e.color) }}>
        {e.symbol}
      </span>
      <span className="mt-0.5 w-full truncate text-center text-[8.5px] text-muted">{name}</span>
    </button>
  );
}

function Marker({ row, label }: { row: number; label: string }) {
  return (
    <div style={{ gridRow: row, gridColumn: 3 }} className="grid place-items-center rounded-md border border-dashed border-line text-[10px] tabular-nums text-faint">
      {label}
    </div>
  );
}

function RowLabel({ row, label }: { row: number; label: string }) {
  return (
    <div style={{ gridRow: row, gridColumn: "1 / 3" }} className="flex items-center justify-end pe-2 text-[11px] font-medium text-muted">
      {label}
    </div>
  );
}

function Details({ element: e, lang, hovering }: { element: ElementData; lang: "en" | "fr" | "ar"; hovering: boolean }) {
  const { t } = useUi();
  return (
    <div className="flex min-w-0 items-baseline gap-3 text-sm" aria-live="polite">
      <span className="text-2xl font-bold" style={{ color: textColor(e.color) }}>
        {e.symbol}
      </span>
      <span className="truncate font-medium text-ink">{elementName(e, lang)}</span>
      <span className="hidden gap-3 text-xs text-muted sm:flex">
        <span>
          {t("Atomic number")}: <b className="tabular-nums text-ink">{e.atomicNumber}</b>
        </span>
        <span>
          {t("Atomic mass")}: <b className="tabular-nums text-ink">{e.atomicMass}</b>
        </span>
        <span>
          {t("Valence")}: <b className="tabular-nums text-ink">{e.valence || "—"}</b>
        </span>
      </span>
      {!hovering && <span className="hidden truncate text-xs text-faint lg:inline">{t("Hover an element to see its details.")}</span>}
    </div>
  );
}
