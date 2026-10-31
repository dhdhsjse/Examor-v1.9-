"use client";

import { Fragment } from "react";
import { Group, Image as KImage, Line, Rect, Shape } from "react-konva";
import StudioShapes from "@/app/_components/shapes/StudioShapes";
import { DEFAULT_ACCENT, layoutTable, layoutText, layoutTextbox, type ListMarker, type ParagraphBox } from "@/app/_lib/blockLayout";
import { useImage } from "@/app/_lib/images";
import { svgUrl } from "@/app/_lib/library";
import { plainText, serializeRich } from "@/app/_lib/richText";
import type { EquationBlock, ExamMeta, ImageBlock, TableBlock, TextBlock, TextboxBlock } from "@/app/_lib/types";
import { INK, RichText, tint } from "./shared";

// The shading and the border lines behind a paragraph (Home → Paragraph).
function ParagraphBackdrop({ box }: { box: ParagraphBox }) {
  const { x, y, width: w, height: h } = box;
  const sides = box.border ?? "";
  const color = box.borderColor ?? INK;
  return (
    <>
      {box.shading && <Rect x={x} y={y} width={w} height={h} fill={box.shading} listening={false} />}
      {sides.includes("t") && <Line points={[x, y + 0.5, x + w, y + 0.5]} stroke={color} strokeWidth={1} listening={false} />}
      {sides.includes("b") && <Line points={[x, y + h - 0.5, x + w, y + h - 0.5]} stroke={color} strokeWidth={1} listening={false} />}
      {sides.includes("l") && <Line points={[x + 0.5, y, x + 0.5, y + h]} stroke={color} strokeWidth={1} listening={false} />}
      {sides.includes("r") && <Line points={[x + w - 0.5, y, x + w - 0.5, y + h]} stroke={color} strokeWidth={1} listening={false} />}
    </>
  );
}

// The marker of a list item ("•", "1.", "أ-"), in the room kept before its text.
function Marker({ m, dy = 0, rtl }: { m: ListMarker; dy?: number; rtl: boolean }) {
  return <RichText lines={[m.line]} x={m.x} y={m.y + dy} width={m.width} rtl={rtl} align={rtl ? "right" : "left"} />;
}

export function TextView({ b, meta }: { b: TextBlock; meta: ExamMeta }) {
  const L = layoutText(b, meta);
  const rtl = L.rtl;
  const accent = b.accent ?? DEFAULT_ACCENT;
  const d = L.deco;
  return (
    <>
      {L.box && <ParagraphBackdrop box={L.box} />}
      {d?.kind === "underline" && <Rect x={d.x} y={d.y} width={d.width} height={d.height} fill={accent} cornerRadius={2} listening={false} />}
      {d?.kind === "bar" && <Rect x={d.x} y={d.y} width={d.width} height={d.height} fill={accent} cornerRadius={2} listening={false} />}
      {d?.kind === "band" && <Rect x={d.x} y={d.y} width={d.width} height={d.height} fill={accent} cornerRadius={6} listening={false} />}
      {d?.kind === "pill" && <Rect x={d.x} y={d.y} width={d.width} height={d.height} fill={accent} cornerRadius={d.height / 2} listening={false} />}
      {d?.kind === "boxed" && (
        <Rect x={d.x + 0.75} y={d.y + 0.75} width={d.width - 1.5} height={d.height - 1.5} fill={tint(accent)} stroke={accent} strokeWidth={1.5} cornerRadius={6} listening={false} />
      )}
      {d?.kind === "rule" &&
        (L.align === "center" ? (
          // Centered title: a line on each side of the text.
          <>
            <Line points={[d.x, d.y, (b.layout.width - d.height) / 2 - 12, d.y]} stroke={accent} strokeWidth={1.5} listening={false} />
            <Line points={[(b.layout.width + d.height) / 2 + 12, d.y, d.x + d.width, d.y]} stroke={accent} strokeWidth={1.5} listening={false} />
          </>
        ) : (
          d.width > 0 && <Line points={[d.x, d.y, d.x + d.width, d.y]} stroke={accent} strokeWidth={1.5} listening={false} />
        ))}
      {L.markers.map((m, k) => (
        <Marker key={k} m={m} rtl={rtl} />
      ))}
      <RichText lines={L.text.lines} x={L.x} y={L.text.y} width={L.width} rtl={rtl} align={L.align} />
    </>
  );
}

// A text box: its paragraphs wrapped inside it (each with its alignment), on its fill color and inside its
// border (both printed). On screen the box shows as a light dashed frame, and an empty one shows a grey
// hint (neither is printed).
export function TextboxView({ b, meta, interactive }: { b: TextboxBlock; meta: ExamMeta; interactive: boolean }) {
  const hint = interactive && !plainText(b.text).trim() ? serializeRich([{ text: meta.lang === "ar" ? "اكتب هنا…" : "Tapez ici…", style: { color: "#9ca3af" } }]) : undefined;
  const L = layoutTextbox(b, meta, hint);
  return (
    <>
      {b.background && <Rect width={b.layout.width} height={L.height} fill={b.background} listening={false} />}
      {b.border ? (
        <Rect x={0.5} y={0.5} width={b.layout.width - 1} height={L.height - 1} stroke={b.border} strokeWidth={1} listening={false} />
      ) : (
        interactive && <Rect width={b.layout.width} height={L.height} stroke="#cbd5e1" strokeWidth={1} dash={[4, 3]} listening={false} />
      )}
      {L.paragraphs.map((p, k) => p.slot ? null : (
        <Fragment key={k}>
          {p.box && <ParagraphBackdrop box={{ ...p.box, y: L.y + p.box.y }} />}
          {p.marker && <Marker m={p.marker} dy={L.y} rtl={p.rtl} />}
          <RichText lines={p.lines} x={p.x} y={L.y + p.y} width={p.width} rtl={p.rtl} align={p.align} />
        </Fragment>
      ))}
    </>
  );
}

function TableBody({ b, meta }: { b: TableBlock; meta: ExamMeta }) {
  // In Arabic the first column is on the right.
  const L = layoutTable(b, meta);
  const rtl = L.F.rtl;
  const w = b.layout.width;

  // A table with merged cells, cell looks, borders, banding or formulas: fills, then the text, then every line in one stroke.
  if (L.ext) {
    const lines = L.lines;
    return (
      <Group listening={false}>
        {L.cellBoxes.map((cell) => cell.fill && <Rect key={`f${cell.r}-${cell.c}`} x={cell.x} y={cell.y} width={cell.w} height={cell.h} fill={cell.fill} />)}
        {L.cellBoxes.map((cell) => (
          <RichText key={`t${cell.r}-${cell.c}`} lines={cell.text.lines} x={cell.x + 6} y={cell.textY} width={cell.w - 12} rtl={rtl} align={cell.align} />
        ))}
        {lines.length > 0 && (
          <Shape
            stroke={b.borderColor ?? INK}
            strokeWidth={1}
            sceneFunc={(ctx, shape) => {
              ctx.beginPath();
              for (const [x1, y1, x2, y2] of lines) {
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
              }
              ctx.strokeShape(shape);
            }}
          />
        )}
      </Group>
    );
  }

  return (
    <Group listening={false}>
      {b.header && L.rows[0] && <Rect width={w} height={L.rows[0].height} fill="#f3f4f6" />}
      {L.rows.map((row, r) => (
        <Group key={r}>
          {r > 0 && <Line points={[0, row.y, w, row.y]} stroke={INK} strokeWidth={1} />}
          {row.cells.map((cell, c) => (
            <RichText
              key={c}
              lines={cell.lines}
              x={L.colX[c] + 6}
              y={row.y + (row.height - cell.height) / 2}
              width={L.colW[c] - 12}
              rtl={rtl}
              align={row.bold ? "center" : undefined}
            />
          ))}
        </Group>
      ))}
      {/* A line on the left edge of every column, except at the table's own edge */}
      {L.colX.map((x, c) => x > 0.5 && <Line key={c} points={[x, 0, x, L.height]} stroke={INK} strokeWidth={1} />)}
      <Rect width={w} height={L.height} stroke={INK} strokeWidth={1.2} />
    </Group>
  );
}

// The shapes drawn over a table (the block is what is selected on the page, not them).
const noop = () => {};
const TableShapes = ({ b }: { b: TableBlock }) => (b.shapes?.length ? <StudioShapes shapes={b.shapes} selectedId={null} interactive={false} scale={1} onSelect={noop} onChange={noop} /> : null);

// A table: its cells and lines, then the shapes drawn over it.
export function TableView({ b, meta }: { b: TableBlock; meta: ExamMeta }) {
  return (
    <Group listening={false}>
      <TableBody b={b} meta={meta} />
      <TableShapes b={b} />
    </Group>
  );
}

// Shows a picture; a light placeholder while it loads.
function Picture({ src, width, height }: { src: string; width: number; height: number }) {
  const img = useImage(src);
  if (!img) return <Rect width={width} height={height} fill="#f4f4f5" cornerRadius={4} listening={false} />;
  return <KImage image={img} width={width} height={height} listening={false} />;
}

export function EquationView({ b }: { b: EquationBlock }) {
  if (!b.svg) return <Rect width={b.layout.width} height={b.layout.height} fill="#f4f4f5" cornerRadius={4} listening={false} />;
  return <Picture src={svgUrl(b.svg)} width={b.layout.width} height={b.layout.height} />;
}

export function ImageView({ b }: { b: ImageBlock }) {
  return <Picture src={b.src} width={b.layout.width} height={b.layout.height} />;
}
