"use client";

import { Circle, Group, Line, Rect } from "react-konva";
import { MATCH_DOT, PAD, RANK_BOX, layoutClassify, layoutMatch, layoutOrder } from "@/app/_lib/blockLayout";
import { plainText } from "@/app/_lib/richText";
import type { ClassifyBlock, MatchBlock, OrderBlock } from "@/app/_lib/types";
import { Answer, Title, WordBankView, type ViewProps } from "./QuestionViews";
import { INK, OneLine, RichText } from "./shared";

// Two columns with a dot on each inner side; the correction sheet joins the matching dots.
export function MatchView({ b, n, meta, mode }: ViewProps<MatchBlock>) {
  const L = layoutMatch(b, n, meta);
  const { rtl, keyColor } = L.F;
  return (
    <>
      <Title box={L.title} width={b.layout.width} rtl={rtl} />
      {L.rows.map((r, k) => (
        <Group key={k}>
          <RichText lines={r.left.lines} x={r.left.x} y={r.left.y} width={r.left.width} rtl={rtl} />
          <RichText lines={r.right.lines} x={r.right.x} y={r.right.y} width={r.right.width} rtl={rtl} />
          <Circle x={r.leftDot.x} y={r.leftDot.y} radius={MATCH_DOT} fill={INK} listening={false} />
          <Circle x={r.rightDot.x} y={r.rightDot.y} radius={MATCH_DOT} fill={INK} listening={false} />
        </Group>
      ))}
      {mode === "key" &&
        L.rows.map((r, k) => {
          // Left item k belongs with the row where pair k's right item is printed.
          const to = L.rows.find((x) => x.pair === k);
          return to ? (
            <Line key={`k${k}`} points={[r.leftDot.x, r.leftDot.y, to.rightDot.x, to.rightDot.y]} stroke={keyColor} strokeWidth={1.8} lineCap="round" listening={false} />
          ) : null;
        })}
    </>
  );
}

// A box before each item for its rank, or mixed-up words to write as a sentence.
export function OrderView({ b, n, meta, mode }: ViewProps<OrderBlock>) {
  const L = layoutOrder(b, n, meta);
  const { rtl, keyColor, body, answer } = L.F;
  const keyMode = mode === "key";
  return (
    <>
      <Title box={L.title} width={b.layout.width} rtl={rtl} />
      {L.sentence && (
        <>
          <RichText lines={L.sentence.words.lines} x={PAD} y={L.sentence.words.y} width={b.layout.width - PAD * 2} rtl={rtl} />
          <Answer area={L.sentence.area} keyMode={keyMode} rtl={rtl} spec={answer} />
        </>
      )}
      {L.rows.map((r, k) => (
        <Group key={k}>
          <Rect x={r.boxX} y={r.boxY} width={RANK_BOX} height={RANK_BOX} stroke={keyMode ? keyColor : "#374151"} strokeWidth={1.2} cornerRadius={3} listening={false} />
          {keyMode && (
            <OneLine text={String(r.item + 1)} x={r.boxX} y={r.boxY + (RANK_BOX - body.font.size) / 2 + 1} width={RANK_BOX} size={body.font.size} family={body.font.family} bold color={keyColor} rtl={false} align="center" />
          )}
          <RichText lines={r.text.lines} x={r.text.x} y={r.text.y} width={r.text.width} rtl={rtl} />
        </Group>
      ))}
    </>
  );
}

// The box of words, then a table with one column per category (filled in on the correction sheet).
export function ClassifyView({ b, n, meta, mode }: ViewProps<ClassifyBlock>) {
  const L = layoutClassify(b, n, meta);
  const { rtl, keyColor, answer } = L.F;
  const T = L.table;
  const x0 = PAD;
  const W = b.layout.width - PAD * 2;
  return (
    <>
      <Title box={L.title} width={b.layout.width} rtl={rtl} />
      {L.bank && <WordBankView bank={L.bank} rtl={rtl} />}
      <Group listening={false}>
        <Rect x={x0} y={T.y} width={W} height={T.headH} fill="#f3f4f6" />
        {L.heads.map((h, c) => (
          <RichText key={c} lines={h.lines} x={h.x} y={T.y + (T.headH - h.height) / 2} width={h.width} rtl={rtl} align="center" />
        ))}
        <Line points={[x0, T.y + T.headH, x0 + W, T.y + T.headH]} stroke={INK} strokeWidth={1} />
        {Array.from({ length: T.rowCount - 1 }, (_, r) => {
          const ly = T.y + T.headH + (r + 1) * T.rowH;
          return <Line key={r} points={[x0, ly, x0 + W, ly]} stroke="#d1d5db" strokeWidth={1} />;
        })}
        {T.colX.map((cx, c) => cx > x0 + 0.5 && <Line key={`c${c}`} points={[cx, T.y, cx, T.y + T.height]} stroke={INK} strokeWidth={1} />)}
        <Rect x={x0} y={T.y} width={W} height={T.height} stroke={INK} strokeWidth={1.2} />
        {mode === "key" &&
          b.groups.flatMap((g, c) =>
            g.items.map((item, r) => (
              <OneLine
                key={`${c}-${r}`}
                text={plainText(item)}
                x={T.colX[c] + 6}
                y={T.y + T.headH + r * T.rowH + (T.rowH - answer.font.size) / 2}
                width={T.colW - 12}
                size={answer.font.size}
                family={answer.font.family}
                color={keyColor}
                rtl={rtl}
                align="center"
              />
            )),
          )}
      </Group>
    </>
  );
}
