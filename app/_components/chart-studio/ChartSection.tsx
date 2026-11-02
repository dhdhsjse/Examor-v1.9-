"use client";

import { useState } from "react";
import { FontSelect } from "@/app/_components/rich/FormatBar";
import { PALETTE_COLORS } from "@/app/_lib/chart/palette";
import { MAX_CHART_SIZE, MIN_CHART_SIZE, PALETTES, type ChartConfig, type PaletteId } from "@/app/_lib/chart/types";
import { DEFAULT_FONT } from "@/app/_lib/fonts";
import type { ExamMeta } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { Check, ColorField, Group, Num, Row, Seg, inputCls } from "./controls";
import { saveTemplate } from "./chartMemory";
import type { Edit } from "./useChartStudio";

export interface PanelProps {
  c: ChartConfig;
  edit: Edit;
  meta: ExamMeta;
}

const PALETTE_NAMES: Record<PaletteId, string> = {
  colorful: "Colorful",
  blue: "Blue",
  green: "Green",
  orange: "Orange",
  purple: "Purple",
  red: "Red",
  gray: "Gray (for black and white)",
  pastel: "Pastel",
};

// Keep the look of the chart under a name: Insert Chart → Templates offers it to start other charts from.
function TemplateGroup({ c }: { c: ChartConfig }) {
  const t = useT();
  const [name, setName] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const save = () => {
    if (!name.trim()) return;
    saveTemplate(name, c);
    setDone(name.trim());
    setName("");
  };
  return (
    <Group title={t("Template")}>
      <p className="text-[11px] leading-snug text-faint">{t("Keeps the look of this chart (kind, colors, font, grid, legend, labels, size) so that other charts can start from it: Change the kind of chart → Templates. Not its table, its texts or its scales.")}</p>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setDone(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder={t("Name of the template")}
          aria-label={t("Name of the template")}
          data-testid="template-name"
          className={inputCls}
        />
        <button type="button" onClick={save} disabled={!name.trim()} data-testid="save-template" className="shrink-0 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium text-ink enabled:hover:border-accent disabled:opacity-40">
          {t("Save as template")}
        </button>
      </div>
      {done && (
        <p role="status" data-testid="template-saved" className="text-xs text-emerald-700">
          {t("Template saved")}: {done}
        </p>
      )}
    </Group>
  );
}

// What is true of the chart as a whole: its title, its size on the page, its colors and font, and whether it is blank for the students.
export default function ChartSection({ c, edit, meta }: PanelProps) {
  const t = useT();
  const set = (patch: Partial<ChartConfig>, key: string) => edit((x) => ({ ...x, ...patch }), key);
  const title = (patch: Partial<ChartConfig["title"]>, key: string) => edit((x) => ({ ...x, title: { ...x.title, ...patch } }), `title:${key}`);

  return (
    <>
      <Group title={t("Title")}>
        <Check checked={c.title.show} onChange={(show) => title({ show }, "show")} label={t("Show the title")} testId="title-show" />
        <input value={c.title.text} onChange={(e) => title({ text: e.target.value }, "text")} data-testid="chart-title" aria-label={t("Title")} placeholder={t("Chart title")} className={inputCls} />
        <Row label={t("Position")}>
          <Seg value={c.title.position} onChange={(position) => title({ position }, "position")} options={[{ value: "top", label: t("Top") }, { value: "bottom", label: t("Bottom") }]} testId="title-position" />
        </Row>
        <Row label={t("Alignment")}>
          <Seg value={c.title.align} onChange={(align) => title({ align }, "align")} options={[{ value: "center", label: t("Center") }, { value: "start", label: t("Start") }]} testId="title-align" />
        </Row>
        <Row label={t("Size")}>
          <Num value={c.title.size} min={8} max={48} onCommit={(size) => size && title({ size }, "size")} className="w-20" testId="title-size" />
        </Row>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Check checked={c.title.bold} onChange={(bold) => title({ bold }, "bold")} label={t("Bold text")} />
          <Check checked={c.title.italic} onChange={(italic) => title({ italic }, "italic")} label={t("Italic")} />
          <ColorField value={c.title.color} onChange={(color) => color && title({ color }, "color")} label={t("Text color")} />
        </div>
      </Group>

      <Group title={t("Size on the page")}>
        <div className="grid grid-cols-2 gap-2.5">
          <Num label={t("Width (px)")} value={c.width} min={MIN_CHART_SIZE} max={MAX_CHART_SIZE} onCommit={(width) => width && set({ width }, "width")} testId="chart-width" />
          <Num label={t("Height (px)")} value={c.height} min={MIN_CHART_SIZE} max={MAX_CHART_SIZE} onCommit={(height) => height && set({ height }, "height")} testId="chart-height" />
        </div>
      </Group>

      <Group title={t("Colors")}>
        <div role="group" aria-label={t("Colors")} data-testid="palettes" className="grid grid-cols-2 gap-1.5">
          {PALETTES.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={c.palette === p}
              data-palette={p}
              title={t(PALETTE_NAMES[p])}
              onClick={() => set({ palette: p }, "palette")}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-start text-xs transition-colors ${c.palette === p ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-white text-ink hover:border-accent"}`}
            >
              <span className="flex shrink-0">
                {PALETTE_COLORS[p].slice(0, 4).map((col) => (
                  <span key={col} className="-ms-1 size-3.5 rounded-full border border-white first:ms-0" style={{ background: col }} />
                ))}
              </span>
              <span className="min-w-0 truncate">{t(PALETTE_NAMES[p])}</span>
            </button>
          ))}
        </div>
        <Check checked={c.patterns} onChange={(patterns) => set({ patterns }, "patterns")} label={t("Hatchings instead of colors")} hint={t("Each series has its own hatching: what prints well in black and white.")} testId="patterns" />
      </Group>

      <Group title={t("Chart area")}>
        <Row label={t("Background")}>
          <Check checked={c.background !== null} onChange={(on) => set({ background: on ? "#ffffff" : null }, "background")} label="" testId="background-on" />
          <ColorField value={c.background} onChange={(background) => background && set({ background }, "background")} label={t("Background")} />
        </Row>
        <Check checked={c.border} onChange={(border) => set({ border }, "border")} label={t("Border round the chart")} testId="border" />
        <Row label={t("Font")}>
          <FontSelect value={c.fontFamily} onChange={(fontFamily) => set({ fontFamily }, "font")} defaultLabel={`${t("Exam font")} (${meta.fontFamily ?? DEFAULT_FONT})`} className={`${inputCls} !w-[170px] !py-1.5`} />
        </Row>
        <Row label={t("Text size")}>
          <Num value={c.fontSize} min={7} max={32} onCommit={(fontSize) => fontSize && set({ fontSize }, "fontSize")} className="w-20" testId="font-size" />
        </Row>
        <Row label={t("Decimal mark")}>
          <Seg value={c.decimalMark} onChange={(decimalMark) => set({ decimalMark }, "mark")} options={[{ value: ",", label: t("Comma") }, { value: ".", label: t("Point") }]} testId="decimal-mark" />
        </Row>
      </Group>

      <Group title={t("Students")}>
        <Check checked={c.blank} onChange={(blank) => set({ blank }, "blank")} label={t("Blank for the students")} hint={t("The exam copy shows the frame, the scale and the names, without the data; the correction sheet shows the whole chart.")} testId="blank" />
      </Group>

      <TemplateGroup c={c} />
    </>
  );
}
