"use client";

import { ChartColumn, Redo2, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StudioKeyboard, StudioKeyboardButton } from "@/app/_components/math-keyboard/StudioKeyboard";
import DiscardDialog from "@/app/_components/molecule-studio/DiscardDialog";
import { changeKind, defaultChart, familyDef, normalizeChart, variantDef } from "@/app/_lib/chart/catalog";
import { readModel, WORDS_AR, WORDS_FR } from "@/app/_lib/chart/data";
import { dress, type Look } from "@/app/_lib/chart/templates";
import type { ChartConfig, ChartFamily } from "@/app/_lib/chart/types";
import type { ExamMeta } from "@/app/_lib/types";
import { useUi } from "@/app/_lib/uiLang";
import { rememberKind } from "./chartMemory";
import ChartGallery from "./ChartGallery";
import ChartPreview, { type PickedPart } from "./ChartPreview";
import DataPanel from "./DataPanel";
import FormatPanel from "./FormatPanel";
import { useChartStudio } from "./useChartStudio";

interface Props {
  meta: ExamMeta;
  /** The chart of the image block being edited (null = a new chart) */
  editing: ChartConfig | null;
  /** Put the chart on the page (a new image block) */
  onInsert: (config: ChartConfig) => void;
  /** Put the chart back in the block it came from */
  onUpdate: (config: ChartConfig) => void;
  onClose: () => void;
}

// The Chart Studio: Insert Chart like Excel's. A new chart starts with the dialog of the kinds (columns, bars, lines, pies, areas, scatters, radars,
// histograms, boxes, waterfalls, funnels, combinations, each with its variants); then the chart in the middle as the page will draw it, its table
// under it (a spreadsheet), and on the right what can be changed (title, axes, series, labels, legend, what belongs to the kind). What is inserted
// is a picture that carries its table and settings, which this Studio opens again (a double-click on the chart, or the button of its Properties
// panel). A chart can be blank for the students: the correction sheet shows it whole.
export default function ChartStudio({ meta, editing, onInsert, onUpdate, onClose }: Props) {
  const { t, rtl } = useUi();
  const lang = meta.lang;
  const [initial] = useState<ChartConfig>(() => (editing ? normalizeChart(editing, lang) : { ...defaultChart("column", "clustered", lang), fontFamily: meta.fontFamily }));
  const studio = useChartStudio(initial);
  const { config, edit, undo, redo, canUndo, canRedo, dirty } = studio;
  const [gallery, setGallery] = useState(!editing); // (a new chart starts with the choice of its kind)
  const [selected, setSelected] = useState(0);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set(["chart"]));
  const [confirmClose, setConfirmClose] = useState(false);
  const model = useMemo(() => readModel(config, lang === "ar" ? WORDS_AR : WORDS_FR), [config, lang]);
  const family = familyDef(config.family);
  const fresh = !editing && config === initial; // (a new chart nothing has been done to: the dialog of the kinds is all there is yet)

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const show = (id: string) => setOpen((cur) => new Set(cur).add(id));

  // The kind chosen in the dialog: a new chart is made from the sample of the kind, a chart that exists changes kind and keeps its table.
  const pickKind = (f: ChartFamily, variant: string) => {
    if (fresh) edit(() => ({ ...defaultChart(f, variant, lang), fontFamily: meta.fontFamily }), "kind");
    else edit((c) => changeKind(c, f, variant), "kind");
    rememberKind({ family: f, variant });
    setSelected(0);
    setGallery(false);
  };
  // A template chosen in the dialog: a new chart is made from the sample of its kind, a chart that exists keeps its table, its words and its scales.
  const pickTemplate = (look: Look) => {
    if (fresh) edit(() => ({ ...dress(defaultChart(look.family, look.variant, lang), look), fontFamily: look.fontFamily ?? meta.fontFamily }), "kind");
    else edit((c) => dress(c, look), "kind");
    setSelected(0);
    setGallery(false);
  };
  const pickPart = (p: PickedPart) => {
    if ("series" in p) {
      setSelected(p.series);
      show("series");
    } else show(p.part === "title" ? "chart" : "axes");
  };

  // Esc closes (asking first if there are changes), unless a field is being typed in; Ctrl+Z undoes and Ctrl+Y redoes when the focus is not in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (gallery || confirmClose || e.defaultPrevented) return;
      const el = e.target as HTMLElement;
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      const key = e.key.toLowerCase();
      if (e.key === "Escape") {
        if (!typing) requestClose();
      } else if ((e.ctrlKey || e.metaKey) && !typing && (key === "z" || key === "y")) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) redo();
        else undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gallery, confirmClose, dirty, undo, redo, onClose]);

  const iconButton = "grid size-8 place-items-center rounded-lg text-muted enabled:hover:bg-subtle enabled:hover:text-ink disabled:opacity-40";

  return (
    <div data-testid="chart-studio" dir={rtl ? "rtl" : "ltr"} className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <h2 className="shrink-0 text-base font-semibold text-ink">{t("Chart Studio")}</h2>
        <span data-testid="chart-kind" className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-strong">
          {t(variantDef(config.family, config.variant).label)}
        </span>
        <div className="mx-2 h-5 w-px bg-line" />
        <button onClick={undo} disabled={!canUndo} title={`${t("Undo")} (Ctrl+Z)`} aria-label={t("Undo")} data-testid="undo" className={iconButton}>
          <Undo2 size={16} />
        </button>
        <button onClick={redo} disabled={!canRedo} title={`${t("Redo")} (Ctrl+Y)`} aria-label={t("Redo")} data-testid="redo" className={iconButton}>
          <Redo2 size={16} />
        </button>
        <StudioKeyboardButton />
        <button type="button" onClick={() => setGallery(true)} data-testid="change-kind" title={t("Change the kind of chart")} className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium text-ink hover:border-accent">
          <ChartColumn size={14} />
          {t("Change the kind of chart")}
        </button>
        <p className="hidden min-w-0 flex-1 truncate text-xs text-muted xl:block">{t("Click a part of the chart to change it · the table under the chart is the data")}</p>
        <button onClick={() => (editing ? onUpdate(config) : onInsert(config))} data-testid="insert" className="ms-auto shrink-0 rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong">
          {editing ? t("Update") : t("Insert")}
        </button>
        <button onClick={requestClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-subtle hover:text-ink" title={t("Close (Esc)")} aria-label={t("Close (Esc)")}>
          <X size={18} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <ChartPreview config={config} lang={lang} onPick={pickPart} />
          <div className="flex h-[300px] shrink-0 flex-col">
            <DataPanel c={config} edit={edit} meta={meta} undo={undo} redo={redo} />
          </div>
        </main>

        <aside className="flex w-[360px] shrink-0 flex-col overflow-y-auto border-line bg-white ltr:border-l rtl:border-r">
          <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
            {t(family.label)} · {t("Format")}
          </h3>
          <FormatPanel c={config} edit={edit} meta={meta} model={model} selected={selected} onSelect={setSelected} open={open} onToggle={toggle} />
        </aside>
      </div>

      <StudioKeyboard />
      {gallery && (
        <ChartGallery
          current={fresh ? null : config}
          lang={lang}
          onPick={pickKind}
          onPickTemplate={pickTemplate}
          onCancel={() => {
            if (fresh) onClose(); // (nothing was made: the dialog was the whole of it)
            else setGallery(false);
          }}
        />
      )}
      {confirmClose && <DiscardDialog onKeep={() => setConfirmClose(false)} onDiscard={onClose} />}
    </div>
  );
}
