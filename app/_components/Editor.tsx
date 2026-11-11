"use client";

import type { Editor as TextEditor, JSONContent } from "@tiptap/core";
import type Konva from "konva";
import { useEffect, useMemo, useRef, useState } from "react";
import { CONTENT_WIDTH, PAGE_MARGIN } from "@/app/_lib/a4";
import { readChart } from "@/app/_lib/chart/types";
import { pageMargins } from "@/app/_lib/onboarding/applyOnboarding";
import { getPageMm, pageSize } from "@/app/_lib/pageFormats";
import { focusMathfield } from "@/app/_lib/activeMathfield";
import { examFullMark } from "@/app/_lib/examMark";
import { rowHasTotalAt } from "@/app/_lib/sheet/marks";
import {
  BLOCK_TYPE_NAMES,
  MAX_OPTIONS,
  addOrderItem,
  addPair,
  blockHeights,
  blockLabel,
  insertOption,
  isQuestion,
  nextTaskTitle,
  questionNumbers,
  screenHeights,
  type BlockPreset,
} from "@/app/_lib/blocks";
import { editRegions, fieldKey, fieldPatch, fieldValue, type EditField } from "@/app/_lib/editRegions";
import { figureDef } from "@/app/_lib/figures";
import { newId } from "@/app/_lib/id";
import { preloadImages, readImageFile } from "@/app/_lib/images";
import { sizingAfterResize } from "@/app/_lib/blockLayout";
import { insertSnippet, snippetFor } from "@/app/_lib/textSnippets";
import { canEmbed, newEmbedded } from "@/app/_lib/textboxSlots";
import { drawInlineMath, inlineMathUrl, type InlineMath } from "@/app/_lib/inlineMath";
import { isRich, parseRich, plainText } from "@/app/_lib/richText";
import { docParagraphs, richFromDoc, textboxDoc } from "@/app/_lib/textboxDoc";
import type { StyleMark } from "@/app/_lib/textboxEditor";
import { BUILTIN_ASSETS, svgUrl, withDrawing, type Asset, type AssetKind } from "@/app/_lib/library";
import { grayImages, imagesToPdf, stagePageImages, stagePageSvgs } from "@/app/_lib/pdf";
import { pdfSheets, printSheets } from "@/app/_lib/print";
import { sheetsOf, type PrintLayout } from "@/app/_lib/printLayout";
import { examVersion, type VersionPlan } from "@/app/_lib/examVersions";
// (Word export is loaded when used: the docx library is large)
import type { Picture, WordCopy } from "@/app/_lib/wordExport";
import { pageBoxes } from "@/app/_lib/pageStack";
import { addMissing, addRowTotals, adoptMarks, linkReport, packRows, refitAnswers, restyleFull, refreshStale, removeOrphans, resetMarks } from "@/app/_lib/sheet/links";
import { sheetScores } from "@/app/_lib/sheet/marks";
import { viewOf } from "@/app/_lib/sheet/part";
import { isTauri, openExamFile, parseExamFile, pickFile, saveExamAs, saveFile, saveUserAssets, writeExamAt, fileNameOf } from "@/app/_lib/storage";
import { ALL_CYCLES, type Subject } from "@/app/_lib/subjects";
import { buildDoc, templateById, type Template } from "@/app/_lib/templates";
import { assetToBlock, type ToolAction } from "@/app/_lib/tools";
import type { Block, BlockType, ExamDoc, Page, PageMargins, ViewMode } from "@/app/_lib/types";
import { useThemeMode } from "@/app/_lib/theme";
import { UiProvider, loadUiLang, saveUiLang, translate, type UiLang } from "@/app/_lib/uiLang";
import { useBlockClipboard } from "@/app/_lib/useBlockClipboard";
import { useExam, type DropPoint } from "@/app/_lib/useExam";
import { addVersion, type Version } from "@/app/_lib/versions";
import { appLayout } from "@/app/_features/app";
import BarRenderer from "@/app/_features/core/BarRenderer";
import type { BarPosition, Ctx, MarginEdit, RightTab, Shell } from "@/app/_features/core/types";
import { blockInspectorFor, findSectionFeature } from "@/app/_features/sections";
import { defaultSize, picturesOf, shapeDef } from "@/app/_lib/shapes";
import type { DrawnBox, DrawnInk } from "./canvas/ExamCanvas";
import { FREEHAND_ID } from "@/app/_lib/shapes";
import { drawnTablePreset } from "@/app/_lib/table/draw";
import { frameOf } from "@/app/_lib/sheet/frame";
import type { TableDrawMode } from "./workspace/TableDrawLayer";
import { setTableSel, tableSelOf } from "./table/tableSelStore";
import { cellSel, selRange } from "./table/tableSel";
import { clearRange, colsOf, insertLines, isFixedTable, keyOf, wholeMerges } from "@/app/_lib/table";
import { inkToShape } from "@/app/_lib/ink/engine";
import { useInkTools } from "@/app/_lib/ink/useInkTools";
import { useEraserTool } from "@/app/_lib/ink/useEraserTool";
import type { CanvasTool } from "./workspace/ToolRail";
import type { OpenedTarget } from "./math-keyboard/FloatingKeyboard";
import Workspace, { type Editing } from "./workspace/Workspace";

const fileName = (title: string) => title.replace(/[\\/:*?"<>|]+/g, "").trim() || "exam";
const KEYBOARD_KEY = "examBuilder.mathKeyboard";
const HIDDEN_BARS_KEY = "examBuilder.hiddenBars";
const BAR_WIDTHS_KEY = "examBuilder.barWidths";

// Bars the user hid last time (remembered in this browser).
function loadHiddenBars(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(HIDDEN_BARS_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
// Widths the user dragged the side bars to (remembered in this browser).
function loadBarWidths(): Record<string, number> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(BAR_WIDTHS_KEY) ?? "{}");
    if (!saved || typeof saved !== "object") return {};
    return Object.fromEntries(Object.entries(saved).filter((e): e is [string, number] => typeof e[1] === "number" && e[1] > 0));
  } catch {
    return {};
  }
}
// "Ctrl+[" → the "[" key, or the key at its place on a US keyboard.
const KEY_CODES: Record<string, string> = { "[": "BracketLeft", "]": "BracketRight" };
function hotkeyHit(e: KeyboardEvent, hotkey: string) {
  const key = hotkey.split("+").pop() ?? "";
  return e.key === key || e.code === KEY_CODES[key];
}

const HEADER_FOOTER_INSPECTOR = "inspector.layout.header-footer"; // where exam headers are edited
const FIND_INSPECTOR = "inspector.home.find"; // Home → Find and replace (Ctrl+F, Ctrl+H)
const MARGIN_SAVE_DELAY = 500; // ms without a change before typed margins become an undo step
const SNAPSHOT_EVERY = 3 * 60 * 1000; // automatic copy in the version history
const CLICK_TEXTBOX_WIDTH = 200; // a text box made by a click (not drawn) with the text box tool

// New blocks of these types start with their text selected on the page, ready to type over.
const TYPE_ON_ADD: BlockType[] = ["mcq", "truefalse", "blank", "open", "match", "order", "classify", "text", "textbox"];

// The shell: owns the state and the actions. The screen itself is drawn from appLayout (app/_features/app.ts).
// The Stamp tool's "click on the page" message is shown the first time a sticker is picked, not each time
let stampHinted = false;
// Copies drawn off-screen for printing so far: each one a new drawing (see ExportRenderer)
let exportJobs = 0;

// What the app opens with (read before the editor shows, see ClientApp): the exam being worked on (null: none yet) and the library.
export interface Start {
  doc: ExamDoc | null;
  assets: Asset[];
}

export default function Editor({ start }: { start: Start }) {
  // Reopen the last exam (autosave), or start with the template picker.
  const [initial] = useState(() => ({ doc: start.doc ?? buildDoc(templateById("classic-fr")), fresh: !start.doc }));
  const [uiLang, setUiLang] = useState<UiLang>(loadUiLang);
  const [themeMode, setThemeMode] = useThemeMode();
  const tr = (text: string, vars?: Record<string, string | number>) => translate(uiLang, text, vars);
  const exam = useExam(initial.doc, tr);
  const { doc, selectedId } = exam;

  const [subject, setSubject] = useState<Subject>("General");
  const [query, setQuery] = useState("");
  // The Correction tab shows the correction sheet, whose blocks are drawn with their answers (undo can take you to the part it changes)
  const mode: ViewMode = exam.part === "sheet" ? "key" : "exam";
  const [sheetWizard, setSheetWizard] = useState({ open: false, rebuild: false }); // the window that makes the correction sheet
  const [tab, setTab] = useState<RightTab>("properties");
  const [activeInspectorId, setActiveInspectorId] = useState<string | null>(null);
  const [marginEdit, setMarginEdit] = useState<MarginEdit | null>(null); // see Shell.marginEdit
  const marginTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [library, setLibrary] = useState<{ kind: AssetKind | "all"; n: number }>({ kind: "all", n: 0 });
  const [picker, setPicker] = useState<{ open: boolean; mustPick: boolean }>({ open: false, mustPick: false });
  const [userAssets, setUserAssets] = useState<Asset[]>(start.assets);
  const [exportJob, setExportJob] = useState<Shell["exportJob"]>(null);
  const [preview, setPreview] = useState(false);
  const [history, setHistory] = useState(false);
  const [molecule, setMolecule] = useState<Shell["molecule"]>({ open: false, blockId: null }); // Molecule Studio
  const [moleculeLab, setMoleculeLab] = useState<Shell["moleculeLab"]>({ open: false, blockId: null }); // the drawing Studio
  const [graphStudio, setGraphStudio] = useState<Shell["graphStudio"]>({ open: false, blockId: null }); // the Graph Studio
  const [circuitStudio, setCircuitStudio] = useState<Shell["circuitStudio"]>({ open: false, blockId: null }); // the Circuit Studio
  const [probaStudio, setProbaStudio] = useState<Shell["probaStudio"]>({ open: false, blockId: null }); // the Probability Studio
  const [tableStudio, setTableStudio] = useState<Shell["tableStudio"]>({ open: false, blockId: null }); // the Table Studio
  const [chartStudio, setChartStudio] = useState<Shell["chartStudio"]>({ open: false, blockId: null }); // the Chart Studio
  const [imageStudio, setImageStudio] = useState<Shell["imageStudio"]>({ open: false, blockId: null }); // the Image Studio
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const eqTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [tableMode, setTableMode] = useState<TableDrawMode>("select");
  const [stamp, setStamp] = useState<ToolAction | null>(null); // (the sticker of the correction sheet the Stamp tool puts on the page)
  const [shapeToDraw, setShapeToDraw] = useState<string | null>(null); // (Insert → Shapes: what the Shapes tool draws)
  const ink = useInkTools(); // the Draw tool: its brush, pencil and highlighter and how each draws (kept between sessions)
  const eraser = useEraserTool(); // the Eraser: how it rubs (parts of the drawings, or whole ones) and how big it is (kept between sessions)
  const [editing, setEditing] = useState<Editing | null>(null);
  const [textEditor, setTextEditor] = useState<TextEditor | null>(null); // Tiptap editor of the text box being typed in
  const [session, setSession] = useState(0); // +1 for each new/opened exam (resets the zoom)
  const [mathKb, setMathKb] = useState(() => {
    try {
      return localStorage.getItem(KEYBOARD_KEY) !== "0";
    } catch {
      return true;
    }
  });

  const [hiddenBars, setHiddenBars] = useState<string[]>(loadHiddenBars);
  const setBarOpen = (id: string, open?: boolean) =>
    setHiddenBars((cur) => {
      const show = open ?? cur.includes(id);
      const next = show ? cur.filter((x) => x !== id) : cur.includes(id) ? cur : [...cur, id];
      try {
        localStorage.setItem(HIDDEN_BARS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  const [barWidths, setBarWidths] = useState<Record<string, number>>(loadBarWidths);
  const setBarWidth = (id: string, width: number | null) =>
    setBarWidths((cur) => {
      const next = { ...cur };
      if (width === null) delete next[id];
      else next[id] = width;
      try {
        localStorage.setItem(BAR_WIDTHS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });

  const heights = useMemo(() => blockHeights(doc), [doc]);
  const numbers = useMemo(() => questionNumbers(doc.blocks, doc.pages), [doc]);
  const drawnHeights = useMemo(() => screenHeights(doc, heights, selectedId), [doc, heights, selectedId]);
  const fullDoc = exam.fullDoc; // the exam and its correction sheet (what is saved, kept in the history and exported)
  const scores = useMemo(() => (exam.part === "sheet" ? sheetScores(doc, doc.sheet?.autoTotals !== false) : null), [doc, exam.part]); // the marks of the correction sheet
  const sheetReport = useMemo(() => (exam.part === "sheet" ? linkReport(fullDoc) : null), [fullDoc, exam.part]); // the sheet against its exam
  const stats = useMemo(() => {
    // The correction sheet: the rows that carry a mark, and what they add up to, out of the exam's full mark
    if (scores) return { questions: scores.rows.length, points: scores.total, pages: doc.pages.length, full: examFullMark(fullDoc), sheet: true };
    const questions = doc.blocks.filter(isQuestion);
    return { questions: questions.length, points: questions.reduce((s, q) => s + q.points, 0), pages: doc.pages.length };
  }, [doc, scores, fullDoc]);
  const selected = doc.blocks.find((b) => b.id === selectedId);
  // Several blocks selected together (a box dragged over them, Shift+click): those still in the exam.
  const group = useMemo(() => exam.groupIds.filter((id) => doc.blocks.some((b) => b.id === id)), [exam.groupIds, doc.blocks]);

  const notify = (message: string) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  };

  // Selecting a block shows its properties, so it also closes an inspector opened from the left panel.
  // A header or footer is set in Page layout → Header and footer: selecting one opens that inspector.
  // A block with its own inspector (a text box: its ribbon) opens it. Otherwise an inspector that works on
  // the selection (Home → Formatting) stays.
  const inspectorFor = (b: Block | undefined) => {
    if (b?.type === "header" || b?.meta?.role) return HEADER_FOOTER_INSPECTOR;
    const own = blockInspectorFor(b?.type);
    if (own) return own.id;
    return findSectionFeature(activeInspectorId)?.followsSelection ? activeInspectorId : null;
  };
  const select = (id: string | null) => {
    if (id !== selectedId && selectedId) setTableSel(selectedId, null);
    exam.setSelectedId(id);
    if (!id) return;
    setTab("properties");
    setActiveInspectorId(inspectorFor(doc.blocks.find((x) => x.id === id)));
  };

  // An inspector feature (target: 'inspector') takes the Properties tab of the right panel, reopened if closed.
  const openInspector = (featureId: string) => {
    setActiveInspectorId(featureId);
    setTab("properties");
    for (const bar of appLayout) if (bar.position === "right" && bar.collapse) setBarOpen(bar.id, true);
  };

  // ---- Page layout → Margins: one draft shared by the right panel and the handles on the canvas ----

  const saveMargins = (m: PageMargins) => {
    clearTimeout(marginTimer.current);
    exam.setMargins(m);
    setMarginEdit((cur) => cur && { draft: null, dragging: false });
  };
  // Show `m` on the canvas and in the panel. Typed changes are saved after a pause; a drag on release.
  const draftMargins = (m: PageMargins | null, dragging = false) => {
    clearTimeout(marginTimer.current);
    setMarginEdit((cur) => cur && { draft: m, dragging });
    if (m && !dragging) marginTimer.current = setTimeout(() => saveMargins(m), MARGIN_SAVE_DELAY);
  };
  const openMarginEdit = (open: boolean) => {
    if (open) return setMarginEdit((cur) => cur ?? { draft: null, dragging: false });
    if (marginEdit?.draft) saveMargins(marginEdit.draft);
    clearTimeout(marginTimer.current);
    setMarginEdit(null);
  };

  const changeUiLang = (lang: UiLang) => {
    setUiLang(lang);
    saveUiLang(lang);
  };
  useEffect(() => {
    document.documentElement.lang = uiLang;
  }, [uiLang]);

  // ---- Version history: an automatic copy every few minutes while the exam changes ----

  const docRef = useRef(fullDoc);
  const snap = useRef({ doc: fullDoc, time: 0 });
  useEffect(() => {
    docRef.current = fullDoc;
  }, [fullDoc]);
  useEffect(() => {
    snap.current.time = Date.now();
    const id = setInterval(() => {
      const current = docRef.current;
      if (current === snap.current.doc || Date.now() - snap.current.time < SNAPSHOT_EVERY) return;
      snap.current = { doc: current, time: Date.now() };
      addVersion(current, "auto").catch((e) => console.error("Version history:", e));
    }, 30 * 1000);
    return () => clearInterval(id);
  }, []);

  // Keep a copy of the current exam before it is replaced (open, template, restore).
  const keepCopy = (label: string) => {
    snap.current = { doc: fullDoc, time: Date.now() };
    addVersion(fullDoc, "before", label).catch((e) => console.error("Version history:", e));
  };

  // ---- Images ----

  // Pick an image file, keep it in "My images", and (optionally) put it on the page.
  const importImage = async (addToPage: boolean) => {
    const file = await pickFile("image/*");
    if (!file) return;
    const { src, ratio } = await readImageFile(file);
    const asset: Asset = { id: `user-${newId()}`, name: file.name.replace(/\.[^.]+$/, ""), kind: "image", subjects: "all", cycles: ALL_CYCLES, src, ratio };
    const next = [asset, ...userAssets];
    setUserAssets(next);
    void saveUserAssets(next).then((ok) => !ok && notify(tr("Library storage is full — the image is only kept in this exam")));
    if (addToPage) {
      const { type, preset } = assetToBlock(asset, doc.meta.lang);
      exam.addBlock(type, preset);
    } else {
      setLibrary((l) => ({ kind: "image", n: l.n + 1 }));
    }
  };

  const replaceImage = async (id: string) => {
    const file = await pickFile("image/*");
    const block = doc.blocks.find((b) => b.id === id);
    if (!file || !block) return;
    const { src, ratio } = await readImageFile(file);
    // A picture that was drawn in a Studio is no longer that drawing: double-click must not reopen the old one.
    exam.updateBlock(id, { src, ratio, drawing: undefined, molecule: undefined, graphStudio: undefined, circuitStudio: undefined, chartStudio: undefined, srcAnswer: undefined, probaStudio: undefined, imageEdit: undefined, layout: { height: block.layout.width / ratio } });
  };

  // Keep a copy of a block in "My blocks" (without its place on the page or its header/footer role).
  const saveToLibrary = (block: Block) => {
    const { layout, type } = block;
    const data = structuredClone(block) as unknown as Record<string, unknown>;
    for (const key of ["id", "layout", "meta", "type"]) delete data[key];
    const fixedSize = type === "image" || type === "equation" || type === "graph";
    const preset = { ...data, width: layout.width, ...(fixedSize ? { height: layout.height } : {}) } as BlockPreset;
    const figure = block.type === "image" && block.figure ? figureDef(block.figure.id) : undefined;
    const asset: Asset = {
      id: `user-${newId()}`,
      name: blockLabel(block) || tr(figure?.name ?? BLOCK_TYPE_NAMES[type]),
      kind: "block",
      subjects: "all",
      cycles: ALL_CYCLES,
      block: { type, preset },
    };
    const next = [asset, ...userAssets];
    setUserAssets(next);
    void saveUserAssets(next).then((ok) => notify(ok ? tr("Saved in your library (Library → My blocks)") : tr("Library storage is full — the block could not be kept")));
  };

  const deleteUserAsset = (id: string) => {
    const next = userAssets.filter((a) => a.id !== id);
    setUserAssets(next);
    void saveUserAssets(next);
  };

  // ---- Tools (click in the toolbox, or drop on the page) ----

  // What a drag on the page does. The text box tool says how to use it, since nothing shows until drawn.
  const setCanvasTool = (next: CanvasTool) => {
    if (next === "table") {
      setEditing(null);
      setTableMode("select");
    }
    setTool(next);
    if (next === "textbox" && tool !== "textbox") notify(tr("Drag on the page to draw a text box — Esc to cancel"));
  };

  // A shape chosen in Insert → Shapes: the next drag on the page draws it.
  const drawShape = (shape: string) => {
    setShapeToDraw(shape);
    setTool("shape");
    notify(tr("Drag on the page to draw the shape — Esc to cancel"));
  };

  // A new block right under another one (under its text box when it sits in one), pushing down what is there: an equation's graph or
  // table of variations. It is a block of the page, never put in the text box.
  const insertBelow = (sourceId: string, type: BlockType, preset: BlockPreset) => {
    const source = doc.blocks.find((b) => b.id === sourceId);
    const anchor = (source?.meta?.slot && doc.blocks.find((b) => b.id === source.meta?.slot)) || source;
    if (!anchor) return void runTool({ kind: "block", type, preset });
    const pageIndex = Math.max(0, doc.pages.findIndex((p) => p.id === anchor.layout.pageId));
    const y = anchor.layout.y + (heights.get(anchor.id) ?? anchor.layout.height) + 16;
    // A table goes from the page's margin (it is as wide as the text); a graph is centered under the equation.
    const page = doc.pages[pageIndex];
    const x = type === "table" ? (page?.margins?.left ?? PAGE_MARGIN) : anchor.layout.x + anchor.layout.width / 2 - (preset.width ?? (type === "graph" ? 320 : anchor.layout.width)) / 2;
    const block = exam.addBlock(type, preset, { pageIndex, x: Math.max(0, x), y, corner: true });
    exam.moveBlock(block.id, block.layout.pageId, block.layout.x, block.layout.y); // (what it lands on goes down)
    setEditing(null);
    setTab("properties");
    setActiveInspectorId(inspectorFor(block));
  };

  // The Stamp tool: a click on the page puts the sticker in hand there (and the tool stays in hand: a barème is many marks)
  // A total is not put in a row that has one already (one at a time: the row's marks add up to it)
  const totalTaken = (action: ToolAction, at?: DropPoint) => {
    if (exam.part !== "sheet" || !at || action.kind !== "block" || action.type !== "mark" || (action.preset as { kind?: string } | undefined)?.kind !== "total") return false;
    if (!rowHasTotalAt(doc, at.pageIndex, at.y)) return false;
    notify(tr("This row already has a total."));
    return true;
  };
  const placeStamp = (at: DropPoint) => {
    if (!stamp || stamp.kind !== "block" || exam.part !== "sheet" || totalTaken(stamp, at)) return;
    const block = exam.addBlock(stamp.type, stamp.preset, at);
    setTab("properties");
    setActiveInspectorId(inspectorFor(block));
  };

  const runTool = (action: ToolAction, at?: DropPoint) => {
    // Another tool used meanwhile: no text box or shape is drawn any more.
    setTool((cur) => (cur === "textbox" || cur === "shape" || cur === "draw" || cur === "stamp" || cur === "table" ? "select" : cur));
    // A question type or a table picked while a text box is being typed in is a real block placed in that box's text, at the cursor
    // (textboxSlots.ts). It is then edited like any block, as when added on the page.
    const box = textEditor && !at ? doc.blocks.find((b) => b.id === editing?.id) : undefined;
    if (box?.type === "textbox" && textEditor) {
      if (action.kind === "block" && canEmbed(action.type)) {
        const { block, slotContent } = newEmbedded(box, action.type, doc.meta.lang, action.preset);
        textEditor.chain().focus().insertContent(slotContent).run();
        setTab("properties");
        setActiveInspectorId(inspectorFor(block));
        exam.setSelectedId(block.id);
        setEditing(TYPE_ON_ADD.includes(block.type) ? { id: block.id, field: { kind: "text" }, selectAll: true } : null);
        return;
      }
      const snippet = snippetFor(action, { lang: doc.meta.lang, blocks: doc.blocks });
      if (snippet) return insertSnippet(textEditor, snippet);
    }
    switch (action.kind) {
      case "block": {
        if (totalTaken(action, at)) return;
        // A new exercise title follows the ones already in the exam ("Exercice 2 :", ...).
        const textPreset = action.type === "text" ? (action.preset as { style?: string; text?: string } | undefined) : undefined;
        const preset =
          textPreset?.style === "heading" && textPreset.text === undefined
            ? { ...action.preset, text: nextTaskTitle(doc.blocks, doc.meta.lang) }
            : action.preset;
        const block = exam.addBlock(action.type, preset, at);
        setTab("properties");
        setActiveInspectorId(inspectorFor(block));
        // Write right away on the page: the starting text is selected, so typing replaces it.
        if (TYPE_ON_ADD.includes(block.type)) setEditing({ id: block.id, field: { kind: "text" }, selectAll: true });
        break;
      }
      case "blocks": {
        // Each block goes under the one before (the document is only updated after this call, so the
        // automatic "next free spot" would give them all the same place).
        let prev: Block | undefined;
        for (const item of action.items) {
          const under = prev && { pageIndex: Math.max(0, doc.pages.findIndex((p) => p.id === prev!.layout.pageId)), x: prev.layout.x, y: prev.layout.y + prev.layout.height + 24, corner: true };
          prev = exam.addBlock(item.type, item.preset, under);
        }
        setTab("properties");
        break;
      }
      case "asset": {
        const asset = [...userAssets, ...BUILTIN_ASSETS].find((a) => a.id === action.assetId);
        if (!asset) return;
        const add = (a: Asset) => {
          const { type, preset } = assetToBlock(a, doc.meta.lang);
          exam.addBlock(type, preset, at);
          setTab("properties");
          setActiveInspectorId(inspectorFor({ type } as Block));
        };
        // (a picture of the pack is read from its file first)
        if (asset.file) void withDrawing(asset).then(add, () => notify(tr("Could not load the picture “{name}”", { name: asset.name })));
        else add(asset);
        break;
      }
      case "importImage":
        void importImage(true);
        break;
      case "molecule":
        setMolecule({ open: true, blockId: null });
        break;
      case "molecule-lab":
        setMoleculeLab({ open: true, blockId: null });
        break;
      case "graph-studio":
        setGraphStudio({ open: true, blockId: null });
        break;
      case "circuit-studio":
        setCircuitStudio({ open: true, blockId: null });
        break;
      case "proba-studio":
        setProbaStudio({ open: true, blockId: null });
        break;
      case "table-studio":
        setTableStudio({ open: true, blockId: null });
        break;
      case "chart-studio":
        setChartStudio({ open: true, blockId: null });
        break;
      case "library":
        setTab("library");
        setLibrary((l) => ({ kind: "diagram", n: l.n + 1 }));
        break;
    }
  };

  // ---- Typing directly on the page ----

  const toggleKeyboard = (open = !mathKb) => {
    setMathKb(open);
    try {
      localStorage.setItem(KEYBOARD_KEY, open ? "1" : "0");
    } catch {}
  };

  // Double-click (or T tool click) on a block. `field` = which text; null = a block without text.
  const startEdit = (id: string, field: EditField | null) => {
    select(id);
    const block = doc.blocks.find((b) => b.id === id);
    // A molecule reopens in the Molecule Studio, with everything it was made of.
    if (block?.type === "image" && block.molecule) return setMolecule({ open: true, blockId: id });
    // A drawing made by hand reopens in the drawing Studio, with all its atoms, bonds, texts and arrows.
    if (block?.type === "image" && block.drawing) return setMoleculeLab({ open: true, blockId: id });
    // A graph paper reopens in the Graph Studio, with its limits, labels and grid.
    if (block?.type === "image" && block.graphStudio) return setGraphStudio({ open: true, blockId: id });
    // A chart reopens in the Chart Studio, with its table and everything it shows.
    if (block?.type === "image" && readChart(block.chartStudio)) return setChartStudio({ open: true, blockId: id });
    // A circuit reopens in the Circuit Studio, with its components and wires.
    if (block?.type === "image" && block.circuitStudio) return setCircuitStudio({ open: true, blockId: id });
    // A probability drawing reopens in the Probability Studio, with its trees and figures.
    if (block?.type === "image" && block.probaStudio) return setProbaStudio({ open: true, blockId: id });
    if (field) {
      if (block?.type === "table" && field.kind === "cell") setTableSel(id, cellSel(field.r, field.c));
      setEditing({ id, field });
    } else if (block?.type === "equation") {
      toggleKeyboard(true);
      setTimeout(focusMathfield, 80);
    }
  };

  // A math keyboard key pressed with no text open. Its text form goes in the selected block's first text (opened for typing), its LaTeX
  // in the selected equation (the Properties panel is shown for its field), or in a new equation when nothing that takes text is selected.
  const openForTyping = (): OpenedTarget => {
    const block = selectedId ? doc.blocks.find((b) => b.id === selectedId) : undefined;
    const showEquationField = () => {
      setBarOpen("bar.right-panel", true);
      setTab("properties");
      setActiveInspectorId(null);
    };
    if (block?.type === "equation") {
      showEquationField();
      return "equation";
    }
    const first = block && editRegions(block, numbers.get(block.id) ?? 1, doc.meta, mode)[0];
    if (block && first) {
      setEditing({ id: block.id, field: first.field });
      return "field";
    }
    runTool({ kind: "block", type: "equation" });
    showEquationField();
    return "new-equation";
  };

  const editChange = (value: string) => {
    const block = editing && doc.blocks.find((b) => b.id === editing.id);
    if (!editing || !block) return;
    exam.updateBlock(block.id, fieldPatch(block, editing.field, value), { key: `${block.id}:inline:${fieldKey(editing.field)}` });
  };

  // Typing in a text box (its Tiptap editor): the document, and the same text as styled runs. Typing in a
  // row is one undo step here; inside the editor, Ctrl+Z undoes step by step.
  const editRich = (content: JSONContent) => {
    if (!editing) return;
    exam.updateBlock(editing.id, { content, text: richFromDoc(content) }, { key: `${editing.id}:inline:text` });
  };
  // The text box loses bold / italic / … of its own (its words got it instead, see textboxEditor.toggleStyle).
  const dropBoxStyle = (mark: StyleMark) => {
    const block = editing && doc.blocks.find((b) => b.id === editing.id);
    if (!block?.font) return;
    const font = { ...block.font, [mark]: mark === "bold" ? false : undefined };
    exam.updateBlock(block.id, { font }, { key: `${block.id}:inline:text` });
  };

  // Tab / Shift+Tab: jump to the next / previous text of the same block.
  const editNext = (back: boolean) => {
    const block = editing && doc.blocks.find((b) => b.id === editing.id);
    if (!editing || !block) return;
    const fields = editRegions(block, numbers.get(block.id) ?? 1, doc.meta, mode).map((r) => r.field);
    const i = fields.findIndex((f) => fieldKey(f) === fieldKey(editing.field));
    const next = fields[(i + (back ? -1 : 1) + fields.length) % fields.length];
    if (next) setEditing({ id: block.id, field: next });
  };

  // Finished typing. A new text from the T tool that stayed empty is removed.
  const editDone = (id: string) => {
    const block = doc.blocks.find((b) => b.id === id);
    if (editing?.id === id && editing.created && block && !plainText(fieldValue(block, editing.field)).trim()) exam.deleteBlock(id);
    setEditing((cur) => (cur?.id === id ? null : cur));
  };

  // Enter in an option / statement / sub-question: add a new one just below and type in it.
  // Enter on an empty one: stop typing.
  const editEnter = () => {
    const block = editing && doc.blocks.find((b) => b.id === editing.id);
    if (!editing || !block) return;
    const f = editing.field;
    // A poem (Poetry verse): Enter goes to the other hemistich; Enter in the last one starts a new verse (a row like this one).
    if (block.type === "table" && block.verse && f.kind === "cell") {
      if (f.c < colsOf(block) - 1) return setEditing({ id: block.id, field: { kind: "cell", r: f.r, c: f.c + 1 } });
      const patch = insertLines(block, "row", f.r + 1);
      if (!patch) return editDone(block.id);
      const cellStyles = { ...patch.cellStyles };
      for (let c = 0; c < colsOf(block); c++) {
        const s = block.cellStyles?.[keyOf(f.r, c)];
        if (s) cellStyles[keyOf(f.r + 1, c)] = { ...s };
      }
      exam.updateBlock(block.id, { ...patch, cellStyles });
      return setEditing({ id: block.id, field: { kind: "cell", r: f.r + 1, c: 0 } });
    }
    if (!("i" in f) || !plainText(fieldValue(block, f)).trim()) return editDone(block.id);
    const i = f.i + 1;
    const insert = <T,>(list: T[], item: T) => [...list.slice(0, i), item, ...list.slice(i)];
    if (block.type === "mcq" && f.kind === "option" && block.options.length < MAX_OPTIONS) {
      exam.updateBlock(block.id, insertOption(block, i));
    } else if (block.type === "match" && (f.kind === "left" || f.kind === "right") && block.pairs.length < 12) {
      // A new pair: type its left item first.
      exam.updateBlock(block.id, addPair(block, i));
      return setEditing({ id: block.id, field: { kind: "left", i } });
    } else if (block.type === "order" && f.kind === "item" && block.items.length < 12) {
      exam.updateBlock(block.id, addOrderItem(block, i));
    } else if (block.type === "truefalse" && f.kind === "statement") {
      exam.updateBlock(block.id, { statements: insert(block.statements, { text: "", answer: true }) });
    } else if (block.type === "open" && f.kind === "part" && (block.parts?.length ?? 0) < 12) {
      const parts = insert(block.parts ?? [], { text: "", lines: 2, answer: "", points: 1 });
      exam.updateBlock(block.id, { parts, points: parts.reduce((sum, p) => sum + p.points, 0) });
    } else return editNext(false);
    setEditing({ id: block.id, field: { kind: f.kind, i } as EditField });
  };

  // Exam ⇄ correction sheet. The Correction tab asks how to make the sheet while there is none.
  const changeMode = (m: ViewMode) => {
    if (m === "key" && !exam.hasSheet) return setSheetWizard({ open: true, rebuild: false });
    exam.setPart(m === "key" ? "sheet" : "exam");
    setEditing(null);
    setTool((cur) => (cur === "stamp" ? "select" : cur));
  };

  // T tool on empty paper: a new paragraph starting where the teacher clicked (its first line on the click).
  const createText = (at: DropPoint) => {
    const width = Math.max(160, Math.min(CONTENT_WIDTH, pageSize(doc.pages[at.pageIndex]).width - pageMargins(doc, at.pageIndex).right - at.x));
    const block = exam.addBlock("text", { style: "body", text: "", width }, { ...at, y: at.y - 10 });
    setEditing({ id: block.id, field: { kind: "text" }, created: true });
  };

  // Text box tool: the box drawn on the page becomes a text box of that size, ready to type in (its ribbon
  // opens in the right panel), and the select tool is back. A click makes a small one, one line tall and growing with its text,
  // its first line on the click (cut at the page's right margin).
  const drawTextbox = ({ pageIndex, x, y, width, height }: DrawnBox) => {
    if (width || height) return runTool({ kind: "block", type: "textbox", preset: { width, height } }, { pageIndex, x, y, corner: true });
    // (a click in the column of the marks or of the totals of a correction sheet: a box as wide as that column)
    const geo = doc.sheet?.paper === "bordered" ? frameOf(doc, pageIndex) : null;
    const col = geo && [geo.marks, geo.total].find((c) => c && x >= c.x0 && x <= c.x1);
    if (col) return runTool({ kind: "block", type: "textbox", preset: { width: col.x1 - col.x0 - 4, height: 0, sizing: "auto-height" } }, { pageIndex, x: col.x0 + 2, y: y - 14, corner: true });
    const room = pageSize(doc.pages[pageIndex]).width - pageMargins(doc, pageIndex).right - x;
    const w = Math.max(80, Math.min(CLICK_TEXTBOX_WIDTH, room));
    runTool({ kind: "block", type: "textbox", preset: { width: w, height: 0, sizing: "auto-height" } }, { pageIndex, x, y: y - 14, corner: true });
  };

  // The table tools' pen: a box drawn on the paper becomes a table of one cell as big as the box, selected; the tools stay in hand to
  // draw its lines.
  const drawTable = (box: DrawnBox) => {
    const block = exam.addBlock("table", drawnTablePreset(box.width, box.height), { pageIndex: box.pageIndex, x: box.x, y: box.y, corner: true, free: true });
    setTableSel(block.id, null);
    setTab("properties");
    setActiveInspectorId(inspectorFor(block));
  };

  // Shapes tool: the box (or line) drawn on the page becomes a shape block of that size (a click: of its usual size, centred on the
  // click), and the select tool is back. A line drawn leftwards or upwards is flipped.
  const drawOnPage = (box: DrawnBox) => {
    if (tool !== "shape" || !shapeToDraw) return drawTextbox(box);
    const line = !!shapeDef(shapeToDraw).line;
    const click = !box.width && !box.height;
    const [dw, dh] = defaultSize(shapeToDraw);
    const width = click ? dw : box.width;
    const height = click ? dh : box.height;
    const preset = { shape: shapeToDraw, width, height, ...(line && box.flipX ? { flipX: true } : {}), ...(line && box.flipY ? { flipY: true } : {}) };
    runTool({ kind: "block", type: "shape", preset }, { pageIndex: box.pageIndex, x: click ? box.x - width / 2 : box.x, y: click ? box.y - height / 2 : box.y, corner: true });
  };

  // Draw tool: each stroke is a shape of the page (a freehand one drawn as ink), so it moves, stretches and is undone like any
  // shape. The tool stays in hand: a drawing is many strokes.
  const drawInk = ({ pageIndex, tool: inkTool, settings, points }: DrawnInk) => {
    const s = inkToShape(points, settings.size);
    if (!s) return;
    const preset = { shape: FREEHAND_ID, ink: inkTool, stroke: settings.color, strokeWidth: settings.size, adj: s.adj, pressure: s.pressure, width: s.w, height: s.h };
    exam.addBlock("shape", preset, { pageIndex, x: s.x, y: s.y, corner: true }, { quiet: true });
  };

  // Equation typed in MathLive: save the LaTeX now, redraw it shortly after.
  const onLatex = (block: Block, latex: string) => {
    if (block.type !== "equation") return;
    exam.updateBlock(block.id, { latex }, { key: `latex-${block.id}` });
    clearTimeout(eqTimer.current);
    eqTimer.current = setTimeout(() => exam.refreshEquation(block, latex), 250);
  };

  // ---- Files ----

  // The exam's own file (desktop app): where it was opened from or saved to, and the exam as it is in it (null: none yet, or a
  // browser). Ctrl+S writes it again without asking, like Word; Save as… asks where.
  const [file, setFile] = useState<{ path: string; saved: ExamDoc } | null>(null);

  const saveAs = async () => {
    try {
      const path = await saveExamAs(JSON.stringify(fullDoc), file ? fileNameOf(file.path) : `${fileName(doc.meta.title)}.exam.json`);
      if (path === null) return;
      setFile(path ? { path, saved: fullDoc } : null);
      notify(path ? tr("Saved to “{file}”", { file: fileNameOf(path) }) : tr("Exam saved"));
    } catch (e) {
      notify(tr("Could not save: {error}", { error: String(e) }));
    }
  };

  const save = async () => {
    if (!file || !isTauri()) return saveAs();
    try {
      await writeExamAt(file.path, JSON.stringify(fullDoc));
      setFile({ path: file.path, saved: fullDoc });
      notify(tr("Saved to “{file}”", { file: fileNameOf(file.path) }));
    } catch (e) {
      notify(tr("Could not save: {error}", { error: String(e) }));
    }
  };

  const open = async () => {
    let picked: Awaited<ReturnType<typeof openExamFile>>;
    try {
      picked = await openExamFile();
    } catch (e) {
      return notify(tr("Could not open: {error}", { error: String(e) }));
    }
    if (!picked) return;
    const opened = parseExamFile(picked.text);
    if (!opened) return notify(tr("This file is not an Exam Builder file"));
    keepCopy(tr("Before opening “{title}”", { title: opened.meta.title }));
    exam.replaceDoc(opened);
    setFile(picked.path ? { path: picked.path, saved: opened } : null);
    setEditing(null);
    setSession((s) => s + 1);
    notify(tr("Opened “{title}”", { title: opened.meta.title }));
  };

  const restore = (v: Version) => {
    keepCopy(tr("Before restoring a version"));
    exam.replaceDoc(structuredClone(v.doc));
    setEditing(null);
    setSession((s) => s + 1);
    setHistory(false);
    notify(tr("Version restored — Ctrl+Z to go back"));
  };

  // Draw a clean copy off-screen (fonts and pictures loaded first) and return its pages as images.
  // The document that goes out for each way of printing: the exam, or the correction sheet
  const printed = (m: ViewMode) => viewOf(fullDoc, m === "key" && fullDoc.correction ? "sheet" : "exam");

  const drawCopy = async <T,>(target: ExamDoc, m: ViewMode, take: (stage: Konva.Stage, pages: Page[]) => T): Promise<T> => {
    const srcs = target.blocks.flatMap((b) => (b.type === "image" ? [b.src, ...(b.srcAnswer ? [b.srcAnswer] : [])] : b.type === "equation" && b.svg ? [svgUrl(b.svg)] : b.type === "table" ? picturesOf(b.shapes) : []));
    // The formulas written in the text — of the text boxes, and of every other block (questions, tables, headers…): their drawings
    // (made by MathJax first for those that keep none), loaded before the copy is drawn, else the page is taken without them.
    const mathIn = (v: unknown): InlineMath[] =>
      typeof v === "string"
        ? isRich(v)
          ? parseRich(v).flatMap((r) => (r.style.math ? [r.style.math] : []))
          : []
        : Array.isArray(v)
          ? v.flatMap(mathIn)
          : v && typeof v === "object"
            ? Object.values(v).flatMap(mathIn)
            : [];
    const formulas = await Promise.all(
      target.blocks
        .flatMap((b) => [
          ...(b.type === "textbox" ? docParagraphs(textboxDoc(b)).flatMap((p) => p.runs.flatMap((r) => (r.style.math ? [r.style.math] : []))) : []),
          ...(b.type === "image" ? mathIn(b.caption) : b.type === "equation" ? [] : mathIn(b)),
        ])
        .map((m) => inlineMathUrl(m) ?? drawInlineMath(m.latex).then((d) => d.url, () => "")),
    );
    await Promise.all([preloadImages([...srcs, ...formulas]), document.fonts.ready]);
    const stage = await new Promise<Konva.Stage>((resolve) => setExportJob({ id: ++exportJobs, doc: target, mode: m, resolve }));
    try {
      return take(stage, target.pages);
    } finally {
      setExportJob(null);
    }
  };
  // The documents that go out for a copy, each with how it is drawn. With versions: each version, and each one's correction (that
  // version with its answers), all the exams first.
  const copiesOf = (which: ViewMode | "both", plan: VersionPlan): { doc: ExamDoc; mode: ViewMode }[] => {
    const modes: ViewMode[] = which === "both" ? ["exam", "key"] : [which];
    if (plan.count <= 1) return modes.map((m) => ({ doc: printed(m), mode: m }));
    const exam = viewOf(fullDoc, "exam");
    const versions = Array.from({ length: plan.count }, (_, i) => examVersion(exam, i, plan));
    return modes.flatMap((mode) => versions.map((doc) => ({ doc, mode })));
  };

  // The pages that go out for a copy of the print preview (the exam, the correction sheet, or both one after the other) as sharp images,
  // with their pages, in black and white when `color` is off. Null (and the correction sheet's wizard opened) when it is the correction
  // sheet and there is none yet.
  const outgoing = async (which: ViewMode | "both", color: boolean, vector: boolean, plan: VersionPlan) => {
    if (which !== "exam" && !fullDoc.correction && plan.count <= 1) {
      notify(tr("Make the correction sheet first"));
      setSheetWizard({ open: true, rebuild: false });
      return null;
    }
    const images: string[] = [];
    const pages: Page[] = [];
    for (const [k, c] of copiesOf(which, plan).entries()) {
      images.push(...(await drawCopy(c.doc, c.mode, (stage, p) => (vector ? stagePageSvgs(stage, p, !color, `c${k}-`) : stagePageImages(stage, p, 3, 0.92)))));
      pages.push(...c.doc.pages);
    }
    return { images: color || vector ? images : await grayImages(images), pages };
  };
  const previewCopy = async (which: ViewMode | "both", plan: VersionPlan) => {
    const images: string[] = [];
    const pages: Page[] = [];
    for (const c of copiesOf(which, plan)) {
      images.push(...(await drawCopy(c.doc, c.mode, (stage, p) => stagePageImages(stage, p, 1.25, 0.85))));
      pages.push(...c.doc.pages);
    }
    return { images, pages };
  };
  const sheetsFor = (pages: Page[], layout: PrintLayout) => sheetsOf(pages.map((p) => getPageMm(p.format)), layout, fullDoc.meta.lang === "ar");
  const outName = (which: ViewMode | "both", plan: VersionPlan) =>
    `${fileName(doc.meta.title)}${which === "key" ? ` - ${tr("correction")}` : which === "both" ? ` - ${tr("exam and correction")}` : ""}${plan.count > 1 ? ` (${plan.count} ${tr("versions")})` : ""}`;

  // Each page into the PDF, on its sheets of paper (from the print preview).
  const exportPdf = async (which: ViewMode | "both", layout: PrintLayout, plan: VersionPlan) => {
    if (busy) return;
    setBusy(true);
    try {
      // In the desktop app: vector pages written by its browser engine (text that can be selected, small files). In a browser: page
      // pictures (it has no way to write a PDF of its own).
      if (isTauri()) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const path = await save({ defaultPath: `${outName(which, plan)}.pdf`, filters: [{ name: "PDF", extensions: ["pdf"] }] });
        if (!path) return;
        const out = await outgoing(which, layout.color, true, plan);
        if (!out) return;
        await pdfSheets(out.images, sheetsFor(out.pages, layout), path);
      } else {
        const out = await outgoing(which, layout.color, false, plan);
        if (!out) return;
        const bytes = await imagesToPdf(out.images, out.pages, layout, fullDoc.meta.lang === "ar");
        if (!(await saveFile(bytes, `${outName(which, plan)}.pdf`, { name: "PDF", extensions: ["pdf"] }))) return;
      }
      notify(which === "key" ? tr("Correction sheet exported") : tr("Exam exported"));
    } catch (e) {
      notify(tr("Export failed: {error}", { error: String(e) }));
    } finally {
      setExportJob(null);
      setBusy(false);
    }
  };

  // The exam as a Word document (editable): each copy's texts and tables, and its drawn blocks cut from its pages as pictures. The
  // correction is the exam with its answers written in (Word has no correction sheet of its own).
  const exportWord = async (which: ViewMode | "both", plan: VersionPlan) => {
    if (busy) return;
    setBusy(true);
    try {
      const { dataUrlBytes, examToDocx, isPictureBlock } = await import("@/app/_lib/wordExport");
      const modes: ViewMode[] = which === "both" ? ["exam", "key"] : [which];
      const exam = viewOf(fullDoc, "exam");
      const docs = plan.count <= 1 ? [exam] : Array.from({ length: plan.count }, (_, i) => examVersion(exam, i, plan));
      const copies: WordCopy[] = [];
      for (const mode of modes)
        for (const d of docs) {
          const drawn = d.blocks.filter(isPictureBlock);
          const pictures = drawn.length
            ? await drawCopy(d, mode, (stage, pages) => {
                const boxes = pageBoxes(pages);
                const heights = blockHeights(d);
                const out = new Map<string, Picture>();
                for (const b of drawn) {
                  const box = boxes[pages.findIndex((p) => p.id === b.layout.pageId)];
                  if (!box) continue;
                  const width = b.layout.width + 4;
                  const height = (heights.get(b.id) ?? b.layout.height) + 4;
                  const url = stage.toDataURL({ x: box.left + b.layout.x - 2, y: box.top + b.layout.y - 2, width, height, pixelRatio: 2, mimeType: "image/png" });
                  out.set(b.id, { data: dataUrlBytes(url), width, height });
                }
                return out;
              })
            : new Map<string, Picture>();
          copies.push({ doc: d, mode, pictures });
        }
      const bytes = await examToDocx(copies);
      if (await saveFile(bytes, `${outName(which, plan)}.docx`, { name: "Word", extensions: ["docx"] })) notify(tr("Word document exported"));
    } catch (e) {
      notify(tr("Export failed: {error}", { error: String(e) }));
    } finally {
      setExportJob(null);
      setBusy(false);
    }
  };

  // The same pages straight to the printer (the system's print window).
  const printOut = async (which: ViewMode | "both", layout: PrintLayout, plan: VersionPlan) => {
    if (busy) return;
    setBusy(true);
    try {
      const out = await outgoing(which, layout.color, true, plan);
      if (!out) return;
      await printSheets(out.images, sheetsFor(out.pages, layout), outName(which, plan));
    } catch (e) {
      notify(tr("Printing failed: {error}", { error: String(e) }));
    } finally {
      setExportJob(null);
      setBusy(false);
    }
  };

  // The window's name (taskbar, Alt+Tab): the exam's file, with a dot while it has changes not written to it
  const windowTitle = file ? `${fileNameOf(file.path)}${file.saved !== fullDoc ? " •" : ""} — Examor` : "Examor";
  useEffect(() => {
    document.title = windowTitle;
    if (isTauri()) void import("@tauri-apps/api/window").then(({ getCurrentWindow }) => getCurrentWindow().setTitle(windowTitle)).catch(() => undefined);
  }, [windowTitle]);

  // ---- Closing: nothing lost ----
  // The desktop window waits for the last change to be written before it closes, and asks only when it could not be. In a browser the
  // change is written when the tab is hidden, and leaving asks while one is not saved.
  const flushRef = useRef(exam.flushSave);
  const saveStatus = useRef(exam.save.status);
  const trRef = useRef(tr);
  useEffect(() => {
    flushRef.current = exam.flushSave;
    saveStatus.current = exam.save.status;
    trRef.current = tr;
  });
  useEffect(() => {
    if (isTauri()) {
      let unlisten: (() => void) | undefined;
      let stopped = false;
      void import("@tauri-apps/api/window").then(({ getCurrentWindow }) =>
        getCurrentWindow()
          .onCloseRequested(async (e) => {
            if (await flushRef.current()) return;
            const { ask } = await import("@tauri-apps/plugin-dialog");
            const tr = trRef.current;
            const leave = await ask(tr("Your latest changes could not be saved on this computer. Close anyway and lose them?"), {
              title: "Examor",
              kind: "warning",
              okLabel: tr("Close anyway"),
              cancelLabel: tr("Cancel"),
            });
            if (!leave) e.preventDefault();
          })
          .then((fn) => (stopped ? fn() : (unlisten = fn))),
      );
      return () => {
        stopped = true;
        unlisten?.();
      };
    }
    const hidden = () => document.visibilityState === "hidden" && void flushRef.current();
    const leaving = (e: BeforeUnloadEvent) => {
      if (saveStatus.current === "saved") return;
      void flushRef.current();
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("beforeunload", leaving);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("beforeunload", leaving);
    };
  }, []);

  // ---- Keyboard shortcuts ----

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const inGrid = !!t.closest?.("[data-table-grid]"); // (the cells of a table in the right panel: its keys are its own, except undo and redo)
      const typing = t.isContentEditable || inGrid || ["INPUT", "TEXTAREA", "SELECT", "MATH-FIELD"].includes(t.tagName);
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (inGrid && mod && (key === "z" || key === "y") && !picker.open && !preview && !history && !tableStudio.open) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) exam.redo();
        else exam.undo();
        return;
      }

      if (mod && key === "s") {
        e.preventDefault();
        void (e.shiftKey ? saveAs() : save());
        return;
      }
      if (mod && key === "p") {
        e.preventDefault();
        setPreview(true);
        return;
      }
      // Ctrl+F and Ctrl+H: Find and replace (also while typing: the browser's own search would not know the page).
      if (mod && !e.altKey && (key === "f" || key === "h")) {
        e.preventDefault();
        openInspector(FIND_INSPECTOR);
        return;
      }
      // Ctrl+[ / Ctrl+] open or close the side bars. Not with Alt: AltGr (= Ctrl+Alt) types "[" on
      // French keyboards. The physical key also works there, where "[" has no key of its own.
      const bar = mod && !e.altKey && appLayout.find((b) => b.collapse?.hotkey && hotkeyHit(e, b.collapse.hotkey));
      if (bar) {
        e.preventDefault();
        setBarOpen(bar.id);
        return;
      }
      if (typing || picker.open || sheetWizard.open || preview || history || molecule.open || moleculeLab.open || graphStudio.open || circuitStudio.open || probaStudio.open || tableStudio.open || chartStudio.open || imageStudio.open) return;

      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) exam.redo();
        else exam.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        exam.redo();
      } else if (mod && key === "d" && selected) {
        e.preventDefault();
        exam.duplicateBlock(selected.id);
      } else if ((key === "delete" || key === "backspace") && group.length) {
        e.preventDefault();
        exam.deleteBlocks(group);
      } else if ((key === "delete" || key === "backspace" || key === "enter" || key === "escape") && selected?.type === "table" && !isFixedTable(selected) && tableSelOf(selected.id)) {
        // cells of the selected table are selected: Delete empties them, Enter types in the first one, Escape goes back to the whole table
        e.preventDefault();
        const sel = tableSelOf(selected.id)!;
        const range = wholeMerges(selected, selRange(sel));
        if (key === "escape") setTableSel(selected.id, null);
        else if (key === "enter") startEdit(selected.id, { kind: "cell", r: range.r0, c: range.c0 });
        else {
          const patch = clearRange(selected, range);
          if (patch) exam.updateBlock(selected.id, patch, { key: `${selected.id}:clear-cells` });
        }
      } else if ((key === "delete" || key === "backspace") && selected) {
        e.preventDefault();
        exam.deleteBlock(selected.id);
      } else if (group.length && key.startsWith("arrow")) {
        // Arrow keys nudge the blocks selected together (Shift = 10px), each kept in its page.
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        const changes = doc.blocks
          .filter((b) => group.includes(b.id))
          .map((b) => {
            const size = pageSize(doc.pages.find((p) => p.id === b.layout.pageId));
            const x = Math.max(0, Math.min(b.layout.x + dx, size.width - b.layout.width));
            const y = Math.max(0, Math.min(b.layout.y + dy, size.height - (heights.get(b.id) ?? 0)));
            return { id: b.id, patch: { layout: { x, y } } };
          });
        exam.updateBlocks(changes, { key: "nudge-group" });
      } else if (key === "escape") {
        exam.setSelectedId(null);
        setTool("select");
      } else if (!mod && key === "b") {
        setCanvasTool("textbox");
      } else if (!mod && key === "v") {
        // (with the table tools in hand: their Select, the bar of the tables stays)
        if (tool === "table") setTableMode("select");
        else setTool("select");
      } else if (!mod && !e.altKey && key === "p") {
        // P: the Draw tool (again: the next of its brush, pencil and highlighter)
        if (tool === "draw") ink.cycle();
        setTool("draw");
      } else if (!mod && !e.altKey && key === "e") {
        // E: the eraser (again: back to Select)
        setTool(tool === "eraser" ? "select" : "eraser");
      } else if (!mod && !e.altKey && (key === "r" || key === "o" || key === "l")) {
        // The shapes of the tool bar's Shapes menu (Shift+L: the arrow).
        drawShape(key === "r" ? "rect" : key === "o" ? "ellipse" : e.shiftKey ? "arrow" : "line");
      } else if (selected && key.startsWith("arrow")) {
        // Arrow keys nudge the selected block (Shift = 10px).
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        const h = heights.get(selected.id) ?? 0;
        const size = pageSize(doc.pages.find((p) => p.id === selected.layout.pageId));
        const x = Math.max(0, Math.min(selected.layout.x + dx, size.width - selected.layout.width));
        const y = Math.max(0, Math.min(selected.layout.y + dy, size.height - h));
        exam.updateBlock(selected.id, { layout: { x, y } }, { key: `nudge-${selected.id}` });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // Copy, cut and paste of whole blocks (when no text is being typed in).
  const clipboard = useBlockClipboard({
    selected,
    active: !(picker.open || sheetWizard.open || preview || history || molecule.open || moleculeLab.open || graphStudio.open || circuitStudio.open || probaStudio.open || tableStudio.open || chartStudio.open || imageStudio.open),
    deleteBlock: exam.deleteBlock,
    pasteBlock: exam.pasteBlock,
    addText: (text) => exam.addBlock("text", { text, style: "body" }),
    notify,
    t: tr,
  });

  // ---- What the features can use ----

  const shell: Shell = {
    title: doc.meta.title,
    setTitle: (title) => exam.setMeta({ title }, "title"),
    setMeta: exam.setMeta,
    setFullMark: exam.setFullMark,
    selected,
    numbers,
    fullDoc,
    stats,
    saveState: exam.save,
    canUndo: exam.canUndo,
    canRedo: exam.canRedo,
    undo: exam.undo,
    redo: exam.redo,
    busy,
    runTool: (action) => runTool(action),
    insertBelow,
    stepInBox: exam.stepInBox,
    canvasTool: tool,
    setCanvasTool,
    shapeToDraw,
    drawShape,
    textEditor,
    updateBlock: (id, patch, field) => exam.updateBlock(id, patch, { key: `${id}:${field}` }),
    updateBlocks: exam.updateBlocks,
    selectBlock: (id) => {
      const block = doc.blocks.find((x) => x.id === id);
      exam.setSelectedId(id);
      if (block) exam.revealPage(block.layout.pageId);
    },
    copyBlock: clipboard.copyBlock,
    pasteClip: clipboard.pasteClip,
    notify,
    onLatex,
    deleteBlock: exam.deleteBlock,
    duplicateBlock: exam.duplicateBlock,
    orderBlock: exam.orderBlock,
    marginEdit,
    openMarginEdit,
    draftMargins: (m) => draftMargins(m),
    setMargins: saveMargins,
    setPageFormat: exam.setPageFormat,
    setPageBorder: exam.setPageBorder,
    themeMode,
    setThemeMode,
    setChrome: exam.setChrome,
    resetPageChrome: exam.resetPageChrome,
    adoptHeader: exam.adoptHeader,
    newExam: () => setPicker({ open: true, mustPick: false }),
    applyDoc: (next, keepOld) => {
      if (keepOld) keepCopy(tr("Before changing the page layout"));
      // (made from the document shown: the correction sheet's own page layout while it is shown, never the whole file)
      if (exam.part === "sheet") exam.replaceView(next);
      else exam.replaceDoc(next);
      setEditing(null);
      setSession((s) => s + 1);
    },
    openExam: () => void open(),
    saveExam: () => void save(),
    saveExamAs: () => void saveAs(),
    examFile: file ? { name: fileNameOf(file.path), changed: file.saved !== fullDoc } : null,
    startedFresh: initial.fresh,
    showHistory: () => setHistory(true),
    showPreview: () => setPreview(true),
    mode,
    setMode: changeMode,
    sheet: exam.part === "sheet" && doc.sheet && scores ? { config: doc.sheet, scores } : null,
    hasSheet: exam.hasSheet,
    sheetWizard,
    openSheetWizard: (rebuild = false) => setSheetWizard({ open: true, rebuild }),
    closeSheetWizard: () => setSheetWizard({ open: false, rebuild: false }),
    makeSheet: (choice) => {
      exam.makeSheet(choice);
      setSheetWizard({ open: false, rebuild: false });
      setEditing(null);
      setTool("select");
      notify(tr("Correction sheet made"));
    },
    sheetReport,
    sheetFix: {
      addMissing: (ids) => exam.fixSheet((f) => addMissing(f, ids)),
      refresh: (ids) => exam.fixSheet((f) => refreshStale(f, ids)),
      refit: () => exam.fixSheet(refitAnswers),
      pack: () => exam.fixSheet(packRows),
      restyle: (look) => exam.fixSheet((f) => restyleFull(f, look)),
      addTotals: () => exam.fixSheet(addRowTotals),
      removeOrphans: () => exam.fixSheet(removeOrphans),
      resetMarks: (ids) => exam.fixSheet((f) => resetMarks(f, ids)),
      adoptMarks: (ids) => exam.fixSheet((f) => adoptMarks(f, ids)),
    },
    deleteSheet: () => {
      exam.deleteSheet(); // (back to the exam; undo brings the sheet back)
      setEditing(null);
      setTool("select");
    },
    setSheet: exam.setSheet,
    stamp,
    setStamp: (action) => {
      setStamp(action);
      setTool(action ? "stamp" : "select");
      // (said once: the mouse in the shape of the sticker tells the rest)
      if (action && !stampHinted) {
        stampHinted = true;
        notify(tr("Click on the page to put the sticker — Esc to stop"));
      }
    },
    selectNone: () => {
      exam.setSelectedId(null);
      setActiveInspectorId(null);
      setTab("properties");
      setTool("select");
    },
    subject,
    setSubject,
    uiLang,
    setUiLang: changeUiLang,
    query,
    setQuery,
    rightTab: tab,
    setRightTab: setTab,
    library,
    userAssets,
    importImage: (addToPage) => void importImage(addToPage),
    deleteUserAsset,
    replaceImage: (id) => void replaceImage(id),
    mathKeyboard: mathKb,
    toggleMathKeyboard: (open) => toggleKeyboard(open ?? !mathKb),
    openForTyping,
    picker,
    openPicker: () => setPicker({ open: true, mustPick: false }),
    closePicker: () => setPicker({ open: false, mustPick: false }),
    pickTemplate: (template: Template) => {
      if (!picker.mustPick) keepCopy(tr("Before starting a new exam"));
      exam.newFromTemplate(template);
      setFile(null); // (a new exam: not in a file yet)
      setEditing(null);
      setSession((s) => s + 1);
      setPicker({ open: false, mustPick: false });
    },
    preview,
    closePreview: () => setPreview(false),
    exportPdf: (which, layout, plan) => void exportPdf(which, layout, plan),
    printOut: (which, layout, plan) => void printOut(which, layout, plan),
    exportWord: (which, plan) => void exportWord(which, plan),
    previewCopy,
    history,
    closeHistory: () => setHistory(false),
    molecule,
    openMolecule: (blockId) => setMolecule({ open: true, blockId: blockId ?? null }),
    closeMolecule: () => setMolecule({ open: false, blockId: null }),
    moleculeLab,
    openMoleculeLab: (blockId) => setMoleculeLab({ open: true, blockId: blockId ?? null }),
    closeMoleculeLab: () => setMoleculeLab({ open: false, blockId: null }),
    graphStudio,
    openGraphStudio: (blockId) => setGraphStudio({ open: true, blockId: blockId ?? null }),
    closeGraphStudio: () => setGraphStudio({ open: false, blockId: null }),
    tableStudio,
    chartStudio,
    openChartStudio: (blockId) => setChartStudio({ open: true, blockId: blockId ?? null }),
    closeChartStudio: () => setChartStudio({ open: false, blockId: null }),
    openTableStudio: (blockId, shape) => setTableStudio({ open: true, blockId: blockId ?? null, shape }),
    closeTableStudio: () => setTableStudio({ open: false, blockId: null }),
    circuitStudio,
    openCircuitStudio: (blockId) => setCircuitStudio({ open: true, blockId: blockId ?? null }),
    closeCircuitStudio: () => setCircuitStudio({ open: false, blockId: null }),
    probaStudio,
    openProbaStudio: (blockId) => setProbaStudio({ open: true, blockId: blockId ?? null }),
    closeProbaStudio: () => setProbaStudio({ open: false, blockId: null }),
    imageStudio,
    openImageStudio: (blockId) => setImageStudio({ open: true, blockId }),
    closeImageStudio: () => setImageStudio({ open: false, blockId: null }),
    restore,
    exportJob,
    toast,
    hiddenBars,
    toggleBar: (id) => setBarOpen(id),
    showBar: (id) => setBarOpen(id, true),
    barWidths,
    setBarWidth,
    saveToLibrary,
  };

  const ctx: Ctx = {
    doc,
    selection: selectedId,
    activePageId: doc.pages[exam.activePage]?.id ?? "",
    t: tr,
    // The interface keeps its left-to-right layout in every language (Arabic words still read right-to-left, see globals.css).
    dir: "ltr",
    shell,
    activeInspectorId,
    openInspector,
    closeInspector: () => setActiveInspectorId(null),
  };

  // Bars for one screen position, in order.
  const bars = (position: BarPosition) =>
    appLayout
      .filter((bar) => bar.position === position)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((bar) => <BarRenderer key={bar.id} bar={bar} ctx={ctx} />);

  return (
    <UiProvider lang={uiLang}>
      <div className="flex h-screen flex-col bg-canvas">
        {bars("top")}

        <div className="flex min-h-0 flex-1">
          {bars("left")}

          <main className="relative min-w-0 flex-1">
            <Workspace
              key={session}
              doc={doc}
              heights={drawnHeights}
              numbers={numbers}
              mode={mode}
              selectedId={selectedId}
              activePage={exam.activePage}
              reveal={exam.reveal}
              tool={tool === "stamp" && exam.part !== "sheet" ? "select" : tool}
              onStamp={(at) => placeStamp(at)}
              stamp={stamp}
              onSheet={exam.setSheet}
              editing={editing}
              marginEdit={marginEdit && { margins: marginEdit.draft ?? pageMargins(doc, exam.activePage), dragging: marginEdit.dragging }}
              onMarginDrag={(m, done) => (done ? saveMargins(m) : draftMargins(m, true))}
        onChromeData={exam.editChrome}
        onChromeScope={exam.chromeScope}
        onChromeSettings={() => openInspector(HEADER_FOOTER_INSPECTOR)}
              onToolChange={setCanvasTool}
              mathKeyboard={mathKb}
              onToggleMathKeyboard={() => toggleKeyboard()}
              onDrawBox={drawOnPage}
              onDrawTable={drawTable}
              tableMode={tableMode}
              onTableMode={(next) => { setEditing(null); setTableMode(next); setTool("table"); }}
              ink={ink}
              onInk={drawInk}
              eraser={eraser}
              onErase={exam.eraseBlocks}
              onEraseInk={exam.eraseInk}
              drawShape={tool === "shape" && shapeToDraw ? (shapeDef(shapeToDraw).line ? "line" : "box") : undefined}
              shapeToDraw={shapeToDraw}
              onPickShape={drawShape}
              onPatch={(id, patch, field) => exam.updateBlock(id, patch, { key: `${id}:${field}` })}
              onEditStart={startEdit}
              onEditChange={editChange}
              onEditNext={editNext}
              onEditEnter={editEnter}
              onEditDone={editDone}
              onRichChange={editRich}
              onDropBoxStyle={dropBoxStyle}
              onTextEditor={setTextEditor}
              onCreateText={createText}
              onSelect={select}
              groupIds={group}
              onSelectMany={exam.selectGroup}
              onMoveMany={exam.moveBlocks}
              onMove={exam.moveBlock}
              onResize={(id, layout) => {
                // Dragging an edge of an auto-sized text box gives it that size, as in Figma (blockLayout.sizingAfterResize).
                const b = doc.blocks.find((x) => x.id === id);
                const sizing = b?.type === "textbox" ? sizingAfterResize(b, doc.meta, layout) : undefined;
                exam.updateBlock(id, { layout, ...(b?.type === "textbox" && sizing !== b.sizing ? { sizing } : {}) });
              }}
              onAddPage={() => exam.addPage()}
              onDeletePage={exam.deletePage}
              onActivePageChange={exam.setActivePage}
              onDropItem={runTool}
            />
            {bars("bottom")}
          </main>

          {bars("right")}
        </div>

        {bars("overlay")}
      </div>
    </UiProvider>
  );
}
