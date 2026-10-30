"use client";

import { useEffect, useRef, useState } from "react";
import { Layer, Rect, Stage } from "react-konva";
import { TableView } from "@/app/_components/canvas/blocks/ContentViews";
import ShapeDrawSurface from "@/app/_components/shapes/ShapeDrawSurface";
import StudioShapes, { type ShapePatch } from "@/app/_components/shapes/StudioShapes";
import { tableHeight } from "@/app/_lib/blockLayout";
import type { DrawnBox, ShapeStyle } from "@/app/_lib/shapes";
import type { ExamMeta, TableBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { StudioTable } from "./useTableStudio";

const PADDING = 24;
const ROOM_BELOW = 260; // empty paper under the table, to draw on

interface Props {
  table: StudioTable;
  meta: ExamMeta;
  /** The shape the next drag draws (null = the Select tool) */
  tool: string | null;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: ShapePatch, key: string) => void;
  onDraw: (box: DrawnBox, style?: Partial<ShapeStyle>) => void;
}

// The table as the page draws it, with its shapes on top, for drawing, moving and resizing them. The shapes are in pixels of the
// table's own box (its top-left corner is 0, 0), so they stay where they are drawn when the table is on the page.
export default function TableShapesCanvas({ table, meta, tool, selectedId, onSelect, onChange, onDraw }: Props) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setArea(Math.round(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { width, shapes, ...data } = table;
  const block: TableBlock = { ...data, id: "canvas", type: "table", layout: { pageId: "p", x: 0, y: 0, width, height: 0 } }; // (without its shapes: they are drawn below, to be handled)
  const rows = tableHeight(block, meta);
  const lowest = Math.ceil(Math.max(0, ...(shapes ?? []).map((s) => s.y + s.h + 40)));
  const worldH = Math.max(rows + ROOM_BELOW, lowest);
  const scale = area > 0 ? Math.max(0.2, Math.min(1.5, (area - 2 * PADDING) / width)) : 1;

  return (
    <div ref={box} dir="ltr" data-testid="table-shapes-canvas" className="relative grid min-h-0 flex-1 place-items-start justify-center overflow-auto bg-subtle/60 p-6">
      <div className="shadow-sm" style={{ width: width * scale, height: worldH * scale, cursor: tool ? "crosshair" : undefined }} aria-label={t("Table with its shapes")} role="img">
        <Stage width={width * scale} height={worldH * scale} scaleX={scale} scaleY={scale}>
          <Layer>
            <Rect width={width} height={worldH} fill="#ffffff" onClick={() => onSelect(null)} onTap={() => onSelect(null)} />
            <TableView b={block} meta={meta} />
            <Rect width={width} height={rows} stroke="#c7d2fe" strokeWidth={1 / scale} dash={[6 / scale, 4 / scale]} listening={false} />
            <StudioShapes shapes={shapes ?? []} selectedId={selectedId} interactive={!tool} scale={scale} onSelect={onSelect} onChange={onChange} />
            {tool && <ShapeDrawSurface width={width} height={worldH} shape={tool} onDraw={onDraw} />}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
