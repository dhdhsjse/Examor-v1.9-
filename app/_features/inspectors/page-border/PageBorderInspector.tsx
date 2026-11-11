"use client";

import { useState } from "react";
import { Segmented } from "@/app/_components/inspector/fields";
import type { Ctx } from "@/app/_features/core/types";
import { BORDER_GROUPS, DEFAULT_BORDER, MAX_BORDER_INSET, MAX_BORDER_WIDTH, MIN_BORDER_INSET, MIN_BORDER_WIDTH, borderPaths } from "@/app/_lib/pageBorder";
import type { PageBorder } from "@/app/_lib/types";
import MoreColors from "@/app/_components/inspector/MoreColors";

type Scope = "all" | "page";

// Formal colours first (ink, black, navy, burgundy, green, bronze, gold, grey)
const COLORS = ["#1f2937", "#000000", "#1e3a8a", "#7f1d1d", "#14532d", "#92400e", "#b8860b", "#6b7280"];
const PREVIEW = { w: 300, h: 400, width: 4, inset: 22 };

const card = (on: boolean) =>
  `flex min-w-0 flex-col items-stretch gap-1.5 rounded-xl p-2 text-xs tracking-[-0.005em] transition-[transform,background-color,box-shadow] duration-150 ease-out outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] ${
    on ? "bg-white font-semibold text-ink shadow-[0_0_0_2px_var(--color-accent,#4f46e5),0_4px_14px_rgba(0,0,0,0.08)]" : "bg-subtle text-muted hover:bg-hover hover:text-ink"
  }`;

// A small page with a design drawn on it, from the same paths as the page (`style` null: no border)
function Mini({ style, color }: { style: string | null; color: string }) {
  const paths = style ? borderPaths({ style, color, width: PREVIEW.width, inset: PREVIEW.inset }, PREVIEW.w, PREVIEW.h) : [];
  return (
    <svg data-paper="" aria-hidden viewBox={`0 0 ${PREVIEW.w} ${PREVIEW.h}`} className="mx-auto h-[72px] w-[54px] rounded-[2px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.1)]">
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.fill === "ink" ? color : p.fill === "paper" ? "#fff" : "none"}
          stroke={p.w ? color : "none"}
          strokeWidth={p.w * PREVIEW.width}
          strokeDasharray={p.dash?.map((n) => n * PREVIEW.width).join(" ")}
          strokeLinecap={p.round ? "round" : "butt"}
          strokeLinejoin={p.round ? "round" : "miter"}
          opacity={p.o}
        />
      ))}
      {!style && <path d="M60 80L240 320M240 80L60 320" stroke="#cbd5e1" strokeWidth="8" strokeLinecap="round" />}
    </svg>
  );
}

// Page layout → Page borders: a border around the whole page, from the designs of pageBorder.ts (plain lines, formal frames, decorative
// bands), with its colour, thickness and distance from the edge. It goes on every page or on the page in view; every click is saved at
// once (one undo step), a slider is one step while it is dragged.
export default function PageBorderInspector({ ctx }: { ctx: Ctx }) {
  const { t, shell, doc } = ctx;
  const index = Math.max(0, doc.pages.findIndex((p) => p.id === ctx.activePageId));
  const page = doc.pages[index];
  const [scope, setScope] = useState<Scope>("page");
  if (!page) return null;

  const border = page.border;
  const pageId = scope === "all" ? null : page.id;
  const save = (next: PageBorder | undefined, key?: string) => shell.setPageBorder(pageId, next, key ? `page-border-${key}-${pageId ?? "all"}` : undefined);
  const patch = (p: Partial<PageBorder>, key?: string) => save({ ...(border ?? DEFAULT_BORDER), ...p }, key);
  const color = border?.color ?? DEFAULT_BORDER.color;
  const slider = "w-full accent-indigo-600";

  return (
    <div className="flex flex-col gap-5">
      <Segmented
        value={scope}
        options={[
          { value: "all", label: t("Whole document") },
          { value: "page", label: t("This page ({n})", { n: index + 1 }) },
        ]}
        onChange={setScope}
      />

      <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
        <button type="button" aria-pressed={!border} data-border="none" onClick={() => save(undefined)} className={card(!border)}>
          <Mini style={null} color={color} />
          <span className="truncate text-center">{t("None")}</span>
        </button>
      </div>

      {BORDER_GROUPS.map((group) => (
        <section key={group.name} aria-label={t(group.name)} className="flex flex-col gap-2">
          <h3 className="text-xs font-semibold text-muted">{t(group.name)}</h3>
          <div className="grid grid-cols-[repeat(3,minmax(0,1fr))] gap-2">
            {group.styles.map((s) => {
              const on = border?.style === s.id;
              return (
                <button key={s.id} type="button" aria-pressed={on} data-border={s.id} onClick={() => patch({ style: s.id })} className={card(on)}>
                  <Mini style={s.id} color={color} />
                  <span className="truncate text-center">{t(s.name)}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {border && (
        <div className="flex flex-col gap-4 rounded-2xl bg-subtle p-3.5" data-testid="border-settings">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted">{t("Color")}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={border.color.toLowerCase() === c}
                  data-color={c}
                  onClick={() => patch({ color: c })}
                  className={`size-6 rounded-full outline-none ring-offset-2 transition-transform duration-100 focus-visible:ring-2 focus-visible:ring-accent active:scale-90 ${border.color.toLowerCase() === c ? "ring-2 ring-accent" : "ring-1 ring-black/15"}`}
                  style={{ background: c }}
                />
              ))}
              <MoreColors value={border.color} colors={COLORS} label={t("Color")} onPick={(color) => patch({ color }, "color")} />
            </div>
          </div>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            <span className="flex justify-between">
              {t("Thickness")}
              <span className="tabular-nums text-ink">{border.width} px</span>
            </span>
            <input type="range" data-testid="border-width" min={MIN_BORDER_WIDTH} max={MAX_BORDER_WIDTH} step={0.5} value={border.width} onChange={(e) => patch({ width: Number(e.target.value) }, "width")} className={slider} />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted">
            <span className="flex justify-between">
              {t("Distance from the edge")}
              <span className="tabular-nums text-ink">{border.inset} px</span>
            </span>
            <input type="range" data-testid="border-inset" min={MIN_BORDER_INSET} max={MAX_BORDER_INSET} step={1} value={border.inset} onChange={(e) => patch({ inset: Number(e.target.value) }, "inset")} className={slider} />
          </label>
        </div>
      )}
    </div>
  );
}
