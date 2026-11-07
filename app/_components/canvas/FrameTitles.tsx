"use client";

import { fontStack } from "@/app/_lib/fonts";
import type { PageBox } from "@/app/_lib/pageStack";
import { withTitle, type FrameGeometry } from "@/app/_lib/sheet/frame";
import type { SheetConfig } from "@/app/_lib/sheet/model";
import type { ExamMeta } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { TITLE_SIZE } from "./blocks/SheetViews";

const INSET = 5; // (kept clear at each side: the handles of the columns sit on their lines)

// The titles of the frame of a bordered correction sheet, typed right on the page: each is a box over its place in the frame (page px, under the
// zoom of the page stack). The canvas does not draw them on screen; the print does (SheetFrame).
export default function FrameTitles({ geos, boxes, sheet, meta, onChange }: {
  geos: (FrameGeometry | null)[];
  boxes: PageBox[];
  sheet: SheetConfig;
  meta: ExamMeta;
  onChange: (patch: Partial<SheetConfig>, key?: string) => void;
}) {
  const t = useT();
  return (
    <>
      {geos.map((geo, i) =>
        geo?.titles.map((title) => (
          <input
            key={`${i}-${title.key}`}
            dir="auto"
            value={title.text}
            placeholder={t("Title")}
            aria-label={t("Title of the column")}
            data-testid={`frame-title-${title.key}`}
            spellCheck={false}
            onChange={(e) => onChange(withTitle(sheet, title.key, e.target.value), `title-${title.key}`)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur();
              e.stopPropagation(); // (Delete, the arrows… are the text's, not the page's)
            }}
            className="absolute rounded-[3px] bg-transparent text-center font-bold outline-none placeholder:font-normal placeholder:text-[#9ca3af] hover:bg-emerald-500/10 focus:bg-[#fff] focus:ring-1 focus:ring-emerald-500"
            style={{
              left: boxes[i].left + title.rect.x + INSET,
              top: boxes[i].top + title.rect.y + 2,
              width: Math.max(10, title.rect.width - INSET * 2),
              height: title.rect.height - 4,
              fontSize: TITLE_SIZE,
              fontFamily: fontStack(meta.fontFamily),
              color: sheet.line.color,
            }}
          />
        )),
      )}
    </>
  );
}
