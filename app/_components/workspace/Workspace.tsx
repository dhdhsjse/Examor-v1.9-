"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PAGE_HEIGHT, PAGE_WIDTH } from "@/app/_lib/a4";
import { LABEL_SPACE, pageTop, stackHeight } from "@/app/_lib/pageStack";
import { questionNumbers } from "@/app/_lib/questions";
import type { Page, Question } from "@/app/_lib/types";
import type { RevealRequest } from "@/app/_lib/useExam";
import { useZoom } from "@/app/_lib/useZoom";
import ExamCanvas from "../canvas/ExamCanvas";
import PageStrip from "./PageStrip";
import ZoomBar from "./ZoomBar";

interface Props {
  pages: Page[];
  questions: Question[];
  selectedId: string | null;
  activePage: number;
  reveal: RevealRequest | null;
  onSelect: (id: string | null) => void;
  onMove: (id: string, pageId: string, x: number, y: number) => void;
  onAddPage: () => void;
  onActivePageChange: (index: number) => void;
}

// Page thumbnails on the left, the zoomable page stack in the center, zoom bottom-right.
export default function Workspace(props: Props) {
  const { pages, questions, selectedId, activePage, reveal, onSelect, onMove, onAddPage, onActivePageChange } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [showGuides, setShowGuides] = useState(true);
  const { zoom, fitMode, setZoom, fitPage } = useZoom(viewport);
  const numbers = useMemo(() => questionNumbers(questions, pages), [questions, pages]);
  const height = stackHeight(pages.length);

  // Smoothly scroll so page `i` (with its label) is at the top.
  const scrollToPage = useCallback(
    (i: number) => {
      const el = scrollRef.current;
      const stack = stackRef.current;
      if (!el || !stack) return;
      el.scrollTo({ top: stack.offsetTop + (pageTop(i) - LABEL_SPACE) * zoom - 8, behavior: "smooth" });
    },
    [zoom],
  );

  // The page under the top third of the screen is the "current" page.
  const handleScroll = () => {
    const el = scrollRef.current;
    const stack = stackRef.current;
    if (!el || !stack) return;
    const mark = el.scrollTop + el.clientHeight / 3;
    let current = 0;
    pages.forEach((_, i) => {
      if (stack.offsetTop + pageTop(i) * zoom <= mark) current = i;
    });
    if (current !== activePage) onActivePageChange(current);
  };

  // Scroll to a page when asked (after adding a page or a question).
  useEffect(() => {
    if (!reveal) return;
    const i = pages.findIndex((p) => p.id === reveal.pageId);
    if (i >= 0 && i !== activePage) scrollToPage(i);
    // Only react to new requests, not to every page/scroll change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reveal]);

  // Track the visible size (used by "Fit page").
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewport({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Ctrl + mouse wheel zooms in/out.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setZoom(zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, setZoom]);

  return (
    <div className="flex h-full">
      <PageStrip
        pages={pages}
        questions={questions}
        activeIndex={activePage}
        onJump={scrollToPage}
        onAddPage={onAddPage}
      />

      <div className="relative min-w-0 flex-1">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="workspace-dots absolute inset-0 overflow-auto"
          // Clicking the grey area clears the selection.
          onMouseDown={(e) => e.target === e.currentTarget && onSelect(null)}
        >
          <div className="mx-auto flex w-fit flex-col items-center gap-4 px-10 pt-2 pb-20">
            {/* Takes the zoomed size in the layout... */}
            <div ref={stackRef} style={{ width: PAGE_WIDTH * zoom, height: height * zoom }} className="relative">
              {/* ...while the content inside stays at real A4 size and is scaled by CSS. */}
              <div
                className="absolute top-0 left-0 origin-top-left"
                style={{ width: PAGE_WIDTH, height, transform: `scale(${zoom})` }}
              >
                {pages.map((page, i) => (
                  <PageFrame
                    key={page.id}
                    index={i}
                    total={pages.length}
                    zoom={zoom}
                    active={i === activePage}
                    onClick={() => scrollToPage(i)}
                  />
                ))}
                <div className="absolute inset-0">
                  <ExamCanvas
                    pages={pages}
                    questions={questions}
                    numbers={numbers}
                    zoom={zoom}
                    showGuides={showGuides}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onMove={onMove}
                  />
                </div>
              </div>
            </div>

            {/* Small "add page" below the last page */}
            <button
              onClick={onAddPage}
              className="flex items-center gap-1.5 rounded-full border border-slate-300/80 bg-white/70 px-3 py-1 text-xs font-medium text-muted backdrop-blur transition-colors hover:border-indigo-300 hover:text-indigo-600"
            >
              <span className="text-sm leading-none">+</span> Add page
            </button>
          </div>
        </div>

        {/* Zoom (bottom-right) */}
        <div className="pointer-events-none absolute right-4 bottom-4">
          <ZoomBar
            zoom={zoom}
            fitMode={fitMode}
            showGuides={showGuides}
            onZoom={setZoom}
            onFitPage={fitPage}
            onToggleGuides={() => setShowGuides(!showGuides)}
          />
        </div>
      </div>
    </div>
  );
}

// The paper shadow behind page `index` + its clickable "Page 1 of 3" label.
// Sizes are divided by zoom so the label keeps the same size on screen.
function PageFrame({ index, total, zoom, active, onClick }: {
  index: number;
  total: number;
  zoom: number;
  active: boolean;
  onClick: () => void;
}) {
  const top = pageTop(index);
  return (
    <>
      <div className="paper-shadow absolute left-0 bg-white" style={{ top, width: PAGE_WIDTH, height: PAGE_HEIGHT }} />
      <button
        onClick={onClick}
        className={`absolute left-0 z-10 rounded font-medium transition-colors hover:bg-white/70 ${
          active ? "text-indigo-600" : "text-muted"
        }`}
        style={{
          top,
          transform: "translateY(-100%)",
          marginTop: -4 / zoom,
          fontSize: 12 / zoom,
          padding: `${2 / zoom}px ${6 / zoom}px`,
        }}
      >
        Page {index + 1} <span className="text-faint">of {total}</span>
      </button>
    </>
  );
}
