"use client";

import type Konva from "konva";
import { Rect } from "react-konva";
import type { PageBox } from "@/app/_lib/pageStack";
import { columnsAfterDrag, offsetsAfterDrag, type FrameGeometry } from "@/app/_lib/sheet/frame";
import { MIN_ANSWER_WIDTH, MIN_COLUMN, type SheetConfig } from "@/app/_lib/sheet/model";
import type { Page } from "@/app/_lib/types";

const COLOR = "#059669"; // the green of the correction sheet
const LONG = 26; // handles, in screen pixels (the same at every zoom)
const SHORT = 6;

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

// One handle: a small bar that slides along one axis between two limits (stage px); `onDrag` gets its position along that axis.
function Grip({ x, y, along, min, max, zoom, onDrag, label }: { x: number; y: number; along: "x" | "y"; min: number; max: number; zoom: number; onDrag: (v: number) => void; label: string }) {
  const horizontal = along === "x"; // slides sideways: a tall thin bar
  const w = (horizontal ? SHORT : LONG) / zoom;
  const h = (horizontal ? LONG : SHORT) / zoom;
  const cursor = (e: Konva.KonvaEventObject<MouseEvent | DragEvent>, value: string) => {
    const container = e.target.getStage()?.container();
    if (container) container.style.cursor = value;
  };
  return (
    <Rect
      name={label}
      x={x}
      y={y}
      width={w}
      height={h}
      offsetX={w / 2}
      offsetY={h / 2}
      fill="#ffffff"
      stroke={COLOR}
      strokeWidth={1 / zoom}
      cornerRadius={3 / zoom}
      shadowColor="rgba(0,0,0,0.2)"
      shadowBlur={4 / zoom}
      hitStrokeWidth={8 / zoom}
      draggable
      dragBoundFunc={(pos) => (horizontal ? { x: clamp(pos.x, min, max), y } : { x, y: clamp(pos.y, min, max) })}
      onMouseEnter={(e) => cursor(e, horizontal ? "ew-resize" : "ns-resize")}
      onMouseLeave={(e) => !e.target.isDragging() && cursor(e, "")}
      onDragMove={(e) => onDrag(horizontal ? e.target.x() : e.target.y())}
      onDragEnd={(e) => {
        cursor(e, "");
        onDrag(horizontal ? e.target.x() : e.target.y());
      }}
    />
  );
}

// The handles of the frame of a bordered correction sheet, on one page: one on each boundary between its columns (they change the width of the
// columns of marks), one in the middle of each edge (they push the frame out of the margins, or in). Shown while nothing is selected.
export default function FrameHandles({ geo, sheet, page, pageIndex, box, rtl, zoom, onChange }: {
  geo: FrameGeometry;
  sheet: SheetConfig;
  page: Page;
  pageIndex: number;
  box: PageBox;
  rtl: boolean;
  zoom: number;
  onChange: (patch: Partial<SheetConfig>, key?: string) => void;
}) {
  const { frame, marks, total, answer } = geo;
  const left = box.left;
  const top = box.top;
  const x1 = frame.x + frame.width;
  const y1 = frame.y + frame.height;
  const midX = left + frame.x + frame.width / 2;
  const midY = top + frame.y + frame.height / 2;
  // Distance of a stage x from the end edge of the frame (the right one; the left one when the sheet reads right to left)
  const dist = (sx: number) => (rtl ? sx - left - frame.x : left + x1 - sx);
  const outerX = rtl ? answer.x0 : answer.x1;
  const innerX = marks && total ? Math.max(marks.x0, total.x0) : null;
  const edgeY = top + frame.y + 18;
  const marksW = marks ? marks.x1 - marks.x0 : 0;
  const totalW = total ? total.x1 - total.x0 : 0;
  // Where a boundary can go, for a distance from the end edge between `dMin` and `dMax` (stage px)
  const range = (dMin: number, dMax: number) => (rtl ? { min: left + frame.x + dMin, max: left + frame.x + dMax } : { min: left + x1 - dMax, max: left + x1 - dMin });
  const edge = (e: "top" | "right" | "bottom" | "left", at: number) => onChange({ frame: offsetsAfterDrag(sheet, page, e, at, pageIndex === 0) }, `frame-${e}`);

  return (
    <>
      {(marks || total) && (
        <Grip
          label="frame-columns"
          x={left + outerX}
          y={edgeY}
          along="x"
          {...range((marks && total ? totalW : 0) + MIN_COLUMN, frame.width - MIN_ANSWER_WIDTH)}
          zoom={zoom}
          onDrag={(sx) => onChange(columnsAfterDrag(sheet, "outer", dist(sx)), "frame-columns")}
        />
      )}
      {marks && total && innerX !== null && (
        <Grip
          label="frame-split"
          x={left + innerX}
          y={edgeY + 40}
          along="x"
          {...range(MIN_COLUMN, marksW + totalW - MIN_COLUMN)}
          zoom={zoom}
          onDrag={(sx) => onChange(columnsAfterDrag(sheet, "inner", dist(sx)), "frame-columns")}
        />
      )}
      <Grip label="frame-top" x={midX} y={top + frame.y} along="y" {...{ min: top, max: top + y1 - 80 }} zoom={zoom} onDrag={(sy) => edge("top", sy - top)} />
      <Grip label="frame-bottom" x={midX} y={top + y1} along="y" {...{ min: top + frame.y + 80, max: top + box.height }} zoom={zoom} onDrag={(sy) => edge("bottom", sy - top)} />
      <Grip label="frame-left" x={left + frame.x} y={midY} along="x" {...{ min: left, max: left + x1 - 200 }} zoom={zoom} onDrag={(sx) => edge("left", sx - left)} />
      <Grip label="frame-right" x={left + x1} y={midY} along="x" {...{ min: left + frame.x + 200, max: left + box.width }} zoom={zoom} onDrag={(sx) => edge("right", sx - left)} />
    </>
  );
}
