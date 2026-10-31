"use client";

import { ChevronDown } from "lucide-react";
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
import { iconBtn } from "@/app/_features/core/ui";
import { MenuSelect, SmallButton, Stepper, Toggle, inputCls } from "./fields";

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
    <div className="flex flex-col">
      <div className="flex h-10 items-center justify-between gap-2 border-b border-line ps-3 pe-1.5">
        <h2 className="truncate text-xs font-semibold text-ink">{t(BLOCK_TYPE_NAMES[block.type])}</h2>
        <div className="flex">
          <HeaderButton label={t("Save to my library (reuse it in other exams)")} onClick={() => props.onSaveToLibrary(block)}>
            <BookmarkIcon />
          </HeaderButton>
          <HeaderButton label={`${t("Duplicate")} (Ctrl+D)`} onClick={() => props.onDuplicate(block.id)}>
            <CopyIcon />
          </HeaderButton>
          <HeaderButton danger label={`${t("Delete")} (Del)`} onClick={() => props.onDelete(block.id)}>
            <TrashIcon />
          </HeaderButton>
        </div>
      </div>
      <div className="flex flex-col gap-3 p-3">
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
    </div>
  );
}

// An icon button of the panel header (Save to library, Duplicate, Delete).
function HeaderButton({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick} className={danger ? `${iconBtn} hover:bg-red-50! hover:text-red-700!` : iconBtn}>
      {children}
    </button>
  );
}

// Nothing selected: settings of the whole exam. (The exam's name is edited in the top bar; the question,
// point and page counts are in the toolbox's status bar.)
function ExamSettings({ meta, hasHeader, onMeta, onChangeTemplate }: Props) {
  const t = useT();
  return (
    <div className="flex flex-col">
      <div className="flex h-10 items-center gap-1.5 border-b border-line px-3">
        <h2 className="text-xs font-semibold text-ink">{t("Exam settings")}</h2>
        <InfoTip label={t("More info")} text={t("Select a block on the page to edit it.")} />
      </div>
      <div className="flex flex-col divide-y divide-line">
        <Section>
          <Row
            label={
              <span className="flex items-center gap-1">
                {t("Exam language")}
                <InfoTip
                  label={t("More info")}
                  text={t("Arabic flips the page right-to-left and translates the printed labels. The app's own language is in the File menu.")}
                />
              </span>
            }
          >
            <MenuSelect label={t("Exam language")} value={meta.lang} options={EXAM_LANGS} onChange={(lang) => onMeta({ lang })} />
          </Row>
          <SmallButton onClick={onChangeTemplate}>{t("Start from a template…")}</SmallButton>
        </Section>

        <Section title={t("Paper font")}>
          <FontSelect value={meta.fontFamily} onChange={(fontFamily) => onMeta({ fontFamily })} defaultLabel={DEFAULT_FONT} className={inputCls} />
          <Row label={t("Question text size")}>
            <Stepper value={meta.fontSize ?? DEFAULT_SIZE} min={9} max={24} onChange={(fontSize) => onMeta({ fontSize }, "fontSize")} />
          </Row>
          <Hint>{t("Every block uses this font unless it has its own (Properties → Text style).")}</Hint>
        </Section>

        <Section title={t("Points")}>
          <Toggle checked={!!meta.hidePoints} onChange={(hidePoints) => onMeta({ hidePoints })} label={t("Hide the points on the paper")} />
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

        {/* Folded by default: a reference, not a setting */}
        <details className="group/keys px-3 py-2">
          <summary className="flex h-6 cursor-pointer list-none items-center justify-between rounded-[5px] text-[11px] font-semibold text-ink outline-none focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
            {t("Shortcuts")}
            <ChevronDown size={12} strokeWidth={2} aria-hidden className="text-muted transition-transform group-open/keys:rotate-180" />
          </summary>
          <div className="flex flex-col gap-1 pt-1 pb-1 text-[11px] leading-snug text-muted">
            <p>{t("Del — delete · Ctrl+D — duplicate")}</p>
            <p>{t("Ctrl+Z / Ctrl+Y — undo / redo")}</p>
            <p>{t("Ctrl+S — save · Ctrl+P — print preview")}</p>
            <p>{t("Ctrl+wheel or Ctrl +/− — zoom · Ctrl+0 — fit")}</p>
            <p>{t("Space + drag — move around the page")}</p>
            <p>{t("Click a selected block's text — type there")}</p>
            <p>{t("T — text tool · V — select tool")}</p>
            <p>{t("B — draw a text box · Esc — stop")}</p>
          </div>
        </details>
      </div>
    </div>
  );
}

// A group of settings, divided from the next by a line (no card), as in Figma's design panel.
function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2 px-3 py-3">
      {title && <h3 className="flex h-5 items-center text-[11px] font-semibold text-ink">{title}</h3>}
      {children}
    </section>
  );
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-2">
      <span className="text-[11px] text-muted">{label}</span>
      {children}
    </div>
  );
}

const Hint = ({ children }: { children: ReactNode }) => <p className="text-[11px] leading-snug text-faint">{children}</p>;
