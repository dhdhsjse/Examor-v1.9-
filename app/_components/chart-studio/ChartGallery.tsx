"use client";

import { ChartArea, ChartBar, ChartCandlestick, ChartColumn, ChartLine, ChartNoAxesColumn, ChartNoAxesCombined, ChartNoAxesGantt, ChartPie, ChartScatter, FolderOpen, Funnel, History, Radar, Trash2, X, type LucideIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FAMILIES, changeKind, defaultChart, familyDef, variantDef } from "@/app/_lib/chart/catalog";
import { renderChartSvg } from "@/app/_lib/chart/render";
import { dress, type ChartTemplate, type KindRef, type Look } from "@/app/_lib/chart/templates";
import type { ChartConfig, ChartFamily } from "@/app/_lib/chart/types";
import type { Lang } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { deleteTemplate, useChartTemplates, useRecentKinds } from "./chartMemory";

const ICONS: Record<ChartFamily, LucideIcon> = {
  column: ChartColumn,
  line: ChartLine,
  pie: ChartPie,
  bar: ChartBar,
  area: ChartArea,
  scatter: ChartScatter,
  radar: Radar,
  histogram: ChartNoAxesColumn,
  box: ChartCandlestick,
  waterfall: ChartNoAxesGantt,
  funnel: Funnel,
  combo: ChartNoAxesCombined,
};

interface Props {
  /** The chart whose kind is being changed (it is shown with its own data); null = a new chart (shown with the sample data) */
  current: ChartConfig | null;
  lang: Lang;
  onPick: (family: ChartFamily, variant: string) => void;
  /** A template was chosen: the chart takes its look */
  onPickTemplate: (look: Look) => void;
  onCancel: () => void;
}

type Mode = "kinds" | "recent" | "templates";

/** A chart as the thumbnails and the large picture draw it: with its own data or the sample, never blank */
function draw(base: ChartConfig, lang: Lang, size: { width: number; height: number }, mini: boolean) {
  const config: ChartConfig = { ...base, ...size, blank: false, ...(mini ? { title: { ...base.title, show: false }, legend: { ...base.legend, show: false } } : {}) };
  return renderChartSvg(config, { lang, mini }).svg;
}

const ofKind = (current: ChartConfig | null, family: ChartFamily, variant: string, lang: Lang) => (current ? changeKind(current, family, variant) : defaultChart(family, variant, lang));
const ofTemplate = (current: ChartConfig | null, tpl: ChartTemplate, lang: Lang) => dress(current ?? defaultChart(tpl.look.family, tpl.look.variant, lang), tpl.look);

const same = (k: KindRef, family: ChartFamily, variant: string) => k.family === family && k.variant === variant;

const THUMB = { width: 92, height: 66 };
const LARGE = { width: 520, height: 340 };

// Insert Chart: Recent and Templates, then the kinds on the left, the variants of the kind chosen above, and a large picture of the variant chosen (with
// the data of the chart when its kind is being changed, with an example when it is new), like the dialog of Excel.
export default function ChartGallery({ current, lang, onPick, onPickTemplate, onCancel }: Props) {
  const t = useT();
  const recent = useRecentKinds();
  const saved = useChartTemplates();
  const [mode, setMode] = useState<Mode>("kinds");
  const [family, setFamily] = useState<ChartFamily>(current?.family ?? "column");
  const [variant, setVariant] = useState<string>(current?.variant ?? "clustered");
  const [templateId, setTemplateId] = useState<string | null>(null);
  const def = familyDef(family);
  const chosen = variantDef(family, variant);
  const template = saved.find((x) => x.id === templateId) ?? saved[0] ?? null;

  const choose = (f: ChartFamily) => {
    setMode("kinds");
    setFamily(f);
    setVariant(f === current?.family ? current.variant : familyDef(f).variants[0].id);
  };
  const openRecent = () => {
    setMode("recent");
    if (recent.length && !recent.some((k) => same(k, family, chosen.id))) {
      setFamily(recent[0].family);
      setVariant(recent[0].variant);
    }
  };
  const nothing = (mode === "recent" && !recent.length) || (mode === "templates" && !template);
  const validate = useCallback(() => {
    if (mode === "templates") {
      if (template) onPickTemplate(template.look);
    } else if (!nothing) onPick(family, chosen.id);
  }, [mode, template, nothing, family, chosen.id, onPick, onPickTemplate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        validate();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [validate, onCancel]);

  // What the row of small pictures holds: the variants of a kind, the kinds picked lately, or the templates saved
  const thumbs = useMemo(() => {
    if (mode === "templates") return saved.map((x) => ({ id: x.id, title: x.name, caption: x.name, svg: draw(ofTemplate(current, x, lang), lang, THUMB, true), on: x.id === template?.id, pick: () => setTemplateId(x.id), go: () => onPickTemplate(x.look) }));
    const kinds = mode === "recent" ? recent : def.variants.map((v) => ({ family, variant: v.id }));
    return kinds.map((k) => {
      const label = t(variantDef(k.family, k.variant).label);
      const pick = () => {
        setFamily(k.family);
        setVariant(k.variant);
      };
      return { id: `${k.family}:${k.variant}`, title: label, caption: null, svg: draw(ofKind(current, k.family, k.variant, lang), lang, THUMB, true), on: same(k, family, chosen.id), pick, go: () => onPick(k.family, k.variant) };
    });
  }, [mode, saved, recent, def, current, family, chosen.id, template, lang, t, onPick, onPickTemplate]);
  const large = useMemo(
    () => (nothing ? "" : draw(mode === "templates" && template ? ofTemplate(current, template, lang) : ofKind(current, family, chosen.id, lang), lang, LARGE, false)),
    [nothing, mode, template, current, family, chosen.id, lang],
  );
  const heading = mode === "templates" ? (template?.name ?? "") : t(chosen.label);
  const navCls = (on: boolean) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm transition-colors ${on ? "bg-accent text-white" : "text-ink hover:bg-white"}`;

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div role="dialog" aria-modal="true" aria-labelledby="gallery-title" data-testid="chart-gallery" className="flex h-[min(680px,92vh)] w-[min(900px,96vw)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-line px-5 py-3">
          <h2 id="gallery-title" className="text-base font-semibold text-ink">
            {t("Insert Chart")}
          </h2>
          <button type="button" onClick={onCancel} aria-label={t("Cancel")} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink">
            <X size={17} />
          </button>
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex w-[210px] shrink-0 flex-col gap-1.5 overflow-y-auto border-line bg-subtle/50 p-2 ltr:border-r rtl:border-l">
            <nav data-testid="chart-collections" className="flex flex-col gap-0.5">
              <button type="button" aria-current={mode === "recent"} data-collection="recent" onClick={openRecent} className={navCls(mode === "recent")}>
                <History size={17} strokeWidth={1.7} />
                {t("Recent")}
              </button>
              <button type="button" aria-current={mode === "templates"} data-collection="templates" onClick={() => setMode("templates")} className={navCls(mode === "templates")}>
                <FolderOpen size={17} strokeWidth={1.7} />
                {t("Templates")}
              </button>
            </nav>
            <div className="mx-2 h-px bg-line" />
            <nav aria-label={t("Kinds of chart")} data-testid="chart-families" className="flex flex-col gap-0.5">
              {FAMILIES.map((f) => {
                const Icon = ICONS[f.id];
                return (
                  <button key={f.id} type="button" aria-current={mode === "kinds" && f.id === family} data-family={f.id} onClick={() => choose(f.id)} className={navCls(mode === "kinds" && f.id === family)}>
                    <Icon size={17} strokeWidth={1.7} />
                    {t(f.label)}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {nothing ? (
              <p data-testid="gallery-empty" className="max-w-sm rounded-lg bg-subtle px-4 py-3 text-sm leading-relaxed text-muted">
                {mode === "recent" ? t("No chart yet: the kinds you choose appear here.") : t("No template yet: set up a chart, then keep its look with Save as template (Chart part of the format panel).")}
              </p>
            ) : (
              <>
                <div role="group" aria-label={mode === "kinds" ? t("Variants") : mode === "recent" ? t("Recent") : t("Templates")} data-testid="chart-variants" className="flex flex-wrap gap-1.5">
                  {thumbs.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      title={x.title}
                      aria-label={x.title}
                      aria-pressed={x.on}
                      data-variant={x.id.split(":")[1]}
                      data-template={mode === "templates" ? x.id : undefined}
                      onClick={x.pick}
                      onDoubleClick={x.go}
                      className={`flex flex-col items-center overflow-hidden rounded-lg border-2 bg-white p-0.5 transition-colors ${x.on ? "border-accent" : "border-line hover:border-indigo-300"}`}
                    >
                      <span className="block [&>svg]:block" dangerouslySetInnerHTML={{ __html: x.svg }} />
                      {x.caption && <span className="mt-0.5 w-[92px] truncate px-1 text-center text-[11px] text-muted">{x.caption}</span>}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="min-w-0 truncate text-lg font-semibold text-ink" data-testid="chart-variant-name">
                    {heading}
                  </h3>
                  {mode === "templates" && template && (
                    <button type="button" onClick={() => deleteTemplate(template.id)} data-testid="delete-template" className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-muted hover:border-red-300 hover:text-red-600">
                      <Trash2 size={13} />
                      {t("Delete this template")}
                    </button>
                  )}
                </div>
                <div className="grid min-h-0 flex-1 place-items-start">
                  <div className="max-w-full rounded-lg border-4 border-slate-400/70 bg-white [&>svg]:block [&>svg]:h-auto [&>svg]:max-w-full" data-testid="chart-gallery-preview" dangerouslySetInnerHTML={{ __html: large }} />
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <button type="button" onClick={validate} disabled={nothing} data-testid="gallery-ok" className="rounded-lg bg-accent px-6 py-1.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-40">
            {t("OK")}
          </button>
          <button type="button" onClick={onCancel} data-testid="gallery-cancel" className="rounded-lg border border-line bg-white px-5 py-1.5 text-sm font-medium text-ink hover:border-accent">
            {t("Cancel")}
          </button>
        </footer>
      </div>
    </div>
  );
}
