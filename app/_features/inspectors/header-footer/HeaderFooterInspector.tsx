"use client";

import { useState } from "react";
import { BookmarkIcon, TrashIcon } from "@/app/_components/icons";
import { HeaderSketch } from "@/app/_components/HeaderSketch";
import { COLORED } from "@/app/_components/inspector/ContentEditors";
import { ChoiceGrid, NumberInput, SmallButton } from "@/app/_components/inspector/fields";
import { ColorGrid, FontSelect } from "@/app/_components/rich/FormatBar";
import type { Ctx } from "@/app/_features/core/types";
import { defaultHeaderFields } from "@/app/_lib/blocks";
import { DEFAULT_FONT } from "@/app/_lib/fonts";
import { pageMargins } from "@/app/_lib/onboarding/applyOnboarding";
import { footerTemplates, headerTemplates } from "@/app/_lib/onboarding/headerFooterLibrary";
import type { HeaderFooterTemplate } from "@/app/_lib/onboardingTypes";
import { isRich, parseRich, plainText, serializeRich } from "@/app/_lib/richText";
import { buildChrome, chromeConfig, chromeTemplate, globalChrome, type ChromeKind } from "@/app/_lib/pageChrome";
import { pageSize } from "@/app/_lib/pageFormats";
import type { ExamDoc, HeaderBlock, HeaderFooterConfig } from "@/app/_lib/types";

type Scope = "global" | "page";

const OFF: HeaderFooterConfig = { enabled: false, templateId: "", data: {} };
const segment = (on: boolean) =>
  `flex-1 rounded-md px-2 py-1.5 text-xs transition-colors ${on ? "bg-white font-semibold text-ink shadow-sm" : "text-muted hover:text-ink"}`;
const inputCls = "rounded-md border border-line bg-white px-2 py-1.5 text-sm text-ink outline-none focus:ring-1 focus:ring-indigo-500";

// Page layout → Header and footer, in the right panel: the one place for the exam header and the
// footer (an exam header selected on the page opens it too). "Whole document" edits what every page
// shows unless it has its own; "This page" gives a page its own (a copy of what it showed, then changed).
// Every change rebuilds the header/footer blocks of the pages it touches, so the canvas and the PDF
// show it at once (pageChrome.ts). Typing in a field is one undo step.
export default function HeaderFooterInspector({ ctx }: { ctx: Ctx }) {
  const { t, doc, shell } = ctx;
  // A header / footer selected on the page: its page is the one "This page" edits.
  const picked = shell.selected?.type === "header" || shell.selected?.meta?.role ? shell.selected : undefined;
  const selected = picked?.type === "header" ? picked : undefined;
  const pageId = picked?.layout.pageId ?? ctx.activePageId;
  const index = Math.max(0, doc.pages.findIndex((p) => p.id === pageId));
  const page = doc.pages[index];
  const loose = !!selected && selected.meta?.role !== "header"; // a header block that is not its page's header
  const pickedKind = picked?.meta?.role === "footer" ? "footer" : "header";
  const [scope, setScope] = useState<Scope>(() => (picked && (loose || page?.[pickedKind] !== undefined) ? "page" : "global"));
  const own = !!page && (page.header !== undefined || page.footer !== undefined);
  const ownCount = doc.pages.filter((p) => p.header !== undefined || p.footer !== undefined).length;

  return (
    <div className="flex flex-col">
      <p className="mb-1.5 text-xs text-muted">{t("Repeated at the top and bottom of the pages.")}</p>
      <p className="mb-3 text-[11px] leading-snug text-faint">{t("Click a text of the header or footer on the page to type there.")}</p>

      <div role="radiogroup" aria-label={t("Apply to")} className="mb-3 flex gap-1 rounded-lg bg-subtle p-1">
        {(["global", "page"] as const).map((s) => (
          <button key={s} type="button" role="radio" aria-checked={scope === s} onClick={() => setScope(s)} className={segment(scope === s)}>
            {s === "global" ? t("Whole document") : t("This page ({n})", { n: index + 1 })}
          </button>
        ))}
      </div>

      {selected && <SelectedHeader ctx={ctx} block={selected} loose={loose} index={index} />}

      {scope === "page" && own && page && !loose && (
        <div className="mb-3 flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
          {t("This page has its own settings.")}
          <button
            type="button"
            onClick={() => shell.resetPageChrome(page.id)}
            className="self-start rounded-md border border-amber-300 bg-white px-2 py-1 font-medium text-amber-900 hover:bg-amber-100"
          >
            {t("Reset to the document's settings")}
          </button>
        </div>
      )}
      {scope === "global" && ownCount > 0 && (
        <p className="mb-3 text-[11px] leading-snug text-faint">{t("{n} page(s) have their own settings and don't follow these.", { n: ownCount })}</p>
      )}

      <ChromeSection ctx={ctx} kind="header" scope={scope} index={index} />
      <hr className="my-4 border-line" />
      <ChromeSection ctx={ctx} kind="footer" scope={scope} index={index} />
    </div>
  );
}

// The exam header clicked on the page: keep it in "My blocks", take it off the page. A header block that
// is not its page's header (an extra copy) can become it.
function SelectedHeader({ ctx, block, loose, index }: { ctx: Ctx; block: HeaderBlock; loose: boolean; index: number }) {
  const { t, shell, doc } = ctx;
  const remove = () => {
    if (loose) return shell.deleteBlock(block.id);
    const c = chromeConfig(doc, index, "header");
    if (c) shell.setChrome("header", { ...c, enabled: false }, block.layout.pageId);
  };
  return (
    <div className="mb-3 flex flex-col gap-2 rounded-lg border border-indigo-200 bg-indigo-50/60 p-2.5 text-xs text-indigo-900">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">{t("Exam header of page {n}", { n: index + 1 })}</span>
        <span className="flex gap-1">
          <SmallButton title={t("Save to my library (reuse it in other exams)")} onClick={() => shell.saveToLibrary(block)}>
            <BookmarkIcon />
          </SmallButton>
          <SmallButton danger title={t(loose ? "Delete" : "Remove from this page")} onClick={remove}>
            <TrashIcon />
          </SmallButton>
        </span>
      </div>
      {loose && (
        <>
          <span>{t("This exam header isn't the page's header: its settings below are the page's.")}</span>
          <button
            type="button"
            onClick={() => shell.adoptHeader(block.id)}
            className="self-start rounded-md border border-indigo-300 bg-white px-2 py-1 font-medium text-indigo-800 hover:bg-indigo-100"
          >
            {t("Use it as this page's header")}
          </button>
        </>
      )}
    </div>
  );
}

// One of the two: on/off, template, color, its texts, the full mark (exam headers) and a preview (footers).
function ChromeSection({ ctx, kind, scope, index }: { ctx: Ctx; kind: ChromeKind; scope: Scope; index: number }) {
  const { t, doc, shell } = ctx;
  const page = doc.pages[index];
  const global = scope === "global";
  const current = (global ? globalChrome(doc, kind) : chromeConfig(doc, index, kind)) ?? OFF;
  const template = chromeTemplate(kind, current.templateId);
  const templates = kind === "header" ? headerTemplates : footerTemplates;

  const save = (c: HeaderFooterConfig, key?: string) => shell.setChrome(kind, c, global ? undefined : page?.id, key && `chrome-${kind}-${global ? "all" : page?.id}-${key}`);
  const change = (patch: Partial<HeaderFooterConfig>, key?: string) => save({ ...current, templateId: template.id, ...patch }, key);
  const setData = (key: string, value: string | undefined) => {
    const data = { ...current.data };
    if (value === undefined) delete data[key];
    else data[key] = value;
    change({ data }, key);
  };
  const defaults = defaultTexts(doc, index, kind, template.id, ctx.t);
  const texts = template.fields?.filter((f) => f.key !== "outOf") ?? [];
  const graded = template.fields?.some((f) => f.key === "outOf");
  const colored = !!template.sketch && COLORED.includes(template.sketch);
  const id = (key: string) => `chrome-${kind}-${key}`;

  return (
    <section className="flex flex-col gap-2.5">
      <label className="flex items-center gap-2 text-sm font-semibold text-ink">
        <input type="checkbox" checked={current.enabled} onChange={(e) => change({ enabled: e.target.checked })} className="size-4 accent-indigo-600" />
        {t(kind === "header" ? "Show a header" : "Show a footer")}
      </label>

      <div className={`flex flex-col gap-2.5 transition-opacity ${current.enabled ? "" : "pointer-events-none opacity-45"}`} aria-disabled={!current.enabled}>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-semibold text-muted">{t(kind === "header" ? "Header style" : "Template")}</span>
          <ChoiceGrid<string>
            cols={2}
            value={template.id}
            // Another template keeps the texts it shares with this one (same field keys).
            onChange={(templateId) => change({ templateId })}
            options={templates.map((tp) => ({ value: tp.id, label: t(tp.nameKey), preview: <TemplatePreview t={t} template={tp} accent={current.data.accent} /> }))}
          />
        </div>

        {colored && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted">{t("Color")}</span>
            <ColorGrid value={current.data.accent || undefined} autoLabel={t("Style's own")} onChange={(accent) => setData("accent", accent)} />
          </div>
        )}

        {template.sketch && (
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-muted">{t("Text style")}</span>
            <FontSelect
              value={current.data.fontFamily || undefined}
              onChange={(family) => setData("fontFamily", family)}
              defaultLabel={`${t("Exam font")} (${doc.meta.fontFamily ?? DEFAULT_FONT})`}
              className={inputCls}
            />
          </div>
        )}

        {kind === "footer" && <Preview ctx={ctx} kind={kind} index={index} config={{ ...current, enabled: true, templateId: template.id }} />}

        {texts.map((f) => {
          const value = current.data[f.key];
          // Words styled differently on the page: typed there only (a plain field would lose the styles).
          const mixed = !!value && parseRich(value).length > 1;
          return (
            <label key={f.key} htmlFor={id(f.key)} className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-muted">{t(f.label)}</span>
              <input
                id={id(f.key)}
                dir="auto"
                autoComplete="off"
                disabled={!current.enabled || mixed}
                title={mixed ? t("Some words are styled on the page: change this text there.") : undefined}
                value={value !== undefined ? plainText(value) : (defaults[f.key] ?? "")}
                placeholder={defaults[f.key]}
                onChange={(e) => setData(f.key, restyled(value, e.target.value))}
                className={`${inputCls} disabled:bg-subtle`}
              />
            </label>
          );
        })}

        {graded && <GradedOutOf ctx={ctx} data={current.data} fallback={Number(defaults.outOf) || 20} onData={setData} />}
        {!template.fields?.length && <p className="text-[11px] leading-snug text-faint">{t("Filled in automatically on every page.")}</p>}
      </div>
    </section>
  );
}

// The full mark of an exam header: a number, or the total of the questions (as in the header's properties).
function GradedOutOf({ ctx, data, fallback, onData }: { ctx: Ctx; data: Record<string, string>; fallback: number; onData: (key: string, value: string | undefined) => void }) {
  const t = ctx.t;
  const total = ctx.shell.stats.points;
  const auto = data.autoOutOf === "1";
  const outOf = Number(data.outOf) >= 1 ? Math.round(Number(data.outOf)) : fallback;
  const mismatch = !auto && total > 0 && total !== outOf;
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line bg-subtle/60 p-2.5">
      <span className="text-[11px] font-semibold text-muted">{t("Graded out of")}</span>
      <label className="flex items-center gap-2 text-xs text-ink">
        <input type="checkbox" checked={auto} onChange={(e) => onData("autoOutOf", e.target.checked ? "1" : undefined)} className="accent-indigo-600" />
        {t("Use the total of the questions ({n} pts)", { n: total })}
      </label>
      {auto ? (
        <p className="text-[10px] leading-snug text-faint">
          {total > 0 ? t("The score follows the points of the questions.") : t("No points yet: /{n} is shown until you add questions.", { n: outOf })}
        </p>
      ) : (
        <NumberInput value={outOf} min={1} max={100} onChange={(v) => onData("outOf", String(v))} />
      )}
      {mismatch && (
        <p className="rounded-md bg-amber-50 px-2 py-1.5 text-[11px] leading-snug text-amber-800 ring-1 ring-amber-200">
          {t("The questions add up to {total} pts, not {outOf}.", { total, outOf })}
        </p>
      )}
    </div>
  );
}

// A small picture of a template: the exam header style, or its text.
function TemplatePreview({ t, template, accent }: { t: Ctx["t"]; template: HeaderFooterTemplate; accent?: string }) {
  return template.sketch ? (
    <HeaderSketch style={template.sketch} accent={accent || undefined} />
  ) : (
    <span className="truncate px-1 text-[9px] text-slate-500" dir="auto">
      {t(template.sample ?? template.nameKey)}
    </span>
  );
}

// A field typed in the panel keeps the look set for the whole text on the page (one style for all of it).
function restyled(old: string | undefined, typed: string): string {
  if (!old || !isRich(old)) return typed;
  const [run] = parseRich(old);
  return serializeRich([{ text: typed, style: run?.style ?? {} }]);
}

// The texts a template shows when nothing is typed: its exam header's texts, and its text lines.
function defaultTexts(doc: ExamDoc, index: number, kind: ChromeKind, templateId: string, t: Ctx["t"]): Record<string, string> {
  const built = buildChrome(doc, index, kind, t, { enabled: true, templateId, data: {} });
  const header = built.find((b) => b.type === "header");
  const fields = header?.type === "header" ? header.fields : defaultHeaderFields(doc.meta.lang);
  const out: Record<string, string> = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, String(v)]));
  for (const b of built) if (b.type === "text") out[b.meta?.field ?? "text"] = plainText(b.text);
  return out;
}

// What the page will show: the exam header's look, and the text lines as they read.
function Preview({ ctx, kind, index, config }: { ctx: Ctx; kind: ChromeKind; index: number; config: HeaderFooterConfig }) {
  const blocks = buildChrome(ctx.doc, index, kind, ctx.t, config);
  const rtl = ctx.doc.meta.lang === "ar";
  const m = pageMargins(ctx.doc, index);
  const full = pageSize(ctx.doc.pages[index]).width - m.left - m.right; // narrower lines are centered
  return (
    <div
      aria-label={ctx.t("Preview")}
      dir={rtl ? "rtl" : "ltr"}
      className="flex min-h-12 flex-col justify-center gap-1 rounded-md bg-white px-3 py-2 shadow-sm ring-1 ring-black/10"
    >
      {blocks.map((b) =>
        b.type === "header" ? (
          <span key={b.id} className="flex h-9 items-center justify-center">
            <HeaderSketch style={b.style} accent={b.accent} />
          </span>
        ) : b.type === "text" ? (
          <span
            key={b.id}
            className={`truncate text-slate-700 ${b.style === "title" ? "text-sm font-bold" : b.style === "heading" ? "text-xs font-semibold" : "text-[11px]"} ${
              b.layout.width < full - 1 ? "text-center" : ""
            }`}
          >
            {b.text}
          </span>
        ) : null,
      )}
    </div>
  );
}
