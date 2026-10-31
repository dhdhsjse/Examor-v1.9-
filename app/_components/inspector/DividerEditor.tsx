"use client";

import { DIVIDER_STYLES, dividerHeight, dividerMarks, dividerSpace, dividerThickness, type DividerMark } from "@/app/_lib/divider";
import type { DividerBlock, DividerStyle } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { ColorGrid } from "../rich/FormatBar";
import { Field, Stepper, inputCls } from "./fields";
import type { OnChange } from "./QuestionEditors";

// (a preview has no page fonts: an average letter width is close enough)
const fadeId = (color: string) => `divider-fade-${color.replace(/[^a-z0-9]/gi, "")}`;
const guessWidth = (text: string, size: number) => text.length * size * 0.58;

// One look of the separator, drawn small (the same marks as on the page, divider.ts).
export function DividerPreview({ style, color, label, w = 120 }: { style: DividerStyle; color: string; label?: string; w?: number }) {
  const b = { style, label };
  const h = dividerHeight({ style, space: 3 });
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} height={h} aria-hidden preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={fadeId(color)} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={color} stopOpacity="0" />
          <stop offset="0.5" stopColor={color} />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {dividerMarks(b, w, h, guessWidth).map((m, k) => (
        <Mark key={k} m={m} color={color} />
      ))}
    </svg>
  );
}

function Mark({ m, color }: { m: DividerMark; color: string }) {
  switch (m.kind) {
    case "line":
      return <line x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2} stroke={color} strokeWidth={m.width} strokeDasharray={m.dash?.join(" ")} strokeLinecap={m.round ? "round" : "butt"} />;
    case "fade":
      return <rect x={m.x} y={m.y} width={m.w} height={m.h} fill={`url(#${fadeId(color)})`} />;
    case "dot":
      return <circle cx={m.x} cy={m.y} r={m.r} fill={color} />;
    case "path":
      return <polyline points={m.points.join(" ")} fill="none" stroke={color} strokeWidth={m.width} strokeLinecap="round" strokeLinejoin="round" />;
    case "diamond":
      return <rect x={m.x - m.r} y={m.y - m.r} width={m.r * 2} height={m.r * 2} fill={color} transform={`rotate(45 ${m.x} ${m.y})`} />;
    case "text":
      return (
        <text x={m.x} y={m.y} fontSize={m.size} fontWeight={700} fill={color} textAnchor={m.anchor} dominantBaseline="central">
          {m.text}
        </text>
      );
  }
}

// Properties of a separator: its look (a gallery), its text, color, thickness and the room around it.
export function DividerEditor({ b, onChange }: { b: DividerBlock; onChange: OnChange }) {
  const t = useT();
  return (
    <>
      <Field label={t("Style")} group>
        <div className="grid grid-cols-2 gap-1.5">
          {DIVIDER_STYLES.map((s) => {
            const on = s.id === b.style;
            return (
              <button
                key={s.id}
                type="button"
                title={t(s.label)}
                aria-pressed={on}
                // (another look starts at its own thickness)
                onClick={() => onChange({ style: s.id, thickness: undefined }, "style")}
                className={`flex flex-col items-stretch gap-1 rounded-[6px] border px-2 pt-1.5 pb-1 text-[10px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  on ? "border-accent bg-accent-soft text-accent" : "border-line bg-white text-muted hover:border-accent/50 hover:text-ink"
                }`}
              >
                <DividerPreview style={s.id} color={on ? "#4f46e5" : "#374151"} label={s.id === "label" ? "Partie 2" : undefined} />
                {t(s.label)}
              </button>
            );
          })}
        </div>
      </Field>

      {b.style === "label" && (
        <Field label={t("Text in the middle")}>
          <input value={b.label ?? ""} onChange={(e) => onChange({ label: e.target.value }, "label")} className={inputCls} />
        </Field>
      )}

      <Field label={t("Color")} group>
        <ColorGrid value={b.color} autoLabel={t("Dark grey")} onChange={(c) => onChange({ color: c }, "color")} />
      </Field>

      <div className="flex min-h-7 items-center justify-between gap-2">
        <span className="text-[11px] text-muted">{t("Thickness")}</span>
        <Stepper value={Math.round(dividerThickness(b))} min={1} max={10} onChange={(v) => onChange({ thickness: v }, "thickness")} />
      </div>
      <div className="flex min-h-7 items-center justify-between gap-2">
        <span className="text-[11px] text-muted">{t("Space above and below")}</span>
        <Stepper value={dividerSpace(b)} min={0} max={60} onChange={(v) => onChange({ space: v }, "space")} />
      </div>
      <p className="text-[10px] leading-snug text-faint">
        {t("Drag its ends to make it shorter or longer.")}
      </p>
    </>
  );
}
