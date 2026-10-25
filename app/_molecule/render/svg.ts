// Small SVG helpers shared by the renderers (pure strings, no DOM).
import type { RenderResult } from "../model";

export const FONT = "Arial, Helvetica, sans-serif";

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const num = (n: number) => String(Math.round(n * 100) / 100);

// A piece of a label: normal text, subscript (atom counts) or superscript (charges).
export interface Run {
  text: string;
  mode: "normal" | "sub" | "sup";
}

// "NH2" -> N H (2 as subscript); "CH3–COOH" -> digits after a letter are subscripts, so are digits after ")".
export function runsFromFormula(text: string): Run[] {
  const runs: Run[] = [];
  let prev = "";
  for (const ch of text) {
    const isSub = /\d/.test(ch) && /[A-Za-z)]/.test(prev);
    const mode: Run["mode"] = isSub ? "sub" : "normal";
    const last = runs[runs.length - 1];
    if (last && last.mode === mode) last.text += ch;
    else runs.push({ text: ch, mode });
    prev = ch;
  }
  return runs;
}

export function runsWidth(runs: Run[], fontSize: number): number {
  let w = 0;
  for (const r of runs) {
    const size = r.mode === "normal" ? fontSize : fontSize * 0.72;
    for (const ch of r.text) w += size * (/[0-9]/.test(ch) ? 0.56 : /[ilI.,;:()|–\-+]/.test(ch) ? 0.34 : /[mwMW]/.test(ch) ? 0.9 : 0.62);
  }
  return w;
}

// One text element made of runs. Sub/superscripts use dy shifts (supported everywhere SVG is rasterised).
export function textRuns(runs: Run[], x: number, y: number, fontSize: number, opts: { anchor?: "start" | "middle" | "end"; fill?: string; attrs?: string } = {}): string {
  let shift = 0;
  const parts = runs.map((r) => {
    const want = r.mode === "sub" ? 0.26 : r.mode === "sup" ? -0.36 : 0;
    const dy = (want - shift) * fontSize;
    shift = want;
    const size = r.mode === "normal" ? "" : ` font-size="${num(fontSize * 0.72)}"`;
    return `<tspan${dy ? ` dy="${num(dy)}"` : ""}${size}>${esc(r.text)}</tspan>`;
  });
  return `<text x="${num(x)}" y="${num(y)}" font-family="${FONT}" font-size="${num(fontSize)}" text-anchor="${opts.anchor ?? "middle"}" fill="${opts.fill ?? "#000"}"${opts.attrs ? " " + opts.attrs : ""}>${parts.join("")}</text>`;
}

export function svgDoc(inner: string, w: number, h: number, warning?: string): RenderResult {
  const W = Math.ceil(w);
  const H = Math.ceil(h);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${inner}</svg>`;
  return { svg, width: W, height: H, ...(warning ? { warning } : {}) };
}
