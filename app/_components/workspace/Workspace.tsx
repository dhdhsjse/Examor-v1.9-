"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type DragEvent } from "react";
import { PAGE_HEIGHT, PAGE_WIDTH } from "@/app/_lib/a4";
import { isQuestion } from "@/app/_lib/blocks";
import type { EditField } from "@/app/_lib/editRegions";
import { CANVAS_BOTTOM_SPACE, CANVAS_TOP_GAP, LABEL_HEIGHT, canvasTopPadding, pageAt, pageTop, stackHeight } from "@/app/_lib/pageStack";
import { DRAG_MIME, type ToolAction } from "@/app/_lib/tools";
import type { BlockLayout, ExamDoc, ExamMeta, PageMargins, ViewMode } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch, DropPoint, RevealRequest } from "@/app/_lib/useExam";
import { useZoom } from "@/app/_lib/useZoom";
import ExamCanvas, { type MarginEditView } from "../canvas/ExamCanvas";
import AnswerBar from "./AnswerBar";
import CorrectionBar from "./CorrectionBar";
import InlineEditor from "./InlineEditor";
import PageStrip from "./PageStrip";
import ToolRail, { type CanvasTool } from "./ToolRail";
import ZoomBar from "./ZoomBar";

export interface Editing {
  id: string;
  field: EditField;
  created?: boolean; // new text from the T tool (removed if left empty)
  selectAll?: boolean; // new block: its starting text is selected, so typing replaces it
}

interface Props {
  doc: ExamDoc;
  heights: Map<string, number>;
  numbers: Map<string, number>;
  mode: ViewMode;
  selectedId: string | null;
  activePage: number;
  reveal: RevealRequest | null;
  tool: CanvasTool;
  editing: Editing | null;
  marginEdit: MarginEditView | null; // margins being edited (Page layout → Margins), see ExamCanvas
  onMarginDrag: (margins: PageMargins, done: boolean) => void;
  onToolChange: (tool: CanvasTool) => void;
  onSelect: (id: string | null) => void;
  onMove: (id: string, pageId: string, x: number, y: number) => void;
  onResize: (id: string, layout: Partial<BlockLayout>) => void;
  onPatch: (id: string, patch: BlockPatch, field: string) => void;
  onEditStart: (id: string, field: EditField | null) => void;
  onEditChange: (value: string) => void;
  onEditNext: (back: boolean) => void;
  onEditEnter: () => void;
  onEditDone: (id: string) => void;
  onCreateText: (at: DropPoint) => void;
  onAddPage: () => void;
  onDeletePage: (pageId: string) => void;
  onActivePageChange: (index: number) => void;
  onDropItem: (action: ToolAction, at: DropPoint) => void;
  onMeta: (patch: Partial<ExamMeta>, key?: string) => void;
  onModeChange: (mode: ViewMode) => void;
}

const ANSWER_BAR_KEY = "examBuilder.answerBarOpen";

// Page thumbnails on the left, the zoomable page stack in the center, zoom bottom-right.
export default function Workspace(props: Props) {
  const t = useT();
  const { doc, heights, numbers, mode, selectedId, activePage, reveal, editing } = props;
  const { pages } = doc;
  const scrollRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [showGuides, setShowGuides] = useState(true);
  const [dropHover, setDropHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [answerOpen, setAnswerOpen] = useState(() => {
    try {
      return localStorage.getItem(ANSWER_BAR_KEY) !== "0";
    } catch {
      return true;
    }
  });
  const { zoom, fitMode, setZoom, fitPage, fitWidth } = useZoom(viewport);
  const [panReady, setPanReady] = useState(false); // Space held: drag to move around
  const [panning, setPanning] = useState(false);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const height = stackHeight(pages.length);
  const pageIndex = (pageId: string) => Math.max(0, pages.findIndex((p) => p.id === pageId));

  // ---- Zoom that keeps the same spot of the page under the screen center (or the mouse) ----

  const anchor = useRef<{ x: number; y: number; sx: number; sy: number } | null>(null);

  const keepAnchor = (sx?: number, sy?: number) => {
    const el = scrollRef.current;
    const stack = stackRef.current;
    if (!el || !stack) return;
    const ax = sx ?? el.clientWidth / 2;
    const ay = sy ?? el.clientHeight / 2;
    anchor.current = {
      x: (el.scrollLeft + ax - stack.offsetLeft) / zoom,
      y: (el.scrollTop + ay - stack.offsetTop) / zoom,
      sx: ax,
      sy: ay,
    };
  };
  const zoomTo = (z: number, sx?: number, sy?: number) => {
    keepAnchor(sx, sy);
    setZoom(z);
  };
  const fitTo = (width = false) => {
    keepAnchor();
    if (width) fitWidth();
    else fitPage();
  };

  // After the new zoom is drawn: scroll so the remembered spot is back where it was.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    const stack = stackRef.current;
    const a = anchor.current;
    anchor.current = null;
    if (!el || !stack || !a) return;
    el.scrollLeft = a.x * zoom + stack.offsetLeft - a.sx;
    el.scrollTop = a.y * zoom + stack.offsetTop - a.sy;
  }, [zoom]);

  // Smoothly scroll so page `i` (with its whole label) is at the top.
  const scrollToPage = useCallback(
    (i: number) => {
      const el = scrollRef.current;
      const stack = stackRef.current;
      if (!el || !stack) return;
      el.scrollTo({ top: stack.offsetTop + pageTop(i) * zoom - LABEL_HEIGHT - CANVAS_TOP_GAP, behavior: "smooth" });
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
    if (current !== activePage) props.onActivePageChange(current);
  };

  // Scroll to a page when asked (after adding a page or a block).
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

  // Ctrl + mouse wheel (or a touchpad pinch) zooms smoothly around the mouse.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const step = e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY; // lines → pixels
      const factor = Math.exp(-Math.max(-120, Math.min(120, step)) * 0.0022);
      zoomTo(zoom * factor, e.clientX - r.left, e.clientY - r.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  // Keyboard: Ctrl + / Ctrl − zoom, Ctrl 0 fits the page, Ctrl 1 = 100%. Space + drag moves around.
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "MATH-FIELD"].includes(el.tagName);
    };
    const onDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === "=" || e.key === "+") zoomTo(zoom * 1.2);
        else if (e.key === "-" || e.key === "_") zoomTo(zoom / 1.2);
        else if (e.key === "0") fitTo();
        else if (e.key === "1") zoomTo(1);
        else return;
        e.preventDefault();
      } else if (e.code === "Space" && !typing(e)) {
        e.preventDefault();
        setPanReady(true);
      }
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setPanReady(false);
        pan.current = null;
      }
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  });

  // Drag & drop from the toolbox or the library onto a page.
  const handleDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropHover(true);
  };
  const handleDrop = (e: DragEvent) => {
    setDropHover(false);
    const raw = e.dataTransfer.getData(DRAG_MIME);
    const stack = stackRef.current;
    if (!raw || !stack) return;
    e.preventDefault();
    const rect = stack.getBoundingClientRect();
    const x = (e.clientX - rect.left) / zoom;
    const y = (e.clientY - rect.top) / zoom;
    const i = pageAt(y, pages.length);
    props.onDropItem(JSON.parse(raw) as ToolAction, { pageIndex: i, x, y: y - pageTop(i) });
  };

  const toggleAnswerBar = () => {
    setAnswerOpen(!answerOpen);
    try {
      localStorage.setItem(ANSWER_BAR_KEY, answerOpen ? "0" : "1");
    } catch {}
  };

  const editBlock = editing ? doc.blocks.find((b) => b.id === editing.id) : undefined;
  const selected = doc.blocks.find((b) => b.id === selectedId);
  const question = selected && isQuestion(selected) && !dragging ? selected : undefined;
  const blockTop = (b: { layout: BlockLayout }) => pageTop(pageIndex(b.layout.pageId)) + b.layout.y;

  return (
    <div className="flex h-full">
      <PageStrip
        pages={pages}
        blocks={doc.blocks}
        heights={heights}
        activeIndex={activePage}
        onJump={scrollToPage}
        onAddPage={props.onAddPage}
        onDeletePage={props.onDeletePage}
      />

      <div className="relative min-w-0 flex-1">
        <div
          ref={scrollRef}
          dir="ltr"
          onScroll={handleScroll}
          className="workspace-dots absolute inset-0 overflow-auto"
          // Clicking the grey area clears the selection.
          onMouseDown={(e) => e.target === e.currentTarget && props.onSelect(null)}
        >
          {/* Top: room for the first "Page 1 of 3" label. Bottom: the end of the last page can always
              be scrolled above the floating tools / zoom bar. */}
          <div
            className="mx-auto flex w-fit flex-col items-center gap-4 px-10"
            style={{ paddingTop: canvasTopPadding(zoom, mode === "key"), paddingBottom: CANVAS_BOTTOM_SPACE }}
          >
            {/* Takes the zoomed size in the layout... */}
            <div
              ref={stackRef}
              style={{ width: PAGE_WIDTH * zoom, height: height * zoom }}
              className={`relative rounded-sm transition-shadow ${dropHover ? "ring-2 ring-indigo-400/60 ring-offset-4 ring-offset-transparent" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={() => setDropHover(false)}
              onDrop={handleDrop}
            >
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
                    keyMode={mode === "key"}
                    onClick={() => scrollToPage(i)}
                  />
                ))}
                <div className="absolute inset-0">
                  <ExamCanvas
                    doc={doc}
                    heights={heights}
                    numbers={numbers}
                    mode={mode}
                    zoom={zoom}
                    showGuides={showGuides}
                    marginEdit={props.marginEdit}
                    onMarginDrag={props.onMarginDrag}
                    selectedId={selectedId}
                    textTool={props.tool === "text"}
                    onSelect={props.onSelect}
                    onMove={props.onMove}
                    onResize={props.onResize}
                    onEdit={props.onEditStart}
                    onPatch={(id, patch) => props.onPatch(id, patch, "click")}
                    onDragging={setDragging}
                    onCreateText={(at) => props.onCreateText({ ...at, corner: true })}
                  />
                </div>

                {/* Typing directly on the page */}
                {editing && editBlock && (
                  <InlineEditor
                    block={editBlock}
                    field={editing.field}
                    number={numbers.get(editBlock.id) ?? 1}
                    meta={doc.meta}
                    mode={mode}
                    zoom={zoom}
                    top={blockTop(editBlock)}
                    onChange={props.onEditChange}
                    onNext={props.onEditNext}
                    onEnter={props.onEditEnter}
                    selectAll={!!editing.selectAll}
                    onDone={() => props.onEditDone(editBlock.id)}
                  />
                )}
              </div>

              {/* Green answer bar under the selected question (screen size, not zoomed) */}
              {question && (
                <div
                  className="pointer-events-none absolute z-30"
                  style={{
                    left: question.layout.x * zoom,
                    top: (blockTop(question) + (heights.get(question.id) ?? 0)) * zoom + 6,
                    width: Math.max(300, question.layout.width * zoom),
                  }}
                >
                  <AnswerBar
                    block={question}
                    number={numbers.get(question.id) ?? 1}
                    lang={doc.meta.lang}
                    mode={mode}
                    open={answerOpen}
                    onToggle={toggleAnswerBar}
                    onPatch={(patch, field) => props.onPatch(question.id, patch, field)}
                    onEdit={(field) => props.onEditStart(question.id, field)}
                    onShowCorrection={() => props.onModeChange("key")}
                  />
                </div>
              )}
            </div>

            {/* Small "add page" below the last page */}
            <button
              onClick={props.onAddPage}
              className="flex items-center gap-1.5 rounded-full border border-slate-300/80 bg-white/70 px-3 py-1 text-xs font-medium text-muted backdrop-blur transition-colors hover:border-indigo-300 hover:text-indigo-600"
            >
              <span className="text-sm leading-none">+</span> {t("Add page")}
            </button>
          </div>
        </div>

        {/* Space held: a layer that catches the mouse to drag the view around */}
        {panReady && (
          <div
            className={`absolute inset-0 z-40 ${panning ? "cursor-grabbing" : "cursor-grab"}`}
            onMouseDown={(e) => {
              const el = scrollRef.current;
              if (!el) return;
              pan.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
              setPanning(true);
            }}
            onMouseMove={(e) => {
              const el = scrollRef.current;
              const p = pan.current;
              if (!el || !p) return;
              el.scrollLeft = p.left - (e.clientX - p.x);
              el.scrollTop = p.top - (e.clientY - p.y);
            }}
            onMouseUp={() => {
              pan.current = null;
              setPanning(false);
            }}
            onMouseLeave={() => {
              pan.current = null;
              setPanning(false);
            }}
          />
        )}

        {/* Correction sheet: the look of the answers. (Points so far / full mark: status bar of the toolbox.) */}
        {mode === "key" && (
          <div className="pointer-events-none absolute end-4 top-3 z-30 flex items-start gap-2">
            <CorrectionBar meta={doc.meta} onMeta={props.onMeta} />
          </div>
        )}

        {/* Select / Text tools + zoom (bottom-right, away from the "Page 1 of 2" labels) */}
        <div className="pointer-events-none absolute right-4 bottom-4 flex items-center gap-2" dir="ltr">
          <ToolRail tool={props.tool} onChange={props.onToolChange} />
          <ZoomBar
            zoom={zoom}
            fitMode={fitMode}
            showGuides={showGuides}
            onZoom={(z) => zoomTo(z)}
            onFitPage={() => fitTo()}
            onFitWidth={() => fitTo(true)}
            onToggleGuides={() => setShowGuides(!showGuides)}
          />
        </div>
      </div>
    </div>
  );
}

// The paper shadow behind page `index` + its clickable "Page 1 of 3" label.
// Sizes are divided by zoom so the label keeps the same size on screen.
function PageFrame({ index, total, zoom, active, keyMode, onClick }: {
  index: number;
  total: number;
  zoom: number;
  active: boolean;
  keyMode: boolean;
  onClick: () => void;
}) {
  const t = useT();
  const top = pageTop(index);
  return (
    <>
      <div
        className={`paper-shadow absolute left-0 bg-white ${keyMode ? "outline-2 outline-emerald-500/50" : ""}`}
        style={{ top, width: PAGE_WIDTH, height: PAGE_HEIGHT }}
      />
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
        {t("Page")} {index + 1} <span className="text-muted">{t("of {n}", { n: total })}</span>
        {keyMode && <span className="text-emerald-600"> · {t("Correction")}</span>}
      </button>
    </>
  );
}
