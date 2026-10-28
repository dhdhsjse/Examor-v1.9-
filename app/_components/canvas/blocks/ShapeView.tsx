"use client";

import type { ShapeBlock } from "@/app/_lib/types";
import { ShapeGraphic } from "@/app/_components/shapes/ShapeGraphic";

// A shape block: the shape drawn to fill the block's box.
export function ShapeView({ b }: { b: ShapeBlock }) {
  return <ShapeGraphic style={b} w={b.layout.width} h={b.layout.height} />;
}
