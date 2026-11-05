"use client";

import type Konva from "konva";
import { useLayoutEffect, useRef, useState } from "react";
import { Group, Rect } from "react-konva";
import { withHints } from "@/app/_lib/blocks";
import { clickTargets, editRegions, type EditField } from "@/app/_lib/editRegions";
import { isFixedTable } from "@/app/_lib/table";
import type { Block, ExamMeta, ViewMode } from "@/app/_lib/types";
import type { BlockPatch } from "@/app/_lib/useExam";
import { EquationView, ImageView, TableView, TextboxView, TextView } from "./blocks/ContentViews";
import { GraphView } from "./blocks/GraphView";
import { ShapeView } from "./blocks/ShapeView";
import { DividerView } from "./blocks/DividerView";
import { HeaderNode } from "./blocks/headerParts";
import { ClassifyView, MatchView, OrderView } from "./blocks/MoreQuestionViews";
import { BlankView, McqView, OpenView, TrueFalseView } from "./blocks/QuestionViews";
import { MarkView, RuleView, type SheetInfo } from "./blocks/SheetViews";
import { TableHandles } from "./blocks/TableHandles";

export interface ResizeResult {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Props {
  block: Block;
  x: number; // position on the canvas
  y: number;
  height: number;
  number: number;
  meta: ExamMeta;
  mode: ViewMode;
  totalPoints: number; // for the header score
  sheet?: SheetInfo; // on a correction sheet: what its stickers and lines need (sheet/marks.ts)
  zoom: number;
  selected: boolean;
  grouped?: boolean; // one of several blocks selected together: outlined
  interactive: boolean; // false when exporting
  textTool: boolean; // "T" tool: one click starts typing
  drawing: boolean; // a box is being drawn on the page (text box tool): blocks ignore the mouse
  typing?: boolean; // a text box being typed in: its editor shows the words, the page only its fill and border
  erasable?: boolean; // the eraser is in hand and this block is a drawing or a shape: what it draws (not its box) catches the eraser
  // Blocks over each other: the selected block takes the clicks even where another one is drawn over it. It is then put on top
  // of the others but not seen ("ghost"), while a copy that ignores the mouse ("passive") draws it in its place in the stack.
  ghost?: boolean;
  passive?: boolean;
  hovered?: boolean; // (passive copy) the mouse is over its ghost
  onHover?: (hover: boolean) => void; // (ghost) tells its passive copy
  // A click on the block (alt: Alt held, pick the block under it; shift: Shift held, add it to the selection or take it out).
  // Returns false when another block was picked instead.
  onSelect: (alt?: boolean, shift?: boolean) => boolean;
  onDragStart: () => void;
  onDragMove: (x: number, y: number) => { x: number; y: number };
  onDragEnd: (x: number, y: number) => void;
  onResize: (r: ResizeResult) => void;
  onResizing?: (r: ResizeResult | null) => void; // where the block is while its handles are dragged (null = done)
  onEdit: (field: EditField | null) => void; // null = block without text (equation, image...)
  onPatch: (patch: BlockPatch) => void;
}

// What to draw inside the block.
function Content({ block: real, number, meta, mode, interactive, selected, totalPoints, typing, sheet }: Pick<Props, "block" | "number" | "meta" | "mode" | "interactive" | "selected" | "totalPoints" | "typing" | "sheet">) {
  // On screen, empty question texts show a light example (and the selected open question its statement); export draws the real
  // (empty) text.
  const block = interactive ? withHints(real, meta.lang, { statement: selected }) : real;
  switch (block.type) {
    case "mcq":
      return <McqView b={block} n={number} meta={meta} mode={mode} />;
    case "truefalse":
      return <TrueFalseView b={block} n={number} meta={meta} mode={mode} />;
    case "blank":
      return <BlankView b={block} n={number} meta={meta} mode={mode} />;
    case "open":
      return <OpenView b={block} n={number} meta={meta} mode={mode} />;
    case "match":
      return <MatchView b={block} n={number} meta={meta} mode={mode} />;
    case "order":
      return <OrderView b={block} n={number} meta={meta} mode={mode} />;
    case "classify":
      return <ClassifyView b={block} n={number} meta={meta} mode={mode} />;
    case "text":
      return <TextView b={block} meta={meta} />;
    case "textbox":
      return <TextboxView b={block} meta={meta} interactive={interactive} frameOnly={typing} />;
    case "table":
      return <TableView b={block} meta={meta} />;
    case "equation":
      // An empty equation is only a hint on screen: it is not printed.
      return interactive || block.latex.trim() ? <EquationView b={block} /> : null;
    case "image":
      return <ImageView b={block} meta={meta} mode={mode} />;
    case "graph":
      return <GraphView b={block} />;
    case "shape":
      return <ShapeView b={block} />;
    case "divider":
      return <DividerView b={block} />;
    case "mark":
      return <MarkView b={block} meta={meta} info={sheet} interactive={interactive} />;
    case "rule":
      return <RuleView b={block} info={sheet} interactive={interactive} />;
    case "header":
      return <HeaderNode b={block} meta={meta} mode={mode} totalPoints={totalPoints} />;
  }
}

const setCursor = (e: Konva.KonvaEventObject<MouseEvent>, cursor: string) => {
  const stage = e.target.getStage();
  if (stage) stage.container().style.cursor = cursor;
};

// One block on the canvas: handles select, hover, drag and resize. Draws its content inside.
export default function BlockNode(props: Props) {
  const { block, x, y, height, selected, interactive, textTool, drawing, onSelect, onDragMove, onDragEnd, onResize, onEdit } = props;
  const [hoverHere, setHoverHere] = useState(false);
  const hover = props.passive ? !!props.hovered : hoverHere;
  const setHover = (h: boolean) => {
    setHoverHere(h);
    props.onHover?.(h);
  };
  // Was the block already selected when the mouse went down? Then one click on a text types in it.
  const wasSelected = useRef(false);
  // The click picked another block (Alt+click on blocks over each other): this one neither moves nor types.
  const passedOn = useRef(false);
  const width = block.layout.width;
  const media = block.type === "image" || block.type === "equation" || block.type === "shape" || block.type === "divider" || block.type === "mark" || block.type === "rule";
  const moveCursor = textTool ? "text" : "move";
  const groupRef = useRef<Konva.Group>(null);

  // After a drag or a resize, the node is put back where the exam says the block is. React only moves it when x/y change, and
  // a drop that lands where the block already was (pushed back, kept in its page…) changes nothing: the node would stay where
  // the mouse left it, and the page would show the block somewhere the exam (and so the PDF) does not have it.
  const [settled, setSettled] = useState(0);
  useLayoutEffect(() => {
    if (!settled) return;
    const node = groupRef.current;
    if (node && !node.isDragging() && (node.x() !== x || node.y() !== y)) node.position({ x, y });
  }, [settled, x, y]);

  // Resizing scales the group; turn that scale into a real width/height. The drawn height is what was
  // scaled (a text box can be taller than it was made, to fit its text).
  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scale({ x: 1, y: 1 });
    props.onResizing?.(null);
    onResize({ x: node.x(), y: node.y(), width: width * sx, height: height * sy });
    setSettled((n) => n + 1);
  };

  return (
    <Group
      ref={groupRef}
      id={props.passive ? undefined : block.id}
      x={x}
      y={y}
      opacity={props.ghost ? 0 : 1}
      draggable={interactive && !textTool && !drawing && !props.passive}
      listening={interactive && (!drawing || !!props.erasable) && !props.passive}
      onMouseDown={(e) => {
        if (props.erasable) return; // (the eraser rubs it, it does not pick it)
        wasSelected.current = selected;
        passedOn.current = !onSelect(e.evt.altKey, e.evt.shiftKey);
      }}
      onTap={() => {
        passedOn.current = false;
        onSelect();
      }}
      onDblClick={() => {
        if (!passedOn.current) onEdit(null);
      }}
      // (the canvas draws the dragged block over the others: ExamCanvas's drawOrder)
      onDragStart={(e) => {
        if (passedOn.current) return e.target.stopDrag();
        props.onDragStart();
      }}
      onDragMove={(e) => e.target.position(onDragMove(e.target.x(), e.target.y()))}
      onDragEnd={(e) => {
        onDragEnd(e.target.x(), e.target.y());
        setSettled((n) => n + 1);
      }}
      onTransform={(e) => props.onResizing?.({ x: e.target.x(), y: e.target.y(), width: width * e.target.scaleX(), height: height * e.target.scaleY() })}
      onTransformEnd={handleTransformEnd}
      onMouseEnter={(e) => {
        if (props.erasable) return;
        setHover(true);
        setCursor(e, moveCursor);
      }}
      onMouseLeave={(e) => {
        if (props.erasable) return;
        setHover(false);
        setCursor(e, "default");
      }}
    >
      {/* Background: also the area you can click and drag. Never opaque: the blocks may lie on top of each other (the paper is white) */}
      <Rect
        width={width}
        height={height}
        fill={media ? "transparent" : selected && interactive ? "#f7f7ff" : "#ffffff"}
        stroke={interactive && props.grouped ? "#4f46e5" : interactive && hover && !selected ? "#c7d2fe" : undefined}
        strokeWidth={props.grouped ? 1.5 / props.zoom : 1}
        dash={props.grouped ? [5 / props.zoom, 3 / props.zoom] : [4, 3]}
        cornerRadius={4}
        listening={!props.erasable}
      />
      <Content block={block} number={props.number} meta={props.meta} mode={props.mode} interactive={interactive} selected={selected} totalPoints={props.totalPoints} typing={props.typing} sheet={props.sheet} />

      {/* Invisible areas on top of the texts: double-click, click a selected block (or click with
          the T tool) to type there. A text box types on the first click, anywhere inside it. */}
      {interactive &&
        !props.erasable &&
        editRegions(withHints(block, props.meta.lang, { statement: selected }), props.number, props.meta, props.mode).map((r, k) => (
          <Rect
            key={`e${k}`}
            {...(r.hit ?? { x: r.x - 2, y: r.y - 1, width: r.width + 4, height: Math.max(r.height, 16) + 2 })}
            fill="transparent"
            stroke={hover && (textTool || selected) && !r.hit ? "#e0e7ff" : undefined}
            strokeWidth={1}
            cornerRadius={3}
            onMouseEnter={(e) => setCursor(e, textTool || selected || r.direct ? "text" : moveCursor)}
            onMouseLeave={(e) => setCursor(e, moveCursor)}
            onClick={(e) => {
              if (passedOn.current || (!textTool && !wasSelected.current && !r.direct)) return;
              e.cancelBubble = true;
              onEdit(r.field);
            }}
            onDblClick={(e) => {
              if (passedOn.current) return;
              e.cancelBubble = true;
              onEdit(r.field);
            }}
          />
        ))}

      {/* Click a circle / box to set the correct answer */}
      {interactive &&
        !props.erasable &&
        clickTargets(block, props.number, props.meta).map((t, k) => (
          <Rect
            key={`c${k}`}
            x={t.x}
            y={t.y}
            width={t.width}
            height={t.height}
            fill="transparent"
            onMouseEnter={(e) => setCursor(e, "pointer")}
            onMouseLeave={(e) => setCursor(e, moveCursor)}
            onClick={() => {
              if (!passedOn.current) props.onPatch(t.patch);
            }}
          />
        ))}

      {/* Drag the lines of the selected table to resize its columns and rows (not a fixed one: it is scaled as a whole, like a picture) */}
      {interactive && selected && !textTool && block.type === "table" && !isFixedTable(block) && (
        <TableHandles b={block} meta={props.meta} zoom={props.zoom} onPatch={props.onPatch} />
      )}
    </Group>
  );
}
