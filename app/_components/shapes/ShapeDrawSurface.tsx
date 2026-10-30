"use client";

import type Konva from "konva";
import { useState } from "react";
import { Group, Line, Rect } from "react-konva";
import { boxFromDrag, freehandFrom, resolveStyle, shapeDef, type DrawnBox, type ShapeStyle } from "@/app/_lib/shapes";
import { ShapeGraphic } from "./ShapeGraphic";

type Drag = { from: [number, number]; to: [number, number]; square: boolean; center: boolean };

type Props = {
  /** The drawing area (the shape is drawn inside it): its top-left corner (0, 0 by default) and its size */
  x?: number;
  y?: number;
  width: number;
  height: number;
  shape: string;
  /** How the new shape looks (the preview follows it) */
  style?: Partial<ShapeStyle>;
  /** Points go to multiples of this (the Studio's grid); none = anywhere */
  snap?: number;
  /** The box drawn; for a stroke of the pencil, also its points (`style.adj`) */
  onDraw: (box: DrawnBox, style?: Partial<ShapeStyle>) => void;
};

// The Studios' drawing tool for shapes: a transparent sheet over the drawing area. Drag from one corner to the opposite one (Shift
// for a square or a 45° line, Alt to draw from the centre); a plain click puts the shape at its usual size. While dragging, the
// shape is shown as it will be. With the pencil (the freehand shape) the drag is the stroke itself, wherever the mouse goes.
export default function ShapeDrawSurface({ x: left = 0, y: top = 0, width, height, shape, style, snap, onDraw }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const [stroke, setStroke] = useState<[number, number][] | null>(null);
  const pencil = !!shapeDef(shape).freehand;

  const at = (e: Konva.KonvaEventObject<MouseEvent>, snapTo = snap): [number, number] => {
    // (relative to the sheet itself, whose corner is at (left, top) of the drawing)
    const p = e.target.getRelativePointerPosition();
    const x = Math.min(Math.max((p?.x ?? 0) + left, left), left + width);
    const y = Math.min(Math.max((p?.y ?? 0) + top, top), top + height);
    return snapTo ? [Math.round(x / snapTo) * snapTo, Math.round(y / snapTo) * snapTo] : [x, y];
  };

  const finish = (d: Drag | null) => {
    setDrag(null);
    if (d) onDraw(boxFromDrag(shape, d.from, d.to, { square: d.square, fromCenter: d.center }));
  };

  const finishStroke = (pts: [number, number][] | null) => {
    setStroke(null);
    const drawn = pts && freehandFrom(pts);
    if (drawn) onDraw(drawn.box, { adj: drawn.adj });
  };

  const preview = drag && Math.hypot(drag.to[0] - drag.from[0], drag.to[1] - drag.from[1]) >= 4 ? boxFromDrag(shape, drag.from, drag.to, { square: drag.square, fromCenter: drag.center }) : null;
  const look = resolveStyle({ ...style, shape });

  return (
    <>
      <Rect
        x={left}
        y={top}
        width={width}
        height={height}
        fill="transparent"
        onMouseDown={(e) => {
          if (e.evt.button !== 0) return;
          if (pencil) return void setStroke([at(e, 0)]);
          const p = at(e);
          setDrag({ from: p, to: p, square: e.evt.shiftKey, center: e.evt.altKey });
        }}
        onMouseMove={(e) => {
          if (pencil) {
            if (!stroke) return;
            const p = at(e, 0);
            const last = stroke[stroke.length - 1];
            if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 1.5) setStroke([...stroke, p]); // (not every pixel)
          } else if (drag) setDrag({ ...drag, to: at(e), square: e.evt.shiftKey, center: e.evt.altKey });
        }}
        onMouseUp={(e) => {
          if (e.evt.button !== 0) return;
          if (pencil) finishStroke(stroke && [...stroke, at(e, 0)]);
          else finish(drag && { ...drag, to: at(e) });
        }}
        onMouseLeave={() => (pencil ? finishStroke(stroke) : finish(drag))}
      />
      {stroke && stroke.length > 1 && <Line points={stroke.flat()} stroke={look.stroke ?? undefined} strokeWidth={look.strokeWidth} lineCap="round" lineJoin="round" opacity={0.75} listening={false} />}
      {preview && (
        <Group x={preview.x} y={preview.y} listening={false}>
          <ShapeGraphic style={{ ...style, shape, flipX: preview.flipX || undefined, flipY: preview.flipY || undefined }} w={preview.w} h={preview.h} opacity={0.75} />
        </Group>
      )}
    </>
  );
}
