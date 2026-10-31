"use client";

import { RectangleHorizontal, RectangleVertical } from "lucide-react";
import { useState, type ReactNode } from "react";
import type { Ctx } from "@/app/_features/core/types";
import { DEFAULT_FORMAT, MAX_PAGE_MM, MIN_PAGE_MM, STANDARD_SIZES, getPageMm, type StandardSize } from "@/app/_lib/pageFormats";
import type { PageFormat, PageOrientation } from "@/app/_lib/types";

type Dim = "width" | "height";

const SIZES = Object.keys(STANDARD_SIZES) as StandardSize[];
const LARGEST_MM = 420; // the long side of A3: the biggest standard sheet fills a preview
const PREVIEW_PX = 34;

// 215.9 → "215.9", 210 → "210".
const mmText = (mm: number) => String(Math.round(mm * 10) / 10);
// A typed number ("300", "215,9"), or null.
const parseMm = (text: string) => {
  const n = Number(text.trim().replace(",", "."));
  return text.trim() && Number.isFinite(n) ? n : null;
};
const clampMm = (mm: number) => Math.max(MIN_PAGE_MM, Math.min(Math.round(mm * 10) / 10, MAX_PAGE_MM));
const inRange = (mm: number) => mm >= MIN_PAGE_MM && mm <= MAX_PAGE_MM;

// A custom page as it lies (width x height on screen): stored portrait, turned by its orientation.
function customFormat(width: number, height: number): PageFormat {
  const orientation: PageOrientation = width > height ? "landscape" : "portrait";
  return { size: "custom", orientation, customWidth: Math.min(width, height), customHeight: Math.max(width, height) };
}

const card = (on: boolean) =>
  `flex items-center gap-2.5 rounded-lg border p-2 text-start text-xs transition-colors ${
    on ? "border-transparent bg-indigo-50 text-accent ring-2 ring-indigo-500" : "border-line bg-white text-ink hover:border-indigo-300"
  }`;

// Page layout → Page format, in the right panel: orientation and paper size of the page in view only
// (a document can mix A4 portrait and A3 landscape pages). Every click is saved at once (one undo step);
// a custom size is saved while it is typed, as one undo step too. Blocks stay where they are.
export default function PageFormatInspector({ ctx }: { ctx: Ctx }) {
  const { t, shell, doc } = ctx;
  const index = Math.max(0, doc.pages.findIndex((p) => p.id === ctx.activePageId));
  const page = doc.pages[index];
  const format = page?.format ?? DEFAULT_FORMAT;
  const mm = getPageMm(format); // as the page lies
  const [typing, setTyping] = useState<{ dim: Dim; text: string } | null>(null);

  const save = (next: PageFormat, key?: string) => page && shell.setPageFormat(page.id, next, key);
  // Turning the page swaps its sides (a custom size is stored portrait, so it turns the same way).
  const orient = (orientation: PageOrientation) => save({ ...format, orientation });
  const pickSize = (size: StandardSize) => save({ size, orientation: format.orientation });
  // Custom starts from the current size.
  const pickCustom = () => format.size !== "custom" && save(customFormat(mm.width, mm.height));

  // One side typed, the other kept (the orientation follows the longer side).
  const resized = (dim: Dim, v: number) => (dim === "width" ? customFormat(v, mm.height) : customFormat(mm.width, v));
  // Typing: a size in range shows at once; anything else waits for Enter or leaving the field.
  const type = (dim: Dim, text: string) => {
    setTyping({ dim, text });
    const v = parseMm(text);
    if (v !== null && inRange(v)) save(resized(dim, v), `page-format-${page?.id}`);
  };
  const finish = () => {
    if (!typing) return;
    const v = parseMm(typing.text);
    setTyping(null);
    if (v !== null) save(resized(typing.dim, clampMm(v)));
  };

  if (!page) return null;
  return (
    <div className="flex flex-col">
      <p className="mb-4 text-xs text-muted">{t("Paper and orientation of page {n} only.", { n: index + 1 })}</p>

      <Heading>{t("Orientation")}</Heading>
      <div role="group" aria-label={t("Orientation")} className="mb-5 grid grid-cols-2 gap-2">
        {(["portrait", "landscape"] as const).map((o) => {
          const on = format.orientation === o;
          const Icon = o === "portrait" ? RectangleVertical : RectangleHorizontal;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              onClick={() => orient(o)}
              className={`flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-xs transition-colors ${
                on ? "border-transparent bg-indigo-50 font-semibold text-accent ring-2 ring-indigo-500" : "border-line bg-white text-ink hover:border-indigo-300"
              }`}
            >
              <Icon size={22} strokeWidth={1.6} />
              {t(o === "portrait" ? "Portrait" : "Landscape")}
            </button>
          );
        })}
      </div>

      <Heading>{t("Paper size")}</Heading>
      <div role="radiogroup" aria-label={t("Paper size")} className="grid grid-cols-2 gap-2">
        {SIZES.map((size) => {
          const on = format.size === size;
          const s = getPageMm({ size, orientation: format.orientation });
          return (
            <button key={size} type="button" role="radio" aria-checked={on} onClick={() => pickSize(size)} className={card(on)}>
              <Sheet width={s.width} height={s.height} on={on} />
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{STANDARD_SIZES[size].name}</span>
                <span className={`whitespace-nowrap text-[10px] tabular-nums ${on ? "text-indigo-500" : "text-faint"}`}>
                  {Math.round(s.width)} × {Math.round(s.height)} mm
                </span>
              </span>
            </button>
          );
        })}
        <button type="button" role="radio" aria-checked={format.size === "custom"} onClick={pickCustom} className={card(format.size === "custom")}>
          <Sheet width={mm.width} height={mm.height} on={format.size === "custom"} dashed />
          <span className="flex min-w-0 flex-col">
            <span className="font-semibold">{t("Custom")}</span>
            <span className={`whitespace-nowrap text-[10px] tabular-nums ${format.size === "custom" ? "text-indigo-500" : "text-faint"}`}>
              {format.size === "custom" ? `${Math.round(mm.width)} × ${Math.round(mm.height)} mm` : "…"}
            </span>
          </span>
        </button>
      </div>

      {format.size === "custom" && (
        <div className="mt-4 flex flex-col gap-3">
          {(["width", "height"] as const).map((dim) => {
            const id = `page-${dim}`;
            return (
              <div key={dim} className="flex items-center justify-between">
                <label htmlFor={id} className="min-w-16 whitespace-nowrap text-sm font-medium text-ink">
                  {t(dim === "width" ? "Width" : "Height")}
                </label>
                <div dir="ltr" className="flex items-center overflow-hidden rounded-md border border-line bg-white">
                  <input
                    id={id}
                    inputMode="decimal"
                    autoComplete="off"
                    value={typing?.dim === dim ? typing.text : mmText(mm[dim])}
                    onChange={(e) => type(dim, e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    onBlur={finish}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") finish();
                      else if (e.key === "Escape") setTyping(null);
                      else return;
                      e.preventDefault();
                    }}
                    className="w-16 bg-transparent px-2 py-1 text-end text-sm tabular-nums text-ink outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <span className="pe-2 text-xs text-faint">mm</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[11px] leading-snug text-faint">
        {t("Custom: from {min} to {max} mm. Blocks stay where they are.", { min: MIN_PAGE_MM, max: MAX_PAGE_MM })}
      </p>
    </div>
  );
}

function Heading({ children }: { children: ReactNode }) {
  return <h3 className="mb-2 text-[11px] font-semibold text-muted">{children}</h3>;
}

// The shape of a sheet, to scale with the others (A3 fills the preview).
function Sheet({ width, height, on, dashed = false }: { width: number; height: number; on: boolean; dashed?: boolean }) {
  const k = PREVIEW_PX / Math.max(LARGEST_MM, width, height);
  return (
    <span aria-hidden className="grid size-[34px] shrink-0 place-items-center">
      <span
        className={`block rounded-[2px] border bg-white ${dashed ? "border-dashed" : ""} ${on ? "border-indigo-500" : "border-slate-400"}`}
        style={{ width: Math.max(4, width * k), height: Math.max(4, height * k) }}
      />
    </span>
  );
}
