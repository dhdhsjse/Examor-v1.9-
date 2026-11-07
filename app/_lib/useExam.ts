"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from "react";
import { DEFAULT_MARGINS } from "./a4";
import { blockHeight } from "./blockLayout";
import { reorderBlock, type BlockOrder } from "./blockOrder";
import { blockHeights, createBlock, firstFreeY, nextFreeY, pageBottom, pushDownOverlaps, type BlockPreset } from "./blocks";
import { newId } from "./id";
import { cutStroke, isStroke } from "./ink/eraser";
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
  stretchHeaders,
  syncChrome,
  type ChromeKind,
} from "./pageChrome";
import { withFullMark } from "./examMark";
import { contentBounds } from "./sheet/frame";
import { moveRule } from "./sheet/flow";
import { generateCorrection } from "./sheet/generate";
import { rebuildSheet, syncPoints } from "./sheet/links";
import type { SheetChoice, SheetConfig } from "./sheet/model";
import { createCorrection, dropCorrection, mergeView, partChanged, readCorrection, viewOf, withCorrection, withSheetChrome, type Part } from "./sheet/part";
import { settleSheet } from "./sheet/settle";
import { addTotals } from "./sheet/totals";
import { saveAutosave } from "./storage";
import { moveSlotTo, removeBlock, settleTextboxes, stepSlot } from "./textboxSlots";
import { buildDoc, type Template } from "./templates";
import type { Block, BlockData, BlockLayout, BlockType, EquationBlock, ExamDoc, ExamMeta, HeaderFooterConfig, Page, PageBorder, PageFormat, PageMargins } from "./types";
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
  /** The last change that made a step (its key and when): the next one with the same key soon after goes in the same step */
  last?: { key: string; time: number } | null;
}

// A new empty page with the same margins as the last one.
// A new page with the margins and paper format of the last one.
const newPageLike = (pages: Page[]): Page => {
  const last = pages[pages.length - 1];
  return { id: newId(), ...(last?.margins ? { margins: last.margins } : {}), ...(last?.format ? { format: last.format } : {}), ...(last?.border ? { border: last.border } : {}) };
};

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));

// The meta of a copy of a block: a copy of a block that sits in a text box is a block of the page, no longer in that box.
const looseMeta = (b: Block): Block["meta"] => {
  if (!b.meta?.slot) return b.meta;
  const rest = { ...b.meta };
  delete rest.slot;
  return Object.keys(rest).length ? rest : undefined;
};

// New svg + size for an equation, keeping its current zoom (pixels per "ex").
export function equationPatch(b: EquationBlock, r: RenderedEquation): BlockPatch {
  const pxPerEx = b.layout.height / Math.max(0.1, b.exH);
  return { ...r, layout: { width: r.exW * pxPerEx, height: r.exH * pxPerEx } } as BlockPatch;
}

// A document just read (a file, the autosave, a template): exam headers that are plain blocks become their page's header settings (see
// adoptHeaders), and the settings of its correction sheet that an older version lacks get their usual value.
const prepare = (d: ExamDoc) => readCorrection(adoptHeaders(d));

// All exam data + every action that changes it (with undo/redo and autosave). The history holds the whole file (the exam and its correction sheet);
// the editor works on one of them at a time (`part`): `doc` is that one, as an ordinary document, and every action changes it.
export function useExam(initial: ExamDoc, t?: T) {
  // Latest translator, for the header/footer text of pages added later.
  const tRef = useRef<T | undefined>(t);
  useEffect(() => {
    tRef.current = t;
  });
  const [hist, setHist] = useState<History>(() => ({ past: [], present: prepare(initial), future: [] }));
  const histRef = useRef(hist);
  useEffect(() => {
    histRef.current = hist;
  });
  const [partState, setPartState] = useState<Part>("exam");
  const partRef = useRef<Part>("exam");
  const [selectedId, setSelectedIdRaw] = useState<string | null>(null);
  // Several blocks selected at once (a box dragged over them with the Select tool, or Shift+click): moved and deleted together.
  // Selecting one block (or none) lets go of them.
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const setSelectedId = useCallback((v: SetStateAction<string | null>) => {
    setSelectedIdRaw(v);
    if (typeof v !== "function") setGroupIds([]);
  }, []);
  const selectGroup = useCallback((ids: string[]) => {
    setSelectedIdRaw(null);
    setGroupIds(ids);
  }, []);
  const [activePage, setActivePage] = useState(0); // page currently in view
  const [reveal, setReveal] = useState<RevealRequest | null>(null);
  const [save, setSave] = useState<SaveState>({ status: "saved", at: null });
  const full = hist.present; // the whole file: the exam and its correction sheet
  // The document shown: the correction sheet only while there is one
  const part: Part = partState === "sheet" && full.correction ? "sheet" : "exam";
  const doc = useMemo(() => viewOf(full, part), [full, part]);

  const revealPage = (pageId: string) => setReveal((r) => ({ pageId, n: (r?.n ?? 0) + 1 }));

  // Show the exam or its correction sheet: what was selected (it belongs to the other one) is let go, and the first page is in view.
  const setPart = useCallback(
    (next: Part) => {
      if (partRef.current === next) return;
      partRef.current = next;
      setPartState(next);
      setSelectedIdRaw(null);
      setGroupIds([]);
      setActivePage(0);
    },
    [],
  );

  // Apply a change to the document shown (`whole`: to the whole file, e.g. a new exam). Edits with the same `key` within 1s become ONE undo step
  // (typing). `silent` changes never create an undo step (e.g. equation re-render). A change that changes nothing starts no step: the next one
  // with its key is a step of its own, not a part of the step before (an eraser that first touches nothing, then cuts a stroke).
  const commit = useCallback((update: (d: ExamDoc) => ExamDoc, opts: { key?: string; silent?: boolean; whole?: boolean } = {}) => {
    const now = Date.now();
    const shown: Part = opts.whole ? "exam" : partRef.current;
    setHist((h) => {
      const view = viewOf(h.present, shown);
      // (text boxes with an automatic size follow their text in the same step: typing, a font, a margin…)
      // (and the blocks placed in a text box follow its text; on a correction sheet the stickers and lines follow its frame)
      const changed = settleTextboxes(update(view));
      const next = shown === "sheet" && changed.sheet ? settleSheet(changed) : changed;
      if (next === view) return h;
      const changedFile = mergeView(h.present, next, shown);
      if (changedFile === h.present) return h;
      // (a mark changed on the correction sheet sets the points of its question in the exam, in the same step: the sheet is the one followed)
      const merged = shown === "sheet" ? syncPoints(h.present, changedFile) : changedFile;
      const merge = opts.silent || (opts.key !== undefined && h.last?.key === opts.key && now - h.last.time < 1000);
      const last = opts.silent ? h.last : opts.key ? { key: opts.key, time: now } : null;
      if (merge) return { ...h, present: merged, last };
      return { past: [...h.past.slice(-99), h.present], present: merged, future: [], last };
    });
  }, []);

  // Undo and redo take you to the part they change (the exam or its correction sheet), as a spreadsheet goes to the sheet that changed.
  const undo = useCallback(() => {
    const h = histRef.current;
    if (!h.past.length) return;
    const target = h.past[h.past.length - 1];
    const to = partChanged(h.present, target);
    if (to) setPart(to === "sheet" && !target.correction ? "exam" : to); // (undoing the making of the sheet leaves nothing to show of it)
    setHist((cur) => (cur.past.length ? { past: cur.past.slice(0, -1), present: cur.past[cur.past.length - 1], future: [cur.present, ...cur.future] } : cur));
  }, [setPart]);
  const redo = useCallback(() => {
    const h = histRef.current;
    if (!h.future.length) return;
    const to = partChanged(h.present, h.future[0]);
    if (to) setPart(to === "sheet" && !h.future[0].correction ? "exam" : to);
    setHist((cur) => (cur.future.length ? { past: [...cur.past, cur.present], present: cur.future[0], future: cur.future.slice(1) } : cur));
  }, [setPart]);

  // Autosave shortly after each change (the top bar shows "Saving…" then "Saved ✓").
  // Compared with what was saved last (not with the opened exam): undoing back to it must be saved too.
  const savedDoc = useRef(full);
  useEffect(() => {
    if (full === savedDoc.current) return; // nothing new to save
    const pending = setTimeout(() => setSave((s) => (s.status === "saving" ? s : { ...s, status: "saving" })), 0);
    const t = setTimeout(() => {
      const ok = saveAutosave(full);
      if (ok) savedDoc.current = full;
      setSave({ status: ok ? "saved" : "error", at: Date.now() });
    }, 400);
    return () => {
      clearTimeout(pending);
      clearTimeout(t);
    };
  }, [full]);

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

  // Change several blocks in one undo step (Find and replace → Replace all, the arrow keys on several selected blocks).
  const updateBlocks = useCallback(
    (changes: { id: string; patch: BlockPatch }[], opts?: { key?: string }) => {
      if (!changes.length) return;
      const by = new Map(changes.map((c) => [c.id, c.patch]));
      commit((d) => ({ ...d, blocks: d.blocks.map((b) => (by.has(b.id) ? ({ ...b, ...by.get(b.id), layout: { ...b.layout, ...by.get(b.id)?.layout } } as Block) : b)) }), opts);
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
    // `quiet`: the new block is neither selected nor scrolled to (a stroke of the drawing tools).
    (type: BlockType, preset: BlockPreset = {}, at?: DropPoint, opts: { quiet?: boolean } = {}) => {
      const lang = doc.meta.lang;
      const block = createBlock(type, lang, "", preset);
      const h = blockHeight(block, 1, doc.meta);
      const w = block.layout.width;
      let pages = doc.pages;
      let chrome: Block[] = [];
      // Header/footer blocks of a page created here follow the exam's rule.
      const chromeFor = (d: ExamDoc, i: number) => (tRef.current ? pageChromeBlocks(d, i, tRef.current) : []);

      // The room for text on a page: between its margins, or in the answer column of its frame (a bordered correction sheet)
      const room = (i: number) => contentBounds({ ...doc, pages }, i);
      if (at) {
        const at0 = clamp(at.pageIndex, 0, pages.length - 1);
        const page = pages[at0];
        const size = pageSize(page);
        // Wider than the page's text (a free question): from one margin to the other.
        const bounds = room(at0);
        const left = bounds.left;
        const room0 = bounds.right - bounds.left;
        const fit = w > room0;
        block.layout = {
          ...block.layout,
          pageId: page.id,
          ...(fit ? { width: room0 } : {}),
          x: fit ? left : clamp(at.corner ? at.x : at.x - w / 2, 0, size.width - w),
          y: clamp(at.corner ? at.y : at.y - Math.min(h, 40) / 2, 0, size.height - h),
        };
      } else {
        // Narrow blocks (images, equations) are centered; the rest use the margin.
        const across = (i: number) => {
          const pageWidth = pageSize(pages[i]).width;
          const bounds = room(i);
          const left = bounds.left;
          const width = bounds.right - left;
          // (centered on the page; on a correction sheet, in its answer column)
          return { x: w < width - 1 ? (doc.sheet ? left + (width - w) / 2 : (pageWidth - w) / 2) : left, width: Math.min(w, width) };
        };
        const heights = blockHeights(doc);
        let target: { pageId: string; y: number } | null = null;
        let pageIdx = 0;
        // Under the last block of the page in view (then of the next ones); when there is no room there, in the first gap of that
        // page big enough for it (the top of a page emptied above a block left low on it), before going on to the next page.
        for (let i = clamp(activePage, 0, pages.length - 1); i < pages.length && !target; i++) {
          const onPage = doc.blocks.filter((b) => b.layout.pageId === pages[i].id);
          const bounds = room(i);
          const bottom = Math.min(pageBottom(onPage, pages[i]), bounds.bottom);
          const under = nextFreeY(onPage, heights, bounds.top);
          const { x, width } = across(i);
          const y = under + h <= bottom ? under : firstFreeY(onPage, heights, bounds.top, bottom, h, x, width);
          if (y !== null) {
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
          target = { pageId: page.id, y: nextFreeY(chrome, chromeHeights, room(pageIdx).top) };
        }
        block.layout = { ...block.layout, ...target, ...across(pageIdx) };
      }

      // A new page changes "Page 1 of N" on the others.
      commit((d) => {
        const added = { ...d, pages, blocks: [...d.blocks, ...chrome, block] };
        const next = chrome.length && tRef.current && pages.length !== d.pages.length ? syncChrome(d, added, tRef.current, { pageCount: true }) : added;
        // A mark stamped on the correction sheet: its row gets its total when it now asks for one (one mark with a column of totals, two on free paper)
        if (block.type === "mark" && block.kind === "number" && next.sheet) return addTotals(next, block.id);
        // An exam header on a page without one becomes that page's header.
        return block.type === "header" ? adoptHeaders(next) : next;
      });
      if (!opts.quiet) {
        setSelectedId(block.id);
        revealPage(block.layout.pageId);
      }
      if (block.type === "equation") refreshEquation(block);
      return block;
    },
    [doc, activePage, commit, refreshEquation, setSelectedId],
  );

  // Drop a block somewhere; blocks it lands on are pushed down below it. A block in a text box's text stays in it: it takes its place
  // among the box's paragraphs and blocks where it was dropped (above or below the others).
  const moveBlock = useCallback(
    (id: string, pageId: string, x: number, y: number) =>
      commit((d) => {
        const cur = d.blocks.find((b) => b.id === id);
        if (cur?.meta?.slot && d.blocks.some((b) => b.id === cur.meta?.slot)) {
          const h = blockHeights(d).get(id) ?? 0;
          return moveSlotTo(d, id, y + h / 2);
        }
        // A row line of the correction sheet moved on its page: its row grows or shrinks and the rows under it follow (sheet/flow.ts)
        const ruled = cur?.type === "rule" ? moveRule(d, id, pageId, y) : null;
        if (ruled) return ruled;
        // The block moved goes over the others (saved, so the PDF draws it on top too, as the page shows it).
        const others = d.blocks.filter((b) => b.id !== id).map((b) => b.layout.z ?? 0);
        const top = Math.max(0, ...others);
        const z = (cur?.layout.z ?? 0) > top ? cur!.layout.z : top + 1;
        // (a total of a correction sheet put somewhere by hand stays there: it is no longer kept in the middle of its row)
        const stays = cur?.type === "mark" && cur.kind === "total" && (cur.place ?? "center") !== "free" && Math.abs(y - cur.layout.y) > 0.5 ? { place: "free" as const } : {};
        const moved = { ...d, blocks: d.blocks.map((b) => (b.id === id ? ({ ...b, ...stays, layout: { ...b.layout, pageId, x, y, z } } as Block) : b)) };
        const pageHeight = pageSize(d.pages.find((p) => p.id === pageId)).height;
        return { ...moved, blocks: pushDownOverlaps(moved.blocks, id, blockHeights(moved), pageHeight) };
      }),
    [commit],
  );

  // Bring a block to the front, send it to the back, or one layer up or down. The layers are what the page draws: the saved `layout.z`, the
  // exam's order for equal ones; the new order is saved as the z of every block (the order of the exam itself, which numbers the questions, stays).
  // To the front / to the back is also the block's Position (In front / Behind): to the back puts it in the bottom layer, under everything
  // else on its page (`behind`), to the front takes it out again — one undo step for both.
  const orderBlock = useCallback(
    (id: string, order: BlockOrder) =>
      commit((d) => {
        const cur = d.blocks.find((b) => b.id === id);
        if (!cur) return d;
        const behind = order === "back" ? true : order === "front" ? undefined : cur.behind;
        const flagged = behind === cur.behind ? d.blocks : d.blocks.map((b) => (b.id === id ? ({ ...b, behind } as Block) : b));
        const stacked = flagged.map((b, i) => ({ b, i })).sort((a, c) => (a.b.layout.z ?? 0) - (c.b.layout.z ?? 0) || a.i - c.i).map((x) => x.b);
        const next = reorderBlock(stacked, id, order, blockHeights(d));
        if (next === stacked) return flagged === d.blocks ? d : { ...d, blocks: flagged };
        const z = new Map(next.map((b, i) => [b.id, i + 1]));
        return { ...d, blocks: flagged.map((b) => ({ ...b, layout: { ...b.layout, z: z.get(b.id) } }) as Block) };
      }),
    [commit],
  );
  // Several blocks dropped together (one undo step): each on its page, over the others (in the order they were stacked), and the
  // blocks they land on pushed down below them, from the top one down.
  const moveBlocks = useCallback(
    (moves: { id: string; pageId: string; x: number; y: number }[]) =>
      commit((d) => {
        const by = new Map(moves.map((m) => [m.id, m]));
        const top = Math.max(0, ...d.blocks.filter((b) => !by.has(b.id)).map((b) => b.layout.z ?? 0));
        const order = d.blocks.filter((b) => by.has(b.id)).sort((a, c) => (a.layout.z ?? 0) - (c.layout.z ?? 0));
        const z = new Map(order.map((b, i) => [b.id, top + 1 + i]));
        let blocks = d.blocks.map((b) => {
          const m = by.get(b.id);
          return m ? ({ ...b, layout: { ...b.layout, pageId: m.pageId, x: m.x, y: m.y, z: z.get(b.id) } } as Block) : b;
        });
        for (const m of [...moves].sort((a, c) => a.y - c.y)) {
          const pageHeight = pageSize(d.pages.find((p) => p.id === m.pageId)).height;
          blocks = pushDownOverlaps(blocks, m.id, blockHeights({ ...d, blocks }), pageHeight);
        }
        return { ...d, blocks };
      }),
    [commit],
  );

  // A block of a text box one place up (−1) or down (+1) among the blocks of its text.
  const stepInBox = useCallback((id: string, dir: -1 | 1) => commit((d) => stepSlot(d, id, dir)), [commit]);

  const deleteBlock = useCallback(
    (id: string) => {
      // A header/footer goes from its settings: the page's own, or the document's (see deleteChrome).
      commit((d) => (tRef.current && deleteChrome(d, id, tRef.current)) || removeBlock(d, id));
      setSelectedIdRaw((cur) => (cur === id ? null : cur));
    },
    [commit],
  );

  // Several selected blocks deleted together (one undo step).
  const deleteBlocks = useCallback(
    (ids: readonly string[]) => {
      commit((d) => ids.reduce((acc, id) => (acc.blocks.some((b) => b.id === id) ? (tRef.current && deleteChrome(acc, id, tRef.current)) || removeBlock(acc, id) : acc), d));
      setGroupIds([]);
      setSelectedIdRaw((cur) => (cur && ids.includes(cur) ? null : cur));
    },
    [commit],
  );

  // The eraser of the tool bar: the drawings and shapes it rubs go; `key` names the stroke of the eraser (one step of the undo).
  const eraseBlocks = useCallback(
    (ids: readonly string[], key: string) => {
      commit((d) => ids.reduce((acc, id) => (acc.blocks.some((b) => b.id === id) ? removeBlock(acc, id) : acc), d), { key });
      setSelectedIdRaw((cur) => (cur && ids.includes(cur) ? null : cur));
    },
    [commit],
  );

  // The real eraser went along `path` on a page (page px, `radius` around it): the strokes of the drawings it touches are cut, what is
  // left of each stays in its place in the exam (a piece keeps the stroke's id); a stroke rubbed out whole goes.
  const eraseInk = useCallback(
    // (nothing is selected meanwhile: the eraser lets go of the selection when it goes down)
    (pageId: string, path: { x: number; y: number }[], radius: number, key: string) =>
      commit(
        (d) => {
          let changed = false;
          const blocks = d.blocks.flatMap((b): Block[] => {
            if (b.type !== "shape" || !isStroke(b) || b.layout.pageId !== pageId) return [b];
            const { x, y, width: w, height: h } = b.layout;
            const pieces = cutStroke({ x, y, w, h, flipX: b.flipX, flipY: b.flipY, adj: b.adj, pressure: b.pressure, strokeWidth: b.strokeWidth }, path, radius);
            if (!pieces) return [b];
            changed = true;
            return pieces.map((p, i) => ({
              ...b,
              id: i === 0 ? b.id : newId(),
              adj: p.adj,
              pressure: p.pressure,
              flipX: undefined,
              flipY: undefined,
              layout: { ...b.layout, x: p.x, y: p.y, width: p.w, height: p.h },
            }));
          });
          return changed ? { ...d, blocks } : d;
        },
        { key },
      ),
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
        meta: looseMeta(src),
        layout: { ...src.layout, pageId: page.id, x: clamp(src.layout.x + (taken ? 12 : 0), 0, size.width - src.layout.width), y: clamp(src.layout.y + (taken ? 24 : 0), 0, size.height - src.layout.height) },
      } as Block;
      commit((d) => ({ ...d, blocks: [...d.blocks, copy] }));
      setSelectedId(copy.id);
    },
    [doc, activePage, commit, setSelectedId],
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
        meta: looseMeta(src),
        layout: { ...src.layout, y: clamp(src.layout.y + 24, 0, size.height - h), x: clamp(src.layout.x + 12, 0, size.width - src.layout.width) },
      } as Block;
      commit((d) => ({ ...d, blocks: [...d.blocks, copy] }));
      setSelectedId(copy.id);
    },
    [doc, commit, setSelectedId],
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

  // Remove a page and everything on it (any page, as long as one is left).
  const deletePage = useCallback(
    (pageId: string) => {
      commit((d) => {
        if (d.pages.length <= 1) return d;
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

  // The border of the pages (Page layout → Page borders): of one page, or of every page when no `pageId` is given; `border` undefined = none.
  // Changes with the same `key` (dragging a slider) are one undo step.
  const setPageBorder = useCallback(
    (pageId: string | null, border: PageBorder | undefined, key?: string) =>
      commit(
        (d) => {
          const same = (p: Page) => JSON.stringify(p.border ?? null) === JSON.stringify(border ?? null);
          const targets = d.pages.filter((p) => pageId === null || p.id === pageId);
          if (targets.every(same)) return d;
          const set = (p: Page): Page => {
            const { border: _old, ...rest } = p;
            void _old;
            return border ? { ...rest, border: { ...border } } : rest;
          };
          const next = { ...d, pages: d.pages.map((p) => (pageId === null || p.id === pageId ? set(p) : p)) };
          // (the header and the footer are placed inside the border)
          return tRef.current ? syncChrome(d, next, tRef.current) : next;
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
        return d.pages.every(same) ? d : stretchHeaders({ ...d, pages: d.pages.map((p) => ({ ...p, margins: { ...m } })) });
      }),
    [commit],
  );

  const setMeta = useCallback(
    (patch: Partial<ExamMeta>, key?: string) => commit((d) => ({ ...d, meta: { ...d.meta, ...patch } }), { key }),
    [commit],
  );

  // What the exam is graded out of: the setting, the exam header and the page headers together (examMark.ts). It is the whole file that changes, whichever part is shown.
  const setFullMark = useCallback((value: number) => commit((d) => withFullMark(d, value, tRef.current), { key: "fullMark", whole: true }), [commit]);

  // The settings of the paper of the correction sheet (its columns, frame, titles…). Changes with the same `key` (dragging an edge) are one undo step.
  const setSheet = useCallback(
    (patch: Partial<SheetConfig>, key?: string) =>
      commit((d) => {
        if (!d.sheet) return d;
        const next = { ...d, sheet: { ...d.sheet, ...patch } };
        // (the column of totals turned on, or the paper changed: the rows that now ask for a total get one)
        return (!d.sheet.total && next.sheet.total) || d.sheet.paper !== next.sheet.paper ? addTotals(next) : next;
      }, { key }),
    [commit],
  );

  // Make the correction sheet as the wizard says (from the exam, or empty) and show it. One that is there is replaced, its settings kept (undo brings it back).
  const makeSheet = useCallback(
    (opts: SheetChoice) => {
      commit(
        (d) => {
          try {
            if (opts.template === "blank") return createCorrection(dropCorrection(d), opts.paper);
            return d.correction ? rebuildSheet(d, { template: opts.template, paper: opts.paper, marks: opts.marks }) : withCorrection(d, generateCorrection(d, { template: opts.template, paper: opts.paper, marks: opts.marks }));
          } catch (e) {
            console.error("Correction sheet:", e); // (the exam is left as it is)
            return d;
          }
        },
        { whole: true },
      );
      setPart("sheet");
      setSelectedId(null);
      setActivePage(0);
    },
    [commit, setPart, setSelectedId],
  );

  // A change of the sheet that looks at the exam too (links.ts: put in the questions it lacks, make marks again, set points from marks…): the whole file in, the whole file out
  const fixSheet = useCallback((fix: (full: ExamDoc) => ExamDoc) => commit((d) => withSheetChrome(d, fix(d), tRef.current), { whole: true }), [commit]);

  // Throw the correction sheet away (undo brings it back)
  const deleteSheet = useCallback(() => {
    commit((d) => dropCorrection(d), { whole: true });
    setPart("exam");
  }, [commit, setPart]);

  // Replace the exam (new template or opened file). Undo can bring the old one back.
  const replaceDoc = useCallback(
    (incoming: ExamDoc) => {
      const next = prepare(incoming);
      commit(() => next, { whole: true });
      setPart("exam");
      setSelectedId(null);
      setActivePage(0);
      // Equations from older files may need their drawing.
      next.blocks.forEach((b) => b.type === "equation" && !b.svg && refreshEquation(b));
    },
    [commit, refreshEquation, setSelectedId, setPart],
  );

  // Replace the document shown (the exam, or the correction sheet) with one made from it, e.g. by the page layout wizard: the other one stays
  const replaceView = useCallback(
    (next: ExamDoc) => {
      commit(() => adoptHeaders(next));
      setSelectedId(null);
      setActivePage(0);
    },
    [commit, setSelectedId],
  );

  const newFromTemplate = useCallback((t: Template) => replaceDoc(buildDoc(t)), [replaceDoc]);

  return {
    doc,
    fullDoc: full,
    part,
    setPart,
    hasSheet: !!full.correction,
    setSheet,
    makeSheet,
    fixSheet,
    deleteSheet,
    selectedId,
    setSelectedId,
    groupIds,
    selectGroup,
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
    orderBlock,
    moveBlocks,
    stepInBox,
    deleteBlock,
    deleteBlocks,
    eraseBlocks,
    eraseInk,
    duplicateBlock,
    pasteBlock,
    addPage,
    deletePage,
    setMargins,
    setPageFormat,
    setPageBorder,
    setChrome,
    resetPageChrome,
    adoptHeader,
    editChrome,
    chromeScope,
    setMeta,
    setFullMark,
    replaceDoc,
    replaceView,
    newFromTemplate,
  };
}

export type ExamStore = ReturnType<typeof useExam>;
