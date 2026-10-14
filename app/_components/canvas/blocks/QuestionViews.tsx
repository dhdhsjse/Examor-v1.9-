"use client";

import { Circle, Group, Line, Rect } from "react-konva";
import {
  ANSWER_LINE,
  BODY,
  CHOICE_W,
  PAD,
  TITLE,
  layoutBlank,
  layoutMcq,
  layoutOpen,
  layoutTrueFalse,
  type AnswerArea,
} from "@/app/_lib/blockLayout";
import { isRtl, words } from "@/app/_lib/i18n";
import type { BlankBlock, Lang, McqBlock, OpenBlock, TrueFalseBlock, ViewMode } from "@/app/_lib/types";
import { INK, KEY, Lines } from "./shared";

interface ViewProps<B> {
  b: B;
  n: number;
  lang: Lang;
  mode: ViewMode;
}

// Bold "3. Question text (2 pts)" line(s) at the top of every question.
function Title({ lines, y, width, rtl }: { lines: string[]; y: number; width: number; rtl: boolean }) {
  return <Lines lines={lines} x={PAD} y={y} width={width - PAD * 2} size={TITLE.size} line={TITLE.line} bold rtl={rtl} />;
}

export function McqView({ b, n, lang, mode }: ViewProps<McqBlock>) {
  const L = layoutMcq(b, n, lang);
  const rtl = isRtl(lang);
  const w = b.layout.width;

  return (
    <>
      <Title lines={L.title.lines} y={L.title.y} width={w} rtl={rtl} />
      {L.options.map((o, i) => {
        const isKey = mode === "key" && i === b.correct;
        return (
          <Group key={i}>
            <Circle
              x={rtl ? w - PAD - 9 : PAD + 9}
              y={o.y + BODY.line / 2}
              radius={7}
              stroke={isKey ? KEY : "#374151"}
              strokeWidth={1.2}
              fill={isKey ? KEY : undefined}
              listening={false}
            />
            <Lines
              lines={o.lines}
              x={rtl ? PAD : PAD + 30}
              y={o.y}
              width={w - PAD * 2 - 30}
              size={BODY.size}
              line={BODY.line}
              bold={isKey}
              color={isKey ? KEY : INK}
              rtl={rtl}
            />
          </Group>
        );
      })}
    </>
  );
}

// A small checkbox; ticked in green on the correction sheet.
function CheckBox({ x, y, checked }: { x: number; y: number; checked: boolean }) {
  return (
    <Group x={x} y={y} listening={false}>
      <Rect width={13} height={13} stroke={checked ? KEY : "#374151"} strokeWidth={1.2} cornerRadius={2} />
      {checked && <Line points={[3, 6.5, 5.5, 9.5, 10.5, 3.5]} stroke={KEY} strokeWidth={2} lineCap="round" lineJoin="round" />}
    </Group>
  );
}

export function TrueFalseView({ b, n, lang, mode }: ViewProps<TrueFalseBlock>) {
  const L = layoutTrueFalse(b, n, lang);
  const rtl = isRtl(lang);
  const w = b.layout.width;
  const t = words(lang);
  const colX = rtl ? PAD : w - PAD - CHOICE_W; // left edge of the choices column
  const choiceW = CHOICE_W / 2;

  return (
    <>
      <Title lines={L.title.lines} y={L.title.y} width={w} rtl={rtl} />
      {L.rows.map((row, i) => {
        const answer = b.statements[i].answer;
        return (
          <Group key={i}>
            <Lines
              lines={row.lines}
              x={rtl ? PAD + CHOICE_W + 10 : PAD}
              y={row.y}
              width={w - PAD * 2 - CHOICE_W - 10}
              size={BODY.size}
              line={BODY.line}
              rtl={rtl}
            />
            {[true, false].map((value, k) => {
              // In Arabic the first choice sits on the right.
              const cx = rtl ? colX + CHOICE_W - (k + 1) * choiceW : colX + k * choiceW;
              const checked = mode === "key" && answer === value;
              return (
                <Group key={k}>
                  <CheckBox x={rtl ? cx + choiceW - 15 : cx} y={row.y + 3} checked={checked} />
                  <Lines
                    lines={[value ? t.true : t.false]}
                    x={rtl ? cx : cx + 19}
                    y={row.y}
                    width={choiceW - 22}
                    size={BODY.size}
                    line={BODY.line}
                    bold={checked}
                    color={checked ? KEY : INK}
                    rtl={rtl}
                  />
                </Group>
              );
            })}
          </Group>
        );
      })}
    </>
  );
}

export function BlankView({ b, n, lang, mode }: ViewProps<BlankBlock>) {
  const L = layoutBlank(b, n, lang);
  const rtl = isRtl(lang);
  const w = b.layout.width;
  const body = mode === "key" ? L.key : L.exam;

  return (
    <>
      <Title lines={L.title.lines} y={L.title.y} width={w} rtl={rtl} />
      <Lines
        lines={body.lines}
        x={PAD}
        y={body.y}
        width={w - PAD * 2}
        size={BODY.size}
        line={BODY.line}
        color={mode === "key" ? KEY : INK}
        rtl={rtl}
      />
    </>
  );
}

export function OpenView({ b, n, lang, mode }: ViewProps<OpenBlock>) {
  const L = layoutOpen(b, n, lang);
  const rtl = isRtl(lang);
  const w = b.layout.width;

  return (
    <>
      <Title lines={L.title.lines} y={L.title.y} width={w} rtl={rtl} />
      <Answer area={L.main} keyMode={mode === "key"} rtl={rtl} />
      {L.parts.map((p, i) => (
        <Group key={i}>
          <Lines lines={p.text.lines} x={p.area.x} y={p.text.y} width={p.area.width} size={BODY.size} line={BODY.line} rtl={rtl} />
          <Answer area={p.area} keyMode={mode === "key"} rtl={rtl} />
        </Group>
      ))}
    </>
  );
}

// Dotted lines for the student; the model answer in green on the correction sheet.
function Answer({ area, keyMode, rtl }: { area: AnswerArea; keyMode: boolean; rtl: boolean }) {
  return (
    <>
      {Array.from({ length: area.count }, (_, i) => {
        const y = area.y + (i + 1) * ANSWER_LINE - 4;
        return <Line key={i} points={[area.x, y, area.x + area.width, y]} stroke="#9ca3af" strokeWidth={1} dash={[2, 4]} listening={false} />;
      })}
      {keyMode && area.text.lines.join("").trim() && (
        <Lines lines={area.text.lines} x={area.x} y={area.y - 4} width={area.width} size={BODY.size} line={ANSWER_LINE} color={KEY} rtl={rtl} />
      )}
    </>
  );
}
