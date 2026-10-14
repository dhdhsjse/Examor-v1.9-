"use client";

import type Konva from "konva";
import { Circle, Group, Rect, Text } from "react-konva";
import { MCQ_STYLE, mcqHeight } from "@/app/_lib/questions";
import type { McqQuestion } from "@/app/_lib/types";

const FONT = "Segoe UI, Tahoma, Arial, sans-serif"; // both support Arabic + French
const LETTERS = ["A", "B", "C", "D", "E", "F"];

interface Props {
  question: McqQuestion;
  x: number; // position on the canvas
  y: number;
  number: number;
  selected: boolean;
  onSelect: () => void;
  // Called while dragging; returns the adjusted (snapped) position.
  onDragMove: (x: number, y: number) => { x: number; y: number };
  onDragEnd: (x: number, y: number) => void;
}

// One multiple-choice question drawn on the page. Can be dragged around.
export default function McqBlock({ question, x, y, number, selected, onSelect, onDragMove, onDragEnd }: Props) {
  const { width } = question.layout;
  const height = mcqHeight(question);
  const s = MCQ_STYLE;

  const setCursor = (e: Konva.KonvaEventObject<MouseEvent>, cursor: string) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = cursor;
  };

  return (
    <Group
      x={x}
      y={y}
      draggable
      onMouseDown={onSelect}
      onDragStart={(e) => e.target.moveToTop()}
      onDragMove={(e) => e.target.position(onDragMove(e.target.x(), e.target.y()))}
      onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
      onMouseEnter={(e) => setCursor(e, "move")}
      onMouseLeave={(e) => setCursor(e, "default")}
    >
      {/* Background + selection outline */}
      <Rect
        width={width}
        height={height}
        fill={selected ? "#f7f7ff" : "#ffffff"}
        cornerRadius={6}
        stroke={selected ? "#4f46e5" : "transparent"}
        strokeWidth={1.5}
      />

      {/* Question number + text */}
      <Text
        x={s.padding}
        y={s.padding}
        width={width - s.padding * 2}
        height={s.titleHeight}
        text={`${number}. ${question.text}`}
        fontFamily={FONT}
        fontSize={15}
        fontStyle="bold"
        fill="#111827"
        verticalAlign="middle"
        wrap="none"
        ellipsis
      />

      {/* Options: a small circle + letter + text */}
      {question.options.map((opt, i) => {
        const rowY = s.padding + s.titleHeight + s.gap + i * s.optionHeight;
        return (
          <Group key={i} x={s.padding + 12} y={rowY}>
            <Circle x={8} y={s.optionHeight / 2} radius={7} stroke="#374151" strokeWidth={1.2} />
            <Text
              x={26}
              width={width - s.padding * 2 - 40}
              height={s.optionHeight}
              text={`${LETTERS[i]})  ${opt}`}
              fontFamily={FONT}
              fontSize={14}
              fill="#1f2937"
              verticalAlign="middle"
              wrap="none"
              ellipsis
            />
          </Group>
        );
      })}
    </Group>
  );
}
