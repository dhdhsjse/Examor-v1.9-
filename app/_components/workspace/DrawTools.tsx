"use client";

import { ChevronDown, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  INK_PALETTES,
  INK_SIZES,
  InkCapture,
  SMOOTHING_LABELS,
  finishInk,
  inkModel,
  seeded,
  type InkPoint,
  type InkSettings,
  type InkTool,
  type Smoothing,
} from "@/app/_lib/ink/engine";
import type { InkTools } from "@/app/_lib/ink/useInkTools";
import { useT } from "@/app/_lib/uiLang";
import InkToolArt from "./InkToolArt";

// The order in the tray: the pencil is the Draw button itself; the brush slides out on its left, the highlighter on its right.
const TRAY: readonly InkTool[] = ["brush", "pencil", "highlighter"];
const NAMES: Record<InkTool, string> = { brush: "Brush", pencil: "Pencil", highlighter: "Highlighter" };
const SLOT = 34; // px, the width of a tool in the tray
const SPRING = "cubic-bezier(0.22, 1.2, 0.36, 1)"; // (a little past the end, then back: the tray stretches like elastic)

// The Draw button of the floating tool bar: a pencil standing in it. Clicked, the tool bar stretches and the brush and the
// highlighter come out on each side of it; the one in hand stands up higher. Over the bar, a bubble says how it draws: its color,
// its size and how much the hand is steadied (with a picture of the stroke). Clicking the tool in hand hides / shows the bubble.
export default function DrawTools({ open, ink, onOpen }: { open: boolean; ink: InkTools; onOpen: () => void }) {
  const t = useT();
  const [bubble, setBubble] = useState(true);
  const slots = useRef<Partial<Record<InkTool, HTMLButtonElement | null>>>({});
  const panel = useRef<HTMLDivElement>(null);
  const [notch, setNotch] = useState(0);
  const showBubble = open && bubble;

  // The notch of the bubble points at the tool in hand (measured again while the tray stretches).
  useLayoutEffect(() => {
    if (!showBubble) return;
    let frame = 0;
    const measure = () => {
      const slot = slots.current[ink.tool]?.getBoundingClientRect();
      const box = panel.current?.getBoundingClientRect();
      if (slot && box) setNotch(slot.left + slot.width / 2 - box.left);
    };
    const until = performance.now() + 600;
    const loop = () => {
      measure();
      if (performance.now() < until) frame = requestAnimationFrame(loop);
    };
    loop();
    // (and whenever the bar or the bubble changes size: the tray stretching, the palette opening)
    const sizes = new ResizeObserver(measure);
    const bar = panel.current?.offsetParent;
    if (bar) sizes.observe(bar);
    if (panel.current) sizes.observe(panel.current);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      sizes.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [showBubble, ink.tool]);

  // The bubble steps aside on its own as soon as a stroke starts on the page (the tool bar brings it back).
  useEffect(() => {
    if (!showBubble) return;
    const hide = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (el?.tagName === "CANVAS" && el.closest(".konvajs-content")) setBubble(false);
    };
    window.addEventListener("pointerdown", hide, true);
    return () => window.removeEventListener("pointerdown", hide, true);
  }, [showBubble]);

  const press = (tool: InkTool) => {
    if (!open) {
      // (the pencil is the Draw button: it opens the tray with the tool used last)
      setBubble(true);
      return onOpen();
    }
    if (tool === ink.tool) setBubble(!bubble);
    else {
      ink.pick(tool);
      setBubble(true);
    }
  };

  return (
    <>
      <div className="flex items-center" data-testid="draw-tools">
        {TRAY.map((tool, i) => {
          const side = tool !== "pencil";
          const shown = open || !side;
          const inHand = open && tool === ink.tool;
          const color = ink.settings[tool].color;
          const label = side ? t(NAMES[tool]) : open ? t(NAMES[tool]) : `${t("Draw")} (P)`;
          return (
            <div
              key={tool}
              className="relative h-8 shrink-0"
              style={{
                width: shown ? SLOT : 0,
                transition: `width 460ms ${SPRING}`,
                // the tools may stand out of the top of the bar, never out of its bottom
                clipPath: "inset(-22px 0 0 0)",
              }}
            >
              <button
                ref={(el) => {
                  slots.current[tool] = el;
                }}
                type="button"
                onClick={() => press(tool)}
                aria-pressed={inHand}
                aria-label={label}
                title={label}
                tabIndex={shown ? 0 : -1}
                data-testid={`ink-${tool}`}
                className={`group absolute inset-y-0 ${tool === "brush" ? "right-0" : "left-0"} w-[34px] rounded-[6px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${inHand ? "bg-black/[0.07]" : "hover:bg-black/[0.04]"}`}
              >
                <span
                  className="absolute start-1/2 top-0 block"
                  style={{
                    transform: `translate(-50%, ${!shown ? 34 : inHand ? -15 : 3}px)`,
                    opacity: shown ? 1 : 0,
                    transition: `transform 420ms ${SPRING} ${open && side ? 90 + i * 30 : 0}ms, opacity 200ms ease ${open && side ? 60 : 0}ms`,
                  }}
                >
                  <span className={`block transition-transform duration-200 ease-out ${inHand ? "" : "group-hover:-translate-y-[5px]"}`}>
                    <InkToolArt tool={tool} color={color} className="h-[50px] w-[22px]" />
                  </span>
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* the bubble over the bar (bottom-right of the screen: it is held by the bar's right end, its notch points at the tool) */}
      <div
        ref={panel}
        role="group"
        aria-label={t(NAMES[ink.tool])}
        aria-hidden={!showBubble}
        className={`absolute bottom-full start-0 mb-3 origin-bottom transition-[opacity,transform] duration-300 ${showBubble ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-2 scale-[0.97] opacity-0"}`}
        style={{ transitionTimingFunction: SPRING }}
      >
        {open && <InkPanel tool={ink.tool} settings={ink.settings[ink.tool]} onChange={ink.set} />}
        <span
          aria-hidden
          className="absolute top-full block size-3 -translate-x-1/2 -translate-y-1.5 rotate-45 rounded-[2px] bg-white shadow-[2px_2px_3px_-1px_rgba(0,0,0,0.12)] transition-[left] duration-300"
          style={{ left: notch, transitionTimingFunction: SPRING }}
        />
      </div>
    </>
  );
}

// The settings of the tool in hand: a swatch of its color (its palette opens under it), its size (typed or slid), and how
// much the hand is steadied, shown as a stroke drawn with it.
function InkPanel({ tool, settings, onChange }: { tool: InkTool; settings: InkSettings; onChange: (patch: Partial<InkSettings>) => void }) {
  const t = useT();
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const [lo, hi] = INK_SIZES[tool];
  const root = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState<string | null>(null); // the size being typed (kept as written until it is done)

  useEffect(() => {
    if (!menu && !palette) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) {
        // (Esc closes only the menu: the drawing tool stays in hand)
        if (e instanceof KeyboardEvent) e.stopPropagation();
        setMenu(false);
        setPalette(false);
      }
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close, true);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close, true);
    };
  }, [menu, palette]);

  const size = (v: number) => onChange({ size: Math.min(hi, Math.max(lo, Math.round(v))) });

  return (
    <div ref={root} dir="ltr" className="rounded-[14px] border border-black/[0.06] bg-white p-2 shadow-[0_10px_34px_-10px_rgba(16,24,40,0.35),0_2px_6px_-2px_rgba(16,24,40,0.12)]">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setPalette(!palette);
            setMenu(false);
          }}
          aria-expanded={palette}
          title={t("Color")}
          aria-label={t("Color")}
          data-testid="ink-color"
          className="size-8 shrink-0 rounded-[7px] border border-black/10 shadow-[inset_0_0_0_2px_rgba(255,255,255,0.35)] transition-transform outline-none hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-accent active:scale-95"
          style={{ background: settings.color }}
        />

        <div className="flex h-8 items-center rounded-[8px] bg-[#f3f3f5] ps-2 pe-1">
          <input
            type="number"
            min={lo}
            max={hi}
            value={typed ?? settings.size}
            onChange={(e) => {
              setTyped(e.target.value);
              const v = Number(e.target.value);
              if (e.target.value !== "" && Number.isFinite(v) && v >= lo && v <= hi) size(v);
            }}
            onBlur={() => setTyped(null)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            aria-label={t("Size")}
            data-testid="ink-size"
            className="w-6 bg-transparent text-[13px] text-ink tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          <span aria-hidden className="mx-1 h-8 w-px bg-white" />
          <Slider value={settings.size} min={lo} max={hi} onChange={size} label={t("Size")} />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setMenu(!menu);
              setPalette(false);
            }}
            aria-expanded={menu}
            aria-haspopup="listbox"
            title={`${t("Smoothing")}: ${t(SMOOTHING_LABELS[settings.smoothing])}`}
            data-testid="ink-smoothing"
            className="flex h-8 w-[104px] items-center gap-1 rounded-[8px] border border-black/[0.12] bg-white ps-2 pe-1.5 outline-none transition-colors hover:border-black/25 focus-visible:ring-2 focus-visible:ring-accent"
          >
            <StrokePreview tool={tool} settings={settings} width={72} height={18} />
            <ChevronDown size={14} strokeWidth={2} className={`shrink-0 text-ink transition-transform duration-200 ${menu ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {menu && (
            <div role="listbox" aria-label={t("Smoothing")} className="absolute bottom-full end-0 mb-2 w-[200px] rounded-[12px] border border-black/[0.06] bg-white p-1.5 shadow-[0_10px_30px_-8px_rgba(16,24,40,0.3)]">
              <div className="px-2 pt-1 pb-1.5 text-[11px] font-medium text-muted">{t("Smoothing — how much your hand is steadied")}</div>
              {([3, 2, 1, 0] as Smoothing[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  role="option"
                  aria-selected={level === settings.smoothing}
                  onClick={() => {
                    onChange({ smoothing: level });
                    setMenu(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-start outline-none transition-colors ${level === settings.smoothing ? "bg-[#eef4ff]" : "hover:bg-black/[0.04] focus-visible:bg-black/[0.04]"}`}
                >
                  <StrokePreview tool={tool} settings={{ ...settings, smoothing: level }} width={96} height={20} />
                  <span className="flex-1 text-[12px] text-ink">{t(SMOOTHING_LABELS[level])}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* the palette, opened under the controls */}
      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${palette ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-1.5 pt-2">
            {INK_PALETTES[tool].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onChange({ color: c })}
                tabIndex={palette ? 0 : -1}
                aria-label={c}
                title={c}
                className={`size-6 rounded-full border border-black/10 transition-transform outline-none hover:scale-110 focus-visible:ring-2 focus-visible:ring-accent ${c.toLowerCase() === settings.color.toLowerCase() ? "ring-2 ring-[#2f80ed] ring-offset-1" : ""}`}
                style={{ background: c }}
              />
            ))}
            <label
              title={t("Custom color")}
              className="relative grid size-6 cursor-pointer place-items-center rounded-full transition-transform hover:scale-110"
              style={{ background: "conic-gradient(#f44336, #ffeb3b, #4caf50, #00bcd4, #3f51b5, #e91e63, #f44336)" }}
            >
              <span className="grid size-4 place-items-center rounded-full bg-white">
                <Plus size={10} strokeWidth={2.5} className="text-ink" aria-hidden />
              </span>
              <input
                type="color"
                tabIndex={palette ? 0 : -1}
                value={/^#[0-9a-f]{6}$/i.test(settings.color) ? settings.color : "#000000"}
                onChange={(e) => onChange({ color: e.target.value })}
                aria-label={t("Custom color")}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

// A slider like the ones of a drawing app: a thin track filled in blue up to a round white knob.
function Slider({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  const track = useRef<HTMLDivElement>(null);
  const f = (Math.min(max, Math.max(min, value)) - min) / (max - min || 1);
  const from = (x: number) => {
    const r = track.current?.getBoundingClientRect();
    if (r) onChange(min + Math.min(1, Math.max(0, (x - r.left) / r.width)) * (max - min));
  };
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        from(e.clientX);
      }}
      onPointerMove={(e) => {
        if (e.buttons & 1) from(e.clientX);
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 5 : 1;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(value + step);
        else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(value - step);
        else return;
        e.preventDefault();
      }}
      className="group relative h-6 w-[96px] cursor-pointer touch-none px-[8px] outline-none"
    >
      <div ref={track} className="relative top-1/2 h-[5px] -translate-y-1/2 rounded-full bg-[#e2e2e6]">
        <div className="absolute inset-y-0 start-0 rounded-full bg-[#2f80ed]" style={{ width: `${f * 100}%` }} />
        <div
          className="absolute top-1/2 size-[15px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/[0.06] bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)] transition-transform group-focus-visible:ring-2 group-focus-visible:ring-accent group-active:scale-110"
          style={{ left: `${f * 100}%` }}
        />
      </div>
    </div>
  );
}

// A shaky hand-drawn wave (always the same one), drawn through the tool's own steadying: the picture shows what the level does.
function demoStroke(tool: InkTool, level: Smoothing, w: number, h: number): InkPoint[] {
  const rand = seeded(11);
  const at = (f: number) => ({ x: 7 + f * (w - 14), y: h / 2 + Math.sin(f * Math.PI * 2) * h * 0.14 + (rand() - 0.5) * 3.4 });
  const start = at(0);
  const capture = new InkCapture(start.x, start.y, level, 1, 0);
  let last = start;
  for (let i = 1; i <= 70; i++) {
    last = at(i / 70);
    capture.add(last.x, last.y, i * 9);
  }
  capture.end(last.x, last.y);
  return finishInk(capture.points, tool, level);
}

function StrokePreview({ tool, settings, width, height }: { tool: InkTool; settings: InkSettings; width: number; height: number }) {
  const size = Math.min(settings.size, height * (tool === "highlighter" ? 0.6 : 0.5));
  const model = useMemo(() => inkModel(tool, demoStroke(tool, settings.smoothing, width, height), Math.max(1.2, size), 5), [tool, settings.smoothing, width, height, size]);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="min-w-0 flex-1" aria-hidden>
      <path d={model.body} fill={settings.color} opacity={tool === "highlighter" ? 0.75 : tool === "pencil" ? 0.92 : 1} />
      {model.bristles.map((b, i) => (
        <polyline key={i} points={b.points.join(" ")} fill="none" stroke={b.light ? "#fff" : "#000"} strokeWidth={b.width} opacity={b.alpha} strokeLinecap="round" />
      ))}
    </svg>
  );
}
