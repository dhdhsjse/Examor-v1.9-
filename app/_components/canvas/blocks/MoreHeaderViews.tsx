"use client";

import { Circle, Line, Rect, Star } from "react-konva";
import type { words } from "@/app/_lib/i18n";
import type { HeaderFields, HeaderStyle } from "@/app/_lib/types";
import { INK, MUTED, OneLine, tint } from "./shared";

// What every header style needs (computed once in HeaderView).
export interface HeaderCtx {
  W: number;
  H: number;
  rtl: boolean;
  family: string;
  t: ReturnType<typeof words>;
  f: HeaderFields;
  title: string; // with "— Correction" on the correction sheet
  sub: string; // subject · level · duration
  outOf: number;
  accent: string | undefined; // the teacher's color (each style has its own otherwise)
  at: (x: number, w: number) => number; // x of a box placed `x` from the start side
}

const DOTS = "....................................";
const DOTS_S = "............";
// Keep "/ 20" left-to-right inside Arabic text.
const ltr = (s: string) => `⁦${s}⁩`;

export const MORE_HEADER_STYLES: HeaderStyle[] = ["official", "split", "compact", "evaluation", "playful", "cards", "algerian"];

export function MoreHeaderView({ style, c }: { style: HeaderStyle; c: HeaderCtx }) {
  const { W, H, rtl, family, t, f, title, sub, outOf, at } = c;
  const start = rtl ? "right" : "left";
  const end = rtl ? "left" : "right";
  const L = (p: { text: string; x: number; y: number; width: number; size: number; bold?: boolean; color?: string; align?: "left" | "right" | "center"; dir?: boolean }) => (
    <OneLine family={family} text={p.text} x={p.x} y={p.y} width={p.width} size={p.size} bold={p.bold} color={p.color} rtl={p.dir ?? rtl} align={p.align} />
  );

  switch (style) {
    case "algerian": {
      // Algerian exam: the Republic and the Ministry centered, a two-column table (directorate and school
      // on one side, year and level on the other), the framed exam title, then subject, duration, score.
      const row = 48;
      const rowH = 52;
      const half = W / 2;
      const band = row + rowH + 8;
      const last = band + 46;
      return (
        <>
          {L({ text: f.republic ?? "", x: 0, y: 0, width: W, size: 13, bold: true, align: "center" })}
          {L({ text: f.authority ?? "", x: 0, y: 22, width: W, size: 12, bold: true, align: "center" })}
          <Rect x={0} y={row} width={W} height={rowH} stroke={INK} strokeWidth={1.2} listening={false} />
          <Line points={[half, row, half, row + rowH]} stroke={INK} strokeWidth={1} listening={false} />
          {L({ text: f.directorate ?? "", x: at(8, half - 16), y: row + 9, width: half - 16, size: 12, align: start })}
          {L({ text: f.school, x: at(8, half - 16), y: row + 30, width: half - 16, size: 12, align: start })}
          {L({ text: `${t.year} : ${f.year}`, x: at(half + 8, half - 16), y: row + 9, width: half - 16, size: 12, align: end })}
          {L({ text: `${t.level} : ${f.level}`, x: at(half + 8, half - 16), y: row + 30, width: half - 16, size: 12, align: end })}
          <Rect x={0} y={band} width={W} height={36} stroke={c.accent ?? INK} strokeWidth={1.6} listening={false} />
          {L({ text: title, x: 8, y: band + 9, width: W - 16, size: 17, bold: true, color: c.accent, align: "center" })}
          {L({ text: `${t.subject} : ${f.subject}`, x: at(0, W * 0.4), y: last, width: W * 0.4, size: 12, bold: true, align: start })}
          {L({ text: `${t.duration} : ${f.duration}`, x: at(W * 0.4, W * 0.3), y: last, width: W * 0.3, size: 12, align: "center" })}
          {L({ text: `${t.score} : ${ltr(`...... / ${outOf}`)}`, x: at(W * 0.7, W * 0.3), y: last, width: W * 0.3, size: 12, bold: true, align: end })}
          <Line points={[0, last + 24, W, last + 24]} stroke={INK} strokeWidth={1} listening={false} />
        </>
      );
    }
    case "official": {
      // Authority and school on one side, subject / level / duration on the other, a framed title,
      // then the student lines and the score box.
      const half = W * 0.55;
      const boxW = 128;
      return (
        <>
          {L({ text: f.authority ?? "", x: at(0, half), y: 2, width: half, size: 11, bold: true, align: start })}
          {L({ text: f.school, x: at(0, half), y: 20, width: half, size: 12, align: start })}
          {L({ text: `${t.year} : ${f.year}`, x: at(0, half), y: 38, width: half, size: 11, color: MUTED, align: start })}
          {L({ text: `${t.subject} : ${f.subject}`, x: at(W - W * 0.42, W * 0.42), y: 2, width: W * 0.42, size: 12, bold: true, align: end })}
          {L({ text: `${t.level} : ${f.level}`, x: at(W - W * 0.42, W * 0.42), y: 20, width: W * 0.42, size: 11, align: end })}
          {L({ text: `${t.duration} : ${f.duration}`, x: at(W - W * 0.42, W * 0.42), y: 38, width: W * 0.42, size: 11, align: end })}
          <Rect x={W * 0.14} y={62} width={W * 0.72} height={40} stroke={c.accent ?? INK} strokeWidth={1.6} cornerRadius={4} listening={false} />
          <Rect x={W * 0.14 + 3} y={65} width={W * 0.72 - 6} height={34} stroke={c.accent ?? INK} strokeWidth={0.6} cornerRadius={2} listening={false} />
          {L({ text: title, x: W * 0.14 + 8, y: 72, width: W * 0.72 - 16, size: 18, bold: true, align: "center" })}
          {L({ text: `${t.name} : ${DOTS}${DOTS}`, x: at(0, W - boxW - 16), y: 118, width: W - boxW - 16, size: 13, align: start })}
          {L({ text: `${t.class} : ${DOTS_S}      ${t.number} : ${DOTS_S}`, x: at(0, W - boxW - 16), y: 144, width: W - boxW - 16, size: 13, align: start })}
          <Rect x={at(W - boxW, boxW)} y={112} width={boxW} height={54} stroke={INK} strokeWidth={1.2} cornerRadius={4} listening={false} />
          {L({ text: t.score, x: at(W - boxW, boxW), y: 118, width: boxW, size: 11, bold: true, align: "center" })}
          {L({ text: `...... / ${outOf}`, x: at(W - boxW, boxW), y: 140, width: boxW, size: 15, bold: true, align: "center", dir: false })}
        </>
      );
    }
    case "split": {
      // Two cards: the exam on one side, the student on the other.
      const accent = c.accent ?? "#4f46e5";
      const leftW = W * 0.6 - 6;
      const rightW = W * 0.4 - 6;
      const lx = at(0, leftW);
      const rx = at(W - rightW, rightW);
      const pad = 14;
      return (
        <>
          <Rect x={lx} y={0} width={leftW} height={H - 4} fill={tint(accent, "12")} stroke={accent} strokeWidth={1.2} cornerRadius={10} listening={false} />
          {L({ text: title, x: lx + pad, y: 14, width: leftW - pad * 2, size: 19, bold: true, color: accent, align: start })}
          {L({ text: [f.subject, f.level].filter(Boolean).join("  ·  "), x: lx + pad, y: 46, width: leftW - pad * 2, size: 13, align: start })}
          {L({ text: `${t.duration} : ${f.duration}`, x: lx + pad, y: 68, width: leftW - pad * 2, size: 12, color: MUTED, align: start })}
          {L({ text: `${t.year} : ${f.year}`, x: lx + pad, y: 88, width: leftW - pad * 2, size: 12, color: MUTED, align: start })}
          {L({ text: f.school, x: lx + pad, y: 108, width: leftW - pad * 2, size: 12, color: MUTED, align: start })}
          <Rect x={rx} y={0} width={rightW} height={H - 4} stroke={INK} strokeWidth={1} cornerRadius={10} listening={false} />
          {L({ text: `${t.lastName} : ${DOTS}`, x: rx + 12, y: 14, width: rightW - 24, size: 13, align: start })}
          {L({ text: `${t.firstName} : ${DOTS}`, x: rx + 12, y: 38, width: rightW - 24, size: 13, align: start })}
          {L({ text: `${t.class} : ${DOTS_S}  ${t.number} : ${DOTS_S}`, x: rx + 12, y: 62, width: rightW - 24, size: 13, align: start })}
          <Line points={[rx + 12, 90, rx + rightW - 12, 90]} stroke="#cbd5e1" strokeWidth={1} listening={false} />
          {L({ text: `${t.score} : ${ltr(`...... / ${outOf}`)}`, x: rx + 12, y: 102, width: rightW - 24, size: 15, bold: true, align: start })}
        </>
      );
    }
    case "compact": {
      // Three thin lines: saves room for the questions.
      const accent = c.accent ?? INK;
      const boxW = 132;
      return (
        <>
          {L({ text: title, x: at(0, W - boxW - 12), y: 2, width: W - boxW - 12, size: 17, bold: true, align: start })}
          <Rect x={at(W - boxW, boxW)} y={0} width={boxW} height={28} stroke={INK} strokeWidth={1.1} cornerRadius={4} listening={false} />
          {L({ text: `${t.score} : ${ltr(`..... / ${outOf}`)}`, x: at(W - boxW, boxW), y: 7, width: boxW, size: 13, bold: true, align: "center" })}
          {L({ text: [f.school, f.subject, f.level, f.duration, f.year].filter(Boolean).join("  ·  "), x: at(0, W - boxW - 12), y: 30, width: W - boxW - 12, size: 11, color: MUTED, align: start })}
          {L({ text: `${t.name} : ${DOTS}${DOTS}      ${t.class} : ${DOTS_S}`, x: 0, y: 52, width: W, size: 12, align: start })}
          <Line points={[0, H - 2, W, H - 2]} stroke={accent} strokeWidth={1.6} listening={false} />
        </>
      );
    }
    case "evaluation": {
      // Title, the student line, then a table: score · teacher's comment · parents' signature.
      const top = 96;
      const head = 22;
      const cols = [
        { w: W * 0.22, label: t.score },
        { w: W * 0.48, label: t.appreciation },
        { w: W * 0.3, label: t.signature },
      ];
      let acc = 0;
      const placed = cols.map((col) => {
        const x = at(acc, col.w);
        acc += col.w;
        return { ...col, x };
      });
      return (
        <>
          {L({ text: f.school, x: at(0, W / 2), y: 0, width: W / 2, size: 11, color: MUTED, align: start })}
          {L({ text: `${t.year} : ${f.year}`, x: at(W / 2, W / 2), y: 0, width: W / 2, size: 11, color: MUTED, align: end })}
          {L({ text: title, x: 0, y: 18, width: W, size: 20, bold: true, align: "center", color: c.accent ?? INK })}
          {L({ text: sub, x: 0, y: 46, width: W, size: 12, color: MUTED, align: "center" })}
          {L({ text: `${t.name} : ${DOTS}${DOTS}`, x: at(0, W * 0.64), y: 70, width: W * 0.64, size: 13, align: start })}
          {L({ text: `${t.class} : ${DOTS_S}`, x: at(W * 0.64, W * 0.36), y: 70, width: W * 0.36, size: 13, align: end })}
          <Rect x={0} y={top} width={W} height={head} fill={c.accent ? tint(c.accent, "1a") : "#f3f4f6"} listening={false} />
          {placed.map((col, i) => (
            <OneLine key={i} family={family} text={col.label} x={col.x + 4} y={top + 5} width={col.w - 8} size={11} bold rtl={rtl} align="center" />
          ))}
          {placed.slice(1).map((col, i) => (
            <Line key={`l${i}`} points={rtl ? [col.x + col.w, top, col.x + col.w, H - 1] : [col.x, top, col.x, H - 1]} stroke={INK} strokeWidth={1} listening={false} />
          ))}
          <Line points={[0, top + head, W, top + head]} stroke={INK} strokeWidth={1} listening={false} />
          <Rect x={0} y={top} width={W} height={H - top - 1} stroke={INK} strokeWidth={1.2} listening={false} />
          {L({ text: `...... / ${outOf}`, x: placed[0].x, y: top + head + 18, width: placed[0].w, size: 15, bold: true, align: "center", dir: false })}
        </>
      );
    }
    case "playful": {
      // Primary school: a soft colored band with stars, a round score badge, the first-name line.
      const accent = c.accent ?? "#0ea5e9";
      const band = 92;
      const bx = rtl ? 52 : W - 52; // center of the badge
      return (
        <>
          <Rect width={W} height={band} fill={tint(accent, "1f")} stroke={accent} strokeWidth={2} cornerRadius={18} listening={false} />
          <Star x={at(26, 0)} y={24} numPoints={5} innerRadius={6} outerRadius={13} fill={accent} listening={false} />
          <Star x={at(54, 0)} y={60} numPoints={5} innerRadius={4} outerRadius={8} fill={tint(accent, "99")} listening={false} />
          {L({ text: title, x: 90, y: 16, width: W - 200, size: 22, bold: true, align: "center" })}
          {L({ text: sub, x: 90, y: 50, width: W - 200, size: 13, color: MUTED, align: "center" })}
          {L({ text: [f.school, f.year].filter(Boolean).join("  —  "), x: 90, y: 70, width: W - 200, size: 11, color: MUTED, align: "center" })}
          <Circle x={bx} y={band / 2} radius={32} fill="#ffffff" stroke={accent} strokeWidth={2} listening={false} />
          <Line points={[bx - 22, band / 2 + 12, bx - 2, band / 2 + 12]} stroke={accent} strokeWidth={1} dash={[2, 2]} listening={false} />
          <OneLine family={family} text={`/${outOf}`} x={bx - 1} y={band / 2 - 4} width={32} size={outOf >= 100 ? 13 : 16} bold rtl={false} align="left" />
          <OneLine family={family} text={t.score} x={bx - 30} y={band / 2 - 24} width={60} size={10} color={MUTED} rtl={rtl} align="center" />
          {L({ text: `${t.firstName} : ${DOTS}${DOTS}`, x: at(0, W * 0.62), y: band + 22, width: W * 0.62, size: 15, align: start })}
          {L({ text: `${t.date} : ${DOTS_S}${DOTS_S}`, x: at(W * 0.62, W * 0.38), y: band + 22, width: W * 0.38, size: 15, align: end })}
        </>
      );
    }
    case "cards": {
      // Centered title, then three cards to fill: name, class, score.
      const accent = c.accent ?? "#4f46e5";
      const top = 70;
      const h = H - top - 2;
      const gap = 12;
      const room = W - gap * 2;
      let acc = 0;
      const cards = [
        { w: room * 0.5, label: t.name, value: DOTS + DOTS, score: false },
        { w: room * 0.25, label: t.class, value: DOTS_S, score: false },
        { w: room * 0.25, label: t.score, value: `...... / ${outOf}`, score: true },
      ].map((card) => {
        const x = at(acc, card.w);
        acc += card.w + gap;
        return { ...card, x };
      });
      return (
        <>
          {L({ text: title, x: 0, y: 0, width: W, size: 21, bold: true, align: "center" })}
          {L({ text: sub, x: 0, y: 30, width: W, size: 12, color: accent, align: "center" })}
          {L({ text: [f.school, f.year].filter(Boolean).join("  —  "), x: 0, y: 48, width: W, size: 11, color: MUTED, align: "center" })}
          {cards.map((card, i) => (
            <Rect key={i} x={card.x} y={top} width={card.w} height={h} fill={tint(accent, "0d")} stroke={accent} strokeWidth={1.2} cornerRadius={8} listening={false} />
          ))}
          {cards.map((card, i) => (
            <OneLine key={`t${i}`} family={family} text={card.label} x={card.x + 10} y={top + 7} width={card.w - 20} size={10} bold color={accent} rtl={rtl} align={card.score ? "center" : start} />
          ))}
          {cards.map((card, i) => (
            <OneLine
              key={`v${i}`}
              family={family}
              text={card.value}
              x={card.x + 10}
              y={top + 28}
              width={card.w - 20}
              size={card.score ? 15 : 13}
              bold={card.score}
              rtl={card.score ? false : rtl}
              align={card.score ? "center" : start}
            />
          ))}
        </>
      );
    }
    default:
      return null;
  }
}
