"use client";

import { Circle, Group, Line, Rect } from "react-konva";
import {
  CHOICE_W,
  PAD,
  answerTextTop,
  dottedLineY,
  layoutBlank,
  layoutMcq,
  layoutOpen,
  layoutTrueFalse,
  type AnswerArea,
  type Spec,
  type TextBox,
} from "@/app/_lib/blockLayout";
import { words } from "@/app/_lib/i18n";
import type { BlankBlock, ExamMeta, McqBlock, OpenBlock, TrueFalseBlock, ViewMode } from "@/app/_lib/types";
import { OneLine, RichText } from "./shared";

interface ViewProps<B> {
  b: B;
  n: number;
  meta: ExamMeta;
  mode: ViewMode;
}

// Bold "3. Question text (2 pts)" line(s) at the top of every question.
function Title({ box, width, rtl }: { box: TextBox; width: number; rtl: boolean }) {
  return <RichText lines={box.lines} x={PAD} y={box.y} width={width - PAD * 2} rtl={rtl} />;
}

export function McqView({ b, n, meta, mode }: ViewProps<McqBlock>) {
  const L = layoutMcq(b, n, meta);
  const { rtl, body, keyColor } = L.F;
  const w = b.layout.width;

  return (
    <>
      <Title box={L.title} width={w} rtl={rtl} />
      {L.options.map((o, i) => {
        const isKey = mode === "key" && i === b.correct;
        return (
          <Group key={i}>
            <Circle
              x={rtl ? w - PAD - 9 : PAD + 9}
              y={o.y + body.line / 2}
              radius={7}
              stroke={isKey ? keyColor : "#374151"}
              strokeWidth={1.2}
              fill={isKey ? keyColor : undefined}
              listening={false}
            />
            <RichText lines={o.lines} x={rtl ? PAD : PAD + 30} y={o.y} width={w - PAD * 2 - 30} rtl={rtl} recolor={isKey ? [body.font.color, keyColor] : undefined} />
          </Group>
        );
      })}
    </>
  );
}

// A small checkbox; ticked in the answer color on the correction sheet.
function CheckBox({ x, y, checked, color }: { x: number; y: number; checked: boolean; color: string }) {
  return (
    <Group x={x} y={y} listening={false}>
      <Rect width={13} height={13} stroke={checked ? color : "#374151"} strokeWidth={1.2} cornerRadius={2} />
      {checked && <Line points={[3, 6.5, 5.5, 9.5, 10.5, 3.5]} stroke={color} strokeWidth={2} lineCap="round" lineJoin="round" />}
    </Group>
  );
}

export function TrueFalseView({ b, n, meta, mode }: ViewProps<TrueFalseBlock>) {
  const L = layoutTrueFalse(b, n, meta);
  const { rtl, body, keyColor } = L.F;
  const w = b.layout.width;
  const t = words(meta.lang);
  const colX = rtl ? PAD : w - PAD - CHOICE_W; // left edge of the choices column
  const choiceW = CHOICE_W / 2;

  return (
    <>
      <Title box={L.title} width={w} rtl={rtl} />
      {L.rows.map((row, i) => {
        const answer = b.statements[i].answer;
        return (
          <Group key={i}>
            <RichText lines={row.lines} x={rtl ? PAD + CHOICE_W + 10 : PAD} y={row.y} width={w - PAD * 2 - CHOICE_W - 10} rtl={rtl} />
            {[true, false].map((value, k) => {
              // In Arabic the first choice sits on the right.
              const cx = rtl ? colX + CHOICE_W - (k + 1) * choiceW : colX + k * choiceW;
              const checked = mode === "key" && answer === value;
              return (
                <Group key={k}>
                  <CheckBox x={rtl ? cx + choiceW - 15 : cx} y={row.y + (body.line - 13) / 2 - 1} checked={checked} color={keyColor} />
                  <Label spec={body} text={value ? t.true : t.false} x={rtl ? cx : cx + 19} y={row.y} width={choiceW - 22} bold={checked} color={checked ? keyColor : body.font.color} rtl={rtl} />
                </Group>
              );
            })}
          </Group>
        );
      })}
    </>
  );
}

// A short plain word in the block's font ("Vrai", "Faux").
function Label({ spec, text, x, y, width, bold, color, rtl }: { spec: Spec; text: string; x: number; y: number; width: number; bold: boolean; color: string; rtl: boolean }) {
  return <OneLine text={text} x={x} y={y + (spec.line - spec.font.size) / 2} width={width} size={spec.font.size} family={spec.font.family} bold={bold} color={color} rtl={rtl} />;
}

export function BlankView({ b, n, meta, mode }: ViewProps<BlankBlock>) {
  const L = layoutBlank(b, n, meta);
  const body = mode === "key" ? L.key : L.exam;
  return (
    <>
      <Title box={L.title} width={b.layout.width} rtl={L.F.rtl} />
      <RichText lines={body.lines} x={PAD} y={body.y} width={b.layout.width - PAD * 2} rtl={L.F.rtl} />
    </>
  );
}

export function OpenView({ b, n, meta, mode }: ViewProps<OpenBlock>) {
  const L = layoutOpen(b, n, meta);
  const { rtl, answer } = L.F;
  const w = b.layout.width;
  const keyMode = mode === "key";

  return (
    <>
      <Title box={L.title} width={w} rtl={rtl} />
      <Answer area={L.main} keyMode={keyMode} rtl={rtl} spec={answer} />
      {L.parts.map((p, i) => (
        <Group key={i}>
          <RichText lines={p.text.lines} x={p.area.x} y={p.text.y} width={p.area.width} rtl={rtl} />
          <Answer area={p.area} keyMode={keyMode} rtl={rtl} spec={answer} />
        </Group>
      ))}
    </>
  );
}

// Dotted lines for the student; on the correction sheet the model answer is written ON them.
function Answer({ area, keyMode, rtl, spec }: { area: AnswerArea; keyMode: boolean; rtl: boolean; spec: Spec }) {
  const hasText = area.text.lines.some((l) => l.pieces.some((p) => p.text.trim()));
  return (
    <>
      {Array.from({ length: area.count }, (_, i) => {
        const y = dottedLineY(area, i);
        return <Line key={i} points={[area.x, y, area.x + area.width, y]} stroke="#9ca3af" strokeWidth={1} dash={[2, 4]} listening={false} />;
      })}
      {keyMode && hasText && (
        <RichText lines={area.text.lines} x={area.x} y={answerTextTop(area, spec.font.size)} width={area.width} rtl={rtl} step={area.line} />
      )}
    </>
  );
}
