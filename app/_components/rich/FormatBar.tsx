"use client";

import { useEffect, useState, type ReactNode } from "react";
import { DEFAULT_FONT, FILL_COLORS, FONT_CHOICES, TEXT_COLORS, fontStack, installedFonts } from "@/app/_lib/fonts";
import type { RunStyle, StylePatch } from "@/app/_lib/richText";
import { useT } from "@/app/_lib/uiLang";

// Fonts found on this computer (all of them until the check is done).
export function useInstalledFonts(): Set<string> | null {
  const [fonts, setFonts] = useState<Set<string> | null>(null);
  useEffect(() => {
    let alive = true;
    void installedFonts().then((f) => alive && setFonts(f));
    return () => {
      alive = false;
    };
  }, []);
  return fonts;
}

// Font picker: the fonts in their own look; missing ones are greyed out.
export function FontSelect({ value, onChange, defaultLabel, className }: { value: string | undefined; onChange: (v: string | undefined) => void; defaultLabel: string; className?: string }) {
  const t = useT();
  const fonts = useInstalledFonts();
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      className={className}
      style={{ fontFamily: fontStack(value) }}
      title={t("Font")}
    >
      <option value="">{defaultLabel}</option>
      {FONT_CHOICES.map((f) => {
        const missing = fonts && !fonts.has(f.name);
        return (
          <option key={f.name} value={f.name} disabled={!!missing} style={{ fontFamily: fontStack(f.name) }}>
            {f.name}
            {f.script === "arabic" ? " — عربي" : ""}
            {missing ? ` (${t("not installed")})` : ""}
          </option>
        );
      })}
    </select>
  );
}

// Color swatches + a custom color. `value` undefined = automatic. `colors`: the swatches (text colors by default).
export function ColorGrid({ value, onChange, autoLabel, colors = TEXT_COLORS }: { value: string | undefined; onChange: (v: string | undefined) => void; autoLabel?: string; colors?: string[] }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-1">
      {autoLabel && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(undefined)}
          className={`h-5 rounded border px-1.5 text-[10px] font-medium ${!value ? "border-indigo-500 text-indigo-600" : "border-line text-muted hover:border-slate-400"}`}
        >
          {autoLabel}
        </button>
      )}
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          title={c}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(c)}
          className={`size-5 rounded-full ring-offset-1 transition-transform hover:scale-110 ${value?.toLowerCase() === c ? "ring-2 ring-indigo-500" : "ring-1 ring-black/10"}`}
          style={{ background: c }}
        />
      ))}
      <label className="relative grid size-5 cursor-pointer place-items-center rounded-full ring-1 ring-black/10" title={t("Custom color")} style={{ background: "conic-gradient(red, yellow, lime, aqua, blue, magenta, red)" }}>
        <input type="color" value={value ?? colors[0]} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>
  );
}

interface Props {
  style: RunStyle; // style of the selected text
  baseFont: string | undefined; // font of the block
  baseSize: number;
  baseColor: string;
  onApply: (patch: StylePatch | "clear") => void;
  onToggle: (key: "b" | "i" | "u" | "x" | "sub" | "sup") => void;
}

const btn = (on = false) =>
  `grid h-7 min-w-7 place-items-center rounded-md px-1 text-[13px] transition-colors ${on ? "bg-indigo-600 text-white" : "text-ink hover:bg-black/5"}`;

// Floating bar over the text being typed: style the selected words (nothing selected = all the text).
export default function FormatBar({ style, baseFont, baseSize, baseColor, onApply, onToggle }: Props) {
  const t = useT();
  const [colors, setColors] = useState(false);
  const [highlights, setHighlights] = useState(false);
  const size = style.size ?? baseSize;
  const color = style.color ?? baseColor;
  const keep = (e: React.MouseEvent) => e.preventDefault(); // keep the text selection

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-line bg-white p-1 shadow-[0_8px_24px_-8px_rgba(16,24,40,0.35)]" dir="ltr">
      <FontSelect
        value={style.font}
        onChange={(font) => onApply({ font: font ?? null })}
        defaultLabel={baseFont ?? DEFAULT_FONT}
        className="h-7 w-32 rounded-md border border-line bg-white px-1 text-xs text-ink outline-none focus:border-indigo-400"
      />
      <Sep />
      <button type="button" className={btn()} onMouseDown={keep} onClick={() => onApply({ size: Math.max(8, size - 1) })} title={t("Smaller")}>
        <span className="text-[11px] font-semibold">A−</span>
      </button>
      <span className="w-7 text-center text-xs font-semibold tabular-nums text-ink" title={t("Font size")}>
        {size}
      </span>
      <button type="button" className={btn()} onMouseDown={keep} onClick={() => onApply({ size: Math.min(72, size + 1) })} title={t("Bigger")}>
        <span className="text-[13px] font-semibold">A+</span>
      </button>
      <Sep />
      <button type="button" className={btn(style.b)} onMouseDown={keep} onClick={() => onToggle("b")} title={`${t("Bold")} (Ctrl+B)`}>
        <b>B</b>
      </button>
      <button type="button" className={btn(style.i)} onMouseDown={keep} onClick={() => onToggle("i")} title={`${t("Italic")} (Ctrl+I)`}>
        <i className="font-serif">I</i>
      </button>
      <button type="button" className={btn(style.u)} onMouseDown={keep} onClick={() => onToggle("u")} title={`${t("Underline")} (Ctrl+U)`}>
        <u>U</u>
      </button>
      <button type="button" className={btn(style.x)} onMouseDown={keep} onClick={() => onToggle("x")} title={t("Strikethrough")}>
        <s>S</s>
      </button>
      <button type="button" className={btn(style.sub)} onMouseDown={keep} onClick={() => onToggle("sub")} title={`${t("Subscript")} (Ctrl+,)`}>
        <span className="text-[12px] leading-none">
          x<sub className="text-[8px]">2</sub>
        </span>
      </button>
      <button type="button" className={btn(style.sup)} onMouseDown={keep} onClick={() => onToggle("sup")} title={`${t("Superscript")} (Ctrl+.)`}>
        <span className="text-[12px] leading-none">
          x<sup className="text-[8px]">2</sup>
        </span>
      </button>
      <Sep />
      <div className="relative">
        <button type="button" className={btn(colors)} onMouseDown={keep} onClick={() => setColors(!colors)} title={t("Text color")}>
          <span className="flex flex-col items-center leading-none">
            <span className="text-[13px] font-semibold">A</span>
            <span className="mt-0.5 h-1 w-4 rounded-full" style={{ background: color }} />
          </span>
        </button>
        {colors && (
          <div className="absolute top-full right-0 z-10 mt-1.5 w-[188px] rounded-lg border border-line bg-white p-2 shadow-lg">
            <ColorGrid
              value={style.color}
              autoLabel={t("Auto")}
              onChange={(c) => {
                onApply({ color: c ?? null });
                setColors(false);
              }}
            />
          </div>
        )}
      </div>
      <div className="relative">
        <button type="button" className={btn(highlights)} onMouseDown={keep} onClick={() => setHighlights(!highlights)} title={t("Highlight color")}>
          <span className="flex flex-col items-center leading-none">
            <span className="text-[13px] font-semibold">ab</span>
            <span className="mt-0.5 h-1 w-4 rounded-full ring-1 ring-black/10" style={{ background: style.hl ?? "#fef08a" }} />
          </span>
        </button>
        {highlights && (
          <div className="absolute top-full right-0 z-10 mt-1.5 w-[188px] rounded-lg border border-line bg-white p-2 shadow-lg">
            <ColorGrid
              value={style.hl}
              autoLabel={t("None")}
              colors={FILL_COLORS}
              onChange={(c) => {
                onApply({ hl: c ?? null });
                setHighlights(false);
              }}
            />
          </div>
        )}
      </div>
      <Sep />
      <button type="button" className={btn()} onMouseDown={keep} onClick={() => onApply("clear")} title={t("Clear formatting")}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M4 3h9M8.5 3 6 13M3 14l10-10" />
        </svg>
      </button>
    </div>
  );
}

function Sep(): ReactNode {
  return <div className="mx-0.5 h-4 w-px bg-line" />;
}
