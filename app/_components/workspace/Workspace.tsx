"use client";

import type { Editor as TextEditor, JSONContent } from "@tiptap/core";
import { Trash2 } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { addPart, isQuestion } from "@/app/_lib/blocks";
import type { EditField } from "@/app/_lib/editRegions";
import { CANVAS_BOTTOM_SPACE, CANVAS_TOP_GAP, LABEL_HEIGHT, canvasTopPadding, pageAt, pageBoxes, stackSize, type PageBox } from "@/app/_lib/pageStack";
import { DRAG_MIME, type ToolAction } from "@/app/_lib/tools";
import type { SheetConfig } from "@/app/_lib/sheet/model";
import type { Block, BlockLayout, ExamDoc, PageMargins, ViewMode } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch, DropPoint, RevealRequest } from "@/app/_lib/useExam";
import { useZoom } from "@/app/_lib/useZoom";
import { chromeConfig, withChromeConfig } from "@/app/_lib/pageChrome";
import type { ResizeResult } from "../canvas/BlockNode";
import ExamCanvas, { type BlockMover, type DrawnBox, type MarginEditView } from "../canvas/ExamCanvas";
import FrameTitles from "../canvas/FrameTitles";
import { frameOf } from "@/app/_lib/sheet/frame";
import { DOCKED_HEIGHT_VAR } from "../math-keyboard/FloatingKeyboard";
import AnswerBar from "./AnswerBar";
import ChromeBar from "./ChromeBar";
import DeletePageDialog from "./DeletePageDialog";
import InlineEditor from "./InlineEditor";
import PageStrip from "./PageStrip";
import SubQuestionButton from "./SubQuestionButton";
import TextboxEditor from "./TextboxEditor";
import type { StyleMark } from "@/app/_lib/textboxEditor";
import ToolRail, { type CanvasTool } from "./ToolRail";
import type { InkTools } from "@/app/_lib/ink/useInkTools";
import type { EraserTool } from "@/app/_lib/ink/useEraserTool";
import type { DrawnInk, InkInHand } from "../canvas/ExamCanvas";
import { stampCursor } from "@/app/_lib/sheet/stampCursor";
import ZoomBar from "./ZoomBar";
import ShapeTextEditor from "./ShapeTextEditor";
import TableDrawBar from "./TableDrawBar";
import TableDrawDock from "./TableDrawDock";
import TableDrawLayer, { isDrawable, tableGeo, type TableDrawMode } from "./TableDrawLayer";
import { setTableSel, useTableSel } from "../table/tableSelStore";
import { clampSel, rangeSel, selRange } from "../table/tableSel";
import { colsOf, rowsOf, setStyle, wholeMerges } from "@/app/_lib/table";
import { cellRange, cellsOf, mergeRange, rangeIn, splitRange } from "@/app/_lib/table/draw";

export interface Editing {
  id: string;
  field: EditField;
  created?: boolean; // new text from the T tool (removed if left empty)
  selectAll?: boolean; // new block: its starting text is selected, so typing replaces it
}

let tableAction = 0;
const tableActionKey = (action: string) => `table-${action}:${++tableAction}`;

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
  mathKeyboard: boolean; // the math keyboard is on (its button is in the tool bar)
  onToggleMathKeyboard: () => void;
  onSelect: (id: string | null) => void;
  groupIds: readonly string[]; // several blocks selected together (see ExamCanvas)
  onSelectMany: (ids: string[]) => void;
  onMoveMany: (moves: { id: string; pageId: string; x: number; y: number }[]) => void;
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
  onDrawTable: (box: DrawnBox) => void; // a box drawn on the paper with the table tools' pen: a new table of one cell
  tableMode: TableDrawMode;
  onTableMode: (mode: TableDrawMode) => void;
  onStamp: (at: DropPoint) => void;
  stamp: ToolAction | null; // the sticker the Stamp tool puts down (the mouse takes its shape) // a click with the Stamp tool: the sticker of the correction sheet in hand goes there
  onSheet: (patch: Partial<SheetConfig>, key?: string) => void; // the frame of the correction sheet dragged on the page
  drawShape?: "box" | "line"; // the Shapes tool is in hand: what it draws
  shapeToDraw: string | null; // (the shape of the Shapes tool)
  onPickShape: (shape: string) => void; // the Shapes button of the tool bar: draw this shape
  ink: InkTools; // the Draw button's brush, pencil and highlighter
  onInk: (stroke: DrawnInk) => void; // a stroke drawn on a page with one of them
  eraser: EraserTool; // the Eraser button: how it rubs and how big it is
  onErase: (ids: readonly string[], key: string) => void; // the stroke eraser rubbed out these drawings / shapes (`key`: one stroke of it)
  onEraseInk: (pageId: string, path: { x: number; y: number }[], radius: number, key: string) => void; // the eraser went along `path` on a page

  onAddPage: () => void;
  onDeletePage: (pageId: string) => void;
  onActivePageChange: (index: number) => void;
  onDropItem: (action: ToolAction, at: DropPoint) => void;
}

// Page thumbnails on the left, the zoomable page stack in the center, zoom bottom-right.
export default function Workspace(props: Props) {
  const t = useT();
  const { doc, heights, numbers, mode, selectedId, activePage, reveal, editing } = props;
  // The drawing tool in hand (none unless the Draw tool is): its stroke is drawn on the pages.
  const drawing = props.tool === "draw";
  const inkTool = props.ink.tool;
  const inkSettings = props.ink.settings[inkTool];
  const inkInHand = useMemo<InkInHand | null>(() => (drawing ? { tool: inkTool, ...inkSettings } : null), [drawing, inkTool, inkSettings]);
  const erasing = props.tool === "eraser";
  const { mode: eraserMode, size: eraserSize } = props.eraser;
  const eraserInHand = useMemo(() => (erasing ? { mode: eraserMode, size: eraserSize } : null), [erasing, eraserMode, eraserSize]);
  // The sticker in hand: the mouse takes its shape over the pages
  const stampInHand = props.tool === "stamp" ? props.stamp : null;
  const padMarks = !!doc.sheet?.pad;
  const mouseSticker = useMemo(() => (stampInHand ? stampCursor(stampInHand, padMarks) : undefined), [stampInHand, padMarks]);
  const { pages } = doc;
  const scrollRef = useRef<HTMLDivElement>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [showGuides, setShowGuides] = useState(true);
  const [dropHover, setDropHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [askDelete, setAskDelete] = useState<string | null>(null); // page waiting for "Do you really want to delete it?"
  const tableMode = props.tableMode;
  const pageIds = useMemo(() => pages.map((p) => p.id), [pages]);
  // Pages can differ in size: each one has its box on the canvas (see pageBoxes).
  const boxes = useMemo(() => pageBoxes(pages), [pages]);
  // (a bordered correction sheet: the frame of each page, whose titles are typed on the page)
  const frames = useMemo(() => (doc.sheet?.paper === "bordered" ? pages.map((_, i) => frameOf(doc, i)) : null), [doc, pages]);
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
  // The edited text box dragged by its edge: hidden on the canvas meanwhile, snapped and dropped by it (mover).
  const [movingId, setMovingId] = useState<string | null>(null);
  const mover = useRef<BlockMover | null>(null);

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

  const editBlock = editing ? doc.blocks.find((b) => b.id === editing.id) : undefined;
  const selected = doc.blocks.find((b) => b.id === selectedId);
  const question = selected && isQuestion(selected) && !dragging ? selected : undefined;
  const chrome = selected?.meta?.role && !dragging ? selected : undefined; // a page's header or footer
  const chromeKind = chrome?.meta?.role;
  const chromePage = chrome ? pageIndex(chrome.layout.pageId) : 0;
  const blockTop = (b: { layout: BlockLayout }) => boxes[pageIndex(b.layout.pageId)].top + b.layout.y;
  const blockLeft = (b: { layout: BlockLayout }) => boxes[pageIndex(b.layout.pageId)].left + b.layout.x;

  // ---- The table tools (Insert → Draw a table, and the floating bar under a selected table) ----
  const tableTools = props.tool === "table";
  const drawn = isDrawable(selected, doc.blocks) && !dragging && !props.groupIds.length && (props.tool === "select" || tableTools) ? selected : undefined;
  const [cellPick] = useTableSel(drawn?.id);
  const geo = drawn ? tableGeo(drawn, boxes, pageIndex(drawn.layout.pageId), doc.meta) : null;
  const safePick = drawn ? clampSel(cellPick, rowsOf(drawn), colsOf(drawn)) : null;
  const picked = drawn && safePick ? wholeMerges(drawn, selRange(safePick)) : null;
  const pickedCells = drawn && picked ? cellsOf(drawn).filter((c) => c.r >= picked.r0 && c.r <= picked.r1 && c.c >= picked.c0 && c.c <= picked.c1) : [];
  const [barNote, setBarNote] = useState<string | null>(null);
  useEffect(() => {
    if (!barNote) return;
    const id = setTimeout(() => setBarNote(null), 3500);
    return () => clearTimeout(id);
  }, [barNote]);
  const pickTableTool = (m: TableDrawMode) => {
    props.onTableMode(m);
  };
  // Closing the tools: the bar goes down first, then the tool bar comes back (it springs up only after they have been used, not when the app opens)
  const [barLeaving, setBarLeaving] = useState(false);
  const closeTableTools = () => {
    if (barLeaving) return;
    setBarLeaving(true);
    setTimeout(() => {
      setBarLeaving(false);
      props.onToolChange("select");
    }, 140);
  };
  const [toolsUsed, setToolsUsed] = useState(false);
  if (tableTools && !toolsUsed) setToolsUsed(true);
  // The bucket: it comes in hand, and what is selected takes its color at once
  const [cellFill, setCellFill] = useState<string | undefined>("#ffff00");
  // Its colors, open or not: kept here, so they stay open when a color chosen under a table brings the bar to the bottom of the worksheet
  const [fillOpen, setFillOpen] = useState(false);
  if (fillOpen && (editing || !(drawn || tableTools))) setFillOpen(false);
  const bucket = (color: string | undefined) => {
    setCellFill(color);
    const patch = drawn && picked ? setStyle(drawn, picked, { fill: color }) : null;
    if (drawn && patch) props.onPatch(drawn.id, patch as BlockPatch, tableActionKey("fill"));
    pickTableTool("fill");
  };
  const mergePicked = () => {
    if (!drawn || !geo || !picked) return;
    const out = mergeRange(drawn, geo.frame, picked);
    if (!out) return;
    props.onPatch(drawn.id, out.patch as BlockPatch, tableActionKey("merge"));
    setTableSel(drawn.id, rangeSel(cellRange(out.cell)));
  };
  const splitPicked = (cols: number, rows: number) => {
    if (!drawn || !geo || !picked) return;
    const out = splitRange(drawn, geo.frame, picked, cols, rows);
    if (!out) return setBarNote("This split does not fit. Choose fewer rows or columns, or enlarge the cells.");
    props.onPatch(drawn.id, out.patch as BlockPatch, tableActionKey("split"));
    const area = rangeIn({ ...drawn, ...out.patch }, out.frame, out.area);
    setTableSel(drawn.id, area ? rangeSel(area) : null);
  };
  const tableBar = (drawn || tableTools) && (
    <TableDrawBar
      key={tableTools ? "tools" : drawn?.id ?? "new"}
      mode={tableTools ? tableMode : null}
      onMode={pickTableTool}
      hasTable={!!drawn}
      cells={pickedCells.length}
      span={pickedCells.length === 1 ? { rows: pickedCells[0].rs, cols: pickedCells[0].cs } : null}
      onMerge={mergePicked}
      onSplit={splitPicked}
      canSplit={(cols, rows) => !!(drawn && geo && picked && splitRange(drawn, geo.frame, picked, cols, rows))}
      fill={cellFill}
      onBucket={() => bucket(cellFill)}
      onFill={bucket}
      fillOpen={fillOpen}
      onFillOpen={setFillOpen}
      onClose={closeTableTools}
      message={barNote}
    />
  );

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
          style={{ cursor: mouseSticker }}
          // Clicking the grey area clears the selection.
          onMouseDown={(e) => e.target === e.currentTarget && props.onSelect(null)}
        >
          {/* Top: room for the first "Page 1 of 3" label. Bottom: the end of the last page can always
              be scrolled above the floating tools / zoom bar. */}
          <div
            className="mx-auto flex w-fit flex-col items-center gap-4 px-10"
            style={{ paddingTop: canvasTopPadding(zoom), paddingBottom: CANVAS_BOTTOM_SPACE }}
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
                    onDelete={doc.pages.length > 1 ? () => setAskDelete(page.id) : undefined}
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
                    stampTool={props.tool === "stamp"}
                    onStamp={(at) => props.onStamp({ ...at })}
                    onSheet={doc.sheet ? props.onSheet : undefined}
                    onSelect={props.onSelect}
                    groupIds={props.groupIds}
                    onSelectMany={props.onSelectMany}
                    onMoveMany={props.onMoveMany}
                    onMove={props.onMove}
                    onResize={props.onResize}
                    onEdit={props.onEditStart}
                    onPatch={(id, patch) => props.onPatch(id, patch, "click")}
                    onDragging={setDragging}
                    onCreateText={(at) => props.onCreateText({ ...at, corner: true })}
                    drawBox={props.tool === "textbox" || props.tool === "shape"}
                    drawShape={props.tool === "shape" ? props.drawShape : undefined}
                    onDrawBox={props.onDrawBox}
                    ink={inkInHand}
                    onInk={props.onInk}
                    eraser={eraserInHand}
                    onErase={props.onErase}
                    onEraseInk={props.onEraseInk}
                    onHandleDown={() => {
                      handleHeld.current = true;
                      window.addEventListener("mouseup", () => setTimeout(() => (handleHeld.current = false)), { once: true });
                    }}
                    onResizing={(id, r) => setLiveBox(r && editing?.id === id ? { ...r, id } : null)}
                    hiddenId={movingId}
                    typingId={editing && (editBlock?.type === "textbox" || editBlock?.type === "shape") ? editBlock.id : null}
                    typingCell={editing && editBlock?.type === "table" && editing.field.kind === "cell" ? { id: editBlock.id, r: editing.field.r, c: editing.field.c } : null}
                    mover={mover}
                  />
                </div>

                {/* The table tools: what a press on a table does (and the selected cells of the selected table) */}
                {(tableTools || drawn) && !editing && (
                  <TableDrawLayer
                    key={`${props.tool}-${tableMode}`}
                    blocks={doc.blocks}
                    meta={doc.meta}
                    pageIds={pageIds}
                    boxes={boxes}
                    zoom={zoom}
                    width={canvasSize.width}
                    height={height}
                    mode={tableTools && tableMode !== "select" ? tableMode : null}
                    fill={cellFill}
                    selectedId={selectedId}
                    onSelect={props.onSelect}
                    onPatch={(id, patch, key) => props.onPatch(id, patch, key)}
                    onCreate={props.onDrawTable}
                    onExit={closeTableTools}
                    onEditCell={(id, r, c) => {
                      props.onTableMode("select");
                      props.onEditStart(id, { kind: "cell", r, c });
                    }}
                    onMessage={setBarNote}
                  />
                )}

                {/* The titles of the frame of a correction sheet, typed on the page */}
                {frames && doc.sheet && <FrameTitles geos={frames} boxes={boxes} sheet={doc.sheet} meta={doc.meta} onChange={props.onSheet} />}

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
                    onOpenBlock={(id) => {
                      props.onEditDone(editBlock.id);
                      props.onSelect(id);
                    }}
                    onMoveStart={() => setMovingId(editBlock.id)}
                    onMoving={(x, y) => mover.current?.move(editBlock.id, x, y) ?? { x, y }}
                    onMoveEnd={(x, y) => {
                      setMovingId(null);
                      mover.current?.end(editBlock.id, x, y);
                    }}
                    onDone={() => props.onEditDone(editBlock.id)}
                  />
                )}

                {/* Typing the text of a shape right on it */}
                {editing && editBlock?.type === "shape" && (
                  <ShapeTextEditor
                    key={editBlock.id}
                    block={editBlock}
                    left={blockLeft(editBlock)}
                    top={blockTop(editBlock)}
                    onChange={props.onEditChange}
                    onDone={() => props.onEditDone(editBlock.id)}
                  />
                )}

                {/* Typing directly on the page */}
                {editing && editBlock && editBlock.type !== "textbox" && editBlock.type !== "shape" && (
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

              {/* Green answer bar under the selected question (screen size, not zoomed); an open question has its
                  "+ Sub-question" button above it */}
              {question && (
                <div
                  className="pointer-events-none absolute z-30 flex flex-col gap-1.5"
                  style={{
                    left: blockLeft(question) * zoom,
                    top: (blockTop(question) + (heights.get(question.id) ?? 0)) * zoom + 6,
                    width: Math.max(300, question.layout.width * zoom),
                  }}
                >
                  {question.type === "open" && (question.parts?.length ?? 0) < 12 && (
                    <div className="self-start">
                      <SubQuestionButton
                        block={question}
                        number={numbers.get(question.id) ?? 1}
                        lang={doc.meta.lang}
                        onAdd={() => {
                          props.onPatch(question.id, addPart(question), "parts");
                          props.onEditStart(question.id, { kind: "part", i: question.parts?.length ?? 0 });
                        }}
                      />
                    </div>
                  )}
                  <AnswerBar
                    block={question}
                    lang={doc.meta.lang}
                    onPatch={(patch, field) => props.onPatch(question.id, patch, field)}
                    onEdit={(field) => props.onEditStart(question.id, field)}
                  />
                </div>
              )}
            </div>

            {/* Small "add page" below the last page */}
            <button
              onClick={props.onAddPage}
              className="flex items-center gap-1.5 rounded-full border border-slate-300/80 bg-white/70 px-3 py-1 text-xs font-medium text-muted backdrop-blur transition-colors hover:border-indigo-300 hover:text-indigo-700"
            >
              <span className="text-sm leading-none">+</span> {t("Add page")}
            </button>
          </div>
        </div>

        {tableBar && !editing && !tableTools && (
          <TableDrawDock scroll={scrollRef} stack={stackRef} anchor={geo ? { left: geo.left * zoom, top: geo.top * zoom, bottom: (geo.top + geo.h) * zoom } : null}>
            <div key={drawn?.id} className="table-bar-pop">{tableBar}</div>
          </TableDrawDock>
        )}

        {/* Warning before a page goes */}
        {askDelete && (
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

        {/* The bottom row of the worksheet: the floating tool bar in the middle (the table tools' bar in its place while they are in hand) and
            the zoom on the right. The two sides share what is left, so the zoom, stretching under the mouse to show its slider, pushes the tool bar
            to the left instead of going over it (its slider gets shorter when the worksheet is narrow). Sits on the math keyboard while it is docked
            at the bottom of the screen (FloatingKeyboard sets the variable). "above": what the table bar opens goes up. */}
        <div
          data-side="above"
          className="group/table-dock @container pointer-events-none absolute inset-x-0 z-30"
          style={{ bottom: `calc(var(${DOCKED_HEIGHT_VAR}, 0px) + 1rem)` }}
          dir="ltr"
        >
          <div className="flex items-end gap-2 px-4">
            <span aria-hidden className="min-w-0 flex-1" />
            {tableTools ? (
              <div className={`table-bar-pop min-w-0 ${barLeaving ? "table-bar-leave" : ""}`}>{tableBar}</div>
            ) : (
              <div className={`min-w-0 ${toolsUsed ? "tool-rail-back" : ""}`}>
                <ToolRail
                  tool={props.tool}
                  onChange={props.onToolChange}
                  shape={props.shapeToDraw}
                  onPickShape={props.onPickShape}
                  ink={props.ink}
                  eraser={props.eraser}
                  keyboardOpen={props.mathKeyboard} onToggleKeyboard={props.onToggleMathKeyboard} />
              </div>
            )}
            <div className="flex min-w-max flex-1 justify-end">
              <ZoomBar
                zoom={zoom}
                fitMode={fitMode}
                showGuides={showGuides}
                onZoom={(z) => zoomTo(z)}
                onFitPage={() => fitTo()}
                onFitWidth={() => fitTo(true)}
                onToggleGuides={() => setShowGuides(!showGuides)}
                // (the folded zoom, the row's padding and gaps: 166px; + the tool bar as wide as it is now, or it would wrap)
                reserved={166 + (tableTools ? 314 : props.tool === "draw" ? 308 : 240)}
              />
            </div>
          </div>
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
          active ? "text-indigo-700" : "text-muted"
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
        {keyMode && <span className="text-emerald-700"> · {t("Correction")}</span>}
      </button>
      {onDelete && (
        <button
          onClick={onDelete}
          title={t("Delete page")}
          className="absolute z-10 flex items-center rounded font-medium text-muted transition-colors hover:bg-red-50 hover:text-red-700"
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
