"use client";

import type Konva from "konva";
import { useState } from "react";
import { Group, Rect } from "react-konva";
import type { Block, Lang, ViewMode } from "@/app/_lib/types";
import { EquationView, ImageView, TableView, TextView } from "./blocks/ContentViews";
import HeaderView from "./blocks/HeaderView";
import { BlankView, McqView, OpenView, TrueFalseView } from "./blocks/QuestionViews";

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
  lang: Lang;
  mode: ViewMode;
  selected: boolean;
  interactive: boolean; // false when exporting
  onSelect: () => void;
  onDragMove: (x: number, y: number) => { x: number; y: number };
  onDragEnd: (x: number, y: number) => void;
  onResize: (r: ResizeResult) => void;
}

// What to draw inside the block.
function Content({ block, number, lang, mode }: Pick<Props, "block" | "number" | "lang" | "mode">) {
  switch (block.type) {
    case "mcq":
      return <McqView b={block} n={number} lang={lang} mode={mode} />;
    case "truefalse":
      return <TrueFalseView b={block} n={number} lang={lang} mode={mode} />;
    case "blank":
      return <BlankView b={block} n={number} lang={lang} mode={mode} />;
    case "open":
      return <OpenView b={block} n={number} lang={lang} mode={mode} />;
    case "text":
      return <TextView b={block} lang={lang} />;
    case "table":
      return <TableView b={block} lang={lang} />;
    case "equation":
      return <EquationView b={block} />;
    case "image":
      return <ImageView b={block} />;
    case "header":
      return <HeaderView b={block} lang={lang} mode={mode} />;
  }
}

// One block on the canvas: handles select, hover, drag and resize. Draws its content inside.
export default function BlockNode(props: Props) {
  const { block, x, y, height, selected, interactive, onSelect, onDragMove, onDragEnd, onResize } = props;
  const [hover, setHover] = useState(false);
  const width = block.layout.width;
  const media = block.type === "image" || block.type === "equation";

  const setCursor = (e: Konva.KonvaEventObject<MouseEvent>, cursor: string) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = cursor;
  };

  // Resizing scales the group; turn that scale into a real width/height.
  const handleTransformEnd = (e: Konva.KonvaEventObject<Event>) => {
    const node = e.target;
    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scale({ x: 1, y: 1 });
    onResize({ x: node.x(), y: node.y(), width: width * sx, height: block.layout.height * sy });
  };

  return (
    <Group
      id={block.id}
      x={x}
      y={y}
      draggable={interactive}
      listening={interactive}
      onMouseDown={onSelect}
      onTap={onSelect}
      onDragStart={(e) => e.target.moveToTop()}
      onDragMove={(e) => e.target.position(onDragMove(e.target.x(), e.target.y()))}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
      onTransformEnd={handleTransformEnd}
      onMouseEnter={(e) => {
        setHover(true);
        setCursor(e, "move");
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
      <Content block={block} number={props.number} lang={props.lang} mode={props.mode} />
    </Group>
  );
}
