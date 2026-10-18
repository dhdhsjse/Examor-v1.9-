import { DEFAULT_MARGINS } from "./a4";
import { blockHeight } from "./blockLayout";
import { chromeTextField, defaultFooterId, defaultHeaderId, footerById, headerById, headerTemplateForStyle } from "./onboarding/headerFooterLibrary";
import { encodeStyle, parseRich, plainText } from "./richText";
import { scopePages } from "./onboarding/pageScope";
import { pageSize } from "./pageFormats";
import type { Block, BlockFont, ChromeRule, ExamDoc, HeaderBlock, HeaderFields, HeaderFooterConfig, Page, PageScope } from "./types";
import type { T } from "./uiLang";

// Headers and footers of the pages (Page layout → Header and footer).
// The settings are the truth: `ExamDoc.globalHeader/globalFooter` for every page, `Page.header/footer`
// for a page with its own. The canvas and the PDF draw ordinary blocks tagged `meta.role`, built from
// those settings here and rebuilt when the settings of a page change (syncChrome).

export type ChromeKind = "header" | "footer";
export const CHROME_KINDS: ChromeKind[] = ["header", "footer"];
const GLOBAL = { header: "globalHeader", footer: "globalFooter" } as const;
const GAP = 10;

export const chromeTemplate = (kind: ChromeKind, id: string | undefined) => (kind === "header" ? headerById(id) : footerById(id));
export const globalChrome = (doc: ExamDoc, kind: ChromeKind) => withChromeConfig(doc)[GLOBAL[kind]];

const config = (enabled: boolean, templateId: string): HeaderFooterConfig => ({ enabled, templateId, data: {} });

// A page without its own header/footer settings.
function withoutOwn(page: Page): Page {
  const rest = { ...page };
  delete rest.header;
  delete rest.footer;
  return rest;
}

// The onboarding rule as settings: "every page" is the document's header; "first page" or a list of
// pages means no header for the document and one of their own for those pages (so new pages get none).
export function chromeFromRule(doc: ExamDoc, rule: ChromeRule): ExamDoc {
  const set = (scope: PageScope, templateId: string) => ({ all: scope.mode === "all", on: new Set(scopePages(scope, doc.pages.length)), templateId });
  const h = set(rule.header, rule.headerId ?? defaultHeaderId);
  const f = set(rule.footer, rule.footerId ?? defaultFooterId);
  return {
    ...doc,
    globalHeader: config(h.all, h.templateId),
    globalFooter: config(f.all, f.templateId),
    pages: doc.pages.map((p, i) => ({
      ...withoutOwn(p),
      ...(!h.all && h.on.has(i) ? { header: config(true, h.templateId) } : {}),
      ...(!f.all && f.on.has(i) ? { footer: config(true, f.templateId) } : {}),
    })),
  };
}

// Older files only have the onboarding rule (`meta.chrome`): read it as settings.
export function withChromeConfig(doc: ExamDoc): ExamDoc {
  if (doc.globalHeader || doc.globalFooter || !doc.meta.chrome) return doc;
  return chromeFromRule(doc, doc.meta.chrome);
}

// The header (or footer) page `i` shows: its own, or the document's.
export function chromeConfig(doc: ExamDoc, i: number, kind: ChromeKind): HeaderFooterConfig | undefined {
  const d = withChromeConfig(doc);
  return d.pages[i]?.[kind] ?? d[GLOBAL[kind]];
}

// Back to a rule, to open the setup window on what the exam uses.
export function chromeRuleOf(doc: ExamDoc): ChromeRule | undefined {
  const d = withChromeConfig(doc);
  if (!d.globalHeader && !d.globalFooter) return undefined;
  const of = (kind: ChromeKind) => {
    const global = d[GLOBAL[kind]];
    const own = d.pages.flatMap((p, i) => (p[kind]?.enabled ? [{ n: i + 1, id: p[kind].templateId }] : []));
    const scope: PageScope = global?.enabled
      ? { mode: "all" }
      : !own.length
        ? { mode: "none" }
        : own.length === 1 && own[0].n === 1
          ? { mode: "first" }
          : { mode: "pages", pages: own.map((o) => o.n) };
    return { scope, id: global?.enabled ? global.templateId : (own[0]?.id ?? global?.templateId) };
  };
  const h = of("header");
  const f = of("footer");
  return { header: h.scope, footer: f.scope, headerId: h.id, footerId: f.id };
}

// The blocks of the header or footer of page `i` (none when it is off). `c`: other settings than the
// page's (previews).
export function buildChrome(doc: ExamDoc, i: number, kind: ChromeKind, t: T, c = chromeConfig(doc, i, kind)): Block[] {
  const page = doc.pages[i];
  if (!page || !c?.enabled) return [];
  return chromeTemplate(kind, c.templateId).build({
    pageId: page.id,
    pageIndex: i,
    pageCount: doc.pages.length,
    margins: page.margins ?? DEFAULT_MARGINS,
    pageSize: pageSize(page),
    lang: doc.meta.lang,
    now: new Date(),
    examTitle: doc.meta.title,
    t,
    data: c.data ?? {},
  });
}

export const pageChromeBlocks = (doc: ExamDoc, i: number, t: T) => CHROME_KINDS.flatMap((kind) => buildChrome(doc, i, kind, t));

// What a page shows, to compare: off is off whatever its template.
const shown = (c: HeaderFooterConfig | undefined) => JSON.stringify(c?.enabled ? { id: c.templateId, data: c.data ?? {} } : null);

// Rebuild the header/footer blocks of the pages whose settings differ between `before` and `after`
// (with `pageCount`, also the ones that show the number of pages). A header of another height moves
// the rest of its page by the difference. New pages (not in `before`) are left to the caller.
export function syncChrome(before: ExamDoc, after: ExamDoc, t: T, opts: { pageCount?: boolean } = {}): ExamDoc {
  let blocks = after.blocks;
  after.pages.forEach((page, i) => {
    const j = before.pages.findIndex((p) => p.id === page.id);
    if (j < 0) return;
    for (const kind of CHROME_KINDS) {
      const now = chromeConfig(after, i, kind);
      const counts = opts.pageCount && now?.enabled && chromeTemplate(kind, now.templateId).countsPages;
      if (!counts && shown(now) === shown(chromeConfig(before, j, kind))) continue;
      const old = blocks.filter((b) => b.layout.pageId === page.id && b.meta?.role === kind);
      // A rebuilt block of the same type keeps its id and height on the page: text being typed on the
      // page stays in its box, the selection stays, and a header moved down stays there.
      const fresh = buildChrome({ ...after, blocks }, i, kind, t).map((b, k) =>
        old[k]?.type === b.type ? ({ ...b, id: old[k].id, layout: { ...b.layout, y: old[k].layout.y } } as Block) : b,
      );
      blocks = [...blocks.filter((b) => !old.includes(b)), ...fresh];
      if (kind !== "header") continue;
      // The body starts under the header (or at the top margin): keep the same room above it.
      const top = (list: Block[]) => (list.length ? Math.max(...list.map((b) => b.layout.y + blockHeight(b, 1, after.meta))) + GAP : (page.margins ?? DEFAULT_MARGINS).top);
      const shift = top(fresh) - top(old);
      if (shift) blocks = blocks.map((b) => (b.layout.pageId === page.id && !b.meta?.role ? { ...b, layout: { ...b.layout, y: Math.max(0, b.layout.y + shift) } } : b));
    }
  });
  return blocks === after.blocks ? after : { ...after, blocks };
}

// Change the document's header/footer (no `pageId`) or one page's own (`config` undefined = the page
// follows the document again), and rebuild what it changes on the pages.
export function setChrome(doc: ExamDoc, kind: ChromeKind, c: HeaderFooterConfig | undefined, pageId: string | undefined, t: T): ExamDoc {
  const base = withChromeConfig(doc);
  const next: ExamDoc = pageId
    ? {
        ...base,
        pages: base.pages.map((p) => {
          if (p.id !== pageId) return p;
          const rest = { ...p };
          delete rest[kind];
          return c ? { ...rest, [kind]: c } : rest;
        }),
      }
    : { ...base, [GLOBAL[kind]]: c };
  const same = JSON.stringify(next.pages) === JSON.stringify(base.pages) && JSON.stringify(next[GLOBAL[kind]]) === JSON.stringify(base[GLOBAL[kind]]);
  return same ? doc : syncChrome(base, next, t);
}

// ---- The exam header block and the settings: one thing ----

// The settings that draw this exam header block: its style's template and its texts.
export function headerConfigOf(b: HeaderBlock, templateId = headerTemplateForStyle(b.style).id): HeaderFooterConfig {
  const { autoOutOf, outOf, ...texts } = b.fields;
  const data: Record<string, string> = { ...Object.fromEntries(Object.entries(texts).map(([k, v]) => [k, String(v ?? "")])), outOf: String(outOf) };
  if (autoOutOf) data.autoOutOf = "1";
  if (b.accent) data.accent = b.accent;
  if (b.font?.family) data.fontFamily = b.font.family;
  for (const [k, a] of Object.entries(b.aligns ?? {})) if (a) data[`align.${k}`] = a;
  return { enabled: true, templateId, data };
}

// Exam headers that are plain blocks (from a template, an older file, "My blocks") become their
// page's header when the page shows none, so they are edited in Page layout → Header and footer.
// The block stays where it is. A page that already shows a header keeps the extra one as a block.
export function adoptHeaders(doc: ExamDoc): ExamDoc {
  let d = doc;
  for (const b of doc.blocks) {
    if (b.type !== "header" || b.meta?.role) continue;
    const i = d.pages.findIndex((p) => p.id === b.layout.pageId);
    if (i < 0 || chromeConfig(d, i, "header")?.enabled || d.blocks.some((o) => o.layout.pageId === b.layout.pageId && o.meta?.role === "header")) continue;
    d = adoptHeader(d, b.id);
  }
  return d;
}

// This exam header block becomes its page's header (any other header blocks of the page go).
export function adoptHeader(doc: ExamDoc, blockId: string): ExamDoc {
  const b = doc.blocks.find((x) => x.id === blockId);
  if (b?.type !== "header") return doc;
  const c = headerConfigOf(b);
  const base = withChromeConfig(doc);
  return {
    ...base,
    pages: base.pages.map((p) => (p.id === b.layout.pageId ? { ...p, header: c } : p)),
    blocks: base.blocks
      .filter((x) => x.id === b.id || x.layout.pageId !== b.layout.pageId || x.meta?.role !== "header")
      .map((x) => (x.id === b.id ? { ...x, meta: { role: "header" as const, templateId: c.templateId } } : x)),
  };
}

// The settings a header/footer block on the page comes from: its page's own, or the document's.
function sourceOf(doc: ExamDoc, blockId: string) {
  const b = doc.blocks.find((x) => x.id === blockId);
  const kind = b?.meta?.role;
  if (!b || !kind) return null;
  const i = doc.pages.findIndex((p) => p.id === b.layout.pageId);
  const config = i < 0 ? undefined : chromeConfig(doc, i, kind);
  if (!config?.enabled) return null;
  const own = withChromeConfig(doc).pages[i][kind] !== undefined;
  return { b, kind, i, config, pageId: own ? b.layout.pageId : undefined };
}

const HEADER_LOOK = ["accent", "autoOutOf", "fontFamily"];
const withoutKeys = (data: Record<string, string>, drop: (k: string) => boolean) => Object.fromEntries(Object.entries(data).filter(([k]) => !drop(k)));

// A change made on a page's header or footer (typed on the page, styled in its format bar, or in the
// right panel: style, color, font, alignment) changes the settings it comes from: the page's own, or
// the document's (then every page following it). Returns null for any other block or change. A footer
// filled in automatically (page numbers) keeps its text: only its look (one style for the whole line)
// can change.
export function chromeEdit(doc: ExamDoc, blockId: string, patch: Record<string, unknown>, t: T): ExamDoc | null {
  const src = sourceOf(doc, blockId);
  if (!src) return null;
  const { b, config } = src;
  let templateId = config.templateId;
  let data: Record<string, string>;
  if (b.type === "header" && ["fields", "style", "accent", "font", "aligns"].some((k) => k in patch)) {
    const changed = { ...b, ...patch, fields: { ...b.fields, ...(patch.fields as Partial<HeaderFields> | undefined) } } as HeaderBlock;
    if (changed.style !== b.style) templateId = headerTemplateForStyle(changed.style).id;
    const kept = withoutKeys(config.data, (k) => HEADER_LOOK.includes(k) || k.startsWith("align."));
    // Texts left as the template has them are not kept: another template then shows its own.
    const base = buildChrome(doc, src.i, "header", t, { enabled: true, templateId, data: {} }).find((x) => x.type === "header");
    const defaults = base?.type === "header" ? (base.fields as unknown as Record<string, unknown>) : {};
    const typed = withoutKeys(headerConfigOf(changed, templateId).data, (k) => k in defaults && String(defaults[k]) === headerConfigOf(changed, templateId).data[k]);
    data = { ...withoutKeys(kept, (k) => k in defaults), ...typed };
  } else if (b.type === "text" && ("text" in patch || "font" in patch)) {
    data = { ...config.data };
    if (typeof patch.text === "string") {
      const field = chromeTextField(b);
      if (field) data[field] = patch.text;
      else {
        const runs = parseRich(patch.text);
        if (plainText(patch.text) !== plainText(b.text) || runs.length > 1) return doc; // only the look of the whole line
        const look = encodeStyle(runs[0]?.style ?? {});
        if (look) data.style = look;
        else delete data.style;
      }
    }
    if ("font" in patch) {
      const font = (patch.font ?? {}) as BlockFont;
      const set = (k: string, v: string | number | undefined) => (v ? (data[k] = String(v)) : delete data[k]);
      set("fontFamily", font.family);
      set("fontSize", font.size);
      set("color", font.color);
    }
  } else return null;
  return setChrome(doc, src.kind, { ...config, templateId, data }, src.pageId, t);
}

// Change the settings a header/footer block comes from with `fn` (format bar of the page: alignment,
// size, bold…).
export function editChromeData(doc: ExamDoc, blockId: string, fn: (data: Record<string, string>, b: Block) => Record<string, string>, t: T): ExamDoc {
  const src = sourceOf(doc, blockId);
  return src ? setChrome(doc, src.kind, { ...src.config, data: fn({ ...src.config.data }, src.b) }, src.pageId, t) : doc;
}

// The header/footer of a page shown on every page ("all"), or only on this page ("page": the page gets
// its own copy, later changes stay on it).
export function chromeScope(doc: ExamDoc, blockId: string, to: "all" | "page", t: T): ExamDoc {
  const src = sourceOf(doc, blockId);
  if (!src) return doc;
  const page = src.b.layout.pageId;
  if (to === "page") return src.pageId ? doc : setChrome(doc, src.kind, src.config, page, t);
  if (!src.pageId) return doc;
  return setChrome(setChrome(doc, src.kind, src.config, undefined, t), src.kind, undefined, page, t);
}

// Deleting a header/footer on the page: a page's own goes (the page shows the document's again), the
// document's is turned off (on every page following it). Null for other blocks.
export function deleteChrome(doc: ExamDoc, blockId: string, t: T): ExamDoc | null {
  const src = sourceOf(doc, blockId);
  if (!src) return null;
  return src.pageId ? setChrome(doc, src.kind, undefined, src.pageId, t) : setChrome(doc, src.kind, { ...src.config, enabled: false }, undefined, t);
}
