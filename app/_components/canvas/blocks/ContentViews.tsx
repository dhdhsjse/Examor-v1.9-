"use client";

import { Group, Image as KImage, Line, Rect } from "react-konva";
import { BODY, PAD, TEXT_STYLES, layoutTable, layoutText } from "@/app/_lib/blockLayout";
import { isRtl } from "@/app/_lib/i18n";
import { useImage } from "@/app/_lib/images";
import { svgUrl } from "@/app/_lib/library";
import type { EquationBlock, ImageBlock, Lang, TableBlock, TextBlock } from "@/app/_lib/types";
import { INK, Lines } from "./shared";

export function TextView({ b, lang }: { b: TextBlock; lang: Lang }) {
  const L = layoutText(b);
  const s = TEXT_STYLES[b.style];
  return (
    <Lines
      lines={L.text.lines}
      x={PAD}
      y={L.text.y}
      width={b.layout.width - PAD * 2}
      size={s.size}
      line={s.line}
      bold={s.bold}
      rtl={isRtl(lang)}
      align={b.style === "title" ? "center" : undefined}
    />
  );
}

export function TableView({ b, lang }: { b: TableBlock; lang: Lang }) {
  const L = layoutTable(b);
  const rtl = isRtl(lang);
  const w = b.layout.width;
  const cols = b.cells[0]?.length ?? 1;
  // In Arabic the first column is on the right.
  const colLeft = (c: number) => (rtl ? w - (c + 1) * L.colW : c * L.colW);

  return (
    <Group listening={false}>
      {b.header && L.rows[0] && <Rect width={w} height={L.rows[0].height} fill="#f3f4f6" />}
      {L.rows.map((row, r) => (
        <Group key={r}>
          {r > 0 && <Line points={[0, row.y, w, row.y]} stroke={INK} strokeWidth={1} />}
          {row.cells.map((cell, c) => (
            <Lines
              key={c}
              lines={cell.lines}
              x={colLeft(c) + 6}
              y={row.y + (row.height - cell.height) / 2}
              width={L.colW - 12}
              size={BODY.size}
              line={BODY.line}
              bold={row.bold}
              rtl={rtl}
              align={row.bold ? "center" : undefined}
            />
          ))}
        </Group>
      ))}
      {Array.from({ length: cols - 1 }, (_, c) => (
        <Line key={c} points={[(c + 1) * L.colW, 0, (c + 1) * L.colW, L.height]} stroke={INK} strokeWidth={1} />
      ))}
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
