"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PAGE_HEIGHT, PAGE_MARGIN, PAGE_WIDTH } from "./a4";
import { blockHeight } from "./blockLayout";
import { blockHeights, createBlock, nextFreeY, type BlockPreset } from "./blocks";
import { newId } from "./id";
import { renderEquation, type RenderedEquation } from "./math";
import { saveAutosave } from "./storage";
import { buildDoc, type Template } from "./templates";
import type { Block, BlockData, BlockLayout, BlockType, EquationBlock, ExamDoc, ExamMeta } from "./types";

// Ask the workspace to scroll to a page (n changes on every request).
export interface RevealRequest {
  pageId: string;
  n: number;
}

// A change to a block. `layout` can be partial.
export type BlockPatch = BlockData & { layout?: Partial<BlockLayout> };

interface History {
  past: ExamDoc[];
  present: ExamDoc;
  future: ExamDoc[];
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

// New svg + size for an equation, keeping its current zoom (pixels per "ex").
export function equationPatch(b: EquationBlock, r: RenderedEquation): BlockPatch {
  const pxPerEx = b.layout.height / Math.max(0.1, b.exH);
  return { ...r, layout: { width: r.exW * pxPerEx, height: r.exH * pxPerEx } } as BlockPatch;
}

// All exam data + every action that changes it (with undo/redo and autosave).
export function useExam(initial: ExamDoc) {
  const [hist, setHist] = useState<History>({ past: [], present: initial, future: [] });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState(0); // page currently in view
  const [reveal, setReveal] = useState<RevealRequest | null>(null);
  const lastEdit = useRef<{ key: string; time: number } | null>(null);
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

  // Autosave shortly after each change.
  useEffect(() => {
    const t = setTimeout(() => saveAutosave(doc), 400);
    return () => clearTimeout(t);
  }, [doc]);

  const updateBlock = useCallback(
    (id: string, patch: BlockPatch, opts?: { key?: string; silent?: boolean }) => {
      commit(
        (d) => ({
          ...d,
          blocks: d.blocks.map((b) => (b.id === id ? ({ ...b, ...patch, layout: { ...b.layout, ...patch.layout } } as Block) : b)),
        }),
        opts,
      );
    },
    [commit],
  );

  // Draw the equation with MathJax, then store the svg (no undo step).
  const refreshEquation = useCallback(
    (b: EquationBlock, latex = b.latex) => {
      renderEquation(latex)
        .then((r) => updateBlock(b.id, equationPatch(b, r), { silent: true }))
        .catch(() => {});
    },
    [updateBlock],
  );

  // Add a block. With `at`: dropped at that spot. Without: stacked on the page in view,
  // or the next page with room, or a new page.
  const addBlock = useCallback(
    (type: BlockType, preset: BlockPreset = {}, at?: { pageIndex: number; x: number; y: number }) => {
      const lang = doc.meta.lang;
      const block = createBlock(type, lang, "", preset);
      const h = blockHeight(block, 1, lang);
      const w = block.layout.width;
      let pages = doc.pages;

      if (at) {
        const page = pages[clamp(at.pageIndex, 0, pages.length - 1)];
        block.layout = {
          ...block.layout,
          pageId: page.id,
          x: clamp(at.x - w / 2, 0, PAGE_WIDTH - w),
          y: clamp(at.y - Math.min(h, 40) / 2, 0, PAGE_HEIGHT - h),
        };
      } else {
        const heights = blockHeights(doc);
        let target: { pageId: string; y: number } | null = null;
        for (let i = clamp(activePage, 0, pages.length - 1); i < pages.length && !target; i++) {
          const y = nextFreeY(doc.blocks.filter((b) => b.layout.pageId === pages[i].id), heights);
          if (y + h <= PAGE_HEIGHT - PAGE_MARGIN) target = { pageId: pages[i].id, y };
        }
        if (!target) {
          const page = { id: newId() };
          pages = [...pages, page];
          target = { pageId: page.id, y: PAGE_MARGIN };
        }
        // Narrow blocks (images, equations) are centered; the rest use the margin.
        const x = w < PAGE_WIDTH - PAGE_MARGIN * 2 - 1 ? (PAGE_WIDTH - w) / 2 : PAGE_MARGIN;
        block.layout = { ...block.layout, ...target, x };
      }

      commit((d) => ({ ...d, pages, blocks: [...d.blocks, block] }));
      setSelectedId(block.id);
      revealPage(block.layout.pageId);
      if (block.type === "equation") refreshEquation(block);
      return block;
    },
    [doc, activePage, commit, refreshEquation],
  );

  const moveBlock = useCallback(
    (id: string, pageId: string, x: number, y: number) => updateBlock(id, { layout: { pageId, x, y } }),
    [updateBlock],
  );

  const deleteBlock = useCallback(
    (id: string) => {
      commit((d) => ({ ...d, blocks: d.blocks.filter((b) => b.id !== id) }));
      setSelectedId(null);
    },
    [commit],
  );

  const duplicateBlock = useCallback(
    (id: string) => {
      const src = doc.blocks.find((b) => b.id === id);
      if (!src) return;
      const h = blockHeights(doc).get(id) ?? 0;
      const copy = {
        ...structuredClone(src),
        id: newId(),
        layout: { ...src.layout, y: clamp(src.layout.y + 24, 0, PAGE_HEIGHT - h), x: clamp(src.layout.x + 12, 0, PAGE_WIDTH - src.layout.width) },
      } as Block;
      commit((d) => ({ ...d, blocks: [...d.blocks, copy] }));
      setSelectedId(copy.id);
    },
    [doc, commit],
  );

  const addPage = useCallback(() => {
    const page = { id: newId() };
    commit((d) => ({ ...d, pages: [...d.pages, page] }));
    revealPage(page.id);
  }, [commit]);

  // Remove a page and everything on it (the last page can't be removed).
  const deletePage = useCallback(
    (pageId: string) => {
      commit((d) =>
        d.pages.length <= 1
          ? d
          : { ...d, pages: d.pages.filter((p) => p.id !== pageId), blocks: d.blocks.filter((b) => b.layout.pageId !== pageId) },
      );
      setActivePage((i) => Math.max(0, i - 1));
    },
    [commit],
  );

  const setMeta = useCallback(
    (patch: Partial<ExamMeta>, key?: string) => commit((d) => ({ ...d, meta: { ...d.meta, ...patch } }), { key }),
    [commit],
  );

  // Replace the exam (new template or opened file). Undo can bring the old one back.
  const replaceDoc = useCallback(
    (next: ExamDoc) => {
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
    canUndo: hist.past.length > 0,
    canRedo: hist.future.length > 0,
    undo,
    redo,
    addBlock,
    updateBlock,
    refreshEquation,
    moveBlock,
    deleteBlock,
    duplicateBlock,
    addPage,
    deletePage,
    setMeta,
    replaceDoc,
    newFromTemplate,
  };
}

export type ExamStore = ReturnType<typeof useExam>;
