"use client";

import { Group, Image as KImage, Line, Rect } from "react-konva";
import { DEFAULT_ACCENT, layoutTable, layoutText, layoutTextbox } from "@/app/_lib/blockLayout";
import { isRtl } from "@/app/_lib/i18n";
import { useImage } from "@/app/_lib/images";
import { svgUrl } from "@/app/_lib/library";
import { plainText, serializeRich } from "@/app/_lib/richText";
import type { EquationBlock, ExamMeta, ImageBlock, TableBlock, TextBlock, TextboxBlock } from "@/app/_lib/types";
import { INK, RichText, tint } from "./shared";


export function TextView({ b, meta }: { b: TextBlock; meta: ExamMeta }) {
  const L = layoutText(b, meta);
  const rtl = isRtl(meta.lang);
  const accent = b.accent ?? DEFAULT_ACCENT;
  const d = L.deco;
  return (
    <>
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
  const rtl = isRtl(meta.lang);
  return (
    <>
      {b.background && <Rect width={b.layout.width} height={L.height} fill={b.background} listening={false} />}
      {b.border ? (
        <Rect x={0.5} y={0.5} width={b.layout.width - 1} height={L.height - 1} stroke={b.border} strokeWidth={1} listening={false} />
      ) : (
        interactive && <Rect width={b.layout.width} height={L.height} stroke="#cbd5e1" strokeWidth={1} dash={[4, 3]} listening={false} />
      )}
      {L.paragraphs.map((p, k) => (
        <RichText key={k} lines={p.lines} x={p.x} y={L.y + p.y} width={p.width} rtl={rtl} align={p.align} />
      ))}
    </>
  );
}

export function TableView({ b, meta }: { b: TableBlock; meta: ExamMeta }) {
  // In Arabic the first column is on the right.
  const L = layoutTable(b, meta);
  const rtl = L.F.rtl;
  const w = b.layout.width;

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
