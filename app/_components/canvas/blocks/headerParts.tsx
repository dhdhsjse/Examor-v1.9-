"use client";

import { Fragment, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import type { EditRegion } from "@/app/_lib/editRegions";
import { words } from "@/app/_lib/i18n";
import { FONT_FAMILY, measureText, type TextFont } from "@/app/_lib/measure";
import { plainText } from "@/app/_lib/richText";
import type { ExamMeta, HeaderBlock, HeaderFields, TextAlign, ViewMode } from "@/app/_lib/types";
import HeaderView from "./HeaderView";
import { OneLine } from "./shared";

// The texts of the exam header on the page, found in what HeaderView draws (so the 24 styles keep a
// single description: their drawing). Each text that shows fields of the header gets a place to type
// in on the page (editRegions) and follows the alignment chosen for it (`HeaderBlock.aligns`).

type HeaderKey = Exclude<keyof HeaderFields, "outOf" | "autoOutOf">;

// Which fields a text shows: one ("Collège …"), several joined by `sep` ("Maths  ·  3e  ·  1 h"),
// after a label (`prefix`: "Durée : ").
export interface HeaderFieldRef {
  keys: HeaderKey[];
  sep: string;
  prefix: string;
}

interface Part {
  el: ReactElement;
  field: HeaderFieldRef | null;
}

type OneLineProps = Parameters<typeof OneLine>[0];

const KEYS: HeaderKey[] = ["title", "republic", "authority", "directorate", "school", "subject", "level", "duration", "year"];
const SEPS = ["  ·  ", "  —  "];

// What a style draws, as a flat list (the style components are plain functions without hooks).
function flatten(node: ReactNode, out: ReactElement[]) {
  if (Array.isArray(node)) return node.forEach((n) => flatten(n, out));
  if (!isValidElement(node)) return;
  const props = node.props as { children?: ReactNode };
  if (node.type === Fragment) return flatten(props.children, out);
  if (typeof node.type === "function" && node.type !== OneLine) return flatten((node.type as (p: unknown) => ReactNode)(node.props), out);
  out.push(node);
}

// The fields a drawn text shows, or null (labels, dotted lines, "/ 20").
function fieldOf(text: string, f: HeaderFields, title: string): HeaderFieldRef | null {
  const value = (k: HeaderKey) => String(f[k] ?? "");
  const one = (keys: HeaderKey[], sep = "", prefix = ""): HeaderFieldRef => ({ keys, sep, prefix });
  if (!text.trim()) return null;
  if (text === title) return one(["title"]);
  for (const sep of SEPS) {
    const parts = text.split(sep);
    if (parts.length < 2) continue;
    const keys = parts.map((p) => KEYS.find((k) => value(k) && value(k) === p));
    if (keys.every(Boolean) && new Set(keys).size === keys.length) return one(keys as HeaderKey[], sep);
  }
  for (const k of KEYS) if (value(k) && (text === value(k) || text === value(k).toUpperCase())) return one([k]);
  for (const k of KEYS) if (value(k) && text.endsWith(` : ${value(k)}`)) return one([k], "", text.slice(0, text.length - value(k).length));
  return null;
}

// Everything the header draws, with the fields of each text and the chosen alignments applied.
export function headerParts(b: HeaderBlock, meta: ExamMeta, mode: ViewMode, totalPoints: number): Part[] {
  const els: ReactElement[] = [];
  flatten(HeaderView({ b, meta, mode, totalPoints }), els);
  const title = mode === "key" ? `${b.fields.title} — ${words(meta.lang).key}` : b.fields.title;
  return els.map((el) => {
    if (el.type !== OneLine) return { el, field: null };
    const field = fieldOf((el.props as OneLineProps).text, b.fields, title);
    const align = field && b.aligns?.[field.keys[0]];
    return { el: align ? cloneElement(el as ReactElement<OneLineProps>, { align }) : el, field };
  });
}

// The exam header on the canvas (instead of HeaderView, so the alignments apply).
export function HeaderNode(props: { b: HeaderBlock; meta: ExamMeta; mode: ViewMode; totalPoints: number }) {
  return <>{headerParts(props.b, props.meta, props.mode, props.totalPoints).map((p, k) => cloneElement(p.el, { key: k }))}</>;
}

// Where each field of the header can be typed in on the page. A text with a label is typed after it.
export function headerRegions(b: HeaderBlock, meta: ExamMeta, mode: ViewMode): EditRegion[] {
  return headerParts(b, meta, mode, 0).flatMap(({ el, field }) => {
    if (!field) return [];
    const p = el.props as OneLineProps;
    const align: TextAlign = p.align ?? (p.rtl ? "right" : "left");
    const font: TextFont = { family: p.family ?? FONT_FAMILY, size: p.size, bold: !!p.bold, italic: false, underline: false, color: p.color ?? "#111827" };
    const region = { field: { kind: "header" as const, keys: field.keys, sep: field.sep }, y: p.y, height: p.size, spec: { font, line: p.size }, multiline: false };
    if (!field.prefix) return [{ ...region, x: p.x, width: p.width, align }];
    // Measure where the label ends and the field starts (right-to-left: the label is on the right).
    const total = Math.min(p.width, measureText(plainText(p.text), font));
    const label = measureText(plainText(field.prefix), font);
    const start = align === "left" ? p.x : align === "right" ? p.x + p.width - total : p.x + (p.width - total) / 2;
    const fieldLeft = p.rtl ? start : start + label;
    const fieldRight = p.rtl ? start + total - label : start + total;
    // The box grows away from the label: to the end of the line, or (right-to-left) from its start.
    const x0 = p.rtl ? (align === "left" ? start : p.x) : fieldLeft;
    const x1 = p.rtl ? fieldRight : align === "left" ? p.x + p.width : fieldRight;
    const typed: TextAlign = align === "center" ? (p.rtl ? "right" : "left") : align;
    return [{ ...region, x: x0, width: Math.max(40, x1 - x0), align: typed }];
  });
}
