"use client";

import { Layer, Stage } from "react-konva";
import { TableView } from "@/app/_components/canvas/blocks/ContentViews";
import { tableHeight } from "@/app/_lib/blockLayout";
import type { ExamMeta } from "@/app/_lib/types";
import { studioBlock } from "./tablePreset";
import type { StudioTable } from "./useTableStudio";

// The table as the page will draw it (the same TableView the page uses), shrunk to the width of the panel.
export default function TablePreview({ table, meta, boxWidth }: { table: StudioTable; meta: ExamMeta; boxWidth: number }) {
  const { width } = table;
  const block = studioBlock(table, "preview");
  const height = tableHeight(block, meta); // (as high as the shapes and pictures reach, if that is lower than the rows)
  const scale = Math.min(1, boxWidth / width);
  return (
    <div data-testid="table-preview" className="max-h-72 overflow-auto rounded-lg border border-line bg-white p-1" dir="ltr">
      <Stage width={Math.ceil(width * scale) + 2} height={Math.ceil(height * scale) + 2} scaleX={scale} scaleY={scale}>
        <Layer x={1 / scale} y={1 / scale}>
          <TableView b={block} meta={meta} />
        </Layer>
      </Stage>
    </div>
  );
}
