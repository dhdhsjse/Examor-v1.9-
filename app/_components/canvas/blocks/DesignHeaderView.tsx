"use client";

import { Circle, Line, Rect } from "react-konva";
import type { HOp } from "@/app/_lib/headerDesigns";
import { OneLine } from "./shared";

// What a header design draws (headerDesigns.ts), as Konva shapes. A plain function without hooks: headerParts reads what it returns to
// find the texts that can be typed on the page.
export function DesignHeaderView({ ops, family, rtl }: { ops: HOp[]; family: string; rtl: boolean }) {
  return (
    <>
      {ops.map((op, i) => {
        switch (op.k) {
          case "rect": {
            const grad = typeof op.fill === "object" ? op.fill : null;
            return (
              <Rect
                key={i}
                x={op.x}
                y={op.y}
                width={op.w}
                height={op.h}
                fill={typeof op.fill === "string" ? op.fill : undefined}
                {...(grad ? { fillLinearGradientStartPoint: { x: grad.from[0], y: grad.from[1] }, fillLinearGradientEndPoint: { x: grad.to[0], y: grad.to[1] }, fillLinearGradientColorStops: [0, grad.stops[0], 1, grad.stops[1]] } : {})}
                stroke={op.stroke}
                strokeWidth={op.sw ?? (op.stroke ? 1 : 0)}
                cornerRadius={op.r}
                dash={op.dash}
                listening={false}
              />
            );
          }
          case "poly":
            return <Line key={i} points={op.pts} closed={op.closed} fill={op.fill} stroke={op.stroke} strokeWidth={op.sw ?? (op.stroke ? 1 : 0)} dash={op.dash} listening={false} />;
          case "circle":
            return <Circle key={i} x={op.x} y={op.y} radius={op.r} fill={op.fill} stroke={op.stroke} strokeWidth={op.sw ?? (op.stroke ? 1 : 0)} dash={op.dash} listening={false} />;
          case "text":
            return <OneLine key={i} family={op.family ?? family} text={op.text} x={op.x} y={op.y} width={op.w} size={op.size} bold={op.bold} color={op.color} rtl={op.ltr ? false : rtl} align={op.align} />;
        }
      })}
    </>
  );
}
