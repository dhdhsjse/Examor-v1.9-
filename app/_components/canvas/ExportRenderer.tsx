"use client";

import type Konva from "konva";
import { useEffect, useMemo, useRef } from "react";
import { blockHeights, questionNumbers } from "@/app/_lib/blocks";
import type { ExamDoc, ViewMode } from "@/app/_lib/types";
import ExamCanvas from "./ExamCanvas";

interface Props {
  doc: ExamDoc;
  mode: ViewMode;
  onReady: (stage: Konva.Stage) => void;
}

// Draws a clean copy of the exam (no guides, no selection) off-screen,
// then hands the Konva stage to the PDF exporter.
export default function ExportRenderer({ doc, mode, onReady }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const heights = useMemo(() => blockHeights(doc), [doc]);
  const numbers = useMemo(() => questionNumbers(doc.blocks, doc.pages), [doc]);
  const readyRef = useRef(onReady);

  useEffect(() => {
    // Wait one frame so Konva has drawn everything.
    const id = requestAnimationFrame(() => stageRef.current && readyRef.current(stageRef.current));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }} aria-hidden>
      <ExamCanvas
        doc={doc}
        heights={heights}
        numbers={numbers}
        mode={mode}
        zoom={1}
        showGuides={false}
        selectedId={null}
        interactive={false}
        stageRef={stageRef}
      />
    </div>
  );
}
