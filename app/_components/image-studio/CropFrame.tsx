"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { dragCrop, type CropHandle } from "@/app/_lib/imageStudio/crop";
import type { CropRect } from "@/app/_lib/imageStudio/types";
import { newShapeId } from "@/app/_lib/shapes";

const CURSORS: Record<CropHandle, string> = { move: "move", n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize", ne: "nesw-resize", sw: "nesw-resize", nw: "nwse-resize", se: "nwse-resize" };
// (where each handle sits on the frame, in % of it)
const SPOTS: Record<Exclude<CropHandle, "move">, [number, number]> = { nw: [0, 0], n: [50, 0], ne: [100, 0], e: [100, 50], se: [100, 100], s: [50, 100], sw: [0, 100], w: [0, 50] };

type Props = {
  /** The whole picture, px of the sheet */
  width: number;
  height: number;
  /** Screen px per px of the sheet */
  scale: number;
  crop: CropRect;
  /** width / height kept while a corner is dragged (null = free: the sides can be dragged too) */
  ratio: number | null;
  /** `gesture` names one drag: one step of the undo */
  onChange: (crop: CropRect, gesture: string) => void;
};

type Drag = { x: number; y: number; crop: CropRect; handle: CropHandle; gesture: string };

// The crop frame over the whole picture: what is cut away is darkened, the part kept is clear with its thirds drawn on it. Drag inside it to
// move it, drag its corners (and, free, its sides) to size it.
export default function CropFrame({ width, height, scale: s, crop, ratio, onChange }: Props) {
  // The drag going on: where it started and what is dragged (the frame captures the pointer, and shows the cursor of what was pressed).
  const drag = useRef<Drag | null>(null);
  const [held, setHeld] = useState<CropHandle | null>(null);

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const handle = ((e.target as HTMLElement).dataset.handle ?? "move") as CropHandle;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, crop, handle, gesture: `crop:${newShapeId()}` };
    setHeld(handle);
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (d) onChange(dragCrop(d.crop, d.handle, (e.clientX - d.x) / s, (e.clientY - d.y) / s, width, height, ratio), d.gesture);
  };
  const up = () => {
    drag.current = null;
    setHeld(null);
  };

  const handles = (Object.keys(SPOTS) as Exclude<CropHandle, "move">[]).filter((h) => !ratio || h.length === 2);
  return (
    <div data-testid="crop-frame" className="absolute inset-0 overflow-hidden select-none" style={{ cursor: held ? CURSORS[held] : undefined }}>
      <div
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className="absolute touch-none border border-white shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]"
        style={{ left: crop.x * s, top: crop.y * s, width: crop.w * s, height: crop.h * s, cursor: held ? CURSORS[held] : "move" }}
      >
        {/* the thirds */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute inset-y-0 left-1/3 w-px bg-white/50" />
          <div className="absolute inset-y-0 left-2/3 w-px bg-white/50" />
          <div className="absolute inset-x-0 top-1/3 h-px bg-white/50" />
          <div className="absolute inset-x-0 top-2/3 h-px bg-white/50" />
        </div>
        {handles.map((h) => (
          <span
            key={h}
            data-handle={h}
            data-testid={`crop-${h}`}
            className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-[2px] border border-accent bg-white shadow-sm ${h.length === 2 ? "size-3" : h === "n" || h === "s" ? "h-2 w-4" : "h-4 w-2"}`}
            style={{ left: `${SPOTS[h][0]}%`, top: `${SPOTS[h][1]}%`, cursor: held ? undefined : CURSORS[h] }}
          />
        ))}
      </div>
    </div>
  );
}
