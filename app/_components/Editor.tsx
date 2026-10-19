"use client";

import type { Editor as TextEditor, JSONContent } from "@tiptap/core";
import type Konva from "konva";
import { useEffect, useMemo, useRef, useState } from "react";
import { CONTENT_WIDTH } from "@/app/_lib/a4";
import { pageMargins } from "@/app/_lib/onboarding/applyOnboarding";
import { pageSize } from "@/app/_lib/pageFormats";
import { focusMathfield } from "@/app/_lib/activeMathfield";
import {
  BLOCK_TYPE_NAMES,
  MAX_OPTIONS,
  addOrderItem,
  addPair,
  blockHeights,
  blockLabel,
  insertOption,
  isQuestion,
  questionNumbers,
  type BlockPreset,
} from "@/app/_lib/blocks";
import { editRegions, fieldKey, fieldPatch, fieldValue, type EditField } from "@/app/_lib/editRegions";
import { figureDef } from "@/app/_lib/figures";
import { newId } from "@/app/_lib/id";
import { preloadImages, readImageFile } from "@/app/_lib/images";
import { plainText } from "@/app/_lib/richText";
import { richFromDoc } from "@/app/_lib/textboxDoc";
import type { StyleMark } from "@/app/_lib/textboxEditor";
import { BUILTIN_ASSETS, svgUrl, type Asset, type AssetKind } from "@/app/_lib/library";
import { imagesToPdf, stagePageImages } from "@/app/_lib/pdf";
import { loadAutosave, loadUserAssets, parseExamFile, pickFile, saveFile, saveUserAssets } from "@/app/_lib/storage";
import { ALL_CYCLES, type Subject } from "@/app/_lib/subjects";
import { buildDoc, templateById, type Template } from "@/app/_lib/templates";
import { assetToBlock, type ToolAction } from "@/app/_lib/tools";
import type { Block, BlockType, PageMargins, ViewMode } from "@/app/_lib/types";
import { UiProvider, loadUiLang, saveUiLang, translate, type UiLang } from "@/app/_lib/uiLang";
import { useExam, type DropPoint } from "@/app/_lib/useExam";
import { addVersion, type Version } from "@/app/_lib/versions";
import { appLayout } from "@/app/_features/app";
import BarRenderer from "@/app/_features/core/BarRenderer";
import type { BarPosition, Ctx, MarginEdit, RightTab, Shell } from "@/app/_features/core/types";
import { blockInspectorFor, findSectionFeature } from "@/app/_features/sections";
import type { DrawnBox } from "./canvas/ExamCanvas";
import type { CanvasTool } from "./workspace/ToolRail";
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
const MARGIN_SAVE_DELAY = 500; // ms without a change before typed margins become an undo step
const SNAPSHOT_EVERY = 3 * 60 * 1000; // automatic copy in the version history

// New blocks of these types start with their text selected on the page, ready to type over.
const TYPE_ON_ADD: BlockType[] = ["mcq", "truefalse", "blank", "open", "match", "order", "classify", "text", "textbox"];

// The shell: owns the state and the actions. The screen itself is drawn from appLayout (app/_features/app.ts).
export default function Editor() {
  // Reopen the last exam (autosave), or start with the template picker.
  const [initial] = useState(() => {
    const saved = loadAutosave();
    return { doc: saved ?? buildDoc(templateById("classic-fr")), fresh: !saved };
  });
  const [uiLang, setUiLang] = useState<UiLang>(loadUiLang);
  const tr = (text: string, vars?: Record<string, string | number>) => translate(uiLang, text, vars);
  const exam = useExam(initial.doc, tr);
  const { doc, selectedId } = exam;

  const [subject, setSubject] = useState<Subject>("General");
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<ViewMode>("exam");
  const [tab, setTab] = useState<RightTab>("properties");
  const [activeInspectorId, setActiveInspectorId] = useState<string | null>(null);
  const [marginEdit, setMarginEdit] = useState<MarginEdit | null>(null); // see Shell.marginEdit
  const marginTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [library, setLibrary] = useState<{ kind: AssetKind | "all"; n: number }>({ kind: "all", n: 0 });
  const [picker, setPicker] = useState<{ open: boolean; mustPick: boolean }>({ open: false, mustPick: false });
  const [userAssets, setUserAssets] = useState<Asset[]>(loadUserAssets);
  const [exportJob, setExportJob] = useState<Shell["exportJob"]>(null);
  const [preview, setPreview] = useState(false);
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const eqTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [tool, setTool] = useState<CanvasTool>("select");
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
  const stats = useMemo(() => {
    const questions = doc.blocks.filter(isQuestion);
    return { questions: questions.length, points: questions.reduce((s, q) => s + q.points, 0), pages: doc.pages.length };
  }, [doc]);
  const selected = doc.blocks.find((b) => b.id === selectedId);

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

  const docRef = useRef(doc);
  const snap = useRef({ doc, time: 0 });
  useEffect(() => {
    docRef.current = doc;
  }, [doc]);
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
    snap.current = { doc, time: Date.now() };
    addVersion(doc, "before", label).catch((e) => console.error("Version history:", e));
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
    if (!saveUserAssets(next)) notify(tr("Library storage is full — the image is only kept in this exam"));
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
    exam.updateBlock(id, { src, ratio, layout: { height: block.layout.width / ratio } });
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
    notify(saveUserAssets(next) ? tr("Saved in your library (Library → My blocks)") : tr("Library storage is full — the block could not be kept"));
  };

  const deleteUserAsset = (id: string) => {
    const next = userAssets.filter((a) => a.id !== id);
    setUserAssets(next);
    saveUserAssets(next);
  };

  // ---- Tools (click in the toolbox, or drop on the page) ----

  // What a drag on the page does. The text box tool says how to use it, since nothing shows until drawn.
  const setCanvasTool = (next: CanvasTool) => {
    setTool(next);
    if (next === "textbox" && tool !== "textbox") notify(tr("Drag on the page to draw a text box — Esc to cancel"));
  };

  const runTool = (action: ToolAction, at?: DropPoint) => {
    // Another tool used meanwhile: no text box is drawn any more.
    setTool((cur) => (cur === "textbox" ? "select" : cur));
    switch (action.kind) {
      case "block": {
        const block = exam.addBlock(action.type, action.preset, at);
        setTab("properties");
        setActiveInspectorId(inspectorFor(block));
        // Write right away on the page: the starting text is selected, so typing replaces it.
        if (TYPE_ON_ADD.includes(block.type)) setEditing({ id: block.id, field: { kind: "text" }, selectAll: true });
        break;
      }
      case "asset": {
        const asset = [...userAssets, ...BUILTIN_ASSETS].find((a) => a.id === action.assetId);
        if (!asset) return;
        const { type, preset } = assetToBlock(asset, doc.meta.lang);
        exam.addBlock(type, preset, at);
        setTab("properties");
        setActiveInspectorId(inspectorFor({ type } as Block));
        break;
      }
      case "importImage":
        void importImage(true);
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
    if (field) setEditing({ id, field });
    else if (block?.type === "equation") {
      toggleKeyboard(true);
      setTimeout(focusMathfield, 80);
    }
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

  // Exam ⇄ correction sheet. Answers can only be typed on the correction sheet, so stop typing.
  const changeMode = (m: ViewMode) => {
    setMode(m);
    setEditing(null);
  };

  // T tool on empty paper: a new paragraph starting where the teacher clicked (its first line on the click).
  const createText = (at: DropPoint) => {
    const width = Math.max(160, Math.min(CONTENT_WIDTH, pageSize(doc.pages[at.pageIndex]).width - pageMargins(doc, at.pageIndex).right - at.x));
    const block = exam.addBlock("text", { style: "body", text: "", width }, { ...at, y: at.y - 10 });
    setEditing({ id: block.id, field: { kind: "text" }, created: true });
  };

  // Text box tool: the box drawn on the page becomes a text box of that size, ready to type in (its ribbon
  // opens in the right panel), and the select tool is back.
  const drawTextbox = ({ pageIndex, x, y, width, height }: DrawnBox) =>
    runTool({ kind: "block", type: "textbox", preset: { width, height } }, { pageIndex, x, y, corner: true });

  // Equation typed in MathLive: save the LaTeX now, redraw it shortly after.
  const onLatex = (block: Block, latex: string) => {
    if (block.type !== "equation") return;
    exam.updateBlock(block.id, { latex }, { key: `latex-${block.id}` });
    clearTimeout(eqTimer.current);
    eqTimer.current = setTimeout(() => exam.refreshEquation(block, latex), 250);
  };

  // ---- Files ----

  const save = async () => {
    try {
      const ok = await saveFile(JSON.stringify(doc), `${fileName(doc.meta.title)}.exam.json`, { name: "Exam", extensions: ["json"] });
      if (ok) notify(tr("Exam saved"));
    } catch (e) {
      notify(tr("Could not save: {error}", { error: String(e) }));
    }
  };

  const open = async () => {
    const file = await pickFile(".json,application/json");
    if (!file) return;
    const opened = parseExamFile(await file.text());
    if (!opened) return notify(tr("This file is not an Exam Builder file"));
    keepCopy(tr("Before opening “{title}”", { title: opened.meta.title }));
    exam.replaceDoc(opened);
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
  const renderPages = async (m: ViewMode, pixelRatio: number, quality: number) => {
    const srcs = doc.blocks.flatMap((b) => (b.type === "image" ? [b.src] : b.type === "equation" && b.svg ? [svgUrl(b.svg)] : []));
    await Promise.all([preloadImages(srcs), document.fonts.ready]);
    const stage = await new Promise<Konva.Stage>((resolve) => setExportJob({ doc, mode: m, resolve }));
    try {
      return stagePageImages(stage, doc.pages, pixelRatio, quality);
    } finally {
      setExportJob(null);
    }
  };

  // Turn each page into a PDF page (from the print preview).
  const exportPdf = async (which: ViewMode | "both") => {
    if (busy) return;
    setBusy(true);
    try {
      const modes: ViewMode[] = which === "both" ? ["exam", "key"] : [which];
      for (const m of modes) {
        const bytes = await imagesToPdf(await renderPages(m, 3, 0.92), doc.pages);
        const name = `${fileName(doc.meta.title)}${m === "key" ? ` - ${tr("correction")}` : ""}.pdf`;
        if (await saveFile(bytes, name, { name: "PDF", extensions: ["pdf"] })) {
          notify(m === "key" ? tr("Correction sheet exported") : tr("Exam exported"));
        }
      }
    } catch (e) {
      notify(tr("Export failed: {error}", { error: String(e) }));
    } finally {
      setExportJob(null);
      setBusy(false);
    }
  };

  // ---- Keyboard shortcuts ----

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "MATH-FIELD"].includes(t.tagName);
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && key === "s") {
        e.preventDefault();
        void save();
        return;
      }
      if (mod && key === "p") {
        e.preventDefault();
        setPreview(true);
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
      if (typing || picker.open || preview || history) return;

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
      } else if ((key === "delete" || key === "backspace") && selected) {
        e.preventDefault();
        exam.deleteBlock(selected.id);
      } else if (key === "escape") {
        exam.setSelectedId(null);
        setTool("select");
      } else if (!mod && key === "t") {
        setTool("text");
      } else if (!mod && key === "b") {
        setCanvasTool("textbox");
      } else if (!mod && key === "v") {
        setTool("select");
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

  // ---- What the features can use ----

  const shell: Shell = {
    title: doc.meta.title,
    setTitle: (title) => exam.setMeta({ title }, "title"),
    setMeta: exam.setMeta,
    selected,
    numbers,
    stats,
    saveState: exam.save,
    canUndo: exam.canUndo,
    canRedo: exam.canRedo,
    undo: exam.undo,
    redo: exam.redo,
    busy,
    runTool: (action) => runTool(action),
    canvasTool: tool,
    setCanvasTool,
    textEditor,
    updateBlock: (id, patch, field) => exam.updateBlock(id, patch, { key: `${id}:${field}` }),
    onLatex,
    deleteBlock: exam.deleteBlock,
    duplicateBlock: exam.duplicateBlock,
    marginEdit,
    openMarginEdit,
    draftMargins: (m) => draftMargins(m),
    setMargins: saveMargins,
    setPageFormat: exam.setPageFormat,
    setChrome: exam.setChrome,
    resetPageChrome: exam.resetPageChrome,
    adoptHeader: exam.adoptHeader,
    newExam: () => setPicker({ open: true, mustPick: false }),
    applyDoc: (next, keepOld) => {
      if (keepOld) keepCopy(tr("Before changing the page layout"));
      exam.replaceDoc(next);
      setEditing(null);
      setSession((s) => s + 1);
    },
    openExam: () => void open(),
    saveExam: () => void save(),
    showHistory: () => setHistory(true),
    showPreview: () => setPreview(true),
    mode,
    setMode,
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
    picker,
    openPicker: () => setPicker({ open: true, mustPick: false }),
    closePicker: () => setPicker({ open: false, mustPick: false }),
    pickTemplate: (template: Template) => {
      if (!picker.mustPick) keepCopy(tr("Before starting a new exam"));
      exam.newFromTemplate(template);
      setEditing(null);
      setSession((s) => s + 1);
      setPicker({ open: false, mustPick: false });
    },
    preview,
    closePreview: () => setPreview(false),
    exportPdf: (which) => void exportPdf(which),
    renderPages,
    history,
    closeHistory: () => setHistory(false),
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
    dir: uiLang === "ar" ? "rtl" : "ltr",
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
      <div className="flex h-screen flex-col bg-canvas" dir={uiLang === "ar" ? "rtl" : "ltr"}>
        {bars("top")}

        <div className="flex min-h-0 flex-1">
          {bars("left")}

          <main className="relative min-w-0 flex-1">
            <Workspace
              key={session}
              doc={doc}
              heights={heights}
              numbers={numbers}
              mode={mode}
              selectedId={selectedId}
              activePage={exam.activePage}
              reveal={exam.reveal}
              tool={tool}
              editing={editing}
              marginEdit={marginEdit && { margins: marginEdit.draft ?? pageMargins(doc, exam.activePage), dragging: marginEdit.dragging }}
              onMarginDrag={(m, done) => (done ? saveMargins(m) : draftMargins(m, true))}
        onChromeData={exam.editChrome}
        onChromeScope={exam.chromeScope}
        onChromeSettings={() => openInspector(HEADER_FOOTER_INSPECTOR)}
              onToolChange={setCanvasTool}
              onDrawBox={drawTextbox}
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
              onMove={exam.moveBlock}
              onResize={(id, layout) => exam.updateBlock(id, { layout })}
              onAddPage={() => exam.addPage()}
              onDeletePage={exam.deletePage}
              onActivePageChange={exam.setActivePage}
              onDropItem={runTool}
              onMeta={exam.setMeta}
              onModeChange={changeMode}
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
