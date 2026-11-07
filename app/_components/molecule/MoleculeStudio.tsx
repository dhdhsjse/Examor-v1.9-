"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Redo2, Search, Shapes, Undo2, X } from "lucide-react";
import { Notice, control } from "@/app/_components/graph-studio/fields";
import { StudioKeyboard, StudioKeyboardButton } from "@/app/_components/math-keyboard/StudioKeyboard";
import { useUi } from "@/app/_lib/uiLang";
import { buildBlock } from "@/app/_molecule/block";
import { displayFormula, formula as hillFormulaOf } from "@/app/_molecule/chem";
import { moveAtoms } from "@/app/_molecule/edit/ops";
import { applyVisibility, changedParts, removeSelected } from "@/app/_molecule/edit/selectionOps";
import { emptySelection, isEmpty } from "@/app/_molecule/edit/select";
import type { ChemEngine } from "@/app/_molecule/engine/ChemEngine";
import { hasIsomerTable } from "@/app/_molecule/isomers/load";
import type { IsomerEntry } from "@/app/_molecule/isomers/types";
import type { MoleculeBlockData, RenderOptions, Visibility } from "@/app/_molecule/model";
import { entryName, type DbEntry } from "@/app/_molecule/resolve/database";
import { detectKind, formulaReadings } from "@/app/_molecule/resolve/normalize";
import { type Candidate, type ResolveResult, fromEntry, resolve } from "@/app/_molecule/resolve/resolve";
import { availableRepresentations, renderMolecule } from "@/app/_molecule/render";
import { cramCenters } from "@/app/_molecule/render/cram";
import { layoutPositions } from "@/app/_molecule/render/structural";
import CanvasBar from "./CanvasBar";
import EditCanvas from "./EditCanvas";
import InsertBar from "./InsertBar";
import IsomerGallery from "./IsomerGallery";
import MoleculeBrowser from "./MoleculeBrowser";
import RepresentationBar from "./RepresentationBar";
import SelectionToolbar from "./SelectionToolbar";
import Welcome from "./Welcome";
import DisplayTab from "./tabs/DisplayTab";
import EditTab from "./tabs/EditTab";
import GeometryTab from "./tabs/GeometryTab";
import { EDITABLE, FIXED_LAYOUT } from "./layoutRules";
import { useChemEngine } from "./useChemEngine";
import { useMoleculeEditor } from "./useMoleculeEditor";
import { ActionButton, Formula } from "./ui";
import { studioHeaderProps } from "@/app/_lib/desktopWindow";

interface Props {
  editing: MoleculeBlockData | null; // the molecule of the block being edited (null = a new one)
  onInsert: (molecule: MoleculeBlockData) => void;
  onUpdate: (molecule: MoleculeBlockData) => void;
  onInsertText: (text: string) => void;
  onClose: () => void;
}

// Reads a candidate into block data. The source records what the teacher typed (name, formula, SMILES, molfile).
async function loadCandidate(engine: ChemEngine, c: Candidate, typed: string, lang: RenderOptions["lang"]): Promise<MoleculeBlockData> {
  const kind = c.molfile ? "molfile" : c.source === "direct" ? "smiles" : detectKind(typed) === "formula" || formulaReadings(typed).length ? "formula" : "name";
  return buildBlock(engine, c, { kind, input: c.molfile ? "" : typed, lang }, lang);
}

const TIP_KEY = "examor.moleculeStudio.tipSeen";
const readTip = () => {
  try {
    return localStorage.getItem(TIP_KEY) === "1";
  } catch {
    return false;
  }
};

// The Molecule Studio: find a molecule, choose how it is drawn, hide or blank parts of it for the exercise, put it on the page.
// Chemistry lives in app/_molecule (no React there); this file only arranges the screen and the flow.
export default function MoleculeStudio({ editing, onInsert, onUpdate, onInsertText, onClose }: Props) {
  const { t, lang } = useUi();
  const chem = useChemEngine();
  const editor = useMoleculeEditor(editing);
  const { block, selection } = editor;
  const [query, setQuery] = useState(editing?.source.kind === "name" ? editing.source.input : (editing?.source.input ?? ""));
  const [typed, setTyped] = useState<string | null>(null); // what the teacher typed and not yet looked up
  const [title, setTitle] = useState<string | null>(editing?.source.kind === "name" ? editing.source.input : null);
  const [result, setResult] = useState<ResolveResult | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [failure, setFailure] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [editReveal, setEditReveal] = useState(0); // brings the Edit section in sight (it opens when this changes)
  const [tipSeen, setTipSeen] = useState(readTip);
  const searchRef = useRef<HTMLInputElement>(null);
  const labelInput = useRef<HTMLInputElement>(null);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => searchRef.current?.focus(), []);

  const ready = chem.status === "ready";
  const editable = !!block && EDITABLE.includes(block.representation);
  const changed = block ? changedParts(block) : 0;

  const setVisibility = (v: Visibility) => editor.apply((b) => applyVisibility(b, selection, v), "visibility");
  const removeSelection = () => {
    editor.apply((b) => removeSelected(b, selection));
    editor.setSelection(emptySelection());
  };

  // Keyboard: Delete removes, H / B / S hide, blank, show; Ctrl+Z / Ctrl+Y undo and redo; Esc clears, then closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (galleryOpen) return; // the isomer gallery has the keyboard
      if (key === "escape") {
        if (!typing && !isEmpty(selection)) editor.setSelection(emptySelection());
        else onClose();
        return;
      }
      if (typing) return;
      if (mod && (key === "z" || key === "y")) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) editor.redo();
        else editor.undo();
        return;
      }
      if (mod || !editable || isEmpty(selection)) return;
      if (key === "delete" || key === "backspace") {
        e.preventDefault();
        removeSelection();
      } else if (key === "h" || key === "b" || key === "s") {
        setVisibility(key === "h" ? "hidden" : key === "b" ? "blank" : "shown");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, selection, editable, onClose, galleryOpen]);

  const search = (text: string) => {
    setQuery(text);
    setTyped(text);
  };

  // Look up what was typed (after a short pause); the best match is shown straight away.
  useEffect(() => {
    const text = typed?.trim();
    if (!ready || !text) return;
    let alive = true;
    const timer = setTimeout(() => {
      resolve(text, { lang, engine: chem.engine })
        .then(async (r) => {
          if (!alive) return;
          setResult(r);
          setFailure(null);
          if (!r.candidates.length) return;
          const best = r.candidates[0];
          const b = await loadCandidate(chem.engine, best, text, lang);
          if (alive) {
            editor.load(b, true);
            setPicked(best.id);
            setTitle(best.names[lang] ?? best.names.en ?? null);
          }
        })
        .catch((e: unknown) => alive && setFailure(e instanceof Error ? e.message : String(e)));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, ready, lang, chem.engine]);

  const open = async (c: Candidate, typedText: string) => {
    try {
      const b = await loadCandidate(chem.engine, c, typedText, lang);
      editor.load(b, true);
      setPicked(c.id);
      setTitle(c.names[lang] ?? c.names.en ?? null);
      setFailure(null);
    } catch (e) {
      setFailure((e as Error).message);
    }
  };
  const pickCandidate = (c: Candidate) => void open(c, query.trim());
  // A molecule chosen in the browser or on the welcome screen: its name goes in the search box (without searching).
  const pickEntry = (e: DbEntry) => {
    const name = entryName(e, lang);
    setQuery(name);
    void open(fromEntry(e), name);
  };
  // An isomer chosen in the gallery becomes the molecule being edited (the representation and options are kept).
  const pickIsomer = async (e: IsomerEntry) => {
    try {
      const c: Candidate = { id: `isomer:${e.smiles}`, smiles: e.smiles, formula: block ? hillFormulaOf(block.graph) : "", names: { ar: e.name?.ar, fr: e.name?.fr, en: e.name?.en }, source: "isomer-table", rank: 0 };
      const b = await buildBlock(chem.engine, c, { kind: "smiles", input: e.smiles }, lang);
      editor.load(b, true);
      setPicked(c.id);
      setTitle(e.name?.[lang] ?? e.name?.en ?? null);
      setQuery(e.name?.[lang] ?? e.name?.en ?? e.smiles);
      setFailure(null);
      setGalleryOpen(false);
    } catch (err) {
      setFailure((err as Error).message);
    }
  };

  // The editor view draws what the student version hides, faded, so that it can be selected again.
  const rendered = useMemo(() => (block ? renderMolecule(block, { ghost: editable }) : null), [block, editable]);
  const positions = () => {
    if (!block) return {};
    const out: Record<string, { x: number; y: number }> = {};
    for (const [id, p] of layoutPositions(block).pos) out[id] = p;
    return out;
  };

  // Cram: click an atom to draw it in perspective, click it again to draw it flat.
  const toggleCenter = (id: string) => {
    if (!block) return;
    const now = cramCenters(block);
    editor.setCenters(now.includes(id) ? now.filter((c) => c !== id) : [...now, id]);
  };

  const warn =
    rendered?.warning === "school-layout-unavailable"
      ? t("The school layout cannot place this molecule: the automatic layout is shown.")
      : rendered?.warning === "ring"
        ? t("Semi-structural formula of rings: not supported yet")
        : rendered?.warning === "pieces"
          ? t("Not a single molecule")
          : null;

  const message = (() => {
    if (chem.status === "loading") return t("Loading the chemistry engine…");
    if (chem.status === "error") return t("Could not load the chemistry engine: {error}", { error: chem.error });
    if (failure) return failure;
    if (result && !result.candidates.length) {
      return result.error === "noFormulaMatch" ? t("No molecule of the database has the formula {formula}.", { formula: query.trim() }) : t("No molecule found. Try a name, a formula such as C2H4O2, or SMILES.");
    }
    return null;
  })();

  // The canonical SMILES follows the structural edits; it is what the page keeps for searching and reloading.
  const finalized = async (m: MoleculeBlockData): Promise<MoleculeBlockData> => {
    try {
      return { ...m, smiles: await chem.engine.toSmiles(m.graph) };
    } catch {
      return m;
    }
  };
  // The page gets the drawing as prepared: what was hidden stays hidden, blanks stay blank.
  const prepared = async (b: MoleculeBlockData): Promise<MoleculeBlockData> => ({ ...(await finalized(b)), exerciseMode: changed > 0 ? "student" : "answer" });
  const submit = async () => {
    if (block) onInsert(await prepared(block));
  };
  const update = async () => {
    if (block) onUpdate(await prepared(block));
  };

  const dismissTip = () => {
    setTipSeen(true);
    try {
      localStorage.setItem(TIP_KEY, "1");
    } catch {
      // the tip comes back next time, which is harmless
    }
  };
  const showTip = !!block && editable && !tipSeen && isEmpty(selection);
  const header = studioHeaderProps();
  const iconButton = "grid size-7 shrink-0 place-items-center rounded text-muted enabled:hover:bg-hover enabled:hover:text-ink disabled:opacity-40";

  // Full screen like the other Studios: the header has the search, how the molecule is drawn, the isomers and Insert; the molecules to
  // browse are on the left, the drawing in the middle (with its floating bar), and what can be changed on the right, one section each.
  return (
    <div data-testid="molecule-studio" className="fixed inset-0 z-50 flex flex-col bg-white">
      <header {...header} className={`${header.className} gap-2! py-1.5!`}>
        <h2 className="shrink-0 text-sm font-semibold text-ink">{t("Molecule Studio")}</h2>
        <div className="mx-1 h-5 w-px bg-line" />
        <button onClick={editor.undo} disabled={!editor.canUndo} title={`${t("Undo")} (Ctrl+Z)`} aria-label={t("Undo")} data-testid="undo" className={iconButton}>
          <Undo2 size={15} />
        </button>
        <button onClick={editor.redo} disabled={!editor.canRedo} title={`${t("Redo")} (Ctrl+Y)`} aria-label={t("Redo")} data-testid="redo" className={iconButton}>
          <Redo2 size={15} />
        </button>

        <div className="relative mx-1 w-full max-w-md min-w-40">
          <Search size={14} aria-hidden className="pointer-events-none absolute start-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => search(e.target.value)}
            placeholder={t("Name, formula (C2H4O2) or SMILES")}
            aria-label={t("Search a molecule")}
            dir="auto"
            data-testid="molecule-search"
            className={`${control} h-7 w-full ps-8 pe-7 bg-subtle! focus:bg-white!`}
            style={{ userSelect: "text" }}
          />
          {query && (
            <button onClick={() => (setQuery(""), setTyped(null), searchRef.current?.focus())} aria-label={t("Clear the search")} title={t("Clear the search")} className="absolute end-1 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted hover:bg-hover hover:text-ink">
              <X size={13} />
            </button>
          )}
        </div>

        <div className="ms-auto flex shrink-0 items-center gap-2">
          {block && (
            <>
              <RepresentationBar representations={availableRepresentations()} value={block.representation} disabled={false} onChange={editor.setRepresentation} />
              <ActionButton icon={<Shapes size={14} />} label={t("Isomers")} hint={t("Browse the isomers of this formula")} onClick={() => setGalleryOpen(true)} disabled={!hasIsomerTable(hillFormulaOf(block.graph))} testId="isomers" />
            </>
          )}
          <InsertBar ready={!!block} editing={!!editing} onInsert={() => void submit()} onUpdate={() => void update()} />
          <StudioKeyboardButton />
          <button onClick={onClose} className="grid size-7 shrink-0 place-items-center rounded text-muted hover:bg-hover hover:text-ink" title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
            <X size={16} />
          </button>
        </div>
      </header>

      <div className={`grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)] ${block ? "grid-cols-[232px_minmax(0,1fr)_256px]" : "grid-cols-[232px_minmax(0,1fr)]"}`}>
        <aside className="min-h-0 overflow-hidden border-line bg-white ltr:border-r rtl:border-l">
          <MoleculeBrowser candidates={result?.candidates ?? []} message={message} picked={picked} onPickCandidate={pickCandidate} onPickEntry={pickEntry} />
        </aside>

        <main className={`relative flex min-h-0 min-w-0 flex-col ${block ? "bg-subtle" : "bg-white"}`}>
          {block ? (
            <div ref={stage} className="relative min-h-0 flex-1" aria-label={t("Print preview of the drawing")}>
              {rendered && (
                <EditCanvas
                  svg={rendered.svg}
                  selection={selection}
                  onSelection={editor.setSelection}
                  zoom={zoom}
                  editable={editable}
                  movable={!FIXED_LAYOUT.includes(block.representation)}
                  unit={block.options.bondLength}
                  positions={positions}
                  onMove={(to) => editor.apply((b) => moveAtoms(b, to), "drag")}
                />
              )}
              {/* (a small note over the corner: how to hide a part, until the teacher says they know; why the drawing is not the usual one) */}
              {(showTip || warn) && (
                <div className="pointer-events-none absolute start-3 top-3 z-10 flex max-w-[min(30rem,calc(100%-1.5rem))] flex-col items-start gap-1.5">
                  {showTip && (
                    <p role="note" data-testid="molecule-tip" className="pointer-events-auto flex items-start gap-1.5 rounded-md border border-line bg-surface/95 py-1 ps-2 pe-1 text-xs leading-snug text-muted shadow-sm">
                      <span>{t("Tip: click an atom or a bond, then use the bar that appears to hide it or leave it blank.")}</span>
                      <button onClick={dismissTip} aria-label={t("Got it")} title={t("Got it")} className="grid size-4 shrink-0 place-items-center rounded text-faint hover:bg-hover hover:text-ink">
                        <X size={11} />
                      </button>
                    </p>
                  )}
                  {warn && <Notice testId="molecule-warning">{warn}</Notice>}
                </div>
              )}
              {editable && (
                <SelectionToolbar
                  container={stage}
                  selection={selection}
                  version={`${zoom}|${rendered?.svg.length}|${block.representation}`}
                  onVisibility={setVisibility}
                  onLabel={() => {
                    setEditReveal((n) => n + 1);
                    setTimeout(() => labelInput.current?.focus(), 60);
                  }}
                  onRemove={removeSelection}
                />
              )}
              <CanvasBar graph={block.graph} selection={selection} setSelection={editor.setSelection} editable={editable} zoom={zoom} setZoom={setZoom} />
            </div>
          ) : (
            <Welcome engine={ready ? chem.engine : null} onPick={pickEntry} />
          )}
        </main>

        {block && (
          <aside className="min-h-0 overflow-y-auto border-line bg-white ltr:border-l rtl:border-r" data-testid="molecule-panel">
            <div className="border-b border-line/70 px-4 py-3">
              {title && <p className="truncate text-[13px] font-semibold text-ink">{title}</p>}
              <p className="text-xs text-muted">
                <Formula text={displayFormula(block.graph)} /> · {t("{n} atoms", { n: block.graph.atoms.length })}
              </p>
            </div>
            <DisplayTab block={block} editor={editor} />
            {editable ? (
              <>
                <EditTab block={block} editor={editor} labelInput={labelInput} reveal={editReveal ? String(editReveal) : null} />
                <GeometryTab block={block} selection={selection} onInsertText={onInsertText} onToggleCenter={toggleCenter} />
              </>
            ) : (
              <p className="px-4 py-3 text-xs text-muted">{t("Choose Developed, Skeletal, Lewis or Cram to use this")}</p>
            )}
          </aside>
        )}
      </div>

      {galleryOpen && block && <IsomerGallery engine={chem.engine} formula={hillFormulaOf(block.graph)} smiles={block.smiles} graph={block.graph} onPick={(e) => void pickIsomer(e)} onClose={() => setGalleryOpen(false)} />}
      <StudioKeyboard />
    </div>
  );
}
