"use client";

import { Circle, Line, Rect } from "react-konva";
import { HEADER_HEIGHT } from "@/app/_lib/blockLayout";
import { isRtl, words } from "@/app/_lib/i18n";
import type { HeaderBlock, Lang, ViewMode } from "@/app/_lib/types";
import { INK, MUTED, OneLine } from "./shared";

interface Props {
  b: HeaderBlock;
  lang: Lang;
  mode: ViewMode;
}

const DOTS = "....................................";

// The exam header from the template (3 styles). Mirrors itself for Arabic.
export default function HeaderView({ b, lang, mode }: Props) {
  const W = b.layout.width;
  const H = HEADER_HEIGHT[b.style];
  const rtl = isRtl(lang);
  const t = words(lang);
  const f = b.fields;
  const title = mode === "key" ? `${f.title} — ${t.key}` : f.title;
  const start = rtl ? "right" : "left";
  const end = rtl ? "left" : "right";
  // x of a box placed at `x` (measured from the start side).
  const at = (x: number, w: number) => (rtl ? W - x - w : x);
  const sub = [f.subject, f.level, f.duration].filter(Boolean).join("  ·  ");

  if (b.style === "modern") {
    return (
      <>
        <Rect width={W} height={84} fill="#eef2ff" cornerRadius={10} listening={false} />
        <OneLine text={title} x={at(18, W - 150)} y={14} width={W - 150} size={21} bold color="#312e81" rtl={rtl} />
        <OneLine text={sub} x={at(18, W - 150)} y={46} width={W - 150} size={13} color="#4338ca" rtl={rtl} />
        <OneLine text={[f.school, f.year].filter(Boolean).join("  —  ")} x={at(18, W - 150)} y={65} width={W - 150} size={11} color="#6366f1" rtl={rtl} />
        <Circle x={rtl ? 56 : W - 56} y={42} radius={32} fill="#ffffff" stroke="#6366f1" strokeWidth={1.5} listening={false} />
        <OneLine text={t.score} x={(rtl ? 56 : W - 56) - 30} y={22} width={60} size={10} color={MUTED} rtl={rtl} align="center" />
        <OneLine text={`/ ${f.outOf}`} x={(rtl ? 56 : W - 56) - 30} y={40} width={60} size={15} bold color="#312e81" rtl={rtl} align="center" />
        <OneLine text={`${t.name} : ${DOTS}${DOTS}      ${t.class} : ${DOTS}`} x={0} y={102} width={W} size={13} rtl={rtl} />
      </>
    );
  }

  if (b.style === "minimal") {
    return (
      <>
        <OneLine text={f.school} x={at(0, W / 2)} y={0} width={W / 2} size={12} color={MUTED} rtl={rtl} align={start} />
        <OneLine text={`${t.year} : ${f.year}`} x={at(W / 2, W / 2)} y={0} width={W / 2} size={12} color={MUTED} rtl={rtl} align={end} />
        <OneLine text={title} x={0} y={22} width={W} size={20} bold rtl={rtl} align="center" />
        <OneLine text={sub} x={0} y={50} width={W} size={12} color={MUTED} rtl={rtl} align="center" />
        <Line points={[0, 74, W, 74]} stroke={INK} strokeWidth={1} listening={false} />
        <OneLine text={`${t.name} : ${DOTS}${DOTS}`} x={at(0, W * 0.62)} y={88} width={W * 0.62} size={13} rtl={rtl} align={start} />
        <OneLine text={`${t.score} : ........ / ${f.outOf}`} x={at(W * 0.62, W * 0.38)} y={88} width={W * 0.38} size={13} bold rtl={rtl} align={end} />
      </>
    );
  }

  // Classic: a boxed table with 3 columns, then name + score box.
  const r1 = 92;
  return (
    <>
      <Rect width={W} height={H} stroke={INK} strokeWidth={1.2} fill="#ffffff" listening={false} />
      <Line points={[W * 0.3, 0, W * 0.3, r1]} stroke={INK} strokeWidth={1} listening={false} />
      <Line points={[W * 0.7, 0, W * 0.7, r1]} stroke={INK} strokeWidth={1} listening={false} />
      <Line points={[0, r1, W, r1]} stroke={INK} strokeWidth={1} listening={false} />
      <Line points={[rtl ? W * 0.25 : W * 0.75, r1, rtl ? W * 0.25 : W * 0.75, H]} stroke={INK} strokeWidth={1} listening={false} />

      <OneLine text={f.school} x={at(10, W * 0.3 - 20)} y={22} width={W * 0.3 - 20} size={13} bold rtl={rtl} />
      <OneLine text={`${t.year} : ${f.year}`} x={at(10, W * 0.3 - 20)} y={52} width={W * 0.3 - 20} size={12} color={MUTED} rtl={rtl} />

      <OneLine text={title} x={W * 0.3 + 10} y={22} width={W * 0.4 - 20} size={18} bold rtl={rtl} align="center" />
      <OneLine text={f.subject} x={W * 0.3 + 10} y={54} width={W * 0.4 - 20} size={13} color={MUTED} rtl={rtl} align="center" />

      <OneLine text={`${t.level} : ${f.level}`} x={at(W * 0.7 + 10, W * 0.3 - 20)} y={22} width={W * 0.3 - 20} size={12} rtl={rtl} />
      <OneLine text={`${t.duration} : ${f.duration}`} x={at(W * 0.7 + 10, W * 0.3 - 20)} y={52} width={W * 0.3 - 20} size={12} rtl={rtl} />

      <OneLine text={`${t.name} : ${DOTS}${DOTS}`} x={at(10, W * 0.75 - 20)} y={r1 + 12} width={W * 0.75 - 20} size={13} rtl={rtl} />
      <OneLine text={`${t.class} : ${DOTS}`} x={at(10, W * 0.75 - 20)} y={r1 + 34} width={W * 0.75 - 20} size={13} rtl={rtl} />
      <OneLine text={t.score} x={at(W * 0.75, W * 0.25)} y={r1 + 8} width={W * 0.25} size={12} bold rtl={rtl} align="center" />
      <OneLine text={`....... / ${f.outOf}`} x={at(W * 0.75, W * 0.25)} y={r1 + 32} width={W * 0.25} size={14} rtl={rtl} align="center" />
    </>
  );
}
