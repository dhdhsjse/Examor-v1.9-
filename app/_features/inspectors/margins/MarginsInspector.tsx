"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Ctx } from "@/app/_features/core/types";
import { MAX_MARGIN_MM, MIN_MARGIN_MM, mmToPx, pxToMm } from "@/app/_lib/a4";
import { pageMargins } from "@/app/_lib/onboarding/applyOnboarding";
import type { PageMargins } from "@/app/_lib/types";
import MiniA4 from "./MiniA4";
import { MARGIN_PRESETS } from "./presets";

type Side = keyof PageMargins;

// In the order of the rows. Labels are English keys (translated).
const SIDES: { side: Side; label: string }[] = [
  { side: "top", label: "Top edge" },
  { side: "bottom", label: "Bottom edge" },
  { side: "left", label: "Left edge" },
  { side: "right", label: "Right edge" },
];

const clampMm = (mm: number) => Math.max(MIN_MARGIN_MM, Math.min(Math.round(mm), MAX_MARGIN_MM));
const inRange = (mm: number) => mm >= MIN_MARGIN_MM && mm <= MAX_MARGIN_MM;
// A typed number ("12", "12,5"), or null.
const parseMm = (text: string) => {
  const n = Number(text.trim().replace(",", "."));
  return text.trim() && Number.isFinite(n) ? n : null;
};
// The panel works in whole millimetres, so a preset is chosen when it shows the same numbers.
const sameMm = (a: PageMargins, b: PageMargins) => SIDES.every(({ side }) => pxToMm(a[side]) === pxToMm(b[side]));

const stepBtn = "px-2 py-1 text-muted transition-colors hover:bg-subtle hover:text-ink disabled:opacity-35 disabled:hover:bg-transparent";

// Page layout → Margins, in the right panel. Every change shows on the canvas at once and becomes an
// undo step when it settles: a preset click, Enter, leaving the field, or half a second without a change.
// The unsaved draft lives in the shell (Shell.marginEdit), shared with the handles on the canvas, so a
// drag there updates the fields here. The margins apply to every page; blocks stay where they are.
export default function MarginsInspector({ ctx }: { ctx: Ctx }) {
  const { t, shell } = ctx;
  const saved = pageMargins(ctx.doc, Math.max(0, ctx.doc.pages.findIndex((p) => p.id === ctx.activePageId)));
  const draft = shell.marginEdit?.draft ?? null; // on the canvas, not saved yet
  const [typing, setTyping] = useState<{ side: Side; text: string } | null>(null); // a field's text while it is typed in
  const shown = draft ?? saved;

  // While the panel is open the canvas shows the margins being edited; closing it saves a draft.
  const latest = useRef(shell);
  useEffect(() => {
    latest.current = shell;
  });
  useEffect(() => {
    latest.current.openMarginEdit(true);
    return () => latest.current.openMarginEdit(false);
  }, []);

  // The last draft sent, until it is drawn: two quick clicks build on each other.
  const sent = useRef<PageMargins | null>(null);
  useEffect(() => {
    sent.current = null;
  }, [draft]);
  const current = () => sent.current ?? shown;

  const change = (m: PageMargins | null) => {
    sent.current = m;
    shell.draftMargins(m);
  };
  const save = (m: PageMargins) => {
    sent.current = null;
    shell.setMargins(m);
  };

  // Typing: a number in range shows at once; anything else waits for Enter or leaving the field.
  const type = (side: Side, text: string) => {
    setTyping({ side, text });
    const mm = parseMm(text);
    if (mm !== null && inRange(mm)) change({ ...current(), [side]: mmToPx(Math.round(mm)) });
  };
  const finish = () => {
    if (!typing) return;
    const mm = parseMm(typing.text);
    setTyping(null);
    save(mm === null ? current() : { ...current(), [typing.side]: mmToPx(clampMm(mm)) });
  };
  const step = (side: Side, delta: number) => {
    const typed = typing?.side === side ? parseMm(typing.text) : null;
    const base = current();
    setTyping(null);
    change({ ...base, [side]: mmToPx(clampMm((typed ?? pxToMm(base[side])) + delta)) });
  };
  const pick = (m: PageMargins) => {
    setTyping(null);
    save(m);
  };
  const cancel = () => {
    setTyping(null);
    change(null);
  };

  return (
    <div className="flex flex-col">
      <p className="mb-4 text-xs text-muted">{t("Adjust the printable area.")}</p>

      <div role="group" aria-label={t("Presets")} className="grid grid-cols-2 gap-2">
        {MARGIN_PRESETS.map((p) => {
          const on = sameMm(shown, p.margins);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => pick(p.margins)}
              className={`flex flex-col items-center gap-2 rounded-lg border p-2 text-xs transition-colors ${
                on ? "border-transparent bg-indigo-50 font-semibold text-accent ring-2 ring-indigo-500" : "border-line bg-white text-ink hover:border-indigo-300"
              }`}
            >
              <MiniA4 margins={p.margins} isSelected={on} />
              {t(p.nameKey)}
            </button>
          );
        })}
      </div>

      <hr className="my-4 border-line" />

      {SIDES.map(({ side, label }) => {
        const mm = pxToMm(shown[side]);
        const id = `margin-${side}`;
        return (
          <div key={side} className="mb-3 flex items-center justify-between">
            <label htmlFor={id} className="min-w-16 whitespace-nowrap text-sm font-medium text-ink">
              {t(label)}
            </label>
            <div dir="ltr" className="flex items-center overflow-hidden rounded-md border border-line bg-white">
              <button type="button" onClick={() => step(side, -1)} disabled={mm <= MIN_MARGIN_MM} aria-label={t("Decrease")} className={stepBtn}>
                <Minus size={14} strokeWidth={1.8} />
              </button>
              <input
                id={id}
                inputMode="decimal"
                autoComplete="off"
                value={typing?.side === side ? typing.text : String(mm)}
                onChange={(e) => type(side, e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={finish}
                onKeyDown={(e) => {
                  if (e.key === "Enter") finish();
                  else if (e.key === "Escape") cancel();
                  else if (e.key === "ArrowUp" || e.key === "ArrowDown") step(side, e.key === "ArrowUp" ? 1 : -1);
                  else return;
                  e.preventDefault();
                }}
                className="w-12 bg-transparent text-center text-sm tabular-nums text-ink outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button type="button" onClick={() => step(side, 1)} disabled={mm >= MAX_MARGIN_MM} aria-label={t("Increase")} className={stepBtn}>
                <Plus size={14} strokeWidth={1.8} />
              </button>
              <span className="pr-2 text-xs text-faint">mm</span>
            </div>
          </div>
        );
      })}
      <p className="text-[11px] leading-snug text-faint">{t("From {min} to {max} mm, on every page. Blocks stay where they are.", { min: MIN_MARGIN_MM, max: MAX_MARGIN_MM })}</p>
    </div>
  );
}
