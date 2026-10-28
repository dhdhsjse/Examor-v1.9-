// What other programs put on the clipboard is HTML (Word, a web page, Google Docs, another editor). This turns it into
// paragraphs with the formatting the app can draw (bold, italic, underline, strikethrough, sub/superscript, color,
// highlight, font, size; lists, alignment, direction, indent, spacing, shading, borders), and the other way round for
// what the app copies. It has no DOM (a small tokenizer), so it works the same everywhere and can be tested without a
// browser.

import { FONT_CHOICES } from "./fonts";
import { listMarkers, type ListKind } from "./lists";
import { cleanLineHeight, cleanSides, clampSpace } from "./paragraphFormat";
import { EFFECT_CSS, isUnderlineStyle, type Run, type RunStyle, type UnderlineStyle } from "./richText";
import { MAX_INDENT } from "./tiptap-indent";
import type { DocParagraph } from "./textboxDoc";
import type { ParagraphAlign } from "./types";

// ---- tokens ----

type Token = { kind: "text"; text: string } | { kind: "open"; tag: string; attrs: Record<string, string>; self: boolean } | { kind: "close"; tag: string };

const VOID = new Set(["br", "hr", "img", "meta", "link", "input", "wbr", "col", "area", "base", "embed", "source", "track", "param"]);
const SKIP_CONTENT = new Set(["head", "style", "script", "title", "xml", "template", "noscript", "svg", "object"]);

const NAMED: Record<string, string> = {
  nbsp: "\u00a0", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", ensp: " ", emsp: " ", thinsp: " ", hellip: "…", mdash: "—", ndash: "–",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", laquo: "«", raquo: "»", bull: "•", middot: "·", copy: "©", reg: "®", trade: "™", deg: "°", plusmn: "±",
  times: "×", divide: "÷", micro: "µ", para: "¶", sect: "§", euro: "€", pound: "£", yen: "¥", cent: "¢", frac12: "½", frac14: "¼", frac34: "¾",
  sup1: "¹", sup2: "²", sup3: "³", alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π", rho: "ρ",
  sigma: "σ", tau: "τ", phi: "φ", omega: "ω", Delta: "Δ", Omega: "Ω", Sigma: "Σ", Pi: "Π", rarr: "→", larr: "←", harr: "↔", le: "≤", ge: "≥", ne: "≠",
  asymp: "≈", infin: "∞", minus: "−", radic: "√", sum: "∑", prod: "∏", int: "∫", part: "∂", nabla: "∇", isin: "∈", cap: "∩", cup: "∪",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (all, body: string) => {
    if (body[0] === "#") {
      const code = body[1] === "x" || body[1] === "X" ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : all;
    }
    return NAMED[body] ?? NAMED[body.toLowerCase()] ?? all;
  });
}

const TAG = /<(\/?)([a-zA-Z][\w:.-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/y;
const ATTR = /([^\s=/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;

function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const n = html.length;
  let i = 0;
  while (i < n) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      tokens.push({ kind: "text", text: decodeEntities(html.slice(i)) });
      break;
    }
    if (lt > i) tokens.push({ kind: "text", text: decodeEntities(html.slice(i, lt)) });
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4); // (this also drops Word's <!--[if gte mso 9]>…<![endif]--> blocks)
      i = end < 0 ? n : end + 3;
      continue;
    }
    if (html.startsWith("<!", lt) || html.startsWith("<?", lt)) {
      const end = html.indexOf(">", lt);
      i = end < 0 ? n : end + 1;
      continue;
    }
    TAG.lastIndex = lt;
    const m = TAG.exec(html);
    if (!m) {
      tokens.push({ kind: "text", text: "<" });
      i = lt + 1;
      continue;
    }
    i = lt + m[0].length;
    const tag = m[2].toLowerCase();
    if (m[1]) {
      tokens.push({ kind: "close", tag });
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of m[3].matchAll(ATTR)) attrs[a[1].toLowerCase()] = decodeEntities(a[2] ?? a[3] ?? a[4] ?? "");
    const self = VOID.has(tag) || /\/\s*$/.test(m[3]);
    if (SKIP_CONTENT.has(tag) && !self) {
      const close = new RegExp(`</${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*>`, "i");
      const rest = close.exec(html.slice(i));
      i = rest ? i + rest.index + rest[0].length : n;
      continue;
    }
    tokens.push({ kind: "open", tag, attrs, self });
  }
  return tokens;
}

// ---- CSS values ----

export function parseCssStyle(attr: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const decl of (attr ?? "").split(";")) {
    const k = decl.indexOf(":");
    if (k < 0) continue;
    const key = decl.slice(0, k).trim().toLowerCase();
    if (key) out[key] = decl.slice(k + 1).trim();
  }
  return out;
}

const COLOR_NAMES: Record<string, string> = {
  red: "#ff0000", blue: "#0000ff", green: "#008000", lime: "#00ff00", yellow: "#ffff00", orange: "#ffa500", purple: "#800080", magenta: "#ff00ff", fuchsia: "#ff00ff",
  cyan: "#00ffff", aqua: "#00ffff", pink: "#ffc0cb", brown: "#a52a2a", gray: "#808080", grey: "#808080", silver: "#c0c0c0", navy: "#000080", teal: "#008080",
  maroon: "#800000", olive: "#808000", gold: "#ffd700", coral: "#ff7f50", crimson: "#dc143c", indigo: "#4b0082", violet: "#ee82ee", turquoise: "#40e0d0",
  white: "#ffffff", black: "#000000",
};

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

// A CSS color as #rrggbb (undefined for none / transparent / unknown).
export function cssColor(v: string | undefined): string | undefined {
  const s = (v ?? "").trim().toLowerCase();
  if (!s || s === "transparent" || s === "inherit" || s === "initial" || s === "auto" || s === "currentcolor") return undefined;
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (hex) return hex[1].length === 3 ? `#${[...hex[1]].map((c) => c + c).join("")}` : `#${hex[1]}`;
  const rgb = /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(s);
  if (rgb) {
    const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith("%") ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    if (!(alpha > 0)) return undefined;
    const channel = (c: string) => (c.endsWith("%") ? (parseFloat(c) * 255) / 100 : parseFloat(c));
    return `#${hex2(channel(rgb[1]))}${hex2(channel(rgb[2]))}${hex2(channel(rgb[3]))}`;
  }
  return COLOR_NAMES[s];
}

// A CSS length in px (undefined when it is not one: auto, a percentage…).
export function cssLength(v: string | undefined): number | undefined {
  const m = /^(-?\d*\.?\d+)\s*(px|pt|pc|cm|mm|in|em|rem)?$/i.exec((v ?? "").trim());
  if (!m) return undefined;
  const n = parseFloat(m[1]);
  switch ((m[2] ?? "px").toLowerCase()) {
    case "pt": return (n * 96) / 72;
    case "pc": return n * 16;
    case "cm": return (n * 96) / 2.54;
    case "mm": return (n * 96) / 25.4;
    case "in": return n * 96;
    case "em":
    case "rem": return n * 16;
    default: return n;
  }
}

// A font family from a CSS list (the first one the app has), undefined when none is.
function cssFont(v: string): string | undefined {
  for (const raw of v.split(",")) {
    const name = raw.trim().replace(/^["']|["']$/g, "").toLowerCase();
    const found = FONT_CHOICES.find((f) => f.name.toLowerCase() === name);
    if (found) return found.name;
  }
  return undefined;
}

// ---- the walk ----

// What an element changes in the words (undefined = leaves it as it is; false = takes it off).
interface Delta {
  b?: boolean;
  i?: boolean;
  u?: boolean;
  ul?: UnderlineStyle | null; // the kind of underline (null = a single line)
  x?: boolean;
  script?: "sub" | "sup" | null;
  color?: string;
  font?: string;
  size?: number;
  hl?: string | null;
}

interface BlockProps {
  align?: ParagraphAlign;
  dir?: "ltr" | "rtl";
  indent: number;
  lineHeight?: number;
  spaceBefore: number;
  spaceAfter: number;
  shading?: string;
  border?: string;
  borderColor?: string;
}

interface ListInfo {
  kind: ListKind;
  none: boolean; // list-style: none (the items are plain paragraphs)
}

interface Frame {
  tag: string;
  delta: Delta; // what this element sets
  align?: ParagraphAlign; // inherited by the blocks inside
  dir?: "ltr" | "rtl";
  pre: boolean;
  list?: ListInfo;
  hidden: boolean;
  marker: boolean; // Word's list marker (mso-list:Ignore): its text is the marker, not the text
}

const BLOCK_TAGS = new Set(["p", "div", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "blockquote", "pre", "ul", "ol", "table", "section", "article", "header", "footer", "aside", "nav", "main", "form", "fieldset", "dl", "dt", "dd", "address", "center", "figure", "figcaption", "caption", "thead", "tbody", "tfoot", "hr"]);
const HEADINGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
const FONT_SIZE_ATTR = [0, 10, 13, 16, 18, 24, 32, 48];

const LIST_TYPE: Record<string, ListKind> = {
  disc: "bullet", circle: "circle", square: "square", decimal: "decimal", "decimal-leading-zero": "decimal", "lower-alpha": "lower-alpha", "lower-latin": "lower-alpha",
  "upper-alpha": "upper-alpha", "upper-latin": "upper-alpha", "lower-roman": "lower-roman", "upper-roman": "upper-roman", "1": "decimal", a: "lower-alpha", A: "upper-alpha", i: "lower-roman", I: "upper-roman",
};

// The kind of a list from what is written before an item in Word's own lists ("1.", "a)", "•").
function kindOfMarker(marker: string): ListKind {
  const m = marker.trim();
  if (/^\d+\)$/.test(m)) return "decimal-paren";
  if (/^\d+[.]?$/.test(m)) return "decimal";
  if (/^[a-z][.)]$/.test(m)) return "lower-alpha";
  if (/^[A-Z][.)]$/.test(m)) return "upper-alpha";
  if (/^[ivxlcdm]+[.)]$/.test(m)) return "lower-roman";
  if (/^[IVXLCDM]+[.)]$/.test(m)) return "upper-roman";
  if (/^[أبجد]\s*[.)-]?$/.test(m)) return "arabic-alpha";
  return "bullet";
}

function frameFor(tag: string, attrs: Record<string, string>, parent: Frame | undefined): Frame {
  const css = parseCssStyle(attrs.style);
  const delta: Delta = {};
  // the tag itself…
  if (tag === "b" || tag === "strong" || HEADINGS.has(tag) || tag === "th") delta.b = true;
  if (tag === "i" || tag === "em" || tag === "cite" || tag === "dfn" || tag === "var") delta.i = true;
  if (tag === "u" || tag === "ins") delta.u = true;
  if (tag === "s" || tag === "strike" || tag === "del") delta.x = true;
  if (tag === "sub") delta.script = "sub";
  if (tag === "sup") delta.script = "sup";
  if (tag === "mark") delta.hl = "#fef08a";
  if (tag === "font") {
    const color = cssColor(attrs.color);
    if (color) delta.color = color;
    if (attrs.face) delta.font = cssFont(attrs.face);
    const size = FONT_SIZE_ATTR[Number(attrs.size)];
    if (size) delta.size = size;
  }
  // …then its style, which wins (Google Docs wraps everything in <b style="font-weight:normal">)
  const weight = css["font-weight"];
  if (weight) delta.b = /^(bold|bolder)$/i.test(weight) || Number(weight) >= 600;
  const fontStyle = css["font-style"];
  if (fontStyle) delta.i = /^(italic|oblique)/i.test(fontStyle);
  const decoration = css["text-decoration"] ?? css["text-decoration-line"];
  if (decoration && tag !== "a") {
    delta.u = /underline/i.test(decoration);
    delta.x = /line-through/i.test(decoration);
    const kind = (/\b(double|dotted|dashed|wavy)\b/i.exec(`${decoration} ${css["text-decoration-style"] ?? ""}`)?.[1] ?? "").toLowerCase();
    delta.ul = delta.u && isUnderlineStyle(kind) ? kind : null;
  }
  const vertical = css["vertical-align"];
  if (vertical) delta.script = /^sub/i.test(vertical) ? "sub" : /^(super|text-top)/i.test(vertical) ? "sup" : /^(baseline|middle)$/i.test(vertical) ? null : delta.script;
  const color = cssColor(css.color);
  if (color && color !== "#000000") delta.color = color; // (black is the default, Word writes it everywhere)
  else if (css.color && /^(windowtext|black)$/i.test(css.color)) delta.color = undefined;
  const bg = cssColor(css["background-color"] ?? (css.background ?? "").split(/\s+/)[0]) ?? cssColor(css["mso-highlight"]);
  if (bg && bg !== "#ffffff") delta.hl = bg;
  if (css["font-family"]) delta.font = cssFont(css["font-family"]) ?? delta.font;
  const size = css["font-size"] ? cssLength(css["font-size"]) : undefined;
  if (size && !/(em|%)$/i.test(css["font-size"])) delta.size = Math.round(size);

  const align = /^(left|center|right|justify)$/i.test(css["text-align"] ?? attrs.align ?? "") ? ((css["text-align"] ?? attrs.align).toLowerCase() as ParagraphAlign) : parent?.align;
  const dirAttr = (attrs.dir ?? css.direction ?? "").toLowerCase();
  const dir = dirAttr === "rtl" || dirAttr === "ltr" ? dirAttr : parent?.dir;

  let list: ListInfo | undefined;
  if (tag === "ul" || tag === "ol") {
    const style = (css["list-style-type"] ?? css["list-style"] ?? "").split(/\s+/)[0].toLowerCase();
    const kind = LIST_TYPE[attrs.type ?? ""] ?? LIST_TYPE[style] ?? (tag === "ol" ? "decimal" : "bullet");
    list = { kind, none: style === "none" };
  }
  return {
    tag,
    delta,
    align,
    dir,
    pre: tag === "pre" || /^pre/i.test(css["white-space"] ?? "") || !!parent?.pre,
    list,
    hidden: tag === "o:p" || /^none$/i.test(css.display ?? "") || /^all$/i.test(css["mso-hide"] ?? "") || /^(true|hidden)$/i.test(attrs.hidden ?? "") || !!parent?.hidden,
    marker: /ignore/i.test(css["mso-list"] ?? "") || !!parent?.marker,
  };
}

function blockProps(tag: string, attrs: Record<string, string>, frame: Frame): BlockProps {
  const css = parseCssStyle(attrs.style);
  const rtl = frame.dir === "rtl";
  const start = cssLength(css[rtl ? "margin-right" : "margin-left"]) ?? cssLength(css[rtl ? "padding-right" : "padding-left"]) ?? cssLength(css["margin-inline-start"]) ?? 0;
  const lh = css["line-height"];
  const lineHeight = lh && /^[\d.]+$/.test(lh) ? cleanLineHeight(Number(lh)) : lh?.endsWith("%") ? cleanLineHeight(parseFloat(lh) / 100) : undefined;
  const border: { sides: string; color?: string } = { sides: "" };
  for (const [prop, side] of [["border-top", "t"], ["border-bottom", "b"], ["border-left", "l"], ["border-right", "r"], ["border", "tblr"]] as const) {
    const v = css[prop];
    if (!v || /\bnone\b|\b0(px|pt)?\b/i.test(v) || /\bhidden\b/.test(v)) continue;
    border.sides += side;
    const c = cssColor(v.split(/\s+/).find((part) => cssColor(part)) ?? undefined);
    if (c) border.color = c;
  }
  const shade = cssColor(css["background-color"] ?? (css.background ?? "").split(/\s+/)[0]);
  return {
    align: frame.align,
    dir: frame.dir,
    // (a list item's own indent is its list level, added by the caller)
    indent: tag === "li" ? 0 : Math.max(0, Math.min(MAX_INDENT, Math.round(start / 24) + (tag === "blockquote" ? 1 : 0))),
    lineHeight,
    spaceBefore: clampSpace(cssLength(css["margin-top"]) ?? 0),
    spaceAfter: clampSpace(cssLength(css["margin-bottom"]) ?? 0),
    shading: shade && shade !== "#ffffff" ? shade : undefined,
    border: cleanSides(border.sides) || undefined,
    borderColor: border.sides ? border.color : undefined,
  };
}

const styleOf = (stack: Frame[]): RunStyle => {
  const s: Record<string, unknown> = {};
  for (const f of stack) {
    const d = f.delta;
    for (const k of ["b", "i", "u", "x"] as const) if (d[k] !== undefined) s[k] = d[k];
    if (d.ul !== undefined) s.ul = d.ul;
    if (d.script !== undefined) {
      delete s.sub;
      delete s.sup;
      if (d.script) s[d.script] = true;
    }
    if (d.color) s.color = d.color;
    if (d.font) s.font = d.font;
    if (d.size) s.size = d.size;
    if (d.hl !== undefined) {
      if (d.hl) s.hl = d.hl;
      else delete s.hl;
    }
  }
  for (const k of Object.keys(s)) if (s[k] === false || s[k] === undefined || s[k] === null) delete s[k];
  if (!s.u) delete s.ul; // (no underline, no kind of it)
  return s as RunStyle;
};

interface Pending {
  runs: Run[];
  props: BlockProps;
  list?: ListKind;
  level: number;
  marker: string;
  sawText: boolean; // there was text, even if it is only spaces: an empty paragraph is a blank line
  word: boolean; // a Word list item: its kind comes from the marker in it
}

const sameRunStyle = (a: RunStyle, b: RunStyle) => JSON.stringify(a) === JSON.stringify(b);

// The paragraphs of some clipboard HTML, with all the formatting found (see applyPasteMode for what is kept).
export function htmlToParagraphs(html: string): DocParagraph[] {
  const tokens = tokenize(html);
  const out: DocParagraph[] = [];
  const stack: Frame[] = [];
  let pending: Pending | null = null;
  let cells = 0; // cells of the table row so far (a space between two)

  const begin = (props: BlockProps, list?: ListKind, level = 0, word = false): Pending => ({ runs: [], props, list, level, marker: "", sawText: false, word });
  const ensure = () => (pending ??= begin(blockProps("p", {}, stack[stack.length - 1] ?? frameFor("div", {}, undefined))));

  const flush = () => {
    const p = pending;
    pending = null;
    if (!p) return;
    // no spaces at the start, no spaces or line breaks at the end; a paragraph of only (non-breaking) spaces is a blank line
    const runs = p.runs.map((r) => ({ ...r }));
    while (runs.length) {
      runs[0].text = runs[0].text.replace(/^ +/, "");
      if (runs[0].text) break;
      runs.shift();
    }
    while (runs.length) {
      const last = runs[runs.length - 1];
      last.text = last.text.replace(/[ \n]+$/, "");
      if (last.text) break;
      runs.pop();
    }
    if (runs.every((r) => /^[\s\u00a0]*$/.test(r.text))) runs.length = 0;
    if (!runs.length && !p.sawText && !p.list) return; // (nothing there: not even a blank line)
    const list = p.word ? kindOfMarker(p.marker) : p.list;
    out.push({
      runs,
      align: p.props.align,
      indent: Math.max(0, Math.min(MAX_INDENT, p.props.indent + p.level)),
      list,
      dir: p.props.dir,
      lineHeight: p.props.lineHeight,
      spaceBefore: p.props.spaceBefore,
      spaceAfter: p.props.spaceAfter,
      shading: p.props.shading,
      border: p.props.border,
      borderColor: p.props.borderColor,
    });
  };

  const addText = (raw: string, frame: Frame | undefined) => {
    const text = frame?.pre ? raw.replace(/\r\n?/g, "\n") : raw.replace(/[ \t\r\n\f]+/g, " ");
    if (!text) return;
    // the white space between two blocks is nothing (no paragraph is started for it)
    if (!frame?.pre && text === " " && !pending?.runs.length) return;
    const p = ensure();
    if (text.trim() || text.includes(" ")) p.sawText = true;
    const style = styleOf(stack);
    const prev = p.runs[p.runs.length - 1];
    const body = !frame?.pre && /^ /.test(text) && (!prev || /[ \n]$/.test(prev.text)) ? text.slice(1) : text; // (one space between words, none at the start)
    if (!body) return;
    if (prev && sameRunStyle(prev.style, style)) prev.text += body;
    else p.runs.push({ text: body, style });
  };

  for (const t of tokens) {
    if (t.kind === "text") {
      const top = stack[stack.length - 1];
      if (top?.hidden) continue;
      if (top?.marker) {
        ensure().marker += t.text; // Word's list marker: "1." or "·", not text of the item
        continue;
      }
      addText(t.text, top);
      continue;
    }
    if (t.kind === "open") {
      const parent = stack[stack.length - 1];
      const frame = frameFor(t.tag, t.attrs, parent);
      if (frame.hidden) {
        if (!t.self) stack.push(frame);
        continue;
      }
      if (t.tag === "br") {
        const p = ensure();
        p.sawText = true;
        p.runs.push({ text: "\n", style: styleOf(stack) });
        continue;
      }
      if (t.tag === "td" || t.tag === "th") {
        if (cells++ > 0) addText(" ", parent);
      }
      if (t.tag === "tr") cells = 0;
      if (BLOCK_TAGS.has(t.tag) && !t.self) {
        flush();
        if (t.tag === "ul" || t.tag === "ol") {
          // a list does not start a paragraph of its own: its items do
        } else if (t.tag === "li") {
          const depth = stack.filter((f) => f.list).length;
          const list = [...stack].reverse().find((f) => f.list)?.list;
          pending = begin(blockProps("li", t.attrs, frame), list && !list.none ? list.kind : undefined, Math.max(0, depth - 1));
        } else {
          const css = parseCssStyle(t.attrs.style);
          const wordList = t.tag === "p" && /\blevel(\d+)\b/i.test(css["mso-list"] ?? "") && !/ignore|none/i.test(css["mso-list"].split(/\s/)[0] ?? "");
          if (wordList) {
            const level = Number(/\blevel(\d+)\b/i.exec(css["mso-list"])?.[1] ?? 1) - 1;
            pending = begin(blockProps("p", t.attrs, frame), "bullet", Math.max(0, level), true);
          } else {
            pending = begin(blockProps(t.tag, t.attrs, frame));
          }
        }
      }
      if (!t.self) stack.push(frame);
      continue;
    }
    // a closing tag: pop to the matching element (a stray one is ignored)
    const at = stack.map((f) => f.tag).lastIndexOf(t.tag);
    if (at < 0) continue;
    stack.length = at;
    if (BLOCK_TAGS.has(t.tag)) flush();
  }
  flush();
  // no blank lines at the ends
  while (out.length && !out[0].runs.length && !out[0].list) out.shift();
  while (out.length && !out[out.length - 1].runs.length && !out[out.length - 1].list) out.pop();
  return out.map((p) => stripUndefined(p));
}

const stripUndefined = (p: DocParagraph): DocParagraph => {
  const q = { ...p } as Record<string, unknown>;
  for (const k of Object.keys(q)) if (q[k] === undefined) delete q[k];
  return q as unknown as DocParagraph;
};

// ---- the other way: what the app copies ----

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\u00a0/g, "&nbsp;");

function runHtml(r: Run): string {
  const st = r.style;
  const css: string[] = [];
  if (st.color) css.push(`color:${st.color}`);
  if (st.font) css.push(`font-family:'${st.font}'`);
  if (st.size) css.push(`font-size:${st.size}px`);
  if (st.hl) css.push(`background-color:${st.hl}`);
  const decoration = [st.u && "underline", st.x && "line-through"].filter(Boolean).join(" ") + (st.u && st.ul ? ` ${st.ul}` : "");
  if (decoration) css.push(`text-decoration:${decoration}`);
  if (st.fx === "shadow" || st.fx === "glow") css.push(`text-shadow:${EFFECT_CSS[st.fx].textShadow}`); // (an outline has no CSS that other programs know)
  let body = esc(r.text).replace(/\n/g, "<br>");
  if (st.sub) body = `<sub>${body}</sub>`;
  else if (st.sup) body = `<sup>${body}</sup>`;
  if (st.i) body = `<em>${body}</em>`;
  if (st.b) body = `<strong>${body}</strong>`;
  return css.length ? `<span style="${css.join(";")}">${body}</span>` : body;
}

const LIST_CSS: Partial<Record<ListKind, string>> = { bullet: "disc", circle: "circle", square: "square", decimal: "decimal", "decimal-paren": "decimal", "lower-alpha": "lower-alpha", "upper-alpha": "upper-alpha", "lower-roman": "lower-roman", "upper-roman": "upper-roman" };

// HTML for other programs; the `payload` (the paragraphs exactly, see richClipboard.ts) rides in an attribute of the first
// element so pasting back into the app loses nothing.
export function paragraphsToHtml(paragraphs: DocParagraph[], payload?: string): string {
  const parts: string[] = [];
  for (const p of paragraphs) {
    const css = ["margin:0"];
    if (p.align) css.push(`text-align:${p.align}`);
    if (p.dir) css.push(`direction:${p.dir}`);
    if (p.indent && !p.list) css.push(`margin-inline-start:${p.indent * 24}px`);
    if (p.lineHeight) css.push(`line-height:${p.lineHeight}`);
    if (p.spaceBefore) css.push(`margin-top:${p.spaceBefore}px`);
    if (p.spaceAfter) css.push(`margin-bottom:${p.spaceAfter}px`);
    if (p.shading) css.push(`background-color:${p.shading}`);
    for (const side of p.border ?? "") css.push(`border-${{ t: "top", b: "bottom", l: "left", r: "right" }[side]}:1px solid ${p.borderColor ?? "#111827"}`);
    const body = p.runs.map(runHtml).join("") || "<br>";
    if (p.list) {
      const tag = LIST_CSS[p.list] && /decimal|alpha|roman/.test(p.list) ? "ol" : "ul";
      css.push(`margin-inline-start:${(p.indent + 1) * 24}px`);
      parts.push(`<${tag} style="margin:0;padding:0;list-style-type:${LIST_CSS[p.list] ?? "disc"}"><li style="${css.join(";")}">${body}</li></${tag}>`);
    } else {
      parts.push(`<p style="${css.join(";")}">${body}</p>`);
    }
  }
  const html = parts.join("");
  return payload ? `<div data-examor-clip="${esc(payload).replace(/"/g, "&quot;")}">${html}</div>` : html;
}

// The text of the paragraphs, with the markers of their lists written out ("• a", "1. b").
export function paragraphsToText(paragraphs: DocParagraph[], arabic = false): string {
  const markers = listMarkers(paragraphs.map((p) => ({ list: p.list ?? null, level: p.indent, arabic: p.dir ? p.dir === "rtl" : arabic })));
  return paragraphs.map((p, i) => `${markers[i] ? `${markers[i]} ` : ""}${p.runs.map((r) => r.text).join("")}`).join("\n");
}

