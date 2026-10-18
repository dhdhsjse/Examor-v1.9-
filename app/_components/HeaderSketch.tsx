"use client";

import type { CSSProperties } from "react";
import type { HeaderStyle } from "@/app/_lib/types";

// Every exam header style, in the order they are offered. Labels are English keys (translated).
export const HEADER_STYLE_OPTIONS: { value: HeaderStyle; label: string }[] = [
  { value: "classic", label: "Classic" },
  { value: "official", label: "Official" },
  { value: "modern", label: "Modern" },
  { value: "split", label: "Two cards" },
  { value: "minimal", label: "Minimal" },
  { value: "compact", label: "Compact" },
  { value: "banner", label: "Banner" },
  { value: "elegant", label: "Elegant" },
  { value: "cards", label: "Name cards" },
  { value: "evaluation", label: "With comments" },
  { value: "playful", label: "Primary school" },
  { value: "accentbar", label: "Accent bar" },
  { value: "bookmark", label: "Bookmark" },
  { value: "gradient", label: "Gradient" },
  { value: "geometric", label: "Geometric" },
  { value: "chips", label: "Info chips" },
  { value: "editorial", label: "Editorial" },
  { value: "framed", label: "Framed title" },
  { value: "infogrid", label: "Info grid" },
  { value: "duotone", label: "Duotone" },
  { value: "monogram", label: "Monogram" },
  { value: "ticket", label: "Ticket" },
  { value: "floating", label: "Floating card" },
  { value: "algerian", label: "Algerian exam" },
];

// Default color of the colored styles (what the accent replaces).
const ACCENTS: Partial<Record<HeaderStyle, string>> = {
  modern: "#6366f1",
  split: "#4f46e5",
  cards: "#4f46e5",
  playful: "#0ea5e9",
  elegant: "#4338ca",
  banner: "#1e293b",
  accentbar: "#0d9488",
  bookmark: "#e11d48",
  gradient: "#7c3aed",
  geometric: "#ea580c",
  chips: "#0284c7",
  editorial: "#b45309",
  framed: "#059669",
  infogrid: "#2563eb",
  duotone: "#4338ca",
  monogram: "#be123c",
  ticket: "#0f766e",
  floating: "#6366f1",
};

const SOFT = "#cbd5e1";
const bar = (w: string, color: string, h = 3): CSSProperties => ({ width: w, height: h, borderRadius: 9, background: color });

// A line of text in a sketch.
function B({ w, c = SOFT, h }: { w: string; c?: string; h?: number }) {
  return <span className="block" style={bar(w, c, h)} />;
}

// A tiny drawing of a header style (about 24 px high, as wide as its box).
export function HeaderSketch({ style, accent }: { style: HeaderStyle; accent?: string }) {
  const a = accent ?? ACCENTS[style] ?? "#64748b";
  const ink = "#475569";

  switch (style) {
    case "classic":
      return (
        <span className="grid h-6 w-full grid-cols-3 border border-slate-500">
          <span className="border-e border-slate-400" />
          <span className="flex items-center justify-center border-e border-slate-400">
            <B w="70%" c={ink} />
          </span>
          <span />
        </span>
      );
    case "algerian":
      return (
        <span className="flex h-6 w-full flex-col items-center justify-between">
          <B w="55%" c={ink} h={2} />
          <span className="grid h-2.5 w-full grid-cols-2 border border-slate-500">
            <span className="border-e border-slate-400" />
            <span />
          </span>
          <span className="flex h-2 w-full items-center justify-center border border-slate-600">
            <B w="45%" c={ink} h={2} />
          </span>
        </span>
      );
    case "official":
      return (
        <span className="flex h-6 w-full flex-col justify-between">
          <span className="flex justify-between">
            <B w="38%" c={ink} h={2} />
            <B w="28%" h={2} />
          </span>
          <span className="mx-auto flex h-2.5 w-3/4 items-center justify-center border border-slate-500">
            <B w="60%" c={accent ?? ink} h={2} />
          </span>
          <span className="flex items-center justify-between">
            <B w="55%" h={2} />
            <span className="h-2 w-4 border border-slate-500" />
          </span>
        </span>
      );
    case "modern":
      return (
        <span className="flex h-6 w-full items-center justify-between rounded px-1.5" style={{ background: `${a}22` }}>
          <span className="flex w-2/3 flex-col gap-0.5">
            <B w="80%" c={a} />
            <B w="50%" c={`${a}77`} />
          </span>
          <span className="size-4 rounded-full border bg-white" style={{ borderColor: a }} />
        </span>
      );
    case "split":
      return (
        <span className="flex h-6 w-full gap-1">
          <span className="flex flex-[3] flex-col justify-center gap-0.5 rounded border px-1" style={{ borderColor: a, background: `${a}18` }}>
            <B w="80%" c={a} />
            <B w="55%" />
          </span>
          <span className="flex flex-[2] flex-col justify-center gap-0.5 rounded border border-slate-400 px-1">
            <B w="90%" />
            <B w="70%" />
          </span>
        </span>
      );
    case "minimal":
      return (
        <span className="flex w-full flex-col items-center gap-1 px-1">
          <B w="60%" c={ink} />
          <span className="block h-px w-full bg-slate-500" />
        </span>
      );
    case "compact":
      return (
        <span className="flex w-full flex-col gap-0.5 border-b-2 pb-0.5" style={{ borderColor: accent ?? ink }}>
          <span className="flex items-center justify-between">
            <B w="50%" c={ink} />
            <span className="h-2 w-5 border border-slate-500" />
          </span>
          <B w="75%" h={2} />
        </span>
      );
    case "banner":
      return (
        <span className="flex h-6 w-full items-center justify-between rounded px-1.5" style={{ background: a }}>
          <span className="flex w-2/3 flex-col gap-0.5">
            <B w="80%" c="#fff" />
            <B w="50%" c="#94a3b8" />
          </span>
          <span className="h-4 w-5 rounded-sm bg-white" />
        </span>
      );
    case "elegant":
      return (
        <span className="flex w-full flex-col items-center gap-0.5 px-1">
          <span className="block h-[2px] w-full border-t border-b border-slate-500" />
          <B w="55%" c={ink} />
          <B w="35%" c={a} />
          <span className="block h-[2px] w-full border-t border-b border-slate-500" />
        </span>
      );
    case "cards":
      return (
        <span className="flex h-6 w-full flex-col items-center justify-between">
          <B w="50%" c={ink} />
          <span className="flex w-full gap-0.5">
            {[2, 1, 1].map((g, i) => (
              <span key={i} className="h-3 rounded-sm border" style={{ flex: g, borderColor: a, background: `${a}14` }} />
            ))}
          </span>
        </span>
      );
    case "evaluation":
      return (
        <span className="flex h-6 w-full flex-col items-center justify-between">
          <B w="55%" c={accent ?? ink} />
          <span className="grid h-3 w-full grid-cols-[1fr_2fr_1.3fr] border border-slate-500">
            <span className="border-e border-slate-400" />
            <span className="border-e border-slate-400" />
            <span />
          </span>
        </span>
      );
    case "playful":
      return (
        <span className="relative flex h-6 w-full items-center justify-center rounded-lg border" style={{ borderColor: a, background: `${a}22` }}>
          <span className="absolute start-1 top-0.5 text-[8px] leading-none" style={{ color: a }}>
            ★
          </span>
          <B w="45%" c={ink} />
          <span className="absolute end-1 size-3.5 rounded-full border bg-white" style={{ borderColor: a }} />
        </span>
      );
    case "accentbar":
      return (
        <span className="flex h-6 w-full items-center gap-1">
          <span className="h-full w-[3px] rounded-full" style={{ background: a }} />
          <span className="flex flex-1 flex-col gap-0.5">
            <B w="35%" c={a} h={2} />
            <B w="75%" c={ink} />
            <B w="50%" h={2} />
          </span>
          <span className="h-5 w-5 rounded border" style={{ borderColor: a, background: `${a}14` }} />
        </span>
      );
    case "bookmark":
      return (
        <span className="relative flex h-6 w-full flex-col gap-0.5 border-t-2 pt-1" style={{ borderColor: a }}>
          <B w="60%" c={ink} />
          <B w="38%" c={a} h={2} />
          <span className="absolute end-1 top-0 h-5 w-3.5 border" style={{ borderColor: a, background: `${a}22`, clipPath: "polygon(0 0,100% 0,100% 100%,50% 78%,0 100%)" }} />
        </span>
      );
    case "gradient":
      return (
        <span className="flex h-6 w-full items-center justify-between rounded-md px-1.5" style={{ background: `linear-gradient(110deg, ${a}, ${a}b8)` }}>
          <span className="flex w-2/3 flex-col gap-0.5">
            <B w="80%" c="#fff" />
            <B w="50%" c="#ffffffaa" />
          </span>
          <span className="size-4 rounded-full bg-white" />
        </span>
      );
    case "geometric":
      return (
        <span className="relative flex h-6 w-full items-center justify-between overflow-hidden ps-6 pe-1">
          <span className="absolute start-0 top-0 size-5" style={{ background: a, clipPath: "polygon(0 0,100% 0,0 100%)" }} />
          <span className="absolute bottom-0 end-0 size-2.5" style={{ background: a, clipPath: "polygon(100% 0,100% 100%,0 100%)" }} />
          <span className="flex w-2/3 flex-col gap-0.5">
            <B w="80%" c={ink} />
            <B w="50%" h={2} />
          </span>
          <span className="h-4 w-5 rounded-sm border border-slate-500" />
        </span>
      );
    case "chips":
      return (
        <span className="flex h-6 w-full items-center justify-between">
          <span className="flex w-2/3 flex-col gap-1">
            <B w="75%" c={ink} />
            <span className="flex gap-0.5">
              {[1, 1, 1].map((_, i) => (
                <span key={i} className="h-1.5 w-3 rounded-full" style={{ background: `${a}33` }} />
              ))}
            </span>
          </span>
          <span className="flex h-5 w-5 flex-col overflow-hidden rounded border" style={{ borderColor: a }}>
            <span className="h-1.5" style={{ background: a }} />
          </span>
        </span>
      );
    case "editorial":
      return (
        <span className="flex h-6 w-full items-center justify-between">
          <span className="flex w-2/3 flex-col gap-0.5">
            <B w="85%" c={ink} h={4} />
            <B w="22%" c={a} h={2} />
            <B w="55%" h={2} />
          </span>
          <span className="flex size-5 items-center justify-center rounded-full border border-dashed" style={{ borderColor: a }}>
            <span className="size-3.5 rounded-full border" style={{ borderColor: a }} />
          </span>
        </span>
      );
    case "framed":
      return (
        <span className="relative flex h-6 w-full items-end">
          <span className="flex h-[18px] w-full flex-col items-center justify-center gap-0.5 rounded-md border" style={{ borderColor: a }}>
            <B w="50%" c={a} h={2} />
            <B w="80%" h={2} />
          </span>
          <span className="absolute inset-x-0 top-0 mx-auto h-2 w-2/5 rounded-full" style={{ background: a }} />
        </span>
      );
    case "infogrid":
      return (
        <span className="flex h-6 w-full flex-col justify-between">
          <B w="55%" c={ink} />
          <span className="grid h-3 w-full grid-cols-4 overflow-hidden rounded-sm border border-slate-300">
            <span className="border-e border-slate-300" />
            <span className="border-e border-slate-300" />
            <span className="border-e border-slate-300" />
            <span style={{ background: `${a}22` }} />
          </span>
        </span>
      );
    case "duotone":
      return (
        <span className="flex h-6 w-full overflow-hidden rounded-md">
          <span className="flex flex-[3] flex-col justify-center gap-0.5 px-1" style={{ background: `${a}1f` }}>
            <B w="80%" c={ink} />
            <B w="50%" h={2} />
          </span>
          <span className="flex flex-1 items-center justify-center" style={{ background: a }}>
            <span className="h-2.5 w-4 rounded-sm bg-white" />
          </span>
        </span>
      );
    case "monogram":
      return (
        <span className="flex h-6 w-full items-center gap-1">
          <span className="size-5 shrink-0 rounded-full" style={{ background: a }} />
          <span className="flex flex-1 flex-col gap-0.5">
            <B w="80%" c={ink} />
            <B w="50%" c={a} h={2} />
          </span>
          <span className="h-5 w-5 rounded-md border" style={{ borderColor: a }} />
        </span>
      );
    case "ticket":
      return (
        <span className="flex h-6 w-full overflow-hidden rounded-md border" style={{ borderColor: a, background: `${a}0d` }}>
          <span className="flex flex-[3] flex-col justify-center gap-0.5 px-1">
            <B w="80%" c={ink} />
            <B w="50%" h={2} />
          </span>
          <span className="flex flex-1 items-center justify-center border-s border-dashed" style={{ borderColor: a }}>
            <B w="60%" c={a} h={2} />
          </span>
        </span>
      );
    case "floating":
      return (
        <span className="flex h-6 w-full items-center justify-between rounded-md border border-slate-200 bg-white px-1 shadow-sm">
          <span className="flex w-2/3 flex-col gap-0.5">
            <span className="flex items-center gap-0.5">
              <span className="size-1 rounded-full" style={{ background: a }} />
              <B w="40%" h={2} />
            </span>
            <B w="80%" c={ink} />
          </span>
          <span className="h-4 w-5 rounded" style={{ background: `${a}22` }} />
        </span>
      );
  }
}
