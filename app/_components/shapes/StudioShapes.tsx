"use client";

import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Circle, Group, Rect, Transformer } from "react-konva";
import { MIN_SHAPE_SIZE, dragHandle, handlePoints, isLine, lineEnds, localToWorld, moveLineEnd, worldToLocal, type ShapeItem } from "@/app/_lib/shapes";
import { ShapeGraphic } from "./ShapeGraphic";

const ACCENT = "#4f46e5";
const ANGLE_STEP = Math.PI / 4;

export type ShapePatch = Partial<Omit<ShapeItem, "id">>;

type Props = {
  shapes: readonly ShapeItem[];
  selectedId: string | null;
  /** The shapes can be clicked, moved and changed (the Select tool is in hand); otherwise they are only drawn */
  interactive: boolean;
  /** How much the Studio's drawing is scaled on the screen: the handles keep their size on the screen */
  scale: number;
  onSelect: (id: string) => void;
  /** `key` names what changed: edits with the same key close together are one step of the undo */
  onChange: (id: string, patch: ShapePatch, key: string) => void;
  /** A shape (or one of its handles) is picked up and let go: a Studio whose undo works by gestures makes one step of what is between */
  onGrab?: () => void;
  onRelease?: () => void;
};

const setCursor = (e: Konva.KonvaEventObject<MouseEvent>, value: string) => {
  const box = e.target.getStage()?.container();
  if (box) box.style.cursor = value;
};

const turnAngle = (deg: number) => {
  const r = Math.round((((deg % 360) + 360) % 360) * 10) / 10;
  return r === 0 || r === 360 ? undefined : r;
};

// The shapes of a Studio, drawn inside its Konva layer (they go over what the Studio draws itself). The selected one has the
// corner handles that resize and turn it (a line has a handle at each end instead), and its yellow handles (how round, how long…).
// Everything is in the Studio's own coordinates; `scale` only keeps the handles the same size on the screen.
export default function StudioShapes({ shapes, selectedId, interactive, scale, onSelect, onChange, onGrab, onRelease }: Props) {
  const transformer = useRef<Konva.Transformer>(null);
  const [version, setVersion] = useState(0); // (a handle that was dragged is put back where the state says it is, by making a new one)
  const selected = interactive ? shapes.find((s) => s.id === selectedId) : undefined;
  const boxed = selected && !isLine(selected) ? selected : undefined;

  useEffect(() => {
    const tr = transformer.current;
    if (!tr) return;
    const node = boxed ? tr.getStage()?.findOne(`#shape-${boxed.id}`) : undefined;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  });

  const handle = 9 / scale;
  const line = selected && isLine(selected) ? selected : undefined;

  return (
    <>
      {shapes.map((s) => (
        <Group
          key={s.id}
          id={`shape-${s.id}`}
          x={s.x + s.w / 2}
          y={s.y + s.h / 2}
          offsetX={s.w / 2}
          offsetY={s.h / 2}
          rotation={s.rotation ?? 0}
          listening={interactive}
          draggable={interactive}
          onClick={(e) => {
            if (e.evt.button !== 0) return;
            e.cancelBubble = true;
            onSelect(s.id);
          }}
          onTap={() => onSelect(s.id)}
          onDragStart={(e) => {
            if (e.target !== e.currentTarget) return;
            onSelect(s.id);
            onGrab?.();
          }}
          onDragEnd={(e) => e.target === e.currentTarget && onRelease?.()}
          onDragMove={(e) => e.target === e.currentTarget && onChange(s.id, { x: e.target.x() - s.w / 2, y: e.target.y() - s.h / 2 }, `shape-move:${s.id}`)}
          onTransformEnd={(e) => {
            const node = e.target;
            const sx = node.scaleX();
            const sy = node.scaleY();
            const w = Math.max(MIN_SHAPE_SIZE, s.w * Math.abs(sx));
            const h = Math.max(MIN_SHAPE_SIZE, s.h * Math.abs(sy));
            node.scale({ x: 1, y: 1 });
            const patch: ShapePatch = { x: node.x() - w / 2, y: node.y() - h / 2, w, h, rotation: turnAngle(node.rotation()) };
            if (sx < 0) patch.flipX = !s.flipX || undefined;
            if (sy < 0) patch.flipY = !s.flipY || undefined;
            onChange(s.id, patch, `shape-resize:${s.id}:${Date.now()}`);
          }}
          onMouseEnter={(e) => interactive && setCursor(e, "move")}
          onMouseLeave={(e) => setCursor(e, "")}
        >
          <ShapeGraphic style={s} w={s.w} h={s.h} />
        </Group>
      ))}

      {boxed && (
        <Transformer
          ref={transformer}
          rotateEnabled
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          rotationSnapTolerance={4}
          keepRatio={false}
          ignoreStroke
          anchorSize={9}
          anchorCornerRadius={2}
          anchorFill="#ffffff"
          anchorStroke={ACCENT}
          borderStroke={ACCENT}
          boundBoxFunc={(oldBox, next) => (next.width < MIN_SHAPE_SIZE || next.height < MIN_SHAPE_SIZE ? oldBox : next)}
        />
      )}

      {/* a line: a handle at each end */}
      {line &&
        (["start", "end"] as const).map((which) => {
          const [x, y] = lineEnds(line)[which];
          const other = lineEnds(line)[which === "start" ? "end" : "start"];
          return (
            <Circle
              key={`${which}-${version}`}
              x={x}
              y={y}
              radius={handle * 0.6}
              fill="#ffffff"
              stroke={ACCENT}
              strokeWidth={1.5 / scale}
              draggable
              onMouseEnter={(e) => setCursor(e, "crosshair")}
              onMouseLeave={(e) => setCursor(e, "")}
              onDragMove={(e) => {
                let p: [number, number] = [e.target.x(), e.target.y()];
                if (e.evt.shiftKey) {
                  // Shift: the line goes along the nearest 45° step
                  const dx = p[0] - other[0];
                  const dy = p[1] - other[1];
                  const len = Math.hypot(dx, dy);
                  const step = Math.round(Math.atan2(dy, dx) / ANGLE_STEP) * ANGLE_STEP;
                  p = [other[0] + Math.cos(step) * len, other[1] + Math.sin(step) * len];
                }
                const m = moveLineEnd(line, which, p);
                onChange(line.id, { x: m.x, y: m.y, w: m.w, h: m.h, flipX: m.flipX, flipY: m.flipY }, `shape-end:${line.id}`);
              }}
              onDragStart={() => onGrab?.()}
              onDragEnd={() => {
                setVersion((v) => v + 1);
                onRelease?.();
              }}
            />
          );
        })}

      {/* the yellow handles of the selected shape */}
      {selected &&
        handlePoints(selected, selected.w, selected.h).map(([hx, hy], i) => {
          const [x, y] = localToWorld(selected, hx, hy);
          return (
            <Rect
              key={`adj${i}-${version}`}
              x={x}
              y={y}
              width={handle}
              height={handle}
              offsetX={handle / 2}
              offsetY={handle / 2}
              rotation={45}
              fill="#facc15"
              stroke="#a16207"
              strokeWidth={1 / scale}
              draggable
              onMouseEnter={(e) => setCursor(e, "pointer")}
              onMouseLeave={(e) => setCursor(e, "")}
              onDragMove={(e) => {
                const [lx, ly] = worldToLocal(selected, e.target.x(), e.target.y());
                onChange(selected.id, { adj: dragHandle(selected, i, lx, ly, selected.w, selected.h) }, `shape-adj:${selected.id}`);
              }}
              onDragStart={() => onGrab?.()}
              onDragEnd={() => {
                setVersion((v) => v + 1);
                onRelease?.();
              }}
            />
          );
        })}
    </>
  );
}
