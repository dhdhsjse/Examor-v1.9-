"use client";

import type { ReactNode } from "react";
import { ChoiceGrid } from "@/app/_components/inspector/fields";
import type { Ctx } from "@/app/_features/core/types";
import { BORDER_KINDS, CORNER_STYLES, DEFAULT_CORNER_SIZE, SIDES, boxFillPath, boxLines, cornerOf, kindOf, sidesOf, type BorderKind, type CornerStyle, type SideKey } from "@/app/_lib/boxBorder";
import type { TextboxBlock } from "@/app/_lib/types";

// Properties → Borders of a text box: the border of the box as a whole (not of its text) — its kind (line, dashes, double, shadow…), its corners
// (square, rounded, chamfered, scooped, leaf), which sides have it, its colour and thickness, and the fill. Each choice is a small drawing of the
// box itself, made by the same code as the page; every change is saved at once.
const LINE_COLORS = ["#111827", "#3b82f6", "#4f46e5", "#16a34a", "#f59e0b", "#e11d48", "#64748b"];
const FILL_SWATCHES = ["#ffffff", "#eff6ff", "#ecfdf5", "#fffbeb", "#fff1f2", "#f1f5f9", "#fef08a"];
const DEFAULT_LINE = "#111827";

const KIND_LABELS: Record<BorderKind, string> = { solid: "Solid", dashed: "Dashed", dotted: "Dotted", double: "Double", "thick-thin": "Thick-thin", triple: "Triple", shadow: "Shadow" };
const CORNER_LABELS: Record<CornerStyle, string> = { square: "Square", round: "Rounded", chamfer: "Chamfered", scoop: "Scooped", leaf: "Leaf" };
const SIDE_LABELS: Record<SideKey, string> = { t: "Top", r: "Right", b: "Bottom", l: "Left" };

// A little box drawn with a look (and two grey lines for its text)
function Mini({ look, color = "#475569" }: { look: Parameters<typeof boxLines>[0]; color?: string }) {
  const [W, H] = [44, 28];
  const lines = boxLines({ ...look, border: look.border ?? color }, W, H);
  return (
    <svg aria-hidden width={W} height={H} viewBox={`-3 -3 ${W + 8} ${H + 8}`} className="overflow-visible">
      {look.background && <path d={boxFillPath(look, W, H)} fill={look.background} />}
      <path d="M12 11H32M16 17H28" stroke="#cbd5e1" strokeWidth="2.2" strokeLinecap="round" />
      {look.border !== "" &&
        lines.map((l, i) => (
          <path key={i} d={l.d} fill={l.fill ? (look.border ?? color) : "none"} stroke={l.w ? (look.border ?? color) : "none"} strokeWidth={l.w} strokeDasharray={l.dash?.join(" ")} strokeLinecap={l.round ? "round" : "butt"} opacity={l.o} />
        ))}
    </svg>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h4 className="px-1 text-[12px] font-medium tracking-[-0.005em] text-muted">{title}</h4>
      {children}
    </section>
  );
}

const rowCls = "flex flex-col gap-2 px-3.5 py-3";
const rowTitle = "text-[12px] font-medium tracking-[-0.005em] text-muted";
const Card = ({ children }: { children: ReactNode }) => (
  <div className="overflow-hidden rounded-2xl bg-subtle">
    <div className="flex flex-col divide-y divide-line/70">{children}</div>
  </div>
);

function Swatches({ value, colors, none, onPick, label }: { value: string | undefined; colors: string[]; none?: string; onPick: (c: string | undefined) => void; label: string }) {
  const ring = (on: boolean) => `size-6 rounded-full outline-none transition-transform duration-100 focus-visible:ring-2 focus-visible:ring-accent active:scale-90 ${on ? "ring-2 ring-accent ring-offset-2 ring-offset-subtle" : "ring-1 ring-black/15"}`;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {none && (
        <button type="button" title={none} aria-label={none} aria-pressed={!value} onClick={() => onPick(undefined)} className={`${ring(!value)} relative overflow-hidden bg-white`}>
          <span aria-hidden className="absolute inset-x-0 top-1/2 h-px -rotate-45 bg-red-500" />
        </button>
      )}
      {colors.map((c) => (
        <button key={c} type="button" aria-label={c} aria-pressed={value?.toLowerCase() === c} onClick={() => onPick(c)} className={ring(value?.toLowerCase() === c)} style={{ background: c }} />
      ))}
      <input
        type="color"
        aria-label={label}
        title={label}
        value={value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#3b82f6"}
        onChange={(e) => onPick(e.target.value)}
        className="size-6 cursor-pointer rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-black/15 [&::-webkit-color-swatch-wrapper]:p-0"
      />
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, testId }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; testId: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between text-[12px] tracking-[-0.005em] text-muted">
        {label}
        <span className="tabular-nums text-ink">{value} px</span>
      </span>
      <input type="range" data-testid={testId} min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-indigo-600" />
    </label>
  );
}

export default function BoxBorders({ ctx, b }: { ctx: Ctx; b: TextboxBlock }) {
  const { t, shell } = ctx;
  const set = (patch: Partial<TextboxBlock>, key: string) => shell.updateBlock(b.id, patch, key);
  const kind = b.border ? kindOf(b) : "none";
  const corner = cornerOf(b);
  const sides = sidesOf(b);
  const color = b.border ?? DEFAULT_LINE;

  const pickKind = (k: BorderKind | "none") => (k === "none" ? set({ border: undefined }, "border") : set({ border: b.border ?? DEFAULT_LINE, borderStyle: k === "solid" ? undefined : k }, "border"));
  const pickCorner = (c: CornerStyle) => set(c === "square" ? { corner: "square", radius: undefined } : { corner: c, radius: b.radius ?? DEFAULT_CORNER_SIZE }, "corner");
  const toggleSide = (k: SideKey) => {
    const next = sides.includes(k) ? sides.filter((s) => s !== k) : [...sides, k];
    if (!next.length) return; // (a border has at least one side: "None" takes it off)
    set({ sides: next.length === 4 ? undefined : SIDES.filter((s) => next.includes(s)).join("") }, "sides");
  };

  return (
    <div className="flex flex-col gap-4">
      <Section title={t("Style")}>
        <ChoiceGrid
          cols={4}
          value={kind}
          onChange={(v) => pickKind(v as BorderKind | "none")}
          options={[
            { value: "none", label: t("None"), preview: <Mini look={{ border: "" }} /> },
            ...BORDER_KINDS.map((k) => ({ value: k, label: t(KIND_LABELS[k]), preview: <Mini look={{ border: color, borderWidth: 3, borderStyle: k, corner, radius: b.radius ?? DEFAULT_CORNER_SIZE, sides: b.sides }} color={color} /> })),
          ]}
        />
      </Section>

      {b.border && (
        <Card>
          <div className={rowCls}>
            <span className={rowTitle}>{t("Color")}</span>
            <Swatches value={b.border} colors={LINE_COLORS} label={t("Border color")} onPick={(c) => c && set({ border: c }, "border-color")} />
          </div>
          <div className={rowCls}>
            <Slider label={t("Thickness")} value={b.borderWidth ?? 1} min={0.5} max={8} step={0.5} testId="box-border-width" onChange={(v) => set({ borderWidth: v === 1 ? undefined : v }, "border-width")} />
          </div>
          <div className={rowCls}>
            <span className={rowTitle}>{t("Sides")}</span>
            <div role="group" aria-label={t("Sides")} className="grid grid-cols-4 gap-1 rounded-[10px] bg-white/70 p-[3px]">
              {SIDES.map((k) => {
                const on = sides.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    aria-pressed={on}
                    data-side={k}
                    onClick={() => toggleSide(k)}
                    className={`h-7 truncate rounded-[8px] px-1 text-xs tracking-[-0.005em] transition-[background-color,color,box-shadow,transform] duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] ${on ? "bg-white font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]" : "text-muted hover:text-ink"}`}
                  >
                    {t(SIDE_LABELS[k])}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      <Section title={t("Corners")}>
        <ChoiceGrid
          cols={3}
          value={corner}
          onChange={(v) => pickCorner(v as CornerStyle)}
          options={CORNER_STYLES.map((c) => ({ value: c, label: t(CORNER_LABELS[c]), preview: <Mini look={{ border: color, borderWidth: 2.5, corner: c, radius: 11 }} color={color} /> }))}
        />
        {corner !== "square" && (
          <Card>
            <div className={rowCls}>
              <Slider label={t("Corner size")} value={b.radius ?? DEFAULT_CORNER_SIZE} min={2} max={40} step={1} testId="box-radius" onChange={(v) => set({ radius: v }, "radius")} />
            </div>
          </Card>
        )}
      </Section>

      <Card>
        <div className={rowCls}>
          <span className={rowTitle}>{t("Fill")}</span>
          <Swatches value={b.background} colors={FILL_SWATCHES} none={t("No fill")} label={t("Fill color")} onPick={(background) => set({ background }, "background")} />
        </div>
      </Card>
    </div>
  );
}
