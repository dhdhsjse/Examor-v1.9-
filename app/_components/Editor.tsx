"use client";

import type Konva from "konva";
import { useEffect, useMemo, useRef, useState } from "react";
import { CONTENT_WIDTH, PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH } from "@/app/_lib/a4";
import { focusMathfield } from "@/app/_lib/activeMathfield";
import { blockHeights, isQuestion, questionNumbers } from "@/app/_lib/blocks";
import { editRegions, fieldKey, fieldPatch, fieldValue, type EditField } from "@/app/_lib/editRegions";import { newId } from "@/app/_lib/id";
import { preloadImages, readImageFile } from "@/app/_lib/images";
import { BUILTIN_ASSETS, svgUrl, type Asset, type AssetKind } from "@/app/_lib/library";
import { stageToPdf } from "@/app/_lib/pdf";
import { loadAutosave, loadUserAssets, parseExamFile, pickFile, saveFile, saveUserAssets } from "@/app/_lib/storage";
import { ALL_CYCLES, type Subject } from "@/app/_lib/subjects";
import { buildDoc, templateById } from "@/app/_lib/templates";
import { assetToBlock, type ToolAction } from "@/app/_lib/tools";
import type { Block, ExamDoc, ViewMode } from "@/app/_lib/types";
import { useExam, type DropPoint } from "@/app/_lib/useExam";
import ExportRenderer from "./canvas/ExportRenderer";
import Inspector from "./inspector/Inspector";
import LeftPanel from "./LeftPanel";
import LibraryPanel from "./library/LibraryPanel";
import MathKeyboard from "./math/MathKeyboard";import RightPanel, { type RightTab } from "./RightPanel";
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

// The main screen: top bar, toolbox (left), pages (center), properties + library (right).
export default function Editor() {
  // Reopen the last exam (autosave), or start with the template picker.
  const [initial] = useState(() => {
    const saved = loadAutosave();
    return { doc: saved ?? buildDoc(templateById("classic-fr")), fresh: !saved };
  });
  const exam = useExam(initial.doc);
  const { doc, selectedId } = exam;

  const [subject, setSubject] = useState<Subject>("General");
  const [mode, setMode] = useState<ViewMode>("exam");
  const [tab, setTab] = useState<RightTab>("properties");
  const [library, setLibrary] = useState<{ kind: AssetKind | "all"; n: number }>({ kind: "all", n: 0 });
  const [picker, setPicker] = useState<{ open: boolean; mustPick: boolean }>({ open: initial.fresh, mustPick: initial.fresh });
  const [userAssets, setUserAssets] = useState<Asset[]>(loadUserAssets);
  const [exportJob, setExportJob] = useState<ExportJob | null>(null);
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

  // ---- Images ----

  // Pick an image file, keep it in "My images", and (optionally) put it on the page.
  const importImage = async (addToPage: boolean) => {
    const file = await pickFile("image/*");
    if (!file) return;
    const { src, ratio } = await readImageFile(file);
    const asset: Asset = { id: `user-${newId()}`, name: file.name.replace(/\.[^.]+$/, ""), kind: "image", subjects: "all", cycles: ALL_CYCLES, src, ratio };
    const next = [asset, ...userAssets];
    setUserAssets(next);
    if (!saveUserAssets(next)) notify("Library storage is full — the image is only kept in this exam");
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
      case "block":
        exam.addBlock(action.type, action.preset, at);
        setTab("properties");
        break;
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
    const fields = editRegions(block, numbers.get(block.id) ?? 1, doc.meta.lang).map((r) => r.field);
    const i = fields.findIndex((f) => fieldKey(f) === fieldKey(editing.field));
    const next = fields[(i + (back ? -1 : 1) + fields.length) % fields.length];
    if (next) setEditing({ id: block.id, field: next });
  };

  // Finished typing. A new text from the T tool that stayed empty is removed.
  const editDone = (id: string) => {
    const block = doc.blocks.find((b) => b.id === id);
    if (editing?.id === id && editing.created && block && !fieldValue(block, editing.field).trim()) exam.deleteBlock(id);
    setEditing((cur) => (cur?.id === id ? null : cur));
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
      if (ok) notify("Exam saved");
    } catch (e) {
      notify(`Could not save: ${String(e)}`);
    }
  };

  const open = async () => {
    const file = await pickFile(".json,application/json");
    if (!file) return;
    const opened = parseExamFile(await file.text());
    if (!opened) return notify("This file is not an Exam Builder file");
    exam.replaceDoc(opened);
    setEditing(null);
    setSession((s) => s + 1);
    notify(`Opened “${opened.meta.title}”`);
  };

  // Draw a clean copy off-screen, then turn each page into a PDF page.
  const exportPdf = async (which: ViewMode | "both") => {
    if (busy) return;
    setBusy(true);
    try {
      const srcs = doc.blocks.flatMap((b) => (b.type === "image" ? [b.src] : b.type === "equation" && b.svg ? [svgUrl(b.svg)] : []));
      await preloadImages(srcs);
      const modes: ViewMode[] = which === "both" ? ["exam", "key"] : [which];
      for (const m of modes) {
        const stage = await new Promise<Konva.Stage>((resolve) => setExportJob({ doc, mode: m, resolve }));
        const bytes = await stageToPdf(stage, doc.pages.length);
        setExportJob(null);
        const name = `${fileName(doc.meta.title)}${m === "key" ? " - correction" : ""}.pdf`;
        if (await saveFile(bytes, name, { name: "PDF", extensions: ["pdf"] })) {
          notify(m === "key" ? "Correction sheet exported" : "Exam exported");
        }
      }
    } catch (e) {
      notify(`Export failed: ${String(e)}`);
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
      if (typing || picker.open) return;

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
    <div className="flex h-screen flex-col bg-canvas">
      <TopBar
        subject={subject}
        onSubjectChange={setSubject}
        title={doc.meta.title}
        onTitleChange={(title) => exam.setMeta({ title }, "title")}
        mode={mode}
        onModeChange={setMode}
        canUndo={exam.canUndo}
        canRedo={exam.canRedo}
        onUndo={exam.undo}
        onRedo={exam.redo}
        onNew={() => setPicker({ open: true, mustPick: false })}
        onOpen={() => void open()}
        onSave={() => void save()}
        onExport={(w) => void exportPdf(w)}
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
            onEditDone={editDone}
            onCreateText={createText}
            onSelect={select}
            onMove={exam.moveBlock}
            onResize={(id, layout) => exam.updateBlock(id, { layout })}
            onAddPage={exam.addPage}
            onDeletePage={exam.deletePage}
            onActivePageChange={exam.setActivePage}
            onDropItem={runTool}
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
            exam.newFromTemplate(t);
            setEditing(null);
            setSession((s) => s + 1);
            setPicker({ open: false, mustPick: false });
          }}
        />
      )}

      {exportJob && <ExportRenderer key={exportJob.mode} doc={exportJob.doc} mode={exportJob.mode} onReady={exportJob.resolve} />}

      {toast && (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-slate-900/90 px-4 py-2 text-xs font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
