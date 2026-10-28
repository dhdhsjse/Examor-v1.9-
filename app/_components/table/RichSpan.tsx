"use client";

import type { CSSProperties } from "react";
import { fontStack } from "@/app/_lib/fonts";
import { isRich, parseRich, runCss } from "@/app/_lib/richText";

// The CSS of a run as a style object of React ("webkitTextStroke" is "WebkitTextStroke" there).
const reactCss = (css: Partial<CSSStyleDeclaration>): CSSProperties => Object.fromEntries(Object.entries(css).map(([k, v]) => [k.replace(/^webkit/, "Webkit"), v])) as CSSProperties;

/** A text with styled words (sub- and superscripts, colors…) shown, not edited */
export function RichSpan({ text }: { text: string }) {
  if (!isRich(text)) return <>{text}</>;
  return (
    <>
      {parseRich(text).map((run, i) => (
        <span key={i} style={reactCss(runCss(run.style, fontStack))}>
          {run.text}
        </span>
      ))}
    </>
  );
}
