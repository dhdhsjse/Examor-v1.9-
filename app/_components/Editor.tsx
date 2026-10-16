"use client";

import type Konva from "konva";
import { useEffect, useMemo, useRef, useState } from "react";
import { CONTENT_WIDTH, PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH } from "@/app/_lib/a4";
import { focusMathfield } from "@/app/_lib/activeMathfield";
import { blockHeights, fullMark, isQuestion, questionNumbers } from "@/app/_lib/blocks";
import { editRegions, fieldKey, fieldPatch, fieldValue, type EditField } from "@/app/_lib/editRegions";
import { newId } from "@/app/_lib/id";
import { preloadImages, readImageFile } from "@/app/_lib/images";
import { plainText } from "@/app/_lib/richText";
import { BUILTIN_ASSETS, svgUrl, type Asset, type AssetKind } from "@/app/_lib/library";
import { imagesToPdf, stagePageImages } from "@/app/_lib/pdf";
import { loadAutosave, loadUserAssets, parseExamFile, pickFile, saveFile, saveUserAssets } from "@/app/_lib/storage";
import { ALL_CYCLES, type Subject } from "@/app/_lib/subjects";
import { buildDoc, templateById } from "@/app/_lib/templates";
import { assetToBlock, type ToolAction } from "@/app/_lib/tools";
import type { Block, BlockType, ExamDoc, ViewMode } from "@/app/_lib/types";
import { UiProvider, loadUiLang, saveUiLang, translate, type UiLang } from "@/app/_lib/uiLang";
import { useExam, type DropPoint } from "@/app/_lib/useExam";
import { addVersion, type Version } from "@/app/_lib/versions";
import ExportRenderer from "./canvas/ExportRenderer";
import ExportPreview from "./export/ExportPreview";
import VersionHistory from "./history/VersionHistory";
import Inspector from "./inspector/Inspector";
import LeftPanel from "./LeftPanel";
import LibraryPanel from "./library/LibraryPanel";
import MathKeyboard from "./math/MathKeyboard";
import RightPanel, { type RightTab } from "./RightPanel";
import TemplatePicker from "./templates/TemplatePicker";
import TopBar from "./TopBar";
import type { CanvasTool } from "./workspace/ToolRail";
import Workspace, { type Editing } from "./workspace/Workspace";

interface ExportJob {
  doc: ExamDoc;
  mode: ViewMode;
  resolve: (stage: Konva.Stage) => void;
}

const fileName = (title: string) => title.replace(/[\\/:*?"<>|]+/g, "").trim() || "exam";
const KEYBOARD_KEY = "examBuilder.mathKeyboard";
const SNAPSHOT_EVERY = 3 * 60 * 1000; // automatic copy in the version history

// New blocks of these types start with their text selected on the page, ready to type over.
const TYPE_ON_ADD: BlockType[] = ["mcq", "truefalse", "blank", "open", "text"];

// The main screen: top bar, toolbox (left), pages (center), properties + library (right).
// Mirrored (right-to-left) when the app is in Arabic.
export default function Editor() {
  // Reopen the last exam (autosave), or start with the template picker.
  const [initial] = useState(() => {
    const saved = loadAutosave();
    return { doc: saved ?? buildDoc(templateById("classic-fr")), fresh: !saved };
  });
  const exam = useExam(initial.doc);
  const { doc, selectedId } = exam;

  const [uiLang, setUiLang] = useState<UiLang>(loadUiLang);
  const tr = (text: string, vars?: Record<string, string | number>) => translate(uiLang, text, vars);
  const [subject, setSubject] = useState<Subject>("General");
  const [mode, setMode] = useState<ViewMode>("exam");
  const [tab, setTab] = useState<RightTab>("properties");
  const [library, setLibrary] = useState<{ kind: AssetKind | "all"; n: number }>({ kind: "all", n: 0 });
  const [picker, setPicker] = useState<{ open: boolean; mustPick: boolean }>({ open: initial.fresh, mustPick: initial.fresh });
  const [userAssets, setUserAssets] = useState<Asset[]>(loadUserAssets);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
  const [preview, setPreview] = useState(false);
  const [history, setHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const eqTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [tool, setTool] = useState<CanvasTool>("select");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [session, setSession] = useState(0); // +1 for each new/opened exam (resets the zoom)
  const [mathKb, setMathKb] = useState(() => {
    try {
      return localStorage.getItem(KEYBOARD_KEY) !== "0";
    } catch {
      return true;
    }
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

  const select = (id: string | null) => {
    exam.setSelectedId(id);
    if (id) setTab("properties");
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
      const { type, preset } = assetToBlock(asset);
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

  const deleteUserAsset = (id: string) => {
    const next = userAssets.filter((a) => a.id !== id);
    setUserAssets(next);
    saveUserAssets(next);
  };

  // ---- Tools (click in the toolbox, or drop on the page) ----

  const runTool = (action: ToolAction, at?: DropPoint) => {
    switch (action.kind) {
      case "block": {
        const block = exam.addBlock(action.type, action.preset, at);
        setTab("properties");
        // Write right away on the page: the starting text is selected, so typing replaces it.
        if (TYPE_ON_ADD.includes(block.type)) setEditing({ id: block.id, field: { kind: "text" }, selectAll: true });
        break;
      }
      case "asset": {
        const asset = [...userAssets, ...BUILTIN_ASSETS].find((a) => a.id === action.assetId);
        if (!asset) return;
        const { type, preset } = assetToBlock(asset);
        exam.addBlock(type, preset, at);
        setTab("properties");
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
    if (block.type === "mcq" && f.kind === "option" && block.options.length < 6) {
      exam.updateBlock(block.id, { options: insert(block.options, ""), correct: block.correct >= i ? block.correct + 1 : block.correct });
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

  // Full mark from the points indicator: the header's "/ 20" when there is one, else the exam setting.
  const setFullMark = (value: number) => {
    const header = doc.blocks.find((b) => b.type === "header");
    if (header?.type === "header" && !header.fields.autoOutOf) exam.updateBlock(header.id, { fields: { ...header.fields, outOf: value } }, { key: "fullMark" });
    else if (!fullMark(doc).fromHeader) exam.setMeta({ fullMark: value }, "fullMark");
  };

  // T tool on empty paper: a new paragraph starting where the teacher clicked.
  const createText = (at: DropPoint) => {
    const width = Math.max(160, Math.min(CONTENT_WIDTH, PAGE_WIDTH - PAGE_MARGIN - at.x));
    const block = exam.addBlock("text", { style: "body", text: "", width }, at);
    setEditing({ id: block.id, field: { kind: "text" }, created: true });
  };

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
      return stagePageImages(stage, doc.pages.length, pixelRatio, quality);
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
        const bytes = await imagesToPdf(await renderPages(m, 3, 0.92));
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
      } else if (!mod && key === "v") {
        setTool("select");
      } else if (selected && key.startsWith("arrow")) {
        // Arrow keys nudge the selected block (Shift = 10px).
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
        const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
        const h = heights.get(selected.id) ?? 0;
        const x = Math.max(0, Math.min(selected.layout.x + dx, PAGE_WIDTH - selected.layout.width));
        const y = Math.max(0, Math.min(selected.layout.y + dy, PAGE_HEIGHT - h));
        exam.updateBlock(selected.id, { layout: { x, y } }, { key: `nudge-${selected.id}` });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <UiProvider lang={uiLang}>
      <div className="flex h-screen flex-col bg-canvas" dir={uiLang === "ar" ? "rtl" : "ltr"}>
        <TopBar
          subject={subject}
          onSubjectChange={setSubject}
          title={doc.meta.title}
          onTitleChange={(title) => exam.setMeta({ title }, "title")}
          mode={mode}
          onModeChange={changeMode}
          canUndo={exam.canUndo}
          canRedo={exam.canRedo}
          onUndo={exam.undo}
          onRedo={exam.redo}
          onNew={() => setPicker({ open: true, mustPick: false })}
          onOpen={() => void open()}
          onSave={() => void save()}
          onHistory={() => setHistory(true)}
          onPreview={() => setPreview(true)}
          save={exam.save}
          uiLang={uiLang}
          onUiLang={changeUiLang}
          busy={busy}
        />

        <div className="flex min-h-0 flex-1">
          <LeftPanel subject={subject} pageCount={stats.pages} questionCount={stats.questions} totalPoints={stats.points} onTool={runTool} />

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
              onToolChange={setTool}
              onPatch={(id, patch, field) => exam.updateBlock(id, patch, { key: `${id}:${field}` })}
              onEditStart={startEdit}
              onEditChange={editChange}
              onEditNext={editNext}
              onEditEnter={editEnter}
              onEditDone={editDone}
              onCreateText={createText}
              onSelect={select}
              onMove={exam.moveBlock}
              onResize={(id, layout) => exam.updateBlock(id, { layout })}
              onAddPage={exam.addPage}
              onDeletePage={exam.deletePage}
              onActivePageChange={exam.setActivePage}
              onDropItem={runTool}
              onMeta={exam.setMeta}
              onFullMark={setFullMark}
              onModeChange={changeMode}
            />

            {/* Math keyboard while an equation is selected */}
            {selected?.type === "equation" && mathKb && (
              <div className="pointer-events-none absolute inset-x-0 bottom-16 z-40 flex justify-center px-4">
                <div className="w-full max-w-[720px]">
                  <MathKeyboard onClose={() => toggleKeyboard(false)} />
                </div>
              </div>
            )}
          </main>

          <RightPanel
            tab={tab}
            onTab={setTab}
            properties={
              <Inspector
                block={selected}
                number={selected ? (numbers.get(selected.id) ?? 1) : 1}
                keyboardOpen={mathKb}
                onToggleKeyboard={() => toggleKeyboard()}
                meta={doc.meta}
                stats={stats}
                hasHeader={doc.blocks.some((b) => b.type === "header")}
                onChange={(id, patch, field) => exam.updateBlock(id, patch, { key: `${id}:${field}` })}
                onLatex={onLatex}
                onDelete={exam.deleteBlock}
                onDuplicate={exam.duplicateBlock}
                onReplaceImage={(id) => void replaceImage(id)}
                onMeta={exam.setMeta}
                onChangeTemplate={() => setPicker({ open: true, mustPick: false })}
              />
            }
            library={
              <LibraryPanel
                key={`${subject}-${library.n}`}
                subject={subject}
                initialKind={library.kind}
                userAssets={userAssets}
                onUse={(a) => runTool({ kind: "asset", assetId: a.id })}
                onImport={() => void importImage(false)}
                onDeleteUserAsset={deleteUserAsset}
              />
            }
          />
        </div>

        {picker.open && (
          <TemplatePicker
            canClose={!picker.mustPick}
            onClose={() => setPicker({ open: false, mustPick: false })}
            onPick={(t) => {
              if (!picker.mustPick) keepCopy(tr("Before starting a new exam"));
              exam.newFromTemplate(t);
              setEditing(null);
              setSession((s) => s + 1);
              setPicker({ open: false, mustPick: false });
            }}
          />
        )}

        {preview && (
          <ExportPreview
            doc={doc}
            busy={busy}
            renderPages={(m) => renderPages(m, 1.25, 0.85)}
            onExport={(w) => void exportPdf(w)}
            onClose={() => setPreview(false)}
          />
        )}

        {history && <VersionHistory current={doc} onRestore={restore} onClose={() => setHistory(false)} />}

        {exportJob && <ExportRenderer key={exportJob.mode} doc={exportJob.doc} mode={exportJob.mode} onReady={exportJob.resolve} />}

        {toast && (
          <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg bg-slate-900/90 px-4 py-2 text-xs font-medium text-white shadow-lg">
            {toast}
          </div>
        )}
      </div>
    </UiProvider>
  );
}
