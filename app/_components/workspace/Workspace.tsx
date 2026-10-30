"use client";

import type { Editor as TextEditor, JSONContent } from "@tiptap/core";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { isQuestion } from "@/app/_lib/blocks";
import type { EditField } from "@/app/_lib/editRegions";
import { CANVAS_BOTTOM_SPACE, CANVAS_TOP_GAP, LABEL_HEIGHT, canvasTopPadding, pageAt, pageBoxes, stackSize, type PageBox } from "@/app/_lib/pageStack";
import { DRAG_MIME, type ToolAction } from "@/app/_lib/tools";
import type { Block, BlockLayout, ExamDoc, ExamMeta, PageMargins, ViewMode } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch, DropPoint, RevealRequest } from "@/app/_lib/useExam";
import { useZoom } from "@/app/_lib/useZoom";
import { chromeConfig, withChromeConfig } from "@/app/_lib/pageChrome";
import type { ResizeResult } from "../canvas/BlockNode";
import ExamCanvas, { type DrawnBox, type MarginEditView } from "../canvas/ExamCanvas";
import AnswerBar from "./AnswerBar";
import ChromeBar from "./ChromeBar";
import DeletePageDialog from "./DeletePageDialog";
import CorrectionBar from "./CorrectionBar";
import InlineEditor from "./InlineEditor";
import PageStrip from "./PageStrip";
import TextboxEditor from "./TextboxEditor";
import type { StyleMark } from "@/app/_lib/textboxEditor";
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
  // A selected header/footer: change its settings, show it on every page or only this one, open its panel.
  onChromeData: (blockId: string, fn: (data: Record<string, string>, b: Block) => Record<string, string>, key?: string) => void;
  onChromeScope: (blockId: string, to: "all" | "page") => void;
  onChromeSettings: () => void;
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
  // The text box being typed in (Tiptap editor over it): its new document, the box losing a style of its
  // own, and the editor itself (for the right panel; null when closed).
  onRichChange: (content: JSONContent) => void;
  onDropBoxStyle: (mark: StyleMark) => void;
  onTextEditor: (editor: TextEditor | null) => void;
  onCreateText: (at: DropPoint) => void;
  onDrawBox: (box: DrawnBox) => void; // a box drawn with the text box tool (or a shape drawn with the Shapes tool)
  drawShape?: "box" | "line"; // the Shapes tool is in hand: what it draws
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
  const [askDelete, setAskDelete] = useState<string | null>(null); // page waiting for "Do you really want to delete it?"
  const [answerOpen, setAnswerOpen] = useState(() => {
    try {
      return localStorage.getItem(ANSWER_BAR_KEY) !== "0";
    } catch {
      return true;
    }
  });
  // Pages can differ in size: each one has its box on the canvas (see pageBoxes).
  const boxes = useMemo(() => pageBoxes(pages), [pages]);
  const canvasSize = stackSize(boxes);
  const { zoom, fitMode, setZoom, fitPage, fitWidth } = useZoom(viewport, boxes[Math.min(activePage, boxes.length - 1)] ?? canvasSize);
  const [panReady, setPanReady] = useState(false); // Space held: drag to move around
  const [panning, setPanning] = useState(false);
  const pan = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const height = canvasSize.height;
  const pageIndex = (pageId: string) => Math.max(0, pages.findIndex((p) => p.id === pageId));
  // A resize handle is held (the text box editor stays open), and where the edited box is while resized.
  const handleHeld = useRef(false);
  const [liveBox, setLiveBox] = useState<(ResizeResult & { id: string }) | null>(null);

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
      el.scrollTo({ top: stack.offsetTop + (boxes[i]?.top ?? 0) * zoom - LABEL_HEIGHT - CANVAS_TOP_GAP, behavior: "smooth" });
    },
    [zoom, boxes],
  );

  // The page under the top third of the screen is the "current" page.
  const handleScroll = () => {
    const el = scrollRef.current;
    const stack = stackRef.current;
    if (!el || !stack) return;
    const mark = el.scrollTop + el.clientHeight / 3;
    let current = 0;
    boxes.forEach((box, i) => {
      if (stack.offsetTop + box.top * zoom <= mark) current = i;
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
    const i = pageAt(y, boxes);
    props.onDropItem(JSON.parse(raw) as ToolAction, { pageIndex: i, x: x - boxes[i].left, y: y - boxes[i].top });
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
  const chrome = selected?.meta?.role && !dragging ? selected : undefined; // a page's header or footer
  const chromeKind = chrome?.meta?.role;
  const chromePage = chrome ? pageIndex(chrome.layout.pageId) : 0;
  const blockTop = (b: { layout: BlockLayout }) => boxes[pageIndex(b.layout.pageId)].top + b.layout.y;
  const blockLeft = (b: { layout: BlockLayout }) => boxes[pageIndex(b.layout.pageId)].left + b.layout.x;

  return (
    <div className="flex h-full">
      <PageStrip
        pages={pages}
        blocks={doc.blocks}
        heights={heights}
        activeIndex={activePage}
        onJump={scrollToPage}
        onAddPage={props.onAddPage}
        onDeletePage={setAskDelete}
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
              style={{ width: canvasSize.width * zoom, height: height * zoom }}
              className={`relative rounded-sm transition-shadow ${dropHover ? "ring-2 ring-indigo-400/60 ring-offset-4 ring-offset-transparent" : ""}`}
              onDragOver={handleDragOver}
              onDragLeave={() => setDropHover(false)}
              onDrop={handleDrop}
            >
              {/* ...while the content inside stays at real page size and is scaled by CSS. */}
              <div
                className="absolute top-0 left-0 origin-top-left"
                style={{ width: canvasSize.width, height, transform: `scale(${zoom})` }}
              >
                {pages.map((page, i) => (
                  <PageFrame
                    key={page.id}
                    index={i}
                    box={boxes[i]}
                    total={pages.length}
                    zoom={zoom}
                    active={i === activePage}
                    keyMode={mode === "key"}
                    onClick={() => scrollToPage(i)}
                    onDelete={i > 0 ? () => setAskDelete(page.id) : undefined}
                  />
                ))}
                <div className={`absolute inset-0 ${props.tool === "textbox" || props.tool === "shape" ? "cursor-crosshair" : ""}`}>
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
                    drawBox={props.tool === "textbox" || props.tool === "shape"}
                    drawShape={props.tool === "shape" ? props.drawShape : undefined}
                    onDrawBox={props.onDrawBox}
                    onHandleDown={() => {
                      handleHeld.current = true;
                      window.addEventListener("mouseup", () => setTimeout(() => (handleHeld.current = false)), { once: true });
                    }}
                    onResizing={(id, r) => setLiveBox(r && editing?.id === id ? { ...r, id } : null)}
                  />
                </div>

                {/* Typing in a text box: a rich-text editor over it, following it while it is resized */}
                {editing && editBlock?.type === "textbox" && (
                  <TextboxEditor
                    key={editBlock.id}
                    block={editBlock}
                    meta={doc.meta}
                    zoom={zoom}
                    box={
                      liveBox?.id === editBlock.id
                        ? { left: liveBox.x, top: liveBox.y, width: liveBox.width, height: liveBox.height }
                        : { left: blockLeft(editBlock), top: blockTop(editBlock), width: editBlock.layout.width, height: heights.get(editBlock.id) ?? editBlock.layout.height }
                    }
                    selectAll={!!editing.selectAll}
                    keepOpen={handleHeld}
                    onChange={props.onRichChange}
                    onDropBoxStyle={props.onDropBoxStyle}
                    onReady={props.onTextEditor}
                    onDone={() => props.onEditDone(editBlock.id)}
                  />
                )}

                {/* Typing directly on the page */}
                {editing && editBlock && editBlock.type !== "textbox" && (
                  <InlineEditor
                    block={editBlock}
                    field={editing.field}
                    number={numbers.get(editBlock.id) ?? 1}
                    meta={doc.meta}
                    mode={mode}
                    zoom={zoom}
                    top={blockTop(editBlock)}
                    left={blockLeft(editBlock)}
                    onChange={props.onEditChange}
                    onNext={props.onEditNext}
                    onEnter={props.onEditEnter}
                    selectAll={!!editing.selectAll}
                    onDone={() => props.onEditDone(editBlock.id)}
                  />
                )}
              </div>

              {/* Format bar under the selected header / footer (screen size, not zoomed) */}
              {chrome && chromeKind && (
                <div
                  className="absolute z-30"
                  style={{ left: blockLeft(chrome) * zoom, top: (blockTop(chrome) + (heights.get(chrome.id) ?? 0)) * zoom + 6 }}
                >
                  <ChromeBar
                    block={chrome}
                    own={withChromeConfig(doc).pages[chromePage]?.[chromeKind] !== undefined}
                    data={chromeConfig(doc, chromePage, chromeKind)?.data ?? {}}
                    editing={editing?.id === chrome.id ? editing.field : null}
                    meta={doc.meta}
                    onData={(fn, key) => props.onChromeData(chrome.id, fn, key)}
                    onScope={(to) => props.onChromeScope(chrome.id, to)}
                    onSettings={props.onChromeSettings}
                  />
                </div>
              )}

              {/* Green answer bar under the selected question (screen size, not zoomed) */}
              {question && (
                <div
                  className="pointer-events-none absolute z-30"
                  style={{
                    left: blockLeft(question) * zoom,
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

        {/* Warning before a page goes */}
        {askDelete && pageIndex(askDelete) > 0 && (
          <DeletePageDialog
            page={pageIndex(askDelete) + 1}
            blocks={doc.blocks.filter((b) => b.layout.pageId === askDelete && !b.meta?.role).length}
            onCancel={() => setAskDelete(null)}
            onConfirm={() => {
              props.onDeletePage(askDelete);
              setAskDelete(null);
            }}
          />
        )}

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

// The paper shadow behind page `index` + its clickable "Page 1 of 3" label, and (not on the first page)
// a button to delete the page at the other end. Sizes are divided by zoom so they keep the same size on screen.
function PageFrame({ index, box, total, zoom, active, keyMode, onClick, onDelete }: {
  index: number;
  box: PageBox;
  total: number;
  zoom: number;
  active: boolean;
  keyMode: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const t = useT();
  const { top, left } = box;
  return (
    <>
      <div
        className={`paper-shadow absolute bg-white ${keyMode ? "outline-2 outline-emerald-500/50" : ""}`}
        style={{ top, left, width: box.width, height: box.height }}
      />
      <button
        onClick={onClick}
        className={`absolute z-10 rounded font-medium transition-colors hover:bg-white/70 ${
          active ? "text-indigo-600" : "text-muted"
        }`}
        style={{
          top,
          left,
          transform: "translateY(-100%)",
          marginTop: -4 / zoom,
          fontSize: 12 / zoom,
          padding: `${2 / zoom}px ${6 / zoom}px`,
        }}
      >
        {t("Page")} {index + 1} <span className="text-muted">{t("of {n}", { n: total })}</span>
        {keyMode && <span className="text-emerald-600"> · {t("Correction")}</span>}
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          title={t("Delete page")}
          className="absolute z-10 flex items-center rounded font-medium text-muted transition-colors hover:bg-red-50 hover:text-red-600"
          style={{
            top,
            left: left + box.width,
            transform: "translate(-100%, -100%)",
            marginTop: -4 / zoom,
            fontSize: 12 / zoom,
            gap: 4 / zoom,
            padding: `${2 / zoom}px ${6 / zoom}px`,
          }}
        >
          <Trash2 size={12 / zoom} strokeWidth={1.8} aria-hidden />
          {t("Delete page")}
        </button>
      )}
    </>
  );
}
