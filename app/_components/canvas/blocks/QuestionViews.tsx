"use client";

import { Circle, Group, Line, Rect, Shape } from "react-konva";
import {
  CHOICE_W,
  GRID_STEP,
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
  type WordBank,
} from "@/app/_lib/blockLayout";
import { mcqAnswers } from "@/app/_lib/blocks";
import { words } from "@/app/_lib/i18n";
import type { AnswerStyle, BlankBlock, ExamMeta, McqBlock, OpenBlock, TrueFalseBlock, ViewMode } from "@/app/_lib/types";
import { OneLine, RichText } from "./shared";

export interface ViewProps<B> {
  b: B;
  n: number;
  meta: ExamMeta;
  mode: ViewMode;
}

// Bold "3. Question text (2 pts)" line(s) at the top of every question.
export function Title({ box, width, rtl }: { box: TextBox; width: number; rtl: boolean }) {
  return <RichText lines={box.lines} x={PAD} y={box.y} width={width - PAD * 2} rtl={rtl} />;
}

export function McqView({ b, n, meta, mode }: ViewProps<McqBlock>) {
  const L = layoutMcq(b, n, meta);
  const { rtl, body, keyColor } = L.F;
  const answers = mcqAnswers(b);

  return (
    <>
      <Title box={L.title} width={b.layout.width} rtl={rtl} />
      {L.options.map((o, i) => {
        const isKey = mode === "key" && answers.includes(i);
        const cy = o.y + body.line / 2;
        return (
          <Group key={i}>
            {/* Several answers: square boxes to tick. One answer: circles. */}
            {b.multi ? (
              <CheckBox x={o.markX - 6.5} y={cy - 6.5} checked={isKey} color={keyColor} />
            ) : (
              <Circle x={o.markX} y={cy} radius={7} stroke={isKey ? keyColor : "#374151"} strokeWidth={1.2} fill={isKey ? keyColor : undefined} listening={false} />
            )}
            <RichText lines={o.lines} x={o.x} y={o.y} width={o.width} rtl={rtl} recolor={isKey ? [body.font.color, keyColor] : undefined} />
          </Group>
        );
      })}
    </>
  );
}

// A small checkbox; ticked in the answer color on the correction sheet.
export function CheckBox({ x, y, checked, color }: { x: number; y: number; checked: boolean; color: string }) {
  return (
    <Group x={x} y={y} listening={false}>
      <Rect width={13} height={13} stroke={checked ? color : "#374151"} strokeWidth={1.2} cornerRadius={2} />
      {checked && <Line points={[3, 6.5, 5.5, 9.5, 10.5, 3.5]} stroke={color} strokeWidth={2} lineCap="round" lineJoin="round" />}
    </Group>
  );
}

export function TrueFalseView({ b, n, meta, mode }: ViewProps<TrueFalseBlock>) {
  const L = layoutTrueFalse(b, n, meta);
  const { rtl, body, keyColor, answer: answerSpec } = L.F;
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
            {row.fix && <Answer area={row.fix} keyMode={mode === "key"} rtl={rtl} spec={answerSpec} />}
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

// The framed box of words (fill in the blank, classification).
export function WordBankView({ bank, rtl }: { bank: WordBank; rtl: boolean }) {
  const inset = 9;
  return (
    <>
      <Rect x={bank.x} y={bank.y} width={bank.width} height={bank.height} stroke={bank.ghost ? "#c7cbd3" : "#6b7280"} strokeWidth={1} dash={[5, 3]} cornerRadius={6} fill={bank.ghost ? "#fafafb" : undefined} listening={false} />
      <RichText lines={bank.text.lines} x={bank.x + inset} y={bank.text.y} width={bank.width - inset * 2} rtl={rtl} align="center" />
    </>
  );
}

export function BlankView({ b, n, meta, mode }: ViewProps<BlankBlock>) {
  const L = layoutBlank(b, n, meta);
  const body = mode === "key" ? L.key : L.exam;
  return (
    <>
      <Title box={L.title} width={b.layout.width} rtl={L.F.rtl} />
      {L.bank && <WordBankView bank={L.bank} rtl={L.F.rtl} />}
      <RichText lines={body.lines} x={PAD} y={body.y} width={b.layout.width - PAD * 2} rtl={L.F.rtl} />
    </>
  );
}

export function OpenView({ b, n, meta, mode }: ViewProps<OpenBlock>) {
  const L = layoutOpen(b, n, meta);
  const { rtl, answer } = L.F;
  const w = b.layout.width;
  const keyMode = mode === "key";
  const style = b.answerStyle ?? "dotted";

  return (
    <>
      <Title box={L.title} width={w} rtl={rtl} />
      {L.context && <RichText lines={L.context.lines} x={PAD} y={L.context.y} width={w - PAD * 2} rtl={rtl} />}
      <Answer area={L.main} keyMode={keyMode} rtl={rtl} spec={answer} style={style} />
      {L.parts.map((p, i) => (
        <Group key={i}>
          <RichText lines={p.text.lines} x={p.area.x} y={p.text.y} width={p.area.width} rtl={rtl} />
          <Answer area={p.area} keyMode={keyMode} rtl={rtl} spec={answer} style={style} />
        </Group>
      ))}
    </>
  );
}

// Where the student writes: dotted or plain lines, squared paper, a frame, or empty space.
// On the correction sheet the model answer is written on top.
export function Answer({ area, keyMode, rtl, spec, style = "dotted" }: { area: AnswerArea; keyMode: boolean; rtl: boolean; spec: Spec; style?: AnswerStyle }) {
  const hasText = area.text.lines.some((l) => l.pieces.some((p) => p.text.trim()));
  const { x, y, width, height } = area;
  return (
    <>
      {(style === "dotted" || style === "lines") &&
        Array.from({ length: area.count }, (_, i) => {
          const ly = dottedLineY(area, i);
          return (
            <Line
              key={i}
              points={[x, ly, x + width, ly]}
              stroke={style === "dotted" ? "#9ca3af" : "#cbd5e1"}
              strokeWidth={1}
              dash={style === "dotted" ? [2, 4] : undefined}
              listening={false}
            />
          );
        })}
      {style === "grid" && height > 0 && (
        <Shape
          listening={false}
          stroke="#cbd5e1"
          strokeWidth={0.7}
          sceneFunc={(ctx, shape) => {
            ctx.beginPath();
            const bottom = y + height - 2;
            for (let gx = x; gx <= x + width + 0.5; gx += GRID_STEP) {
              ctx.moveTo(gx, y + 2);
              ctx.lineTo(gx, bottom);
            }
            for (let gy = y + 2; gy <= bottom + 0.5; gy += GRID_STEP) {
              ctx.moveTo(x, gy);
              ctx.lineTo(x + Math.floor(width / GRID_STEP) * GRID_STEP, gy);
            }
            ctx.strokeShape(shape);
          }}
        />
      )}
      {style === "box" && height > 0 && <Rect x={x} y={y + 2} width={width} height={height - 4} stroke="#9ca3af" strokeWidth={1} cornerRadius={4} listening={false} />}
      {keyMode && hasText && <RichText lines={area.text.lines} x={x} y={answerTextTop(area, spec.font.size)} width={width} rtl={rtl} step={area.line} />}
    </>
  );
}
