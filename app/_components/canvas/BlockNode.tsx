"use client";

import type Konva from "konva";
import { useRef, useState } from "react";
import { Group, Rect } from "react-konva";
import { withHints } from "@/app/_lib/blocks";
import { clickTargets, editRegions, type EditField } from "@/app/_lib/editRegions";
import type { Block, ExamMeta, ViewMode } from "@/app/_lib/types";
import type { BlockPatch } from "@/app/_lib/useExam";
import { EquationView, ImageView, TableView, TextboxView, TextView } from "./blocks/ContentViews";
import { GraphView } from "./blocks/GraphView";
import { ShapeView } from "./blocks/ShapeView";
import { HeaderNode } from "./blocks/headerParts";
import { ClassifyView, MatchView, OrderView } from "./blocks/MoreQuestionViews";
import { BlankView, McqView, OpenView, TrueFalseView } from "./blocks/QuestionViews";
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
  zoom: number;
  selected: boolean;
  interactive: boolean; // false when exporting
  textTool: boolean; // "T" tool: one click starts typing
  drawing: boolean; // a box is being drawn on the page (text box tool): blocks ignore the mouse
  onSelect: () => void;
  onDragStart: () => void;
  onDragMove: (x: number, y: number) => { x: number; y: number };
  onDragEnd: (x: number, y: number) => void;
  onResize: (r: ResizeResult) => void;
  onResizing?: (r: ResizeResult | null) => void; // where the block is while its handles are dragged (null = done)
  onEdit: (field: EditField | null) => void; // null = block without text (equation, image...)
  onPatch: (patch: BlockPatch) => void;
}

// What to draw inside the block.
function Content({ block: real, number, meta, mode, interactive, selected, totalPoints }: Pick<Props, "block" | "number" | "meta" | "mode" | "interactive" | "selected" | "totalPoints">) {
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
      return <TextboxView b={block} meta={meta} interactive={interactive} />;
    case "table":
      return <TableView b={block} meta={meta} />;
    case "equation":
      // An empty equation is only a hint on screen: it is not printed.
      return interactive || block.latex.trim() ? <EquationView b={block} /> : null;
    case "image":
      return <ImageView b={block} />;
    case "graph":
      return <GraphView b={block} />;
    case "shape":
      return <ShapeView b={block} />;
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
  const [hover, setHover] = useState(false);
  // Was the block already selected when the mouse went down? Then one click on a text types in it.
  const wasSelected = useRef(false);
  const width = block.layout.width;
  const media = block.type === "image" || block.type === "equation" || block.type === "shape";
  const moveCursor = textTool ? "text" : "move";

  // Resizing scales the group; turn that scale into a real width/height. The drawn height is what was
  // scaled (a text box can be taller than it was made, to fit its text).
  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scale({ x: 1, y: 1 });
    props.onResizing?.(null);
    onResize({ x: node.x(), y: node.y(), width: width * sx, height: height * sy });
  };

  return (
    <Group
      id={block.id}
      x={x}
      y={y}
      draggable={interactive && !textTool && !drawing && !block.meta?.slot}
      listening={interactive && !drawing}
      onMouseDown={() => {
        wasSelected.current = selected;
        onSelect();
      }}
      onTap={onSelect}
      onDblClick={() => onEdit(null)}
      onDragStart={(e) => {
        e.target.moveToTop();
        props.onDragStart();
      }}
      onDragMove={(e) => e.target.position(onDragMove(e.target.x(), e.target.y()))}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
      onTransform={(e) => props.onResizing?.({ x: e.target.x(), y: e.target.y(), width: width * e.target.scaleX(), height: height * e.target.scaleY() })}
      onTransformEnd={handleTransformEnd}
      onMouseEnter={(e) => {
        setHover(true);
        setCursor(e, moveCursor);
      }}
      onMouseLeave={(e) => {
        setHover(false);
        setCursor(e, "default");
      }}
    >
      {/* Background: also the area you can click and drag */}
      <Rect
        width={width}
        height={height}
        fill={media ? "transparent" : selected && interactive ? "#f7f7ff" : "#ffffff"}
        stroke={interactive && hover && !selected ? "#c7d2fe" : undefined}
        strokeWidth={1}
        dash={[4, 3]}
        cornerRadius={4}
      />
      <Content block={block} number={props.number} meta={props.meta} mode={props.mode} interactive={interactive} selected={selected} totalPoints={props.totalPoints} />

      {/* Invisible areas on top of the texts: double-click, click a selected block (or click with
          the T tool) to type there. A text box types on the first click, anywhere inside it. */}
      {interactive &&
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
              if (!textTool && !wasSelected.current && !r.direct) return;
              e.cancelBubble = true;
              onEdit(r.field);
            }}
            onDblClick={(e) => {
              e.cancelBubble = true;
              onEdit(r.field);
            }}
          />
        ))}

      {/* Click a circle / box to set the correct answer */}
      {interactive &&
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
            onClick={() => props.onPatch(t.patch)}
          />
        ))}

      {/* Drag the lines of the selected table to resize its columns and rows */}
      {interactive && selected && !textTool && block.type === "table" && (
        <TableHandles b={block} meta={props.meta} zoom={props.zoom} onPatch={props.onPatch} />
      )}
    </Group>
  );
}
