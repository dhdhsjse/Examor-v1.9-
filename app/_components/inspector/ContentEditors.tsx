"use client";

import { ChartColumn, PencilLine } from "lucide-react";
import type { ReactNode } from "react";
import { DEFAULT_ACCENT } from "@/app/_lib/blockLayout";
import { readChart } from "@/app/_lib/chart/types";
import { docFromRich } from "@/app/_lib/textboxDoc";
import { plainText } from "@/app/_lib/richText";
import type { ExamMeta, HeaderBlock, HeaderFields, HeaderStyle, HeadingDecor, ImageBlock, Lang, TextBlock, TextboxBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { HEADER_DESIGNS, isDesignStyle } from "@/app/_lib/headerDesigns";
import { HeaderPicker, type HeaderPickItem } from "../HeaderPicker";
import { HEADER_STYLE_OPTIONS, HeaderSketch } from "../HeaderSketch";
import { HeaderThumb, demoHeader } from "../HeaderThumb";
import { ColorGrid } from "../rich/FormatBar";
import { CaptionControls } from "./CaptionControls";
import { FigureEditor } from "./FigureEditor";
import { ChoiceGrid, Field, Group, NumberInput, RichInput, Row, Segmented, SmallButton, TextInput, Toggle } from "./fields";
import type { OnChange } from "./QuestionEditors";

// A text box: its text, and where it sits in the box. Font, size and alignment: Home → Formatting.
export function TextboxEditor({ b, onChange }: { b: TextboxBlock; onChange: OnChange }) {
  const t = useT();
  return (
    <>
      <Field label={t("Text")}>
        <RichInput value={b.text} onChange={(text) => onChange({ text, content: docFromRich(text) }, "text")} rows={5} multiline />
      </Field>
      <Field group label={t("In the box")}>
        <Segmented
          value={b.valign ?? "top"}
          onChange={(valign) => onChange({ valign }, "valign")}
          options={[
            { value: "top", label: t("Top") },
            { value: "middle", label: t("Middle") },
            { value: "bottom", label: t("Bottom") },
          ]}
        />
      </Field>
    </>
  );
}

export function TextEditor({ b, onChange }: { b: TextBlock; onChange: OnChange }) {
  const t = useT();
  return (
    <>
      <Field group label={t("Style")}>
        <Segmented
          value={b.style}
          onChange={(style) => onChange({ style }, "style")}
          options={[
            { value: "title", label: t("Title") },
            { value: "heading", label: t("Heading") },
            { value: "body", label: t("Paragraph") },
          ]}
        />
      </Field>
      <Field label={t("Text")}>
        <RichInput value={b.text} onChange={(text) => onChange({ text }, "text")} rows={b.style === "body" ? 5 : 2} multiline={b.style === "body"} />
      </Field>
      {b.style !== "body" && (
        <Group>
          <Field group label={t("Look")}>
            <ChoiceGrid value={b.decor ?? "plain"} onChange={(decor) => onChange({ decor }, "decor")} options={decorOptions(t, b.accent ?? DEFAULT_ACCENT)} />
          </Field>
          {(b.decor ?? "plain") !== "plain" && (
            <Field group label={t("Accent color")}>
              <ColorGrid value={b.accent ?? DEFAULT_ACCENT} onChange={(accent) => onChange({ accent }, "accent")} />
            </Field>
          )}
        </Group>
      )}
    </>
  );
}

export function ImageEditor({ b, lang, meta, onChange, onReplace, onOpenChartStudio, onOpenImageStudio }: { b: ImageBlock; lang: Lang; meta?: ExamMeta; onChange: OnChange; onReplace: () => void; onOpenChartStudio: () => void; onOpenImageStudio: () => void }) {
  const t = useT();
  const hasCaption = !!b.caption && !!plainText(b.caption).trim();
  return (
    <>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
        <img src={b.src} alt="" data-paper="" className="max-h-36 w-full rounded-[5px] border border-line bg-subtle object-contain" />
        <button
          type="button"
          onClick={onOpenImageStudio}
          title={t("Edit the image: draw on it, crop it")}
          aria-label={t("Edit the image: draw on it, crop it")}
          data-testid="edit-image"
          className="ui-icon absolute top-1.5 grid size-7 place-items-center rounded-[5px] border border-line bg-surface/90 text-ink shadow-sm backdrop-blur-sm transition-colors hover:border-accent hover:text-accent ltr:right-1.5 rtl:left-1.5"
        >
          <PencilLine size={14} aria-hidden />
        </button>
      </div>
      <div className="flex gap-1.5">
        {readChart(b.chartStudio) && (
          <SmallButton onClick={onOpenChartStudio} className="flex-1">
            <ChartColumn size={13} aria-hidden />
            <span className="truncate">{t("Edit the chart")}</span>
          </SmallButton>
        )}
        {/* A figure is redrawn from its settings, a molecule or a drawing from its data: replacing it with a picture drops them. */}
        <SmallButton onClick={onReplace} className="flex-1">
          <span className="truncate">{t(b.figure || b.molecule || b.drawing || b.graphStudio || b.circuitStudio || b.chartStudio || b.probaStudio ? "Replace with an image…" : "Replace image…")}</span>
        </SmallButton>
      </div>
      {b.figure && <FigureEditor b={b} figure={b.figure} lang={lang} onChange={onChange} />}
      <Group title={t("Caption")}>
        <RichInput value={b.caption ?? ""} onChange={(caption) => onChange({ caption }, "caption")} rows={2} multiline placeholder={t("e.g. Figure 1: a plant cell seen under a microscope")} />
        {hasCaption && <CaptionControls b={b} meta={meta} onChange={onChange} />}
      </Group>
    </>
  );
}

// Header styles drawn in their own color (the teacher can change it).
export const COLORED: HeaderStyle[] = ["modern", "banner", "elegant", "split", "cards", "playful", "evaluation", "official", "compact",
  "accentbar", "bookmark", "gradient", "geometric", "chips", "editorial", "framed", "infogrid", "duotone", "monogram", "ticket", "floating"];
// (every design of the header library follows a color)
export const isColoredHeader = (style: HeaderStyle) => isDesignStyle(style) || COLORED.includes(style);

export function HeaderEditor({ b, meta, totalPoints, onChange }: { b: HeaderBlock; meta?: ExamMeta; totalPoints: number; onChange: OnChange }) {
  const t = useT();
  const paper: ExamMeta = meta ?? { title: "", lang: "fr", templateId: "" };
  const styleItems: HeaderPickItem[] = [
    ...HEADER_DESIGNS.map((d) => ({ value: d.id, label: t(d.name), category: d.category, preview: <HeaderThumb block={{ ...demoHeader(d.id as HeaderStyle, paper.lang), fields: b.fields, accent: b.accent }} meta={paper} /> })),
    ...HEADER_STYLE_OPTIONS.map((o) => ({ value: o.value, label: t(o.label), category: "earlier", preview: <HeaderSketch style={o.value} accent={b.accent} /> })),
  ];
  const set = (key: keyof HeaderFields, value: string | number | boolean) => onChange({ fields: { ...b.fields, [key]: value } }, `field-${key}`);
  const text = (key: Exclude<keyof HeaderFields, "outOf" | "autoOutOf">, label: string) => (
    <Field label={label}>
      <TextInput value={b.fields[key] ?? ""} onChange={(v) => set(key, v)} />
    </Field>
  );
  const auto = !!b.fields.autoOutOf;
  const mismatch = !auto && totalPoints > 0 && totalPoints !== b.fields.outOf;

  return (
    <>
      <Field group label={t("Header style")}>
        <HeaderPicker items={styleItems} value={b.style} onChange={(style) => onChange({ style: style as HeaderStyle }, "style")} t={t} />
      </Field>
      {isColoredHeader(b.style) && (
        <Field group label={t("Color")}>
          <ColorGrid value={b.accent} autoLabel={t("Style's own")} onChange={(accent) => onChange({ accent }, "accent")} />
        </Field>
      )}

      {/* The texts: the long ones on their own line, the short ones two by two */}
      <Group>
        {b.style === "official" && text("authority", t("Ministry / authority line"))}
        {text("title", t("Exam title"))}
        {text("school", t("School"))}
        <div className="grid grid-cols-2 gap-x-2 gap-y-2">
          {text("subject", t("Subject"))}
          {text("level", t("Level / class"))}
          {text("duration", t("Duration"))}
          {text("year", t("School year"))}
        </div>
      </Group>

      <Group>
        <Row label={t("Graded out of")} hint={auto && totalPoints === 0 ? t("No points yet: /{n} is shown until you add questions.", { n: b.fields.outOf }) : undefined}>
          {auto ? (
            <span className="pe-1 text-xs font-semibold tabular-nums text-ink">/{totalPoints > 0 ? totalPoints : b.fields.outOf}</span>
          ) : (
            <NumberInput value={b.fields.outOf} min={1} max={100} ariaLabel={t("Graded out of")} className="w-16" onChange={(v) => set("outOf", v)} />
          )}
        </Row>
        <Toggle checked={auto} onChange={(v) => set("autoOutOf", v)} label={t("Use the total of the questions ({n} pts)", { n: totalPoints })} />
        {mismatch && (
          <p role="status" className="rounded-[5px] bg-amber-50 px-2 py-1 text-xs leading-snug text-amber-800 ring-1 ring-amber-200">
            {t("The questions add up to {total} pts, not {outOf}.", { total: totalPoints, outOf: b.fields.outOf })}
          </p>
        )}
      </Group>
    </>
  );
}

type Tr = ReturnType<typeof useT>;

// The heading looks, each with a small drawing in the chosen accent color.
function decorOptions(t: Tr, accent: string): { value: HeadingDecor; label: string; preview: ReactNode }[] {
  const word = <span className="text-[11px] font-bold text-ink">Exercice 1</span>;
  return [
    { value: "plain", label: t("Plain"), preview: word },
    { value: "underline", label: t("Underline"), preview: <span className="border-b-[3px] pb-px text-[11px] font-bold text-ink" style={{ borderColor: accent }}>Exercice 1</span> },
    { value: "bar", label: t("Side bar"), preview: <span className="border-s-[3px] ps-1 text-[11px] font-bold text-ink" style={{ borderColor: accent }}>Exercice 1</span> },
    { value: "band", label: t("Band"), preview: <span className="w-full rounded px-1.5 py-1 text-start text-[11px] font-bold text-white" style={{ background: accent }}>Exercice 1</span> },
    { value: "pill", label: t("Pill"), preview: <span className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white" style={{ background: accent }}>Exercice 1</span> },
    { value: "boxed", label: t("Box"), preview: <span className="w-full rounded border-[1.5px] px-1.5 py-0.5 text-start text-[11px] font-bold text-ink" style={{ borderColor: accent, background: `${accent}14` }}>Exercice 1</span> },
    {
      value: "rule",
      label: t("Line"),
      preview: (
        <span className="flex w-full items-center gap-1 px-1">
          {word}
          <span className="h-px flex-1" style={{ background: accent }} />
        </span>
      ),
    },
  ];
}
