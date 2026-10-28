"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import RichEditable, { type RichHandle } from "@/app/_components/rich/RichEditable";
import { fontStack } from "@/app/_lib/fonts";
import { plainText } from "@/app/_lib/richText";
import {
  anchorOf,
  cellLook,
  cellName,
  colName,
  colsOf,
  displayGrid,
  tableMirrored,
  fillRange,
  hEdgeShown,
  isCovered,
  isFormula,
  keyOf,
  mergeAt,
  parseTable,
  pasteMatrix,
  rangeName,
  rowsOf,
  setCell,
  showsError,
  textOf,
  toTabText,
  vEdgeShown,
  wholeMerges,
  type CellPos,
  type CellRange,
  type TableCellStyle,
  type TableData,
  type TablePatch,
} from "@/app/_lib/table";
import { useT } from "@/app/_lib/uiLang";
import { RichSpan } from "./RichSpan";
import type { TableActions } from "./tableActions";
import { cellSel, rangeSel, selRange, type Sel } from "./tableSel";

const HEAD_W = 34; // the row numbers
const HEAD_H = 22; // the column letters
const INK = "#111827";
const FAINT = "#d7dce4"; // the lines of the editor's grid that the table does not draw
const ACCENT = "#4f46e5";

// What was last copied in the grid: the cells as typed (formulas as formulas) and their looks, to paste them inside the app exactly; the
// text on the system clipboard is what the cells show, for other programs. Pasting text that is not this copy reads it as a table.
let held: { text: string; raw: string[][]; styles: (TableCellStyle | undefined)[][]; from: CellPos } | null = null;

const clampTo = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(v, hi));
const FIRST = cellSel(0, 0);

interface Props {
  table: TableData;
  lang: "fr" | "ar";
  /** null = no cell is selected: only what is true of the whole table works (the font) */
  sel: Sel | null;
  onSelect: (s: Sel | null) => void;
  /** A change of the table; `key` is the same for the edits of one thing that should be one step of the undo */
  onChange: (patch: TablePatch, key: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  /** Smaller (the right panel) */
  compact?: boolean;
  /** The Studio fills its area; the panel has a height of its own */
  maxHeight?: number | string;
  /** The actions of the selection (made by the owner, which also shows them in its format bar) */
  actions: TableActions;
  /** The font of the exam, for the cells that have none of their own and a table without a font */
  examFont?: string;
  testId?: string;
}

type Edit = { r: number; c: number; draft: string; from: "cell" | "bar" };

// The spreadsheet of a table: column letters and row numbers, a formula bar, cells that are selected with the mouse or the arrows,
// typed in, copied, pasted (also from Excel or Google Sheets), filled by dragging the little square of the selection, merged… The cells show what
// the page will show (a formula's value, formatted); the cell being typed in shows what was typed. A table with formulas can be
// pointed at: with "=" typed, a click on a cell writes its name.
export default function TableGrid({ table, lang, sel, onSelect, onChange, onUndo, onRedo, compact, maxHeight, actions, examFont, testId = "table-grid" }: Props) {
  const t = useT();
  const textRtl = lang === "ar"; // the direction of the text (the exam's)
  const rtl = tableMirrored(table, textRtl); // the first column is on the right
  const rows = rowsOf(table);
  const cols = colsOf(table);
  const hasSel = sel !== null;
  const here = sel ?? FIRST; // (with no cell selected the first one stands in where a position is needed; nothing shows it)
  const range = useMemo(() => wholeMerges(table, selRange(sel ?? FIRST)), [table, sel]);
  const active = anchorOf(table, here.focus.r, here.focus.c);
  const shown = useMemo(() => displayGrid(table, lang), [table, lang]);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [fill, setFill] = useState<{ source: CellRange; to: CellPos } | null>(null); // the fill handle being dragged
  const grid = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const editor = useRef<RichHandle>(null);
  const dragging = useRef(false);
  const filling = useRef<{ source: CellRange; to: CellPos } | null>(null); // (the same, for the end of the drag)
  const fs = compact ? 12 : 13;
  const minH = compact ? 24 : 28;

  const raw = table.cells[active.r]?.[active.c] ?? "";

  // ---- typing in a cell ----

  const focusGrid = useCallback(() => grid.current?.focus({ preventScroll: true }), []);

  const begin = (r: number, c: number, initial?: string, from: Edit["from"] = "cell") => {
    const at = anchorOf(table, r, c);
    setEdit({ r: at.r, c: at.c, draft: initial ?? table.cells[at.r]?.[at.c] ?? "", from });
  };

  const move = (dr: number, dc: number, extend = false) => {
    const f = here.focus;
    const m = mergeAt(table, f.r, f.c);
    let r = f.r;
    let c = f.c;
    if (dr > 0) r = m ? m.r + m.rs : f.r + 1;
    else if (dr < 0) r = (m ? m.r : f.r) - 1;
    if (dc > 0) c = m ? m.c + m.cs : f.c + 1;
    else if (dc < 0) c = (m ? m.c : f.c) - 1;
    r = clampTo(r, 0, rows - 1);
    c = clampTo(c, 0, cols - 1);
    if (extend) onSelect({ anchor: here.anchor, focus: { r, c } });
    else {
      const to = anchorOf(table, r, c);
      onSelect(cellSel(to.r, to.c));
    }
  };

  // Ends the typing: the text goes into the cell, and the selection goes on (down with Enter, right with Tab) if asked to.
  const commit = (dr = 0, dc = 0) => {
    if (!edit) return;
    const patch = setCell(table, edit.r, edit.c, edit.draft);
    if (patch) onChange(patch, `cell:${keyOf(edit.r, edit.c)}`);
    setEdit(null);
    if (dr || dc) {
      // (the selection moves from the cell that was typed in)
      const m = mergeAt(table, edit.r, edit.c);
      let r = edit.r;
      let c = edit.c;
      if (dr > 0) r = m ? m.r + m.rs : r + 1;
      else if (dr < 0) r -= 1;
      if (dc > 0) c = m ? m.c + m.cs : c + 1;
      else if (dc < 0) c -= 1;
      // Tab at the end of a row goes to the start of the next one
      if (dc > 0 && c >= cols) {
        c = 0;
        r += 1;
      } else if (dc < 0 && c < 0) {
        c = cols - 1;
        r -= 1;
      }
      const to = anchorOf(table, clampTo(r, 0, rows - 1), clampTo(c, 0, cols - 1));
      onSelect(cellSel(to.r, to.c));
    }
    focusGrid();
  };

  const cancel = () => {
    setEdit(null);
    focusGrid();
  };

  // The caret goes to the end of the text when a cell is opened for typing (or a name was written in it by a click)
  useEffect(() => {
    if (edit?.from === "cell") editor.current?.focus("end");
  }, [edit?.r, edit?.c, edit?.from]);

  useEffect(() => {
    holder.current?.querySelector(`[data-r="${active.r}"][data-c="${active.c}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active.r, active.c]);

  // ---- the mouse ----

  useEffect(() => {
    const up = () => {
      dragging.current = false;
      const drag = filling.current;
      filling.current = null;
      setFill(null);
      if (!drag) return;
      const f = fillRange(table, drag.source, drag.to);
      if (f) {
        onChange(f.patch, `fill:${Date.now()}`);
        onSelect(rangeSel(f.range));
      }
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  });

  // Whether a click on a cell should write the cell's name in the formula being typed (it ends with an operator or an opening bracket)
  const pointing = (e: Edit | null) => !!e && !!table.calc && e.draft.startsWith("=") && /[=(+\-*/^,;&<>:]$/.test(e.draft.trimEnd());

  const pickCell = (r: number, c: number, e: MouseEvent) => {
    if (e.button !== 0) return;
    if (edit && pointing(edit)) {
      e.preventDefault();
      const at = anchorOf(table, r, c);
      setEdit({ ...edit, draft: edit.draft.trimEnd() + cellName(at.r, at.c) });
      requestAnimationFrame(() => editor.current?.focus("end"));
      return;
    }
    if (edit && !(edit.r === r && edit.c === c)) commit();
    const at = anchorOf(table, r, c);
    if (edit && edit.r === at.r && edit.c === at.c) return; // (a click in the cell being typed in)
    e.preventDefault();
    focusGrid();
    if (e.shiftKey) onSelect({ anchor: here.anchor, focus: at });
    else onSelect(cellSel(at.r, at.c));
    dragging.current = true;
  };

  const enterCell = (r: number, c: number, e: MouseEvent) => {
    if (filling.current) {
      filling.current = { ...filling.current, to: { r, c } };
      return setFill(filling.current);
    }
    if (!dragging.current || e.buttons !== 1) return;
    onSelect({ anchor: here.anchor, focus: anchorOf(table, r, c) });
  };

  const pickHeader = (kind: "col" | "row" | "all", i: number, e: MouseEvent) => {
    if (e.button !== 0) return;
    if (edit) commit();
    e.preventDefault();
    focusGrid();
    const g: CellRange = kind === "col" ? { r0: 0, r1: rows - 1, c0: i, c1: i } : kind === "row" ? { c0: 0, c1: cols - 1, r0: i, r1: i } : { r0: 0, r1: rows - 1, c0: 0, c1: cols - 1 };
    if (e.shiftKey && kind !== "all") onSelect({ anchor: here.anchor, focus: kind === "col" ? { r: rows - 1, c: i } : { r: i, c: cols - 1 } });
    else onSelect(rangeSel(g));
  };

  // Dragging the line after a column letter changes the width of the column (and of the one after it); after a row number, the height.
  const resizeColumn = (c: number, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const heads = [...(holder.current?.querySelectorAll<HTMLElement>("[data-colhead]") ?? [])];
    const widths = heads.map((h) => h.getBoundingClientRect().width);
    if (c + 1 >= widths.length) return;
    const start = e.clientX;
    const pair = widths[c] + widths[c + 1];
    const move = (m: globalThis.MouseEvent) => {
      const delta = (m.clientX - start) * (rtl ? -1 : 1);
      const left = clampTo(widths[c] + delta, 40, pair - 40);
      const next = widths.map((w, i) => (i === c ? left : i === c + 1 ? pair - left : w));
      const total = next.reduce((s, v) => s + v, 0);
      onChange({ colWidths: next.map((w) => Math.round((w / total) * 10000) / 10000) }, "colwidths");
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const resizeRow = (r: number, e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const el = holder.current?.querySelector<HTMLElement>(`[data-rowhead="${r}"]`);
    if (!el) return;
    const start = e.clientY;
    const height = el.getBoundingClientRect().height;
    const move = (m: globalThis.MouseEvent) => {
      const heights = Array.from({ length: rows }, (_, i) => table.rowHeights?.[i] ?? 0);
      heights[r] = Math.max(minH, Math.round(height + m.clientY - start));
      onChange({ rowHeights: heights }, "rowheights");
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const autoRow = (r: number) => {
    if (!table.rowHeights?.[r]) return;
    const heights = table.rowHeights.map((h, i) => (i === r ? 0 : h));
    onChange({ rowHeights: heights.some((h) => h > 0) ? heights : undefined }, "rowheights");
  };

  // ---- the keyboard ----

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return; // (the keys of a cell being typed in, or of the formula bar, are theirs)
    const mod = e.ctrlKey || e.metaKey;
    const key = e.key;
    const horizontal = (dc: number) => (rtl ? -dc : dc);
    if (mod) {
      const k = key.toLowerCase();
      if (k === "a") {
        e.preventDefault();
        onSelect(rangeSel({ r0: 0, c0: 0, r1: rows - 1, c1: cols - 1 }));
      } else if (k === "z" && onUndo) {
        e.preventDefault();
        if (e.shiftKey) onRedo?.();
        else onUndo();
      } else if (k === "y" && onRedo) {
        e.preventDefault();
        onRedo();
      } else if (k === "b" || k === "i") {
        e.preventDefault();
        actions.toggle(k === "b" ? "bold" : "italic");
      }
      return;
    }
    if (key === "Escape" && hasSel) {
      // lets go of the selection (the Studio does not close on this Escape)
      e.preventDefault();
      onSelect(null);
      return;
    }
    if (!hasSel) {
      // with nothing selected a movement key or Enter selects the first cell
      if (key.startsWith("Arrow") || key === "Tab" || key === "Enter" || key === "F2") {
        e.preventDefault();
        onSelect(cellSel(0, 0));
      }
      return;
    }
    if (key.startsWith("Arrow")) {
      e.preventDefault();
      move(key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0, key === "ArrowRight" ? horizontal(1) : key === "ArrowLeft" ? horizontal(-1) : 0, e.shiftKey);
    } else if (key === "Tab") {
      e.preventDefault();
      const f = here.focus;
      const next = e.shiftKey ? { r: f.c === 0 ? f.r - 1 : f.r, c: f.c === 0 ? cols - 1 : f.c - 1 } : { r: f.c === cols - 1 ? f.r + 1 : f.r, c: f.c === cols - 1 ? 0 : f.c + 1 };
      const to = anchorOf(table, clampTo(next.r, 0, rows - 1), clampTo(next.c, 0, cols - 1));
      onSelect(cellSel(to.r, to.c));
    } else if (key === "Enter" || key === "F2") {
      e.preventDefault();
      begin(active.r, active.c);
    } else if (key === "Delete" || key === "Backspace") {
      e.preventDefault();
      actions.clear();
    } else if (key.length === 1 && !e.altKey) {
      e.preventDefault();
      // (a fast typist's second letter can arrive before the cell's editor has the focus: it goes on the text)
      if (edit) setEdit({ ...edit, draft: edit.draft + key });
      else begin(active.r, active.c, key);
    }
  };

  // ---- the clipboard ----

  const copy = (e: ClipboardEvent<HTMLDivElement>, cut: boolean) => {
    if (e.target !== e.currentTarget || !hasSel) return;
    e.preventDefault();
    const text = toTabText(Array.from({ length: range.r1 - range.r0 + 1 }, (_, i) => Array.from({ length: range.c1 - range.c0 + 1 }, (_, j) => plainText(shown[range.r0 + i]?.[range.c0 + j] ?? ""))));
    e.clipboardData.setData("text/plain", text);
    held = {
      text,
      raw: textOf(table, range),
      styles: Array.from({ length: range.r1 - range.r0 + 1 }, (_, i) => Array.from({ length: range.c1 - range.c0 + 1 }, (_, j) => table.cellStyles?.[keyOf(range.r0 + i, range.c0 + j)])),
      from: { r: range.r0, c: range.c0 },
    };
    if (cut) actions.clear();
  };

  const paste = (e: ClipboardEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget || !hasSel) return;
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    const own = held && held.text === text ? held : null;
    const matrix = own ? own.raw : parseTable(text);
    const at = { r: range.r0, c: range.c0 };
    const result = pasteMatrix(table, at, matrix, own?.from);
    if (!result) return;
    const patch: TablePatch = { ...result.patch };
    if (own) {
      const styles = { ...(patch.cellStyles ?? table.cellStyles ?? {}) };
      own.styles.forEach((row, i) =>
        row.forEach((s, j) => {
          const key = keyOf(at.r + i, at.c + j);
          if (s) styles[key] = { ...s };
          else delete styles[key];
        }),
      );
      patch.cellStyles = Object.keys(styles).length ? styles : undefined;
    }
    onChange(patch, `paste:${Date.now()}`);
    onSelect(rangeSel(result.range));
  };

  // ---- what is drawn ----

  const tracks = (table.colWidths?.length === cols ? table.colWidths : Array.from({ length: cols }, () => 1)).map((w) => `minmax(${compact ? 52 : 70}px, ${w}fr)`).join(" ");
  const inRange = (r: number, c: number) => hasSel && r >= range.r0 && r <= range.r1 && c >= range.c0 && c <= range.c1;
  const fillBox: CellRange | null = fill ? { r0: Math.min(range.r0, fill.to.r), r1: Math.max(range.r1, fill.to.r), c0: Math.min(range.c0, fill.to.c), c1: Math.max(range.c1, fill.to.c) } : null;

  const cellNodes: React.ReactNode[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isCovered(table, r, c)) continue;
      const m = mergeAt(table, r, c);
      const rs = m?.rs ?? 1;
      const cs = Math.min(m?.cs ?? 1, cols - c);
      const look = cellLook(table, r, c);
      const editing = edit?.r === r && edit?.c === c;
      const isActive = hasSel && active.r === r && active.c === c;
      const selected = inRange(r, c);
      const inFill = !!fillBox && r >= fillBox.r0 && r <= fillBox.r1 && c >= fillBox.c0 && c <= fillBox.c1 && !selected;
      const text = shown[r]?.[c] ?? "";
      const edge = (on: boolean) => `1px solid ${on ? INK : FAINT}`;
      const style: CSSProperties = {
        gridRow: `${r + 2} / span ${rs}`,
        gridColumn: `${c + 2} / span ${cs}`,
        minHeight: Math.max(minH, table.rowHeights?.[r] ?? 0),
        background: selected && !isActive ? `color-mix(in srgb, ${look.fill ?? "#ffffff"} 80%, ${ACCENT} 20%)` : (look.fill ?? "#ffffff"),
        direction: textRtl ? "rtl" : "ltr",
        color: look.color ?? INK,
        fontFamily: fontStack(look.family ?? table.font?.family ?? examFont),
        fontWeight: look.bold ? 700 : 400,
        fontStyle: look.italic ? "italic" : "normal",
        fontSize: look.size ? Math.round(look.size * (fs / 14)) : fs,
        justifyContent: look.align === "center" ? "center" : look.align === "right" ? "flex-end" : look.align === "left" ? "flex-start" : "flex-start",
        textAlign: look.align ?? undefined,
        alignItems: look.valign === "top" ? "flex-start" : look.valign === "bottom" ? "flex-end" : "center",
        borderBottom: edge(hEdgeShown(table, rows, r + rs, c)),
        borderTop: r === 0 ? edge(hEdgeShown(table, rows, 0, c)) : undefined,
        outline: isActive ? `2px solid ${ACCENT}` : inFill ? `1px dashed ${ACCENT}` : undefined,
        outlineOffset: isActive ? -2 : -1,
        zIndex: isActive ? 2 : undefined,
      };
      // each cell draws the edge after it (its end side) and the first column the edge before it: an edge is drawn once. The grid reads right to left in Arabic.
      const end = edge(vEdgeShown(table, cols, c + cs, r));
      const start = c === 0 ? edge(vEdgeShown(table, cols, 0, r)) : undefined;
      style.borderRight = rtl ? start : end;
      style.borderLeft = rtl ? end : start;
      const lastCell = (m ? m.r + m.rs - 1 : r) === range.r1 && (m ? m.c + m.cs - 1 : c) === range.c1;
      cellNodes.push(
        <div
          key={`${r}-${c}`}
          role="gridcell"
          aria-selected={selected}
          data-r={r}
          data-c={c}
          data-testid={`cell-${r}-${c}`}
          className="relative flex min-w-0 overflow-hidden px-1.5 py-1 leading-tight break-words select-none"
          style={style}
          onMouseDown={(e) => pickCell(r, c, e)}
          onMouseEnter={(e) => enterCell(r, c, e)}
          onDoubleClick={() => !edit && begin(r, c)}
          onContextMenu={(e) => {
            e.preventDefault();
            if (!inRange(r, c)) onSelect(cellSel(r, c));
            setMenu({ x: e.clientX, y: e.clientY });
          }}
        >
          {editing ? (
            <div className="w-full min-w-0 [&_.rich-edit]:min-h-0 [&_.rich-edit]:p-0">
              <RichEditable
                ref={editor}
                value={edit.draft}
                onChange={(draft) => setEdit((cur) => (cur ? { ...cur, draft } : cur))}
                dir={textRtl ? "rtl" : "ltr"}
                className="rich-edit w-full bg-transparent outline-none"
                onKeyDown={(ev) => {
                  if (ev.key === "Enter") {
                    ev.preventDefault();
                    commit(ev.shiftKey ? -1 : 1, 0);
                  } else if (ev.key === "Tab") {
                    ev.preventDefault();
                    commit(0, ev.shiftKey ? -1 : 1);
                  } else if (ev.key === "Escape") {
                    ev.preventDefault();
                    ev.stopPropagation();
                    cancel();
                  }
                }}
                onBlur={(ev) => {
                  const next = ev.relatedTarget as Node | null;
                  if (!next || !holder.current?.contains(next)) commit();
                }}
              />
            </div>
          ) : (
            <span className={`min-w-0 ${showsError(text) ? "text-red-600" : ""}`}>
              <RichSpan text={text} />
            </span>
          )}
          {selected && lastCell && !edit && (
            <span
              data-testid="fill-handle"
              title={t("Drag to fill")}
              className="absolute -end-[3px] -bottom-[3px] z-10 size-2 cursor-crosshair border border-white"
              style={{ background: ACCENT }}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                filling.current = { source: range, to: { r: range.r1, c: range.c1 } };
                setFill(filling.current);
              }}
            />
          )}
        </div>,
      );
    }
  }

  const head = (selectedLine: boolean): CSSProperties => ({ background: selectedLine ? "#e0e7ff" : "#f3f4f6", color: selectedLine ? ACCENT : "#6b7280", borderRight: `1px solid ${FAINT}`, borderBottom: `1px solid ${FAINT}`, fontSize: 11, fontWeight: selectedLine ? 700 : 500 });

  return (
    <div ref={holder} className="flex min-h-0 min-w-0 flex-col" data-testid={testId}>
      {/* the formula bar: the name of the cell, and what is in it as typed */}
      <div className="flex items-center gap-2 border-b border-line bg-white px-2 py-1.5" dir="ltr">
        <span data-testid="table-cell-name" className="grid h-7 min-w-14 place-items-center rounded-md border border-line bg-subtle px-2 text-xs font-semibold text-ink tabular-nums">
          {hasSel ? rangeName(range) : "—"}
        </span>
        <span className="text-xs font-semibold text-muted italic" aria-hidden>
          fx
        </span>
        <div className={`min-w-0 flex-1 rounded-md border border-line bg-white px-2 py-1 text-[13px] focus-within:border-indigo-400 ${hasSel ? "" : "pointer-events-none opacity-50"}`} dir={textRtl ? "rtl" : "ltr"} data-testid="table-formula-bar">
          <RichEditable
            value={edit ? edit.draft : hasSel ? raw : ""}
            onChange={(draft) => setEdit((cur) => (cur ? { ...cur, draft } : hasSel ? { r: active.r, c: active.c, draft, from: "bar" } : cur))}
            dir={textRtl ? "rtl" : "ltr"}
            className="rich-edit min-h-0 w-full bg-transparent p-0 outline-none"
            placeholder={table.calc ? t("Type a value or a formula such as =SUM(B2:B4)") : t("Type the text of the cell")}
            onFocus={() => !edit && hasSel && setEdit({ r: active.r, c: active.c, draft: raw, from: "bar" })}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                commit(ev.shiftKey ? -1 : 1, 0);
              } else if (ev.key === "Escape") {
                ev.preventDefault();
                ev.stopPropagation();
                cancel();
              }
            }}
            onBlur={(ev) => {
              const next = ev.relatedTarget as Node | null;
              if (!next || !holder.current?.contains(next)) commit();
            }}
          />
        </div>
        {isFormula(raw) && !table.calc && <span className="shrink-0 text-[11px] text-amber-700">{t("Formulas are off for this table")}</span>}
      </div>

      <div
        ref={grid}
        role="grid"
        tabIndex={0}
        data-table-grid
        aria-label={t("Table cells")}
        aria-rowcount={rows}
        aria-colcount={cols}
        dir={rtl ? "rtl" : "ltr"}
        onKeyDown={onKeyDown}
        onMouseDown={(e) => {
          if (e.target !== e.currentTarget || e.button !== 0) return;
          if (edit) commit();
          setMenu(null);
          onSelect(null);
          focusGrid();
        }}
        onCopy={(e) => copy(e, false)}
        onCut={(e) => copy(e, true)}
        onPaste={paste}
        className="min-h-0 flex-1 overflow-auto bg-white outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-inset"
        style={{ maxHeight }}
      >
        <div className="grid w-full" style={{ gridTemplateColumns: `${HEAD_W}px ${tracks}`, gridTemplateRows: `${HEAD_H}px` }}>
          <div className="sticky top-0 z-20 cursor-pointer" style={{ ...head(false), gridRow: 1, gridColumn: 1 }} onMouseDown={(e) => pickHeader("all", 0, e)} title={t("Select all")} />
          {Array.from({ length: cols }, (_, c) => {
            const on = hasSel && range.c0 <= c && c <= range.c1 && range.r0 === 0 && range.r1 === rows - 1;
            return (
              <div
                key={`h${c}`}
                data-colhead={c}
                className="sticky top-0 z-20 grid cursor-pointer place-items-center select-none"
                style={{ ...head(on || (hasSel && c >= range.c0 && c <= range.c1)), gridRow: 1, gridColumn: c + 2 }}
                onMouseDown={(e) => pickHeader("col", c, e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!(hasSel && c >= range.c0 && c <= range.c1)) onSelect(rangeSel({ r0: 0, r1: rows - 1, c0: c, c1: c }));
                  setMenu({ x: e.clientX, y: e.clientY });
                }}
              >
                {colName(c)}
                {c < cols - 1 && <span className="absolute inset-y-0 -end-1 z-30 w-2 cursor-col-resize" data-testid={`col-resize-${c}`} onMouseDown={(e) => resizeColumn(c, e)} />}
              </div>
            );
          })}
          {Array.from({ length: rows }, (_, r) => {
            const on = hasSel && r >= range.r0 && r <= range.r1;
            return (
              <div
                key={`n${r}`}
                data-rowhead={r}
                className="sticky start-0 z-10 grid cursor-pointer place-items-center select-none"
                style={{ ...head(on), gridRow: r + 2, gridColumn: 1, minHeight: Math.max(minH, table.rowHeights?.[r] ?? 0) }}
                onMouseDown={(e) => pickHeader("row", r, e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!(hasSel && r >= range.r0 && r <= range.r1)) onSelect(rangeSel({ r0: r, r1: r, c0: 0, c1: cols - 1 }));
                  setMenu({ x: e.clientX, y: e.clientY });
                }}
              >
                {r + 1}
                <span className="absolute inset-x-0 -bottom-1 z-30 h-2 cursor-row-resize" data-testid={`row-resize-${r}`} onMouseDown={(e) => resizeRow(r, e)} onDoubleClick={() => autoRow(r)} />
              </div>
            );
          })}
          {cellNodes}
        </div>
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} actions={actions} onClose={() => setMenu(null)} onFocusGrid={focusGrid} />}
    </div>
  );
}

// The right-click menu: rows, columns, merging, clearing, sorting.
function ContextMenu({ x, y, actions, onClose, onFocusGrid }: { x: number; y: number; actions: TableActions; onClose: () => void; onFocusGrid: () => void }) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) onClose();
    };
    const esc = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("mousedown", away, true);
    document.addEventListener("keydown", esc, true);
    return () => {
      document.removeEventListener("mousedown", away, true);
      document.removeEventListener("keydown", esc, true);
    };
  }, [onClose]);
  const item = (label: string, run: () => void, disabled = false) => (
    <button
      key={label}
      type="button"
      disabled={disabled}
      onClick={() => {
        run();
        onClose();
        onFocusGrid();
      }}
      className="rounded-md px-2.5 py-1.5 text-start text-[13px] text-ink hover:bg-subtle disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {label}
    </button>
  );
  const left = Math.min(x, window.innerWidth - 220);
  const top = Math.min(y, window.innerHeight - 340);
  return (
    <div ref={box} role="menu" data-testid="table-menu" className="fixed z-[70] flex w-52 flex-col rounded-lg border border-line bg-white p-1 shadow-[0_12px_32px_-10px_rgba(16,24,40,0.4)]" style={{ left, top }}>
      {item(t("Insert row above"), () => actions.insertRows(false))}
      {item(t("Insert row below"), () => actions.insertRows(true))}
      {item(t("Insert column before"), () => actions.insertCols(false))}
      {item(t("Insert column after"), () => actions.insertCols(true))}
      <hr className="my-1 border-line" />
      {item(t("Delete row"), actions.deleteRows)}
      {item(t("Delete column"), actions.deleteCols)}
      <hr className="my-1 border-line" />
      {item(t("Merge cells"), actions.merge, !actions.canMerge)}
      {item(t("Split merged cells"), actions.unmerge, !actions.canUnmerge)}
      <hr className="my-1 border-line" />
      {item(t("Sort A to Z"), () => actions.sort("asc"))}
      {item(t("Sort Z to A"), () => actions.sort("desc"))}
      {item(t("Clear contents"), actions.clear)}
    </div>
  );
}

