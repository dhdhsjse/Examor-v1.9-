"use client";

import type { Block, ExamMeta } from "@/app/_lib/types";
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
  const { block } = props;

  if (!block) return <ExamSettings {...props} />;

  return (
    <div className="flex flex-col gap-3.5 p-3.5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">{TYPE_NAMES[block.type]}</h2>
        <div className="flex gap-1">
          <SmallButton title="Duplicate (Ctrl+D)" onClick={() => props.onDuplicate(block.id)}>
            <CopyIcon />
          </SmallButton>
          <SmallButton danger title="Delete (Del)" onClick={() => props.onDelete(block.id)}>
            <TrashIcon />
          </SmallButton>
        </div>
      </div>
      <ContentEditorSwitch
        block={block}
        number={props.number}
        lang={props.meta.lang}
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
  return (
    <div className="flex flex-col gap-3.5 p-3.5">
      <div>
        <h2 className="text-sm font-semibold text-ink">Exam settings</h2>
        <p className="mt-0.5 text-[11px] text-faint">Select a block on the page to edit it.</p>
      </div>
      <Field label="File name">
        <TextInput value={meta.title} onChange={(title) => onMeta({ title }, "title")} />
      </Field>
      <Field label="Exam language" hint="Arabic flips the page right-to-left and translates the printed labels.">
        <Segmented
          value={meta.lang}
          onChange={(lang) => onMeta({ lang })}
          options={[
            { value: "fr", label: "Français" },
            { value: "ar", label: "العربية" },
          ]}
        />
      </Field>
      <SmallButton onClick={onChangeTemplate}>Start from a template…</SmallButton>

      <div className="grid grid-cols-3 gap-2 pt-1">
        {[
          ["Questions", stats.questions],
          ["Points", stats.points],
          ["Pages", stats.pages],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-subtle px-2 py-2 text-center ring-1 ring-line">
            <p className="text-base font-semibold text-ink">{value}</p>
            <p className="text-[10px] text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-indigo-50/60 p-3 text-[11px] leading-relaxed text-indigo-900 ring-1 ring-indigo-100">
        <p className="mb-1 font-semibold">Shortcuts</p>
        <p>Del — delete · Ctrl+D — duplicate</p>
        <p>Ctrl+Z / Ctrl+Y — undo / redo</p>
        <p>Ctrl+S — save · Ctrl+wheel — zoom</p>
        <p>Double-click a text on the page — type there</p>
        <p>T — text tool · V — select tool</p>
      </div>
    </div>
  );
}
