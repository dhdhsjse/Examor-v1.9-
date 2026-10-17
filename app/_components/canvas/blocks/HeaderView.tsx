"use client";

import { Circle, Line, Rect } from "react-konva";
import { HEADER_HEIGHT } from "@/app/_lib/blockLayout";
import { fontStack } from "@/app/_lib/fonts";
import { isRtl, words } from "@/app/_lib/i18n";
import type { ExamMeta, HeaderBlock, ViewMode } from "@/app/_lib/types";
import { MODERN_HEADER_STYLES, ModernHeaderView } from "./ModernHeaderViews";
import { MORE_HEADER_STYLES, MoreHeaderView } from "./MoreHeaderViews";
import { INK, MUTED, OneLine, tint } from "./shared";

interface Props {
  b: HeaderBlock;
  meta: ExamMeta;
  mode: ViewMode;
  totalPoints: number;
}

const DOTS = "....................................";
// Keep "/ 20" left-to-right inside Arabic text (otherwise it shows as "20 /").
const ltr = (s: string) => `⁦${s}⁩`;

// The exam header (23 styles). Mirrors itself for Arabic. The teacher's accent color, when set,
// replaces each style's own color.
export default function HeaderView({ b, meta, mode, totalPoints }: Props) {
  const lang = meta.lang;
  const family = fontStack(b.font?.family || meta.fontFamily);
  const W = b.layout.width;
  const H = HEADER_HEIGHT[b.style] ?? HEADER_HEIGHT.classic;
  const rtl = isRtl(lang);
  const t = words(lang);
  const f = b.fields;
  const title = mode === "key" ? `${f.title} — ${t.key}` : f.title;
  const start = rtl ? "right" : "left";
  const end = rtl ? "left" : "right";
  // x of a box placed at `x` (measured from the start side).
  const at = (x: number, w: number) => (rtl ? W - x - w : x);
  const sub = [f.subject, f.level, f.duration].filter(Boolean).join("  ·  ");
  // Graded out of: the total of the questions when the teacher asked for it.
  const outOf = f.autoOutOf && totalPoints > 0 ? totalPoints : f.outOf;
  const accent = b.accent;

  const ctx = { W, H, rtl, family, t, f, title, sub, outOf, accent, at };
  if (MORE_HEADER_STYLES.includes(b.style)) return <MoreHeaderView style={b.style} c={ctx} />;
  if (MODERN_HEADER_STYLES.includes(b.style)) return <ModernHeaderView style={b.style} c={ctx} />;

  if (b.style === "banner") {
    // Dark band with the title, a score card at the end, then school / year and the name line.
    const card = 112;
    const cardX = at(W - card - 12, card);
    return (
      <>
        <Rect width={W} height={80} fill={accent ?? "#1e293b"} cornerRadius={8} listening={false} />
        <OneLine family={family} text={title} x={at(20, W - card - 52)} y={15} width={W - card - 52} size={22} bold color="#ffffff" rtl={rtl} />
        <OneLine family={family} text={sub} x={at(20, W - card - 52)} y={49} width={W - card - 52} size={13} color="#cbd5e1" rtl={rtl} />
        <Rect x={cardX} y={11} width={card} height={58} fill="#ffffff" cornerRadius={6} listening={false} />
        <OneLine family={family} text={t.score} x={cardX} y={17} width={card} size={10} color={MUTED} rtl={rtl} align="center" />
        <OneLine family={family} text={`...... / ${outOf}`} x={cardX} y={37} width={card} size={16} bold color={accent ?? "#1e293b"} rtl={false} align="center" />
        <OneLine family={family} text={f.school} x={at(4, W / 2)} y={90} width={W / 2} size={12} color={MUTED} rtl={rtl} align={start} />
        <OneLine family={family} text={`${t.year} : ${f.year}`} x={at(W / 2 - 4, W / 2)} y={90} width={W / 2} size={12} color={MUTED} rtl={rtl} align={end} />
        <OneLine family={family} text={`${t.name} : ${DOTS}${DOTS}      ${t.class} : ${DOTS}`} x={0} y={116} width={W} size={13} rtl={rtl} />
      </>
    );
  }

  if (b.style === "elegant") {
    // Centered title between thin double rules.
    const color = accent ?? "#4338ca";
    return (
      <>
        <Line points={[0, 1, W, 1]} stroke={INK} strokeWidth={1.6} listening={false} />
        <Line points={[0, 5, W, 5]} stroke={INK} strokeWidth={0.6} listening={false} />
        <OneLine family={family} text={f.school} x={at(0, W / 2)} y={13} width={W / 2} size={11} color={MUTED} rtl={rtl} align={start} />
        <OneLine family={family} text={`${t.year} : ${f.year}`} x={at(W / 2, W / 2)} y={13} width={W / 2} size={11} color={MUTED} rtl={rtl} align={end} />
        <OneLine family={family} text={title} x={0} y={32} width={W} size={23} bold rtl={rtl} align="center" />
        <OneLine family={family} text={sub} x={0} y={64} width={W} size={12} color={color} rtl={rtl} align="center" />
        <Line points={[0, 86, W, 86]} stroke={INK} strokeWidth={0.6} listening={false} />
        <Line points={[0, 90, W, 90]} stroke={INK} strokeWidth={1.6} listening={false} />
        <OneLine family={family} text={`${t.name} : ${DOTS}${DOTS}`} x={at(0, W * 0.62)} y={106} width={W * 0.62} size={13} rtl={rtl} align={start} />
        <OneLine family={family} text={`${t.score} : ${ltr(`........ / ${outOf}`)}`} x={at(W * 0.62, W * 0.38)} y={106} width={W * 0.38} size={13} bold rtl={rtl} align={end} />
      </>
    );
  }

  if (b.style === "modern") {
    const cx = rtl ? 56 : W - 56; // center of the score circle
    return (
      <>
        <Rect width={W} height={84} fill={accent ? tint(accent, "1a") : "#eef2ff"} cornerRadius={10} listening={false} />
        <OneLine family={family} text={title} x={at(18, W - 150)} y={14} width={W - 150} size={21} bold color={accent ?? "#312e81"} rtl={rtl} />
        <OneLine family={family} text={sub} x={at(18, W - 150)} y={46} width={W - 150} size={13} color={accent ?? "#4338ca"} rtl={rtl} />
        <OneLine family={family} text={[f.school, f.year].filter(Boolean).join("  —  ")} x={at(18, W - 150)} y={65} width={W - 150} size={11} color={accent ?? "#6366f1"} rtl={rtl} />
        <Circle x={cx} y={42} radius={32} fill="#ffffff" stroke={accent ?? "#6366f1"} strokeWidth={1.5} listening={false} />
        <OneLine family={family} text={t.score} x={cx - 30} y={18} width={60} size={10} color={MUTED} rtl={rtl} align="center" />
        {/* Room to write the grade, then "/20" */}
        <Line points={[cx - 24, 55, cx - 2, 55]} stroke="#a5b4fc" strokeWidth={1} dash={[2, 2]} listening={false} />
        <OneLine family={family} text={`/${outOf}`} x={cx - 1} y={39} width={32} size={outOf >= 100 ? 13 : 16} bold color="#312e81" rtl={false} align="left" />
        <OneLine family={family} text={`${t.name} : ${DOTS}${DOTS}      ${t.class} : ${DOTS}`} x={0} y={102} width={W} size={13} rtl={rtl} />
      </>
    );
  }

  if (b.style === "minimal") {
    return (
      <>
        <OneLine family={family} text={f.school} x={at(0, W / 2)} y={0} width={W / 2} size={12} color={MUTED} rtl={rtl} align={start} />
        <OneLine family={family} text={`${t.year} : ${f.year}`} x={at(W / 2, W / 2)} y={0} width={W / 2} size={12} color={MUTED} rtl={rtl} align={end} />
        <OneLine family={family} text={title} x={0} y={22} width={W} size={20} bold rtl={rtl} align="center" />
        <OneLine family={family} text={sub} x={0} y={50} width={W} size={12} color={MUTED} rtl={rtl} align="center" />
        <Line points={[0, 74, W, 74]} stroke={INK} strokeWidth={1} listening={false} />
        <OneLine family={family} text={`${t.name} : ${DOTS}${DOTS}`} x={at(0, W * 0.62)} y={88} width={W * 0.62} size={13} rtl={rtl} align={start} />
        <OneLine family={family} text={`${t.score} : ${ltr(`........ / ${outOf}`)}`} x={at(W * 0.62, W * 0.38)} y={88} width={W * 0.38} size={13} bold rtl={rtl} align={end} />
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

      <OneLine family={family} text={f.school} x={at(10, W * 0.3 - 20)} y={22} width={W * 0.3 - 20} size={13} bold rtl={rtl} />
      <OneLine family={family} text={`${t.year} : ${f.year}`} x={at(10, W * 0.3 - 20)} y={52} width={W * 0.3 - 20} size={12} color={MUTED} rtl={rtl} />

      <OneLine family={family} text={title} x={W * 0.3 + 10} y={22} width={W * 0.4 - 20} size={18} bold rtl={rtl} align="center" />
      <OneLine family={family} text={f.subject} x={W * 0.3 + 10} y={54} width={W * 0.4 - 20} size={13} color={MUTED} rtl={rtl} align="center" />

      <OneLine family={family} text={`${t.level} : ${f.level}`} x={at(W * 0.7 + 10, W * 0.3 - 20)} y={22} width={W * 0.3 - 20} size={12} rtl={rtl} />
      <OneLine family={family} text={`${t.duration} : ${f.duration}`} x={at(W * 0.7 + 10, W * 0.3 - 20)} y={52} width={W * 0.3 - 20} size={12} rtl={rtl} />

      <OneLine family={family} text={`${t.name} : ${DOTS}${DOTS}`} x={at(10, W * 0.75 - 20)} y={r1 + 12} width={W * 0.75 - 20} size={13} rtl={rtl} />
      <OneLine family={family} text={`${t.class} : ${DOTS}`} x={at(10, W * 0.75 - 20)} y={r1 + 34} width={W * 0.75 - 20} size={13} rtl={rtl} />
      <OneLine family={family} text={t.score} x={at(W * 0.75, W * 0.25)} y={r1 + 8} width={W * 0.25} size={12} bold rtl={rtl} align="center" />
      <OneLine family={family} text={`....... / ${outOf}`} x={at(W * 0.75, W * 0.25)} y={r1 + 32} width={W * 0.25} size={14} rtl={false} align="center" />
    </>
  );
}
