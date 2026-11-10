"use client";

import { ChevronDown, Plus } from "lucide-react";
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

// Color swatches + a custom color. `value` undefined = automatic. `colors`: the swatches (text colors by default). `custom` false: the
// swatches alone (what shows them has its own way to any other color).
export function ColorGrid({ value, onChange, autoLabel, colors = TEXT_COLORS, custom = true }: { value: string | undefined; onChange: (v: string | undefined) => void; autoLabel?: string; colors?: string[]; custom?: boolean }) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-1">
      {autoLabel && (
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onChange(undefined)}
          className={`h-5 rounded-[3px] border px-1.5 text-[11px] font-medium ${!value ? "border-accent text-accent" : "border-line text-muted hover:border-faint"}`}
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
          className={`size-5 rounded-[3px] ring-offset-1 ${value?.toLowerCase() === c ? "ring-2 ring-accent" : "ring-1 ring-black/10 hover:ring-black/30"}`}
          style={{ background: c }}
        />
      ))}
      {custom && (
        <label className="relative grid size-5 cursor-pointer place-items-center rounded-[3px] text-muted ring-1 ring-line hover:text-ink hover:ring-faint" title={t("Custom color")}>
          <Plus size={12} strokeWidth={2} aria-hidden />
          <input type="color" value={value ?? colors[0]} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
      )}
    </div>
  );
}

interface Props {
  style: RunStyle; // style of the selected text
  baseFont: string | undefined; // font of the block
  baseSize: number;
  onApply: (patch: StylePatch | "clear") => void;
  onToggle: (key: "b" | "i" | "u" | "x" | "sub" | "sup") => void;
}

const btn = (on = false) =>
  `grid h-7 min-w-7 place-items-center rounded-md px-1 text-[13px] transition-colors ${on ? "bg-accent text-white" : "text-ink hover:bg-black/5"}`;

// Floating bar over the text being typed: style the selected words (nothing selected = all the text).
export default function FormatBar({ style, baseFont, baseSize, onApply, onToggle }: Props) {
  const t = useT();
  const [colors, setColors] = useState(false);
  const [highlights, setHighlights] = useState(false);
  const size = style.size ?? baseSize;
  const [textPen, setTextPen] = usePen("text", "#dc2626");
  const [hlPen, setHlPen] = usePen("highlight", "#fef08a");
  const keep = (e: React.MouseEvent) => e.preventDefault(); // keep the text selection

  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-line bg-white p-1 shadow-[0_8px_24px_-8px_rgba(16,24,40,0.35)]" dir="ltr">
      <FontSelect
        value={style.font}
        onChange={(font) => onApply({ font: font ?? null })}
        defaultLabel={baseFont ?? DEFAULT_FONT}
        className="h-7 w-24 truncate rounded-md border border-line bg-white px-1 text-[11px] text-ink outline-none focus:border-accent"
      />
      <Sep />
      <button type="button" className={btn()} onMouseDown={keep} onClick={() => onApply({ size: Math.max(8, size - 1) })} title={t("Smaller")}>
        <span className="text-xs font-semibold">A−</span>
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
      <ColorSplit
        open={colors}
        setOpen={(v) => {
          setColors(v);
          setHighlights(false);
        }}
        pen={textPen}
        title={t("Text color")}
        label={<span className="text-[13px] font-semibold">A</span>}
        keep={keep}
        on={!!style.color && style.color.toLowerCase() === textPen.toLowerCase()}
        onPut={(on) => onApply({ color: on ? null : textPen })}
      >
        <ColorGrid
          value={style.color}
          autoLabel={t("Auto")}
          onChange={(c) => {
            if (c) setTextPen(c);
            onApply({ color: c ?? null });
            setColors(false);
          }}
        />
      </ColorSplit>
      <ColorSplit
        open={highlights}
        setOpen={(v) => {
          setHighlights(v);
          setColors(false);
        }}
        pen={hlPen}
        title={t("Highlight color")}
        label={<span className="text-[13px] font-semibold">ab</span>}
        keep={keep}
        on={!!style.hl && style.hl.toLowerCase() === hlPen.toLowerCase()}
        onPut={(on) => onApply({ hl: on ? null : hlPen })}
      >
        <ColorGrid
          value={style.hl}
          autoLabel={t("None")}
          colors={FILL_COLORS}
          onChange={(c) => {
            if (c) setHlPen(c);
            onApply({ hl: c ?? null });
            setHighlights(false);
          }}
        />
      </ColorSplit>
      <Sep />
      <button type="button" className={btn()} onMouseDown={keep} onClick={() => onApply("clear")} title={t("Clear formatting")}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M4 3h9M8.5 3 6 13M3 14l10-10" />
        </svg>
      </button>
    </div>
  );
}

// The color a color button puts on in one click (red text, yellow highlight to begin with). Picking a color in its panel makes
// that the new one, kept for the next time.
function usePen(kind: "text" | "highlight", fallback: string): [string, (c: string) => void] {
  const key = `formatBar.pen.${kind}`;
  const [pen, setPen] = useState(() => (typeof window === "undefined" ? fallback : (localStorage.getItem(key) ?? fallback)));
  const change = (c: string) => {
    setPen(c);
    try {
      localStorage.setItem(key, c);
    } catch {}
  };
  return [pen, change];
}

// A split color button: the main part puts on the current color, or takes it off when the text already has it (it shows
// pressed then); the arrow opens the panel (upward, away from the text being
// typed under the bar) to choose another.
function ColorSplit({
  open,
  setOpen,
  pen,
  title,
  label,
  keep,
  on,
  onPut,
  children,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  pen: string;
  title: string;
  label: ReactNode;
  keep: (e: React.MouseEvent) => void;
  on: boolean; // the selected text already has this color: the button shows pressed, and a click takes the color off
  onPut: (on: boolean) => void;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <div className="relative flex items-center">
      <button
        type="button"
        className={`grid h-7 min-w-6 place-items-center rounded-md rounded-r-none pr-0.5 pl-1 text-[13px] text-ink transition-[background-color,box-shadow] ${on ? "bg-black/[0.08] shadow-[inset_0_1px_3px_rgba(0,0,0,0.3)]" : "hover:bg-black/5"}`}
        onMouseDown={keep}
        onClick={() => onPut(on)}
        title={title}
        aria-pressed={on}
      >
        <span className="flex flex-col items-center leading-none">
          {label}
          <span className="mt-0.5 h-1 w-4 rounded-full ring-1 ring-black/10" style={{ background: pen }} />
        </span>
      </button>
      <button
        type="button"
        className={`grid h-7 w-3.5 place-items-center rounded-md rounded-l-none transition-colors ${open ? "bg-accent text-white" : "text-muted hover:bg-black/5 hover:text-ink"}`}
        onMouseDown={keep}
        onClick={() => setOpen(!open)}
        title={t("More colors")}
        aria-expanded={open}
      >
        <ChevronDown size={11} strokeWidth={2.25} aria-hidden />
      </button>
      {open && <div className="absolute bottom-full right-0 z-10 mb-1.5 w-[188px] rounded-lg border border-line bg-white p-2 shadow-lg">{children}</div>}
    </div>
  );
}

function Sep(): ReactNode {
  return <div className="mx-0.5 h-4 w-px bg-line" />;
}
