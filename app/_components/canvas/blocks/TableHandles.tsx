"use client";

import type Konva from "konva";
import { useState } from "react";
import { Rect } from "react-konva";
import { TABLE_MIN_COL, TABLE_MIN_ROW, layoutTable } from "@/app/_lib/blockLayout";
import type { ExamMeta, TableBlock } from "@/app/_lib/types";
import type { BlockPatch } from "@/app/_lib/useExam";

const GRIP = 8; // grab area around a line (page px)
const ACCENT = "#4f46e5";

type DragEvt = Konva.KonvaEventObject<DragEvent>;
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

// Invisible strips over the inner lines of the selected table: drag them to change
// column widths (left/right) or row heights (up/down, including the bottom edge).
export function TableHandles({ b, meta, zoom, onPatch }: { b: TableBlock; meta: ExamMeta; zoom: number; onPatch: (patch: BlockPatch) => void }) {
  const L = layoutTable(b, meta);
  const rtl = L.mirror; // (the first column is on the right)
  const grip = GRIP / Math.max(0.5, zoom);

  // The line between columns k-1 and k. In Arabic column k is on the LEFT of column k-1.
  const columnLine = (k: number) => {
    const left = rtl ? k : k - 1;
    const right = rtl ? k - 1 : k;
    const min = L.colX[left] + TABLE_MIN_COL;
    const max = L.colX[right] + L.colW[right] - TABLE_MIN_COL;
    return { x: L.colX[right], left, right, min, max };
  };

  const dropColumn = (k: number, x: number) => {
    const line = columnLine(k);
    const nx = clamp(x, line.min, line.max);
    const widths = [...L.colW];
    widths[line.left] = nx - L.colX[line.left];
    widths[line.right] = L.colX[line.right] + L.colW[line.right] - nx;
    const total = widths.reduce((s, v) => s + v, 0);
    onPatch({ colWidths: widths.map((v) => Math.round((v / total) * 10000) / 10000) });
  };

  const dropRow = (r: number, y: number) => {
    const row = L.rows[r];
    const height = Math.max(TABLE_MIN_ROW, Math.round(y - row.y));
    const heights = b.cells.map((_, i) => b.rowHeights?.[i] ?? 0);
    // Smaller than the text: the row just fits its text again.
    const content = Math.max(TABLE_MIN_ROW, ...row.cells.map((c) => c.height + 8));
    heights[r] = height <= content ? 0 : height;
    onPatch({ rowHeights: heights });
  };

  return (
    <>
      {L.colW.slice(1).map((_, i) => {
        const k = i + 1;
        const line = columnLine(k);
        return (
          <Grip
            key={`c${k}`}
            vertical
            x={line.x - grip / 2}
            y={0}
            width={grip}
            height={L.height}
            limit={(x) => clamp(x + grip / 2, line.min, line.max) - grip / 2}
            onDrop={(x) => dropColumn(k, x + grip / 2)}
          />
        );
      })}
      {L.rows.map((row, r) => (
        <Grip
          key={`r${r}`}
          vertical={false}
          x={0}
          y={row.y + row.height - grip / 2}
          width={b.layout.width}
          height={grip}
          limit={(y) => Math.max(row.y + TABLE_MIN_ROW, y + grip / 2) - grip / 2}
          onDrop={(y) => dropRow(r, y + grip / 2)}
        />
      ))}
    </>
  );
}

// One draggable strip. It shows as a thin indigo line while hovered or dragged.
function Grip({ vertical, x, y, width, height, limit, onDrop }: {
  vertical: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
  limit: (pos: number) => number;
  onDrop: (pos: number) => void;
}) {
  const [active, setActive] = useState(false);
  const cursor = vertical ? "col-resize" : "row-resize";
  const setCursor = (e: Konva.KonvaEventObject<MouseEvent | DragEvent>, c: string) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = c;
  };
  // Keep the drag events here: the block itself must not move.
  const stop = (e: DragEvt) => {
    e.cancelBubble = true;
  };

  return (
    <Rect
      x={x}
      y={y}
      width={width}
      height={height}
      fill={active ? "rgba(79,70,229,0.18)" : "transparent"}
      stroke={active ? ACCENT : undefined}
      strokeWidth={0}
      draggable
      onMouseEnter={(e) => {
        setActive(true);
        setCursor(e, cursor);
      }}
      onMouseLeave={(e) => {
        setActive(false);
        setCursor(e, "move");
      }}
      onDragStart={stop}
      onDragMove={(e) => {
        stop(e);
        const n = e.target;
        if (vertical) n.position({ x: limit(n.x()), y });
        else n.position({ x, y: limit(n.y()) });
      }}
      onDragEnd={(e) => {
        stop(e);
        const n = e.target;
        const pos = vertical ? n.x() : n.y();
        n.position({ x, y }); // the new size redraws the table and moves the strip
        setActive(false);
        setCursor(e, "default");
        onDrop(pos);
      }}
    />
  );
}
