"use client";

import type { Block, ExamMeta } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch } from "@/app/_lib/useExam";
import { CopyIcon, TrashIcon } from "../icons";
import { ContentEditorSwitch } from "./ContentEditorSwitch";
import { Field, Segmented, SmallButton, TextInput } from "./fields";

const TYPE_NAMES: Record<Block["type"], string> = {
  mcq: "Multiple choice",
  truefalse: "True / False",
  blank: "Fill in the blank",
  open: "Open question",
  text: "Text",
  table: "Table",
  graph: "Function graph",
  equation: "Equation",
  image: "Image",
  header: "Exam header",
};

interface Props {
  block: Block | undefined;
  number: number; // question number of the selected block
  meta: ExamMeta;
  stats: { questions: number; points: number; pages: number };
  onChange: (id: string, patch: BlockPatch, field: string) => void;
  onLatex: (block: Block, latex: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onReplaceImage: (id: string) => void;
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
        <h2 className="text-sm font-semibold text-ink">{t(TYPE_NAMES[block.type])}</h2>
        <div className="flex gap-1">
          <SmallButton title={`${t("Duplicate")} (Ctrl+D)`} onClick={() => props.onDuplicate(block.id)}>
            <CopyIcon />
          </SmallButton>
          <SmallButton danger title={`${t("Delete")} (Del)`} onClick={() => props.onDelete(block.id)}>
            <TrashIcon />
          </SmallButton>
        </div>
      </div>
      <ContentEditorSwitch
        block={block}
        number={props.number}
        lang={props.meta.lang}
        totalPoints={props.stats.points}
        keyboardOpen={props.keyboardOpen}
        onToggleKeyboard={props.onToggleKeyboard}
        onChange={(patch, field) => props.onChange(block.id, patch, field)}
        onLatex={(latex) => props.onLatex(block, latex)}
        onReplaceImage={() => props.onReplaceImage(block.id)}
      />
    </div>
  );
}

function ExamSettings({ meta, stats, onMeta, onChangeTemplate }: Props) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3.5 p-3.5">
      <div>
        <h2 className="text-sm font-semibold text-ink">{t("Exam settings")}</h2>
        <p className="mt-0.5 text-[11px] text-faint">{t("Select a block on the page to edit it.")}</p>
      </div>
      <Field label={t("File name")}>
        <TextInput value={meta.title} onChange={(title) => onMeta({ title }, "title")} />
      </Field>
      <Field label={t("Exam language")} hint={t("Arabic flips the page right-to-left and translates the printed labels. The app's own language is in the top bar.")}>
        <Segmented
          value={meta.lang}
          onChange={(lang) => onMeta({ lang })}
          options={[
            { value: "fr", label: "Français" },
            { value: "ar", label: "العربية" },
          ]}
        />
      </Field>
      <SmallButton onClick={onChangeTemplate}>{t("Start from a template…")}</SmallButton>

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
      </div>
    </div>
  );
}
