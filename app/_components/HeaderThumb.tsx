"use client";

import type Konva from "konva";
import { useEffect, useRef, useState } from "react";
import { Group, Layer, Rect, Stage } from "react-konva";
import { HeaderNode } from "@/app/_components/canvas/blocks/headerParts";
import { headerHeight } from "@/app/_lib/blockLayout";
import { createBlock, defaultHeaderFields } from "@/app/_lib/blocks";
import { designDefaults } from "@/app/_lib/headerDesigns";
import type { ExamMeta, HeaderBlock, HeaderStyle, Lang } from "@/app/_lib/types";

// A live picture of an exam header: the real header, drawn by the canvas (so with the exam's texts, color, font and language), made
// small. Each picture is drawn once on a hidden stage when it comes into view, then kept as an image (the same header is not drawn twice),
// so a long list of designs stays light.

const PX = 360; // width it is drawn at (shown smaller: sharp on any screen)
const cache = new Map<string, string>();
const MAX_CACHED = 500;

export function HeaderThumb({ block, meta, className = "" }: { block: HeaderBlock; meta: ExamMeta; className?: string }) {
  const top = block.inset ? Math.min(0, (block.frame?.top ?? 0) - block.layout.y) : 0;
  const s = PX / block.layout.width;
  const h = Math.round((headerHeight(block.style) - top + 8) * s);
  const key = JSON.stringify([block.style, block.accent, meta.accent, meta.lang, meta.fontFamily, block.fields, block.font, block.aligns, block.layout.width, block.inset, top]);
  const url = cache.get(key);
  const [, redraw] = useState(0);
  const [seen, setSeen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  const stage = useRef<Konva.Stage>(null);

  useEffect(() => {
    if (seen || !box.current) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setSeen(true), { rootMargin: "240px" });
    io.observe(box.current);
    return () => io.disconnect();
  }, [seen]);

  const drawing = seen && !url;
  useEffect(() => {
    if (!drawing) return;
    let alive = true;
    const keep = () => {
      if (!alive || !stage.current) return;
      try {
        cache.set(key, stage.current.toDataURL({ pixelRatio: 1 }));
        if (cache.size > MAX_CACHED) cache.delete(cache.keys().next().value as string);
      } catch {}
      redraw((n) => n + 1);
    };
    const fonts = typeof document !== "undefined" && document.fonts ? document.fonts.ready : Promise.resolve();
    fonts.then(() => requestAnimationFrame(keep)).catch(keep);
    return () => {
      alive = false;
    };
  }, [drawing, key]);

  return (
    <span ref={box} className={`relative block w-full overflow-hidden bg-white ${className}`} style={{ aspectRatio: `${PX} / ${h}` }}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" draggable={false} className="block h-full w-full select-none" />
      ) : (
        <span className="absolute inset-1 animate-pulse rounded-sm bg-slate-100" />
      )}
      {drawing && (
        <span aria-hidden className="pointer-events-none fixed -left-[10000px] top-0">
          <Stage ref={stage} width={PX} height={h} listening={false}>
            <Layer listening={false}>
              <Rect width={PX} height={h} fill="#ffffff" />
              <Group scaleX={s} scaleY={s} y={-top * s + 4 * s}>
                <HeaderNode b={block} meta={meta} mode="exam" totalPoints={0} />
              </Group>
            </Layer>
          </Stage>
        </span>
      )}
    </span>
  );
}

// An example header of a style, for pictures outside an exam (the exam's own texts are not known there).
export function demoHeader(style: HeaderStyle, lang: Lang, accent?: string): HeaderBlock {
  const b = createBlock("header", lang, "demo", { style, fields: { ...defaultHeaderFields(lang), ...designDefaults(style) }, width: 794, ...(accent ? { accent } : {}) }) as HeaderBlock;
  return { ...b, inset: { left: 48, right: 48 }, layout: { ...b.layout, x: 0, y: 48 } };
}
