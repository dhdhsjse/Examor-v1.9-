"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_MARGINS, PAGE_MARGIN } from "./a4";
import { blockHeight } from "./blockLayout";
import { blockHeights, createBlock, nextFreeY, pageBottom, pushDownOverlaps, type BlockPreset } from "./blocks";
import { newId } from "./id";
import { renderEquation, type RenderedEquation } from "./math";
import { pageSize } from "./pageFormats";
import {
  CHROME_KINDS,
  adoptHeader as adoptHeaderBlock,
  adoptHeaders,
  chromeEdit,
  chromeScope as setChromeScope,
  deleteChrome,
  editChromeData,
  pageChromeBlocks,
  setChrome as setPageChrome,
  syncChrome,
  type ChromeKind,
} from "./pageChrome";
import { saveAutosave } from "./storage";
import { buildDoc, type Template } from "./templates";
import type { Block, BlockData, BlockLayout, BlockType, EquationBlock, ExamDoc, ExamMeta, HeaderBlock, HeaderFooterConfig, Page, PageFormat, PageMargins } from "./types";
import type { T } from "./uiLang";

// Ask the workspace to scroll to a page (n changes on every request).
export interface RevealRequest {
  pageId: string;
  n: number;
}

// Where to put a new block. `corner` = (x, y) is its top-left corner instead of its center.
export interface DropPoint {
  pageIndex: number;
  x: number;
  y: number;
  corner?: boolean;
}

// A change to a block. `layout` can be partial.
export type BlockPatch = BlockData & { layout?: Partial<BlockLayout> };

// Autosave state shown in the top bar.
export type SaveState = { status: "saved" | "saving" | "error"; at: number | null };

interface History {
  past: ExamDoc[];
  present: ExamDoc;
  future: ExamDoc[];
}

// A new empty page with the same margins as the last one.
// A new page with the margins and paper format of the last one.
const newPageLike = (pages: Page[]): Page => {
  const last = pages[pages.length - 1];
  return { id: newId(), ...(last?.margins ? { margins: last.margins } : {}), ...(last?.format ? { format: last.format } : {}) };
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

// New svg + size for an equation, keeping its current zoom (pixels per "ex").
export function equationPatch(b: EquationBlock, r: RenderedEquation): BlockPatch {
  const pxPerEx = b.layout.height / Math.max(0.1, b.exH);
  return { ...r, layout: { width: r.exW * pxPerEx, height: r.exH * pxPerEx } } as BlockPatch;
}

// All exam data + every action that changes it (with undo/redo and autosave).
export function useExam(initial: ExamDoc, t?: T) {
  // Latest translator, for the header/footer text of pages added later.
  const tRef = useRef<T | undefined>(t);
  useEffect(() => {
    tRef.current = t;
  });
  // Exam headers that are plain blocks become their page's header settings (see adoptHeaders).
  const [hist, setHist] = useState<History>(() => ({ past: [], present: adoptHeaders(initial), future: [] }));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0); // page currently in view
  const [reveal, setReveal] = useState<RevealRequest | null>(null);
  const lastEdit = useRef<{ key: string; time: number } | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "saved", at: null });
  const doc = hist.present;

  const revealPage = (pageId: string) => setReveal((r) => ({ pageId, n: (r?.n ?? 0) + 1 }));

  // Apply a change. Edits with the same `key` within 1s become ONE undo step (typing).
  // `silent` changes never create an undo step (e.g. equation re-render).
  const commit = useCallback((update: (d: ExamDoc) => ExamDoc, opts: { key?: string; silent?: boolean } = {}) => {
    const now = Date.now();
    const last = lastEdit.current;
    const merge = opts.silent || (opts.key !== undefined && last?.key === opts.key && now - last.time < 1000);
    if (!opts.silent) lastEdit.current = opts.key ? { key: opts.key, time: now } : null;
    setHist((h) => {
      const next = update(h.present);
      if (next === h.present) return h;
      if (merge) return { ...h, present: next };
      return { past: [...h.past.slice(-99), h.present], present: next, future: [] };
    });
  }, []);

  const undo = useCallback(() => {
    setHist((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h));
  }, []);
  const redo = useCallback(() => {
    setHist((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  }, []);

  // Autosave shortly after each change (the top bar shows "Saving…" then "Saved ✓").
  // Compared with what was saved last (not with the opened exam): undoing back to it must be saved too.
  const savedDoc = useRef(doc);
  useEffect(() => {
    if (doc === savedDoc.current) return; // nothing new to save
    const pending = setTimeout(() => setSave((s) => (s.status === "saving" ? s : { ...s, status: "saving" })), 0);
    const t = setTimeout(() => {
      const ok = saveAutosave(doc);
      if (ok) savedDoc.current = doc;
      setSave({ status: ok ? "saved" : "error", at: Date.now() });
    }, 400);
    return () => {
      clearTimeout(pending);
      clearTimeout(t);
    };
  }, [doc]);

  const updateBlock = useCallback(
    (id: string, patch: BlockPatch, opts?: { key?: string; silent?: boolean }) => {
      commit((d) => {
        // A page's header/footer is drawn from its settings (Page layout → Header and footer): what is
        // typed or styled on it changes them.
        const chrome = tRef.current ? chromeEdit(d, id, patch as Record<string, unknown>, tRef.current) : null;
        if (chrome) return chrome;
        return { ...d, blocks: d.blocks.map((b) => (b.id === id ? ({ ...b, ...patch, layout: { ...b.layout, ...patch.layout } } as Block) : b)) };
      }, opts);
    },
    [commit],
  );

  // Change several blocks in one undo step (Find and replace → Replace all).
  const updateBlocks = useCallback(
    (changes: { id: string; patch: BlockPatch }[]) => {
      if (!changes.length) return;
      const by = new Map(changes.map((c) => [c.id, c.patch]));
      commit((d) => ({ ...d, blocks: d.blocks.map((b) => (by.has(b.id) ? ({ ...b, ...by.get(b.id), layout: { ...b.layout, ...by.get(b.id)?.layout } } as Block) : b)) }));
    },
    [commit],
  );

  // Draw the equation with MathJax, then store the svg (no undo step).
  const refreshEquation = useCallback(
    (b: EquationBlock, latex = b.latex) => {
      renderEquation(latex)
        .then((r) => updateBlock(b.id, equationPatch(b, r), { silent: true }))
        .catch((e) => console.error("Equation drawing failed:", String(e), e?.stack));
    },
    [updateBlock],
  );

  // Add a block. With `at`: dropped at that spot. Without: stacked on the page in view,
  // or the next page with room, or a new page.
  const addBlock = useCallback(
    (type: BlockType, preset: BlockPreset = {}, at?: DropPoint) => {
      const lang = doc.meta.lang;
      const block = createBlock(type, lang, "", preset);
      const h = blockHeight(block, 1, doc.meta);
      const w = block.layout.width;
      let pages = doc.pages;
      let chrome: Block[] = [];
      // Header/footer blocks of a page created here follow the exam's rule.
      const chromeFor = (d: ExamDoc, i: number) => (tRef.current ? pageChromeBlocks(d, i, tRef.current) : []);

      if (at) {
        const page = pages[clamp(at.pageIndex, 0, pages.length - 1)];
        const size = pageSize(page);
        block.layout = {
          ...block.layout,
          pageId: page.id,
          x: clamp(at.corner ? at.x : at.x - w / 2, 0, size.width - w),
          y: clamp(at.corner ? at.y : at.y - Math.min(h, 40) / 2, 0, size.height - h),
        };
      } else {
        const heights = blockHeights(doc);
        let target: { pageId: string; y: number } | null = null;
        let pageIdx = 0;
        for (let i = clamp(activePage, 0, pages.length - 1); i < pages.length && !target; i++) {
          const onPage = doc.blocks.filter((b) => b.layout.pageId === pages[i].id);
          const y = nextFreeY(onPage, heights, pages[i].margins?.top);
          if (y + h <= pageBottom(onPage, pages[i])) {
            target = { pageId: pages[i].id, y };
            pageIdx = i;
          }
        }
        if (!target) {
          const page = newPageLike(pages);
          pages = [...pages, page];
          pageIdx = pages.length - 1;
          chrome = chromeFor({ ...doc, pages }, pageIdx);
          const chromeHeights = new Map(chrome.map((b) => [b.id, blockHeight(b, 1, doc.meta)]));
          target = { pageId: page.id, y: nextFreeY(chrome, chromeHeights, page.margins?.top) };
        }
        // Narrow blocks (images, equations) are centered; the rest use the margin.
        const m = pages[pageIdx].margins;
        const pageWidth = pageSize(pages[pageIdx]).width;
        const left = m?.left ?? PAGE_MARGIN;
        const room = pageWidth - left - (m?.right ?? PAGE_MARGIN);
        const x = w < room - 1 ? (pageWidth - w) / 2 : left;
        block.layout = { ...block.layout, ...target, x, width: Math.min(w, room) };
      }

      // A new page changes "Page 1 of N" on the others.
      commit((d) => {
        const added = { ...d, pages, blocks: [...d.blocks, ...chrome, block] };
        const next = chrome.length && tRef.current && pages.length !== d.pages.length ? syncChrome(d, added, tRef.current, { pageCount: true }) : added;
        // An exam header on a page without one becomes that page's header.
        return block.type === "header" ? adoptHeaders(next) : next;
      });
      setSelectedId(block.id);
      revealPage(block.layout.pageId);
      if (block.type === "equation") refreshEquation(block);
      return block;
    },
    [doc, activePage, commit, refreshEquation],
  );

  // Drop a block somewhere; blocks it lands on are pushed down below it.
  const moveBlock = useCallback(
    (id: string, pageId: string, x: number, y: number) =>
      commit((d) => {
        const moved = { ...d, blocks: d.blocks.map((b) => (b.id === id ? ({ ...b, layout: { ...b.layout, pageId, x, y } } as Block) : b)) };
        const pageHeight = pageSize(d.pages.find((p) => p.id === pageId)).height;
        return { ...moved, blocks: pushDownOverlaps(moved.blocks, id, blockHeights(moved), pageHeight) };
      }),
    [commit],
  );

  const deleteBlock = useCallback(
    (id: string) => {
      // A header/footer goes from its settings: the page's own, or the document's (see deleteChrome).
      commit((d) => (tRef.current && deleteChrome(d, id, tRef.current)) || { ...d, blocks: d.blocks.filter((b) => b.id !== id) });
      setSelectedId((cur) => (cur === id ? null : cur));
    },
    [commit],
  );

  // Put a copy of a block (taken from the clipboard, maybe from another exam) on its own page, or on the page in view when that one
  // is not here; a little aside when another block already is where it was.
  const pasteBlock = useCallback(
    (src: Block) => {
      const page = doc.pages.find((p) => p.id === src.layout.pageId) ?? doc.pages[clamp(activePage, 0, doc.pages.length - 1)];
      if (!page) return;
      const size = pageSize(page);
      const taken = doc.blocks.some((b) => b.layout.pageId === page.id && Math.abs(b.layout.x - src.layout.x) < 1 && Math.abs(b.layout.y - src.layout.y) < 1);
      const copy = {
        ...structuredClone(src),
        id: newId(),
        layout: { ...src.layout, pageId: page.id, x: clamp(src.layout.x + (taken ? 12 : 0), 0, size.width - src.layout.width), y: clamp(src.layout.y + (taken ? 24 : 0), 0, size.height - src.layout.height) },
      } as Block;
      commit((d) => ({ ...d, blocks: [...d.blocks, copy] }));
      setSelectedId(copy.id);
    },
    [doc, activePage, commit],
  );

  const duplicateBlock = useCallback(
    (id: string) => {
      const src = doc.blocks.find((b) => b.id === id);
      if (!src) return;
      const h = blockHeights(doc).get(id) ?? 0;
      const size = pageSize(doc.pages.find((p) => p.id === src.layout.pageId));
      const copy = {
        ...structuredClone(src),
        id: newId(),
        layout: { ...src.layout, y: clamp(src.layout.y + 24, 0, size.height - h), x: clamp(src.layout.x + 12, 0, size.width - src.layout.width) },
      } as Block;
      commit((d) => ({ ...d, blocks: [...d.blocks, copy] }));
      setSelectedId(copy.id);
    },
    [doc, commit],
  );

  const addPage = useCallback(() => {
    const page = newPageLike(doc.pages);
    commit((d) => {
      const pages = [...d.pages, page];
      const next = { ...d, pages };
      if (!tRef.current) return next;
      // The new page gets the document's header and footer; "Page 1 of N" changes on the others.
      const withChrome = { ...next, blocks: [...d.blocks, ...pageChromeBlocks(next, pages.length - 1, tRef.current)] };
      return syncChrome(d, withChrome, tRef.current, { pageCount: true });
    });
    revealPage(page.id);
  }, [commit, doc.pages]);

  // Remove a page and everything on it (the first page, the main one, can't be removed).
  const deletePage = useCallback(
    (pageId: string) => {
      commit((d) => {
        if (d.pages.length <= 1 || d.pages[0].id === pageId) return d;
        const next = { ...d, pages: d.pages.filter((p) => p.id !== pageId), blocks: d.blocks.filter((b) => b.layout.pageId !== pageId) };
        return tRef.current ? syncChrome(d, next, tRef.current, { pageCount: true }) : next;
      });
      setActivePage((i) => Math.max(0, i - 1));
    },
    [commit],
  );

  // Paper size and orientation of one page (Page layout → Page format). Blocks stay where they are, even
  // outside a page that got smaller. Changes with the same `key` (typing a custom size) are one undo step.
  const setPageFormat = useCallback(
    (pageId: string, format: PageFormat, key?: string) =>
      commit(
        (d) => {
          const page = d.pages.find((p) => p.id === pageId);
          if (!page || JSON.stringify(page.format ?? null) === JSON.stringify(format)) return d;
          return { ...d, pages: d.pages.map((p) => (p.id === pageId ? { ...p, format: { ...format } } : p)) };
        },
        { key },
      ),
    [commit],
  );

  // Header or footer of the document (no `pageId`) or of one page (Page layout → Header and footer).
  // `config` undefined: the page follows the document again. Changes with the same `key` (typing) are one undo step.
  const setChrome = useCallback(
    (kind: ChromeKind, config: HeaderFooterConfig | undefined, pageId?: string, key?: string) =>
      commit((d) => (tRef.current ? setPageChrome(d, kind, config, pageId, tRef.current) : d), { key }),
    [commit],
  );

  // Format bar of a header/footer on the page: change the settings it comes from.
  const editChrome = useCallback(
    (blockId: string, fn: (data: Record<string, string>, b: Block) => Record<string, string>, key?: string) =>
      commit((d) => (tRef.current ? editChromeData(d, blockId, fn, tRef.current) : d), { key }),
    [commit],
  );

  // A page's header/footer on every page, or only on this page (its own copy).
  const chromeScope = useCallback(
    (blockId: string, to: "all" | "page") => commit((d) => (tRef.current ? setChromeScope(d, blockId, to, tRef.current) : d)),
    [commit],
  );

  // This exam header block becomes its page's header (the page's other header blocks go).
  const adoptHeader = useCallback((blockId: string) => commit((d) => adoptHeaderBlock(d, blockId)), [commit]);

  // A page drops its own header and footer and shows the document's again (one undo step).
  const resetPageChrome = useCallback(
    (pageId: string) => commit((d) => (tRef.current ? CHROME_KINDS.reduce((doc, kind) => setPageChrome(doc, kind, undefined, pageId, tRef.current!), d) : d)),
    [commit],
  );

  // The same margins on every page (Page layout → Margins), as one undo step. Blocks stay where they are.
  const setMargins = useCallback(
    (m: PageMargins) =>
      commit((d) => {
        const same = (p: Page) => {
          const o = p.margins ?? DEFAULT_MARGINS;
          return o.top === m.top && o.right === m.right && o.bottom === m.bottom && o.left === m.left;
        };
        return d.pages.every(same) ? d : { ...d, pages: d.pages.map((p) => ({ ...p, margins: { ...m } })) };
      }),
    [commit],
  );

  const setMeta = useCallback(
    (patch: Partial<ExamMeta>, key?: string) => commit((d) => ({ ...d, meta: { ...d.meta, ...patch } }), { key }),
    [commit],
  );

  // Replace the exam (new template or opened file). Undo can bring the old one back.
  const replaceDoc = useCallback(
    (incoming: ExamDoc) => {
      const next = adoptHeaders(incoming);
      commit(() => next);
      setSelectedId(null);
      setActivePage(0);
      // Equations from older files may need their drawing.
      next.blocks.forEach((b) => b.type === "equation" && !b.svg && refreshEquation(b));
    },
    [commit, refreshEquation],
  );

  const newFromTemplate = useCallback((t: Template) => replaceDoc(buildDoc(t)), [replaceDoc]);

  return {
    doc,
    selectedId,
    setSelectedId,
    activePage,
    setActivePage,
    reveal,
    save,
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0,
    undo,
    redo,
    addBlock,
    updateBlock,
    updateBlocks,
    revealPage,
    refreshEquation,
    moveBlock,
    deleteBlock,
    duplicateBlock,
    pasteBlock,
    addPage,
    deletePage,
    setMargins,
    setPageFormat,
    setChrome,
    resetPageChrome,
    adoptHeader,
    editChrome,
    chromeScope,
    setMeta,
    replaceDoc,
    newFromTemplate,
  };
}

export type ExamStore = ReturnType<typeof useExam>;
