"use client";

import { Arc, Circle, Line, Rect, Wedge } from "react-konva";
import type { HeaderStyle } from "@/app/_lib/types";
import type { HeaderCtx } from "./MoreHeaderViews";
import { INK, MUTED, OneLine, tint } from "./shared";

const DOTS = "....................................";
const DOTS_S = "............";
const SOFT_LINE = "#e5e7eb";
// Keep "/ 20" left-to-right inside Arabic text.
const ltr = (s: string) => `⁦${s}⁩`;

export const MODERN_HEADER_STYLES: HeaderStyle[] = [
  "accentbar",
  "bookmark",
  "gradient",
  "geometric",
  "chips",
  "editorial",
  "framed",
  "infogrid",
  "duotone",
  "monogram",
  "ticket",
  "floating",
];

// Modern header styles. Every one mirrors itself for Arabic: `at` places boxes, `mx` mirrors points.
export function ModernHeaderView({ style, c }: { style: HeaderStyle; c: HeaderCtx }) {
  const { W, H, rtl, family, t, f, title, sub, outOf, at, x0, x1, y0 } = c;
  // The edges of the paper on the start and end sides (bands and corner shapes run to them).
  const startEdge = rtl ? x1 : x0;
  const endEdge = rtl ? x0 : x1;
  const dir = rtl ? -1 : 1;
  const start = rtl ? "right" : "left";
  const end = rtl ? "left" : "right";
  const mx = (x: number) => (rtl ? W - x : x);
  // Konva corner order: top-left, top-right, bottom-right, bottom-left. `s` = start side, `e` = end side.
  const corners = (s: number, e: number) => (rtl ? [e, s, s, e] : [s, e, e, s]);
  const L = (p: { text: string; x: number; y: number; width: number; size: number; bold?: boolean; color?: string; align?: "left" | "right" | "center"; dir?: boolean }) => (
    <OneLine family={family} text={p.text} x={p.x} y={p.y} width={p.width} size={p.size} bold={p.bold} color={p.color} rtl={p.dir ?? rtl} align={p.align} />
  );
  const nameLine = (y: number, width = W) => L({ text: `${t.name} : ${DOTS}${DOTS}      ${t.class} : ${DOTS_S}`, x: at(0, width), y, width, size: 13, align: start });
  // A score box: label on top, "...... / 20" below.
  const scoreBox = (x: number, y: number, w: number, h: number, labelColor: string) => (
    <>
      {L({ text: t.score, x, y: y + 10, width: w, size: 10, bold: true, color: labelColor, align: "center" })}
      {L({ text: `...... / ${outOf}`, x, y: y + h / 2 + 2, width: w, size: 16, bold: true, align: "center", dir: false })}
    </>
  );
  // A round score badge with a dashed line to write the grade on, then "/20".
  const scoreCircle = (cx: number, cy: number, r: number, color: string) => (
    <>
      <OneLine family={family} text={t.score} x={cx - r} y={cy - r * 0.62} width={r * 2} size={9} bold color={color} rtl={rtl} align="center" />
      <Line points={[cx - r * 0.72, cy + r * 0.38, cx - 2, cy + r * 0.38]} stroke={tint(color, "88")} strokeWidth={1} dash={[2, 2]} listening={false} />
      <OneLine family={family} text={`/${outOf}`} x={cx - 1} y={cy - 4} width={r} size={outOf >= 100 ? 13 : 16} bold rtl={false} align="left" />
    </>
  );

  switch (style) {
    case "accentbar": {
      // A vertical color bar along the start side, a big title and a rounded score card.
      const accent = c.accent ?? "#0d9488";
      const card = 128;
      const textW = W - card - 40;
      return (
        <>
          <Rect x={at(0, 6)} y={0} width={6} height={86} fill={accent} cornerRadius={3} listening={false} />
          {L({ text: f.school, x: at(20, textW), y: 2, width: textW, size: 11, bold: true, color: accent, align: start })}
          {L({ text: title, x: at(20, textW), y: 20, width: textW, size: 23, bold: true, align: start })}
          {L({ text: sub, x: at(20, textW), y: 52, width: textW, size: 12, color: MUTED, align: start })}
          {L({ text: `${t.year} : ${f.year}`, x: at(20, textW), y: 70, width: textW, size: 11, color: MUTED, align: start })}
          <Rect x={at(W - card, card)} y={4} width={card} height={76} fill={tint(accent, "0f")} stroke={accent} strokeWidth={1.4} cornerRadius={10} listening={false} />
          {scoreBox(at(W - card, card), 4, card, 76, accent)}
          <Line points={[x0, 96, x1, 96]} stroke={SOFT_LINE} strokeWidth={1} listening={false} />
          {nameLine(106)}
        </>
      );
    }
    case "bookmark": {
      // A thin color strip on top, with a bookmark hanging from it that holds the score.
      const accent = c.accent ?? "#e11d48";
      const bw = 104;
      const left = at(W - bw - 16, bw);
      const textW = W - bw - 40;
      return (
        <>
          <Rect x={x0} y={y0} width={x1 - x0} height={5} fill={accent} listening={false} />
          <Line closed points={[left, y0, left + bw, y0, left + bw, 82, left + bw / 2, 68, left, 82]} fill={tint(accent, "14")} stroke={accent} strokeWidth={1.4} listening={false} />
          {L({ text: t.score, x: left, y: 16, width: bw, size: 10, bold: true, color: accent, align: "center" })}
          {L({ text: `..... / ${outOf}`, x: left, y: 38, width: bw, size: 15, bold: true, align: "center", dir: false })}
          {L({ text: [f.school, `${t.year} : ${f.year}`].filter(Boolean).join("   ·   "), x: at(0, textW), y: 16, width: textW, size: 11, color: MUTED, align: start })}
          {L({ text: title, x: at(0, textW), y: 34, width: textW, size: 23, bold: true, align: start })}
          {L({ text: sub, x: at(0, textW), y: 66, width: textW, size: 12, bold: true, color: accent, align: start })}
          {nameLine(102)}
        </>
      );
    }
    case "gradient": {
      // A rounded band fading from the color, with a white score badge.
      const accent = c.accent ?? "#7c3aed";
      const band = 86;
      const cx = mx(W - 52);
      const textW = W - 140;
      return (
        <>
          <Rect
            x={x0}
            y={y0}
            width={x1 - x0}
            height={band - y0}
            fillLinearGradientStartPoint={{ x: rtl ? x1 - x0 : 0, y: 0 }}
            fillLinearGradientEndPoint={{ x: rtl ? 0 : x1 - x0, y: band - y0 }}
            fillLinearGradientColorStops={[0, accent, 1, tint(accent, "b8")]}
            listening={false}
          />
          {L({ text: title, x: at(20, textW), y: 15, width: textW, size: 22, bold: true, color: "#ffffff", align: start })}
          {L({ text: sub, x: at(20, textW), y: 47, width: textW, size: 13, color: "#ffffffe6", align: start })}
          {L({ text: [f.school, f.year].filter(Boolean).join("  —  "), x: at(20, textW), y: 66, width: textW, size: 11, color: "#ffffffbf", align: start })}
          <Circle x={cx} y={band / 2} radius={34} fill="#ffffff" listening={false} />
          <Circle x={cx} y={band / 2} radius={29} stroke={tint(accent, "55")} strokeWidth={1} dash={[3, 3]} listening={false} />
          {scoreCircle(cx, band / 2, 30, accent)}
          {nameLine(104)}
        </>
      );
    }
    case "geometric": {
      // Two color triangles in opposite corners frame the title.
      const accent = c.accent ?? "#ea580c";
      const box = 128;
      const textX = 132;
      const textW = W - textX - box - 16;
      return (
        <>
          <Line closed points={[startEdge, y0, startEdge + dir * 150, y0, startEdge, 96]} fill={tint(accent, "2e")} listening={false} />
          <Line closed points={[startEdge, y0, startEdge + dir * 108, y0, startEdge, 68]} fill={accent} listening={false} />
          <Line closed points={[endEdge, H, endEdge - dir * 44, H, endEdge, H - 28]} fill={accent} listening={false} />
          {L({ text: f.school, x: at(textX, textW), y: 6, width: textW, size: 11, bold: true, color: accent, align: start })}
          {L({ text: title, x: at(textX, textW), y: 24, width: textW, size: 22, bold: true, align: start })}
          {L({ text: sub, x: at(textX, textW), y: 56, width: textW, size: 12, color: MUTED, align: start })}
          {L({ text: `${t.year} : ${f.year}`, x: at(textX, textW), y: 74, width: textW, size: 11, color: MUTED, align: start })}
          <Rect x={at(W - box, box)} y={6} width={box} height={72} stroke={INK} strokeWidth={1.2} cornerRadius={6} listening={false} />
          <Rect x={at(W - box + 16, box - 32)} y={6} width={box - 32} height={3} fill={accent} listening={false} />
          {scoreBox(at(W - box, box), 6, box, 72, INK)}
          {nameLine(104, W - 56)}
        </>
      );
    }
    case "chips": {
      // Title, then subject / level / duration as rounded chips; the score card has a colored tab.
      const accent = c.accent ?? "#0284c7";
      const card = 120;
      const room = W - card - 24;
      let acc = 0;
      const chips = [f.subject, f.level, f.duration]
        .filter(Boolean)
        .map((text) => {
          const w = Math.min(room - acc, text.length * 6.6 + 26);
          const chip = { text, w, x: at(acc, w) };
          acc += w + 8;
          return chip;
        })
        .filter((chip) => chip.w > 30);
      const cardX = at(W - card, card);
      return (
        <>
          {L({ text: [f.school, `${t.year} : ${f.year}`].filter(Boolean).join("   ·   "), x: at(0, room), y: 0, width: room, size: 11, color: MUTED, align: start })}
          {L({ text: title, x: at(0, room), y: 18, width: room, size: 23, bold: true, align: start })}
          {chips.map((chip, i) => (
            <Rect key={i} x={chip.x} y={54} width={chip.w} height={22} fill={tint(accent, "14")} stroke={tint(accent, "66")} strokeWidth={1} cornerRadius={11} listening={false} />
          ))}
          {chips.map((chip, i) => (
            <OneLine key={`t${i}`} family={family} text={chip.text} x={chip.x + 6} y={59} width={chip.w - 12} size={11} bold color={accent} rtl={rtl} align="center" />
          ))}
          <Rect x={cardX} y={0} width={card} height={78} stroke={accent} strokeWidth={1.4} cornerRadius={12} listening={false} />
          <Rect x={cardX} y={0} width={card} height={22} fill={accent} cornerRadius={[12, 12, 0, 0]} listening={false} />
          {L({ text: t.score, x: cardX, y: 5, width: card, size: 11, bold: true, color: "#ffffff", align: "center" })}
          {L({ text: `...... / ${outOf}`, x: cardX, y: 42, width: card, size: 16, bold: true, align: "center", dir: false })}
          <Line points={[x0, 92, x1, 92]} stroke={SOFT_LINE} strokeWidth={1} listening={false} />
          {nameLine(102)}
        </>
      );
    }
    case "editorial": {
      // Magazine look: a large title, a short thick underline and a stamp-like score.
      const accent = c.accent ?? "#b45309";
      const cx = mx(W - 46);
      const textW = W - 120;
      return (
        <>
          {L({ text: f.school.toUpperCase(), x: at(0, textW), y: 0, width: textW, size: 10, bold: true, color: accent, align: start })}
          {L({ text: title, x: at(0, textW), y: 15, width: textW, size: 27, bold: true, align: start })}
          <Rect x={at(0, 56)} y={53} width={56} height={4} fill={accent} cornerRadius={2} listening={false} />
          {L({ text: [sub, f.year].filter(Boolean).join("  ·  "), x: at(0, textW), y: 66, width: textW, size: 12, color: MUTED, align: start })}
          <Circle x={cx} y={42} radius={40} stroke={accent} strokeWidth={1} dash={[3, 3]} listening={false} />
          <Circle x={cx} y={42} radius={34} stroke={accent} strokeWidth={1.6} listening={false} />
          {scoreCircle(cx, 42, 32, accent)}
          <Line points={[x0, 96, x1, 96]} stroke={INK} strokeWidth={0.8} listening={false} />
          {L({ text: `${t.name} : ${DOTS}${DOTS}`, x: at(0, W * 0.64), y: 106, width: W * 0.64, size: 13, align: start })}
          {L({ text: `${t.class} : ${DOTS_S}`, x: at(W * 0.64, W * 0.36), y: 106, width: W * 0.36, size: 13, align: end })}
        </>
      );
    }
    case "framed": {
      // A rounded frame with the title in a colored pill sitting on its top edge.
      const accent = c.accent ?? "#059669";
      const pill = Math.min(W - 80, title.length * 9 + 48);
      return (
        <>
          <Rect x={0} y={13} width={W} height={H - 15} stroke={accent} strokeWidth={1.4} cornerRadius={12} listening={false} />
          <Rect x={(W - pill) / 2} y={0} width={pill} height={27} fill={accent} cornerRadius={13.5} listening={false} />
          {L({ text: title, x: (W - pill) / 2 + 12, y: 6, width: pill - 24, size: 15, bold: true, color: "#ffffff", align: "center" })}
          {L({ text: f.school, x: at(16, W / 2 - 24), y: 38, width: W / 2 - 24, size: 11, color: MUTED, align: start })}
          {L({ text: `${t.year} : ${f.year}`, x: at(W / 2 + 8, W / 2 - 24), y: 38, width: W / 2 - 24, size: 11, color: MUTED, align: end })}
          {L({ text: sub, x: 16, y: 57, width: W - 32, size: 13, bold: true, color: accent, align: "center" })}
          <Line points={[16, 82, W - 16, 82]} stroke={tint(accent, "66")} strokeWidth={1} dash={[4, 4]} listening={false} />
          {L({ text: `${t.name} : ${DOTS}${DOTS}`, x: at(16, W * 0.6), y: 92, width: W * 0.6, size: 13, align: start })}
          {L({ text: `${t.score} : ${ltr(`...... / ${outOf}`)}`, x: at(W * 0.6 + 16, W * 0.4 - 32), y: 92, width: W * 0.4 - 32, size: 14, bold: true, align: end })}
          {L({ text: `${t.class} : ${DOTS_S}      ${t.number} : ${DOTS_S}`, x: at(16, W * 0.6), y: 114, width: W * 0.6, size: 13, align: start })}
        </>
      );
    }
    case "infogrid": {
      // Swiss look: title and school, then a row of labeled cells (the last one is the score).
      const accent = c.accent ?? "#2563eb";
      const top = 42;
      const h = 48;
      const cw = W / 4;
      const cells = [
        { label: t.subject, value: f.subject },
        { label: t.level, value: f.level },
        { label: t.duration, value: f.duration },
        { label: t.score, value: `..... / ${outOf}`, score: true },
      ].map((cell, i) => ({ ...cell, x: at(i * cw, cw) }));
      const last = cells[cells.length - 1];
      return (
        <>
          {L({ text: title, x: at(0, W * 0.64), y: 2, width: W * 0.64, size: 23, bold: true, align: start })}
          {L({ text: f.school, x: at(W * 0.64, W * 0.36), y: 2, width: W * 0.36, size: 11, bold: true, align: end })}
          {L({ text: `${t.year} : ${f.year}`, x: at(W * 0.64, W * 0.36), y: 19, width: W * 0.36, size: 11, color: MUTED, align: end })}
          <Rect x={last.x} y={top} width={cw} height={h} fill={tint(accent, "14")} cornerRadius={corners(0, 8)} listening={false} />
          <Rect x={0} y={top} width={W} height={h} stroke="#cbd5e1" strokeWidth={1} cornerRadius={8} listening={false} />
          {[1, 2, 3].map((i) => (
            <Line key={i} points={[i * cw, top, i * cw, top + h]} stroke="#cbd5e1" strokeWidth={1} listening={false} />
          ))}
          {cells.map((cell, i) => (
            <OneLine key={i} family={family} text={cell.label.toUpperCase()} x={cell.x + 12} y={top + 9} width={cw - 24} size={9} bold color={accent} rtl={rtl} align={start} />
          ))}
          {cells.map((cell, i) => (
            <OneLine key={`v${i}`} family={family} text={cell.value} x={cell.x + 12} y={top + 25} width={cw - 24} size={13} bold rtl={cell.score ? false : rtl} align={cell.score ? "center" : start} />
          ))}
          {L({ text: `${t.name} : ${DOTS}${DOTS}`, x: at(0, W * 0.64), y: 104, width: W * 0.64, size: 13, align: start })}
          {L({ text: `${t.class} : ${DOTS_S}`, x: at(W * 0.64, W * 0.36), y: 104, width: W * 0.36, size: 13, align: end })}
          {L({ text: `${t.number} : ${DOTS_S}      ${t.date} : ${DOTS_S}`, x: at(0, W * 0.64), y: 128, width: W * 0.64, size: 13, align: start })}
        </>
      );
    }
    case "duotone": {
      // Two tones side by side: a light panel with the exam, a solid panel with a white score box.
      const accent = c.accent ?? "#4338ca";
      const band = 88;
      const sw = 144;
      const mainW = W - sw;
      const sx = at(mainW, sw);
      return (
        <>
          {/* Each panel runs to the edge of the paper on its side */}
          <Rect x={rtl ? sw : x0} y={y0} width={rtl ? x1 - sw : mainW - x0} height={band - y0} fill={tint(accent, "14")} listening={false} />
          <Rect x={rtl ? x0 : mainW} y={y0} width={rtl ? sw - x0 : x1 - mainW} height={band - y0} fill={accent} listening={false} />
          {L({ text: [f.school, f.year].filter(Boolean).join("   ·   "), x: at(18, mainW - 36), y: 12, width: mainW - 36, size: 11, bold: true, color: accent, align: start })}
          {L({ text: title, x: at(18, mainW - 36), y: 30, width: mainW - 36, size: 22, bold: true, align: start })}
          {L({ text: sub, x: at(18, mainW - 36), y: 62, width: mainW - 36, size: 12, color: MUTED, align: start })}
          {L({ text: t.score, x: sx, y: 12, width: sw, size: 11, bold: true, color: "#ffffff", align: "center" })}
          <Rect x={sx + 16} y={32} width={sw - 32} height={42} fill="#ffffff" cornerRadius={8} listening={false} />
          {L({ text: `..... / ${outOf}`, x: sx + 16, y: 45, width: sw - 32, size: 15, bold: true, color: accent, align: "center", dir: false })}
          {nameLine(106)}
        </>
      );
    }
    case "monogram": {
      // A round badge with the subject's initial, the title beside it, a rounded score card.
      const accent = c.accent ?? "#be123c";
      const r = 36;
      const cx = mx(r);
      const letter = (f.subject || f.title).trim().charAt(0).toUpperCase();
      const card = 116;
      const textX = r * 2 + 18;
      const textW = W - textX - card - 16;
      return (
        <>
          <Circle x={cx} y={42} radius={r} fill={accent} listening={false} />
          <Circle x={cx} y={42} radius={r - 5} stroke="#ffffff66" strokeWidth={1} listening={false} />
          <OneLine family={family} text={letter} x={cx - r} y={26} width={r * 2} size={32} bold color="#ffffff" rtl={rtl} align="center" />
          {L({ text: title, x: at(textX, textW), y: 10, width: textW, size: 22, bold: true, align: start })}
          {L({ text: sub, x: at(textX, textW), y: 42, width: textW, size: 12, bold: true, color: accent, align: start })}
          {L({ text: [f.school, f.year].filter(Boolean).join("  —  "), x: at(textX, textW), y: 62, width: textW, size: 11, color: MUTED, align: start })}
          <Rect x={at(W - card, card)} y={6} width={card} height={72} stroke={accent} strokeWidth={1.4} cornerRadius={16} listening={false} />
          {scoreBox(at(W - card, card), 6, card, 72, accent)}
          <Line points={[x0, 96, x1, 96]} stroke={tint(accent, "55")} strokeWidth={1} listening={false} />
          {nameLine(106)}
        </>
      );
    }
    case "ticket": {
      // A ticket: the exam on the main part, the score on a stub behind a perforated line.
      const accent = c.accent ?? "#0f766e";
      const band = 92;
      const stub = 140;
      const px = mx(W - stub); // x of the perforation
      const sx = at(W - stub, stub);
      const textW = W - stub - 40;
      const notch = (y: number, rotation: number) => (
        <>
          <Wedge x={px} y={y} radius={11} angle={180} rotation={rotation} fill="#ffffff" listening={false} />
          <Arc x={px} y={y} innerRadius={9.6} outerRadius={11} angle={180} rotation={rotation} fill={accent} listening={false} />
        </>
      );
      return (
        <>
          <Rect width={W} height={band} fill={tint(accent, "0d")} stroke={accent} strokeWidth={1.4} cornerRadius={12} listening={false} />
          <Line points={[px, 16, px, band - 16]} stroke={accent} strokeWidth={1.2} dash={[4, 4]} listening={false} />
          {notch(0, 0)}
          {notch(band, 180)}
          {L({ text: f.school, x: at(20, textW), y: 12, width: textW, size: 11, bold: true, color: accent, align: start })}
          {L({ text: title, x: at(20, textW), y: 30, width: textW, size: 22, bold: true, align: start })}
          {L({ text: [sub, f.year].filter(Boolean).join("  ·  "), x: at(20, textW), y: 62, width: textW, size: 12, color: MUTED, align: start })}
          {L({ text: t.score, x: sx, y: 20, width: stub, size: 10, bold: true, color: accent, align: "center" })}
          {L({ text: `...... / ${outOf}`, x: sx, y: 44, width: stub, size: 17, bold: true, align: "center", dir: false })}
          {nameLine(108)}
        </>
      );
    }
    case "floating": {
      // A white card with a soft shadow, a color dot and a tinted score tile.
      const accent = c.accent ?? "#6366f1";
      const band = 90;
      const tile = 124;
      const textW = W - tile - 52;
      return (
        <>
          <Rect width={W} height={band} fill="#ffffff" stroke={SOFT_LINE} strokeWidth={1} cornerRadius={14} shadowColor="#0f172a" shadowOpacity={0.1} shadowBlur={14} shadowOffsetY={4} listening={false} />
          <Circle x={mx(24)} y={21} radius={4} fill={accent} listening={false} />
          {L({ text: [f.school, f.year].filter(Boolean).join("   ·   "), x: at(36, textW - 16), y: 15, width: textW - 16, size: 11, bold: true, color: MUTED, align: start })}
          {L({ text: title, x: at(20, textW), y: 33, width: textW, size: 22, bold: true, align: start })}
          {L({ text: sub, x: at(20, textW), y: 64, width: textW, size: 12, color: accent, align: start })}
          <Rect x={at(W - tile - 12, tile)} y={12} width={tile} height={band - 24} fill={tint(accent, "14")} cornerRadius={10} listening={false} />
          {scoreBox(at(W - tile - 12, tile), 12, tile, band - 24, accent)}
          {nameLine(110)}
        </>
      );
    }
    default:
      return null;
  }
}
