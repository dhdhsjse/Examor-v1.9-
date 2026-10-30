"use client";

import type { Editor, JSONContent } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from "react";
import { mathCommand, onNextMathfield } from "@/app/_lib/activeMathfield";
import { blockRtl, textboxPad, textboxSpec } from "@/app/_lib/blockLayout";
import { setCurrentFormula } from "@/app/_lib/currentFormula";
import { registerFormulaField } from "../math-keyboard/fieldTarget";
import { useShowMarks } from "@/app/_lib/formattingMarks";
import { isRtl } from "@/app/_lib/i18n";
import type { StylePatch } from "@/app/_lib/richText";
import { textboxDoc } from "@/app/_lib/textboxDoc";
import * as cmd from "@/app/_lib/textboxEditor";
import type { ExamMeta, TextboxBlock } from "@/app/_lib/types";
import FormatBar from "../rich/FormatBar";

// Where the box is on the page stack (page pixels); while it is being resized, where it is now.
export type BoxRect = { left: number; top: number; width: number; height: number };

interface Props {
  block: TextboxBlock;
  meta: ExamMeta;
  zoom: number;
  box: BoxRect;
  selectAll: boolean; // a new box: its text is selected, so typing replaces it
  keepOpen: RefObject<boolean>; // true while a resize handle of the box is held: that click does not close the editor
  onChange: (content: JSONContent) => void;
  onDropBoxStyle: (mark: cmd.StyleMark) => void; // the whole box loses bold / italic / … (see cmd.toggleStyle)
  onDone: () => void;
  onReady: (editor: Editor | null) => void; // for the right panel, which formats the selection through it
  // Its edge is dragged (page stack pixels): it starts, where the box would go (snapped, inside its page), where it is dropped.
  onMoveStart: () => void;
  onMoving: (left: number, top: number) => { x: number; y: number };
  onMoveEnd: (left: number, top: number) => void;
}

const GRAB_PX = 6; // the band along the inside of the edge that moves the box (screen pixels)

const JUSTIFY = { top: "flex-start", middle: "center", bottom: "flex-end" } as const;
const BAR_MARK = { b: "bold", i: "italic", u: "underline", x: "strike" } as const;

// The text box being typed in: a Tiptap editor exactly over the box on the page (inside the zoomed layer,
// so sizes are page pixels), with the box's inner margin, place of the text, fill, border and font. Words
// and paragraphs can be formatted one by one (the bar above it, or the right panel); Ctrl+Z undoes inside
// it; pasted formatted text keeps what the canvas can draw. The canvas draws the same document when the
// editor is closed (textboxDoc.ts). A click anywhere else (except the right panel's formatting) or Escape
// closes it. Its edge can be dragged to move the box while typing goes on.
export default function TextboxEditor({ block, meta, zoom, box, selectAll, keepOpen, onChange, onDropBoxStyle, onDone, onReady, onMoveStart, onMoving, onMoveEnd }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const [moved, setMoved] = useState<{ x: number; y: number } | null>(null); // the edge is being dragged: where the box is (page stack pixels)
  const stopMove = useRef<(() => void) | null>(null);
  const rtl = blockRtl(block, meta);
  const showMarks = useShowMarks();
  const s = textboxSpec(block, meta);
  const autoWidth = block.sizing === "auto-width";
  const latest = useRef({ onChange, onDone, onReady, onMoveStart, onMoving, onMoveEnd });
  useEffect(() => {
    latest.current = { onChange, onDone, onReady, onMoveStart, onMoving, onMoveEnd };
  });

  // The extensions are made once for this editing session (new ones on every render would be new options every time).
  // The direction and the size are those of the box when typing starts: they do not change while it is open.
  const [extensions] = useState(() => cmd.textboxExtensions({ rtl, size: s.font.size }));
  const editor = useEditor({
    extensions,
    content: textboxDoc(block),
    // Ready on the first render, so the first keys typed right after drawing the box are not lost. (Only
    // ever mounted in the browser, when typing starts: no server render to match.)
    immediatelyRender: true,
    onUpdate: ({ editor: e }) => latest.current.onChange(e.getJSON()),
    editorProps: {
      attributes: { dir: block.dir ?? (isRtl(meta.lang) ? "rtl" : "auto"), "aria-label": "Text box", class: "outline-none" },
      handleKeyDown: (_view, e) => {
        if (e.key !== "Escape") return false;
        e.preventDefault();
        latest.current.onDone();
        return true;
      },
    },
  });

  // Focus at once (Tiptap's autofocus waits a frame, and the first keys typed would be lost), with the
  // text selected for a new box, else the cursor at the end.
  useLayoutEffect(() => {
    if (!editor) return;
    if (selectAll) editor.commands.selectAll();
    else editor.commands.setTextSelection(editor.state.doc.content.size);
    editor.view.focus();
    // Only when the editor starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // The math keyboard puts real formulas in the box: a key typed in the text starts a formula at the cursor with that key in it, and
  // the keys after it go on in that formula (its field has the focus) until the cursor goes back to the words.
  useEffect(() => {
    if (!editor) return;
    return registerFormulaField(editor.view.dom, (latex) => {
      onNextMathfield(() => mathCommand(["insert", latex, { selectionMode: "placeholder" }]));
      editor.chain().focus().insertInlineMath().run();
    });
  }, [editor]);

  // The Properties panel shows the formula being edited (currentFormula.ts) until the cursor is back in the words, or the box closes.
  useEffect(() => {
    if (!editor) return;
    const words = () => setCurrentFormula(null);
    editor.on("focus", words);
    return () => {
      editor.off("focus", words);
      setCurrentFormula(null);
    };
  }, [editor]);

  // The right panel formats the selection through this editor while it is open.
  useEffect(() => {
    latest.current.onReady(editor);
    return () => latest.current.onReady(null);
  }, [editor]);

  // A click outside closes it. A resize handle of this box keeps it open; typing goes on after the resize.
  useEffect(() => {
    let resizing = false;
    const down = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (root.current?.contains(target) || target?.closest?.("[data-text-format]")) return;
      if (keepOpen.current) resizing = true;
      else latest.current.onDone();
    };
    const up = () => {
      if (!resizing) return;
      resizing = false;
      editor?.commands.focus();
    };
    document.addEventListener("mousedown", down);
    window.addEventListener("mouseup", up);
    return () => {
      document.removeEventListener("mousedown", down);
      window.removeEventListener("mouseup", up);
    };
  }, [editor, keepOpen]);

  // Dragging the edge: the editor follows the mouse, and the box is moved where it is let go. The text keeps its focus and
  // selection (the press does not take them), so typing goes on after.
  // The canvas snaps it to the guides and the other blocks, and hides its own drawing of the box meanwhile.
  const startMove = (e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const start = { x: e.clientX, y: e.clientY, left: box.left, top: box.top };
    let at = { x: box.left, y: box.top };
    let started = false;
    const move = (ev: MouseEvent) => {
      const dx = (ev.clientX - start.x) / zoom;
      const dy = (ev.clientY - start.y) / zoom;
      if (!started && Math.abs(dx) + Math.abs(dy) < 2) return; // (a click on the edge moves nothing)
      if (!started) latest.current.onMoveStart();
      started = true;
      at = latest.current.onMoving(start.left + dx, start.top + dy);
      setMoved(at);
    };
    const stop = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      stopMove.current = null;
      setMoved(null);
      if (started) latest.current.onMoveEnd(at.x, at.y);
    };
    const up = (ev: MouseEvent) => {
      move(ev);
      stop();
      editor?.commands.focus();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    stopMove.current = stop;
  };
  // (closed while dragged: the box is dropped where it is, so the canvas shows it again)
  useEffect(() => () => stopMove.current?.(), []);
  const grab = GRAB_PX / zoom;
  const bands = [
    { top: 0, left: 0, right: 0, height: grab },
    { bottom: 0, left: 0, right: 0, height: grab },
    { top: 0, bottom: 0, left: 0, width: grab },
    { top: 0, bottom: 0, right: 0, width: grab },
  ];

  // The bar above the text: what the selection looks like, and its commands.
  const sel = useEditorState({ editor, selector: ({ editor: e }) => (e ? cmd.selectionFormat(e) : null) });
  const boxHas = { bold: s.font.bold, italic: s.font.italic, underline: s.font.underline, strike: !!s.font.strike };
  const apply = (p: StylePatch | "clear") => {
    if (!editor) return;
    if (p === "clear") return void cmd.clearMarks(editor);
    if ("font" in p) cmd.setFamily(editor, p.font ?? undefined);
    if ("size" in p) cmd.setSize(editor, p.size ?? undefined);
    if ("color" in p) cmd.setColor(editor, p.color ?? undefined);
    if ("hl" in p) cmd.setHighlight(editor, p.hl ?? undefined);
  };
  const toggle = (k: keyof typeof BAR_MARK | "sub" | "sup") => {
    if (!editor) return;
    if (k === "sub" || k === "sup") return void cmd.toggleScript(editor, k);
    cmd.toggleStyle(editor, BAR_MARK[k], boxHas[BAR_MARK[k]], () => onDropBoxStyle(BAR_MARK[k]));
  };

  const decoration = [s.font.underline && "underline", s.font.strike && "line-through"].filter(Boolean).join(" ");
  return (
    <div
      ref={root}
      className="absolute z-20"
      // An auto-width box grows with the line being typed (its size on the page follows a moment later): no wrapping here.
      style={{ left: moved?.x ?? box.left, top: moved?.y ?? box.top, ...(autoWidth ? { minWidth: box.width, width: "max-content" } : { width: box.width }) }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Format bar just above the box, at screen size (lined up on the right in Arabic) */}
      <div className="absolute z-30 h-0" style={{ [rtl ? "right" : "left"]: 0, top: -8 / zoom }}>
        <div className={`absolute bottom-0 ${rtl ? "right-0 origin-bottom-right" : "left-0 origin-bottom-left"}`} style={{ transform: `scale(${1 / zoom})` }}>
          <FormatBar
            style={{
              font: sel?.family,
              size: sel?.size,
              color: sel?.color,
              hl: sel?.highlight,
              b: boxHas.bold || sel?.marks.bold,
              i: boxHas.italic || sel?.marks.italic,
              u: boxHas.underline || sel?.marks.underline,
              x: boxHas.strike || sel?.marks.strike,
              sub: sel?.script === "sub",
              sup: sel?.script === "sup",
            }}
            baseFont={block.font?.family ?? meta.fontFamily}
            baseSize={s.font.size}
            baseColor={s.font.color}
            onApply={apply}
            onToggle={toggle}
          />
        </div>
      </div>

      <div
        dir={rtl ? "rtl" : "ltr"}
        // A click in the box but outside the text types at its end.
        onMouseDown={(e) => {
          if (e.target !== e.currentTarget) return;
          e.preventDefault();
          editor?.commands.focus("end");
        }}
        className={`textbox-editor ${showMarks ? "show-marks" : ""} ${autoWidth ? "[&_.ProseMirror]:whitespace-pre!" : ""} relative flex cursor-text flex-col rounded-[2px] outline-2 outline-offset-1 outline-indigo-500 [&_.ProseMirror]:outline-none [&_.ProseMirror]:[overflow-wrap:break-word] [&_mark]:[color:inherit]`}
        style={{
          minHeight: box.height,
          padding: textboxPad(block),
          justifyContent: JUSTIFY[block.valign ?? "top"],
          background: block.background ?? "#ffffff",
          boxShadow: block.border ? `inset 0 0 0 1px ${block.border}` : undefined,
          fontFamily: s.font.family,
          fontSize: s.font.size,
          lineHeight: s.line / s.font.size,
          color: s.font.color,
          fontWeight: s.font.bold ? 700 : 400,
          fontStyle: s.font.italic ? "italic" : undefined,
          textDecoration: decoration || undefined,
          // (each paragraph is at the start of its own direction unless the box is aligned)
          textAlign: block.align ?? "start",
        }}
      >
        <EditorContent editor={editor} />
        {bands.map((style, i) => (
          <div key={i} aria-hidden onMouseDown={startMove} className="absolute z-10 cursor-move" style={style} />
        ))}
      </div>
    </div>
  );
}
