"use client";

import { useMemo } from "react";
import { Path } from "react-konva";
import { borderPaths } from "@/app/_lib/pageBorder";
import type { PageBox } from "@/app/_lib/pageStack";
import type { PageBorder } from "@/app/_lib/types";

// The border of a page, under its blocks: the paths of its design (pageBorder.ts), drawn where the page stands on the stage. The PDF and the
// export preview are taken from the stage, so they have it too.
export default function PageBorderView({ box, border }: { box: PageBox; border: PageBorder }) {
  const { style, color, width, inset } = border;
  const paths = useMemo(() => borderPaths({ style, color, width, inset }, box.width, box.height), [style, color, width, inset, box.width, box.height]);
  return (
    <>
      {paths.map((p, i) => (
        <Path
          key={i}
          x={box.left}
          y={box.top}
          data={p.d}
          fill={p.fill === "ink" ? color : p.fill === "paper" ? "#ffffff" : undefined}
          stroke={p.w ? color : undefined}
          strokeWidth={p.w * Math.max(0.5, width)}
          dash={p.dash?.map((n) => n * Math.max(0.5, width))}
          lineCap={p.round ? "round" : "butt"}
          lineJoin={p.round ? "round" : "miter"}
          opacity={p.o ?? 1}
          listening={false}
          perfectDrawEnabled={false}
        />
      ))}
    </>
  );
}
