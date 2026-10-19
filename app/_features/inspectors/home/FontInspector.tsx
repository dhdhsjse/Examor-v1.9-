"use client";

import { Check, MousePointerClick } from "lucide-react";
import { hasFontControls } from "@/app/_components/inspector/FontControls";
import { useInstalledFonts } from "@/app/_components/rich/FormatBar";
import type { Ctx } from "@/app/_features/core/types";
import { FONT_CATEGORIES, fontLibrary } from "@/app/_features/libraries/fonts";
import { DEFAULT_FONT, fontStack } from "@/app/_lib/fonts";
import type { BlockFont } from "@/app/_lib/types";

// What a card shows in its own font: Arabic for Arabic fonts, a French line for the others.
const SAMPLE = { arabic: "أجب عن الأسئلة التالية", latin: "Exercice 1 — Évaluation" };

const card = (on: boolean, missing: boolean) =>
  `flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start transition-colors ${
    on ? "border-indigo-500 bg-indigo-50 ring-1 ring-indigo-500" : missing ? "border-line bg-subtle/50 opacity-55" : "border-line bg-white hover:border-indigo-300"
  }`;

// Home → Font, in the right panel: every font of the font library (app/_features/libraries/fonts.ts),
// grouped and each drawn in its own look, for the selected block (the whole block; single words are
// styled on the page). Stays open while other blocks are selected. Fonts not installed on this computer
// are greyed out. A header / footer gets the font in its settings (so on every page that shows it).
export default function FontInspector({ ctx }: { ctx: Ctx }) {
  const { t, shell, doc } = ctx;
  const installed = useInstalledFonts();
  const b = shell.selected;

  if (!b || !hasFontControls(b)) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
        <MousePointerClick size={28} strokeWidth={1.4} className="text-faint" />
        <p className="text-sm text-muted">{b ? t("This block has no text to change the font of.") : t("Select a text block on the page to change its font.")}</p>
      </div>
    );
  }

  const current = b.font?.family;
  const pick = (family: string | undefined) => {
    const next: BlockFont = { ...b.font, family };
    if (!family) delete next.family;
    shell.updateBlock(b.id, { font: Object.keys(next).length ? next : undefined }, "font");
  };
  const examFont = doc.meta.fontFamily ?? DEFAULT_FONT;

  return (
    <div className="flex flex-col gap-4">
      <button type="button" aria-pressed={!current} onClick={() => pick(undefined)} className={card(!current, false)}>
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-base text-ink" style={{ fontFamily: fontStack(examFont) }}>
            {t("Exam font")} ({examFont})
          </span>
          <span className="text-[10px] text-faint">{t("The font chosen for the whole exam")}</span>
        </span>
        {!current && <Check size={16} className="shrink-0 text-accent" />}
      </button>

      {FONT_CATEGORIES.map((cat) => {
        const fonts = fontLibrary.filter((f) => f.category === cat.id);
        if (!fonts.length) return null;
        return (
          <section key={cat.id} className="flex flex-col gap-1.5">
            <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">{t(cat.label)}</h3>
            {fonts.map((f) => {
              const on = current === f.value;
              const missing = !!installed && !installed.has(f.value);
              return (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={on}
                  disabled={missing && !on}
                  title={missing ? t("Not installed on this computer") : undefined}
                  onClick={() => pick(f.value)}
                  className={card(on, missing)}
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-base text-ink" style={{ fontFamily: fontStack(f.value) }}>
                      {f.label}
                    </span>
                    <span className="truncate text-xs text-muted" dir="auto" style={{ fontFamily: fontStack(f.value) }}>
                      {f.script === "latin" ? SAMPLE.latin : SAMPLE.arabic}
                    </span>
                    {missing && <span className="text-[10px] text-faint">{t("Not installed on this computer")}</span>}
                  </span>
                  {on && <Check size={16} className="shrink-0 text-accent" />}
                </button>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
