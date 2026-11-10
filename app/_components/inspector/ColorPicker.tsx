"use client";

import { Pipette } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "@/app/_lib/uiLang";

/** Hue 0–360, saturation and brightness 0–1 */
interface Hsv { h: number; s: number; v: number }

const HEX = /^#?([0-9a-f]{6})$/i;
const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function hexToHsv(hex: string): Hsv {
  const n = Number.parseInt(HEX.exec(hex)?.[1] ?? "000000", 16);
  const r = (n >> 16) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const h = d === 0 ? 0 : max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return Math.round((v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255).toString(16).padStart(2, "0");
  };
  return `#${f(5)}${f(3)}${f(1)}`;
}

// The color at a place of the strip of hues ("hue") or of the square of shades (x and y from 0 to 1), and the one an arrow key leads to
const under = (part: string | undefined, old: Hsv, x: number, y: number): Hsv => (part === "hue" ? { ...old, h: Math.min(359.9, x * 360) } : { ...old, s: x, v: 1 - y });
const stepped = (part: string | undefined, old: Hsv, dx: number, dy: number): Hsv =>
  part === "hue" ? { ...old, h: (old.h + (dx + dy) * 5 + 360) % 360 } : { ...old, s: clamp(old.s + dx * 0.05), v: clamp(old.v + dy * 0.05) };
const ARROWS: Record<string, [number, number] | undefined> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };

interface EyeDropperWindow { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }

const thumb = "pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#fff] shadow-[0_0_0_1px_rgb(0_0_0/0.35),0_1px_3px_rgb(0_0_0/0.4)]";

// Any color: a square of shades, a strip of hues, the color's code, and a pipette that takes a color from the screen (where the browser
// has one). Sliding only moves the picker itself: `onChange` is called once, when the mouse is let go, so what the color is for is not
// redrawn for every color the pointer goes over.
export default function ColorPicker({ value, onChange }: {
  /** The color chosen now (undefined: none; the picker starts on yellow) */
  value: string | undefined;
  /** A color is chosen: the slide is over, a key moved it, a whole code is typed, or the pipette took one */
  onChange: (color: string) => void;
}) {
  const t = useT();
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value && HEX.test(value) ? value : "#ffff00"));
  const [draft, setDraft] = useState<string | null>(null); // the code while it is typed
  const latest = useRef(hsv);
  const box = useRef<DOMRect | null>(null);
  const hex = hsvToHex(hsv);
  const canPick = typeof window !== "undefined" && "EyeDropper" in window;

  const show = (next: Hsv) => {
    latest.current = next;
    setHsv(next);
    setDraft(null);
  };
  const choose = (next: Hsv) => {
    show(next);
    onChange(hsvToHex(next));
  };

  // A slide on the square or on the strip (told apart by `data-part`)
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = box.current;
    if (r) show(under(e.currentTarget.dataset.part, latest.current, clamp((e.clientX - r.left) / r.width), clamp((e.clientY - r.top) / r.height)));
  };
  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    box.current = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    move(e);
  };
  const drag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e);
  };
  // (let go, or taken away: the color it stopped on is the one chosen)
  const drop = () => {
    box.current = null;
    onChange(hsvToHex(latest.current));
  };
  // The arrows move it too
  const arrows = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const d = ARROWS[e.key];
    if (!d) return;
    e.preventDefault();
    e.stopPropagation();
    choose(stepped(e.currentTarget.dataset.part, latest.current, d[0], d[1]));
  };

  const pipette = async () => {
    try {
      const { sRGBHex } = await new (window as unknown as EyeDropperWindow).EyeDropper().open();
      if (HEX.test(sRGBHex)) choose(hexToHsv(sRGBHex));
    } catch {
      // (Esc: nothing is taken)
    }
  };

  return (
    <div className="flex flex-col gap-2" data-testid="color-picker">
      <div
        data-part="shade"
        onPointerDown={down}
        onPointerMove={drag}
        onLostPointerCapture={drop}
        onKeyDown={arrows}
        role="slider"
        tabIndex={0}
        aria-label={t("Shade")}
        aria-valuetext={hex}
        aria-valuenow={Math.round(hsv.s * 100)}
        data-testid="color-picker-shade"
        className="relative h-28 cursor-crosshair touch-none rounded-md outline-none ring-1 ring-black/10 focus-visible:ring-2 focus-visible:ring-accent"
        style={{ background: `linear-gradient(to top, #000, rgb(0 0 0 / 0)), linear-gradient(to right, #fff, rgb(255 255 255 / 0)), hsl(${hsv.h} 100% 50%)` }}
      >
        <span aria-hidden className={thumb} style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
      </div>
      <div
        data-part="hue"
        onPointerDown={down}
        onPointerMove={drag}
        onLostPointerCapture={drop}
        onKeyDown={arrows}
        role="slider"
        tabIndex={0}
        aria-label={t("Hue")}
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        data-testid="color-picker-hue"
        className="relative mx-[7px] h-3 cursor-pointer touch-none rounded-full outline-none ring-1 ring-black/10 focus-visible:ring-2 focus-visible:ring-accent"
        style={{ background: "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)" }}
      >
        <span aria-hidden className={`${thumb} top-1/2`} style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }} />
      </div>
      <div className="flex items-center gap-1.5">
        {canPick && (
          <button
            type="button"
            onClick={() => void pipette()}
            title={t("Pick a color from the screen")}
            aria-label={t("Pick a color from the screen")}
            data-testid="color-picker-pipette"
            className="grid size-7 shrink-0 place-items-center rounded-[5px] border border-line text-ink outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
          >
            <Pipette size={14} aria-hidden />
          </button>
        )}
        <span aria-hidden className="size-7 shrink-0 rounded-[5px] ring-1 ring-black/15" style={{ background: hex }} />
        <input
          type="text"
          value={draft ?? hex}
          maxLength={7}
          spellCheck={false}
          aria-label={t("Color code")}
          data-testid="color-picker-hex"
          onChange={(e) => {
            const typed = e.target.value.trim();
            const whole = HEX.exec(typed);
            if (whole) choose(hexToHsv(whole[1]));
            else setDraft(typed);
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="h-7 min-w-0 flex-1 rounded-[5px] border border-line bg-surface px-1.5 font-mono text-xs text-ink uppercase outline-none focus:ring-2 focus:ring-accent"
        />
      </div>
    </div>
  );
}
