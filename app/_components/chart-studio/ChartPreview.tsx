"use client";

import { Eye } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { renderChartSvg } from "@/app/_lib/chart/render";
import type { ChartConfig } from "@/app/_lib/chart/types";
import type { Lang } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";

const PADDING = 24;

export type PickedPart = { series: number } | { part: "title" | "axis-x" | "axis-y" | "axis-y2" };

interface Props {
  config: ChartConfig;
  lang: Lang;
  /** A part of the chart was clicked: a series, the title, an axis (the Studio opens what belongs to it on the right) */
  onPick: (part: PickedPart) => void;
}

// The chart as the page will draw it (the same SVG), shown to fit the room there is. A click on a series, the title or an axis picks it. A chart that
// is blank for the students can be looked at as the students see it.
export default function ChartPreview({ config, lang, onPick }: Props) {
  const t = useT();
  const area = useRef<HTMLDivElement>(null);
  const [room, setRoom] = useState({ w: 0, h: 0 });
  const [students, setStudents] = useState(false);
  const asStudents = students && config.blank;
  const svg = useMemo(() => renderChartSvg(config, { lang, blank: asStudents }).svg, [config, lang, asStudents]);

  useEffect(() => {
    const el = area.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setRoom({ w: Math.round(entry.contentRect.width), h: Math.round(entry.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = room.w > 0 ? Math.max(0.3, Math.min(2, (room.w - 2 * PADDING) / config.width, (room.h - 2 * PADDING) / config.height)) : 1;

  return (
    <div ref={area} dir="ltr" data-testid="chart-preview" className="relative grid min-h-0 flex-1 place-items-center overflow-hidden bg-subtle/60">
      <div
        role="img"
        aria-label={t("Chart")}
        data-testid="chart-picture"
        className="select-none bg-white shadow-sm [&>svg]:block [&>svg]:h-auto [&>svg]:w-full"
        style={{ width: config.width * scale }}
        onClick={(e) => {
          const el = (e.target as Element).closest("[data-series],[data-part]");
          if (!el) return;
          const series = el.getAttribute("data-series");
          if (series !== null) onPick({ series: Number(series) });
          else onPick({ part: el.getAttribute("data-part") as "title" });
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {config.blank && (
        <button
          type="button"
          aria-pressed={students}
          data-testid="students-view"
          onClick={() => setStudents((s) => !s)}
          className={`absolute end-3 top-3 flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium shadow-sm transition-colors ${students ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-white text-ink hover:border-accent"}`}
        >
          <Eye size={13} />
          {students ? t("As the students see it") : t("Whole chart (teacher)")}
        </button>
      )}
    </div>
  );
}
