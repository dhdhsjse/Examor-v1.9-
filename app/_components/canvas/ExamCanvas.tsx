"use client";

import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Layer, Line, Rect, Stage } from "react-konva";
import { PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH } from "@/app/_lib/a4";
import { pageAt, pageTop, stackHeight } from "@/app/_lib/pageStack";
import { mcqHeight } from "@/app/_lib/questions";
import { snapBox, type Guide } from "@/app/_lib/snapping";
import type { Page, Question } from "@/app/_lib/types";
import McqBlock from "./McqBlock";

const SNAP_PX = 6; // snap distance on screen, in pixels
const GUIDE_COLOR = "#c7d2fe"; // static margin/center guides
const SNAP_COLOR = "#ec4899"; // pink lines while dragging

interface Props {
  pages: Page[];
  questions: Question[];
  numbers: Map<string, number>;
  zoom: number;
  showGuides: boolean;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, pageId: string, x: number, y: number) => void;
}

// All pages on ONE Konva stage (always at real A4 size, 794 x 1123 per page),
// so blocks can be dragged from one page to another. Zoom is applied by CSS outside.
export default function ExamCanvas({ pages, questions, numbers, zoom, showGuides, selectedId, onSelect, onMove }: Props) {
  const layerRef = useRef<Konva.Layer>(null);
  const [snap, setSnap] = useState<{ page: number; guides: Guide[] } | null>(null);
  const height = stackHeight(pages.length);
  const pageIndex = new Map(pages.map((p, i) => [p.id, i]));

  // Draw at a higher resolution when zoomed in, so text stays sharp.
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const ratio = Math.min((window.devicePixelRatio || 1) * Math.max(1, zoom), 30000 / height);
    layer.getCanvas().setPixelRatio(ratio);
    layer.batchDraw();
  }, [zoom, height]);

  // While dragging: pick the closest page, snap to guides, keep the block inside that page.
  const handleDragMove = (q: Question, x: number, y: number) => {
    const h = mcqHeight(q);
    const i = pageAt(y + h / 2, pages.length);
    const top = pageTop(i);
    const others = questions
      .filter((o) => o.id !== q.id && o.layout.pageId === pages[i].id)
      .map((o) => ({ ...o.layout, height: mcqHeight(o) }));

    const box = { x, y: y - top, width: q.layout.width, height: h };
    const snapped = showGuides ? snapBox(box, others, SNAP_PX / zoom) : { ...box, guides: [] };
    setSnap({ page: i, guides: snapped.guides });

    return {
      x: Math.max(0, Math.min(snapped.x, PAGE_WIDTH - q.layout.width)),
      y: top + Math.max(0, Math.min(snapped.y, PAGE_HEIGHT - h)),
    };
  };

  // Drop: save which page the block landed on and its position on that page.
  const handleDragEnd = (q: Question, x: number, y: number) => {
    const i = pageAt(y + mcqHeight(q) / 2, pages.length);
    setSnap(null);
    onMove(q.id, pages[i].id, x, y - pageTop(i));
  };

  return (
    <Stage
      width={PAGE_WIDTH}
      height={height}
      // Clicking empty paper or the gap between pages clears the selection.
      onMouseDown={(e) => {
        if (e.target === e.target.getStage() || e.target.name() === "paper") onSelect(null);
      }}
    >
      <Layer ref={layerRef}>
        {pages.map((page, i) => (
          <PaperSheet key={page.id} top={pageTop(i)} showGuides={showGuides} zoom={zoom} />
        ))}

        {questions.map((q) => (
          <McqBlock
            key={q.id}
            question={q}
            x={q.layout.x}
            y={pageTop(pageIndex.get(q.layout.pageId) ?? 0) + q.layout.y}
            number={numbers.get(q.id) ?? 0}
            selected={q.id === selectedId}
            onSelect={() => onSelect(q.id)}
            onDragMove={(x, y) => handleDragMove(q, x, y)}
            onDragEnd={(x, y) => handleDragEnd(q, x, y)}
          />
        ))}

        {/* Pink alignment lines on the page being dragged over */}
        {snap?.guides.map((g, k) => {
          const top = pageTop(snap.page);
          return (
            <Line
              key={k}
              points={
                g.axis === "x"
                  ? [g.pos, top, g.pos, top + PAGE_HEIGHT]
                  : [0, top + g.pos, PAGE_WIDTH, top + g.pos]
              }
              stroke={SNAP_COLOR}
              strokeWidth={1 / zoom}
              listening={false}
            />
          );
        })}
      </Layer>
    </Stage>
  );
}

// One white A4 sheet, with margin box + center line when guides are on.
function PaperSheet({ top, showGuides, zoom }: { top: number; showGuides: boolean; zoom: number }) {
  return (
    <>
      <Rect name="paper" y={top} width={PAGE_WIDTH} height={PAGE_HEIGHT} fill="#ffffff" />
      {showGuides && (
        <>
          <Rect
            x={PAGE_MARGIN}
            y={top + PAGE_MARGIN}
            width={PAGE_WIDTH - PAGE_MARGIN * 2}
            height={PAGE_HEIGHT - PAGE_MARGIN * 2}
            stroke={GUIDE_COLOR}
            strokeWidth={1 / zoom}
            dash={[6, 4]}
            listening={false}
          />
          <Line
            points={[PAGE_WIDTH / 2, top + PAGE_MARGIN, PAGE_WIDTH / 2, top + PAGE_HEIGHT - PAGE_MARGIN]}
            stroke={GUIDE_COLOR}
            strokeWidth={1 / zoom}
            dash={[2, 6]}
            listening={false}
          />
        </>
      )}
    </>
  );
}
