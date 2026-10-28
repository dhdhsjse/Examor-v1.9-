"use client";

import type { ReactNode } from "react";
import { ANSWER_COLOR, DEFAULT_SIZE } from "@/app/_lib/blockLayout";
import { BLOCK_TYPE_NAMES } from "@/app/_lib/blocks";
import { DEFAULT_FONT } from "@/app/_lib/fonts";
import { EXAM_LANGS } from "@/app/_lib/i18n";
import type { Block, ExamMeta } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch } from "@/app/_lib/useExam";
import { BookmarkIcon, CopyIcon, TrashIcon } from "../icons";
import InfoTip from "../InfoTip";
import { ContentEditorSwitch } from "./ContentEditorSwitch";
import { ColorGrid, FontSelect } from "../rich/FormatBar";
import { BlockFontControls, hasFontControls } from "./FontControls";
import { MenuSelect, SmallButton, Stepper } from "./fields";

interface Props {
  block: Block | undefined;
  number: number; // question number of the selected block
  meta: ExamMeta;
  stats: { questions: number; points: number; pages: number };
  hasHeader: boolean; // the full mark is set in the header then
  onChange: (id: string, patch: BlockPatch, field: string) => void;
  onLatex: (block: Block, latex: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSaveToLibrary: (block: Block) => void;
  onReplaceImage: (id: string) => void;
  onOpenTableStudio: (shape?: string) => void; // a table: back to the Table Studio on it
  onMeta: (patch: Partial<ExamMeta>, key?: string) => void;
  onChangeTemplate: () => void;
  keyboardOpen: boolean;
  onToggleKeyboard: () => void;
}

// Right panel "Properties": edits the selected block, or the exam settings if nothing is selected.
export default function Inspector(props: Props) {
  const t = useT();
  const { block } = props;

  if (!block) return <ExamSettings {...props} />;

  return (
    <div className="flex flex-col gap-3.5 p-3.5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{t(BLOCK_TYPE_NAMES[block.type])}</h2>
        <div className="flex gap-1">
          <SmallButton title={t("Save to my library (reuse it in other exams)")} onClick={() => props.onSaveToLibrary(block)}>
            <BookmarkIcon />
          </SmallButton>
          <SmallButton title={`${t("Duplicate")} (Ctrl+D)`} onClick={() => props.onDuplicate(block.id)}>
            <CopyIcon />
          </SmallButton>
          <SmallButton danger title={`${t("Delete")} (Del)`} onClick={() => props.onDelete(block.id)}>
            <TrashIcon />
          </SmallButton>
        </div>
      </div>
      <ContentEditorSwitch
        key={block.id}
        block={block}
        number={props.number}
        lang={props.meta.lang}
        totalPoints={props.stats.points}
        keyboardOpen={props.keyboardOpen}
        onToggleKeyboard={props.onToggleKeyboard}
        onChange={(patch, field) => props.onChange(block.id, patch, field)}
        onLatex={(latex) => props.onLatex(block, latex)}
        onReplaceImage={() => props.onReplaceImage(block.id)}
        examFont={props.meta.fontFamily}
        onOpenTableStudio={props.onOpenTableStudio}
      />
      {hasFontControls(block) && <BlockFontControls b={block} meta={props.meta} onChange={(patch, field) => props.onChange(block.id, patch, field)} />}
    </div>
  );
}

// Nothing selected: settings of the whole exam. (The exam's name is edited in the top bar.)
function ExamSettings({ meta, stats, hasHeader, onMeta, onChangeTemplate }: Props) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3.5 p-3.5">
      <div className="flex items-center gap-1.5">
        <h2 className="text-sm font-semibold text-ink">{t("Exam settings")}</h2>
        <InfoTip label={t("More info")} text={t("Select a block on the page to edit it.")} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-[11px] font-semibold text-muted">
          {t("Exam language")}
          <InfoTip
            label={t("More info")}
            text={t("Arabic flips the page right-to-left and translates the printed labels. The app's own language is in the File menu.")}
          />
        </span>
        <MenuSelect label={t("Exam language")} value={meta.lang} options={EXAM_LANGS} onChange={(lang) => onMeta({ lang })} />
      </div>
      <SmallButton onClick={onChangeTemplate}>{t("Start from a template…")}</SmallButton>

      <Section title={t("Paper font")}>
        <FontSelect
          value={meta.fontFamily}
          onChange={(fontFamily) => onMeta({ fontFamily })}
          defaultLabel={DEFAULT_FONT}
          className="w-full rounded-md border border-line bg-white px-2 py-1.5 text-[13px] text-ink outline-none focus:border-indigo-400"
        />
        <Row label={t("Question text size")}>
          <Stepper value={meta.fontSize ?? DEFAULT_SIZE} min={9} max={24} onChange={(fontSize) => onMeta({ fontSize }, "fontSize")} />
        </Row>
        <Hint>{t("Every block uses this font unless it has its own (Properties → Text style).")}</Hint>
      </Section>

      <Section title={t("Points")}>
        <label className="flex items-center gap-2 text-xs text-ink">
          <input type="checkbox" checked={!!meta.hidePoints} onChange={(e) => onMeta({ hidePoints: e.target.checked })} className="accent-indigo-600" />
          {t("Hide the points on the paper")}
        </label>
        {hasHeader ? (
          <Hint>{t("The full mark is set in Page layout → Header and footer (“Graded out of”).")}</Hint>
        ) : (
          <Row label={t("Full mark")}>
            <Stepper value={meta.fullMark ?? 20} min={1} max={200} onChange={(fullMark) => onMeta({ fullMark }, "fullMark")} />
          </Row>
        )}
      </Section>

      <Section title={t("Correction sheet")}>
        <span className="text-[11px] text-muted">{t("Color of the answers")}</span>
        <ColorGrid value={meta.answerColor} autoLabel={t("Green")} onChange={(answerColor) => onMeta({ answerColor })} />
        <Row label={t("Size of the answers")}>
          <Stepper value={meta.answerSize ?? meta.fontSize ?? DEFAULT_SIZE} min={9} max={28} onChange={(answerSize) => onMeta({ answerSize }, "answerSize")} />
        </Row>
        <p className="text-[11px] text-faint">
          {t("Preview:")} <span style={{ color: meta.answerColor ?? ANSWER_COLOR, fontWeight: 600 }}>{t("model answer")}</span>
        </p>
      </Section>

      <div className="grid grid-cols-3 gap-2 pt-1">
        {(
          [
            ["Questions", stats.questions],
            ["Points", stats.points],
            ["Pages", stats.pages],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-subtle px-2 py-2 text-center ring-1 ring-line">
            <p className="text-base font-semibold text-ink">{value}</p>
            <p className="text-[10px] text-muted">{t(label)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-indigo-50/60 p-3 text-[11px] leading-relaxed text-indigo-900 ring-1 ring-indigo-100">
        <p className="mb-1 font-semibold">{t("Shortcuts")}</p>
        <p>{t("Del — delete · Ctrl+D — duplicate")}</p>
        <p>{t("Ctrl+Z / Ctrl+Y — undo / redo")}</p>
        <p>{t("Ctrl+S — save · Ctrl+P — print preview")}</p>
        <p>{t("Ctrl+wheel or Ctrl +/− — zoom · Ctrl+0 — fit")}</p>
        <p>{t("Space + drag — move around the page")}</p>
        <p>{t("Click a selected block's text — type there")}</p>
        <p>{t("T — text tool · V — select tool")}</p>
        <p>{t("B — draw a text box · Esc — stop")}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-subtle/60 p-2.5">
      <span className="text-[11px] font-semibold text-muted">{title}</span>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[11px] text-muted">{label}</span>
      {children}
    </div>
  );
}

const Hint = ({ children }: { children: ReactNode }) => <p className="text-[11px] leading-snug text-faint">{children}</p>;
