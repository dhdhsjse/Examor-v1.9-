"use client";

import type { BlockPreset } from "@/app/_lib/blocks";
import type { SheetScores } from "@/app/_lib/sheet/marks";
import type { SheetConfig } from "@/app/_lib/sheet/model";
import type { Block, BlockType, ExamMeta, Lang } from "@/app/_lib/types";
import TablePanel from "@/app/_components/table/TablePanel";
import { HeaderEditor, ImageEditor, TextboxEditor, TextEditor } from "./ContentEditors";
import { DividerEditor } from "./DividerEditor";
import { MarkEditor, RuleEditor } from "./SheetEditors";
import EquationEditor from "./EquationEditor";
import { GraphEditor } from "./GraphEditor";
import { ClassifyEditor, MatchEditor, OrderEditor } from "./MoreQuestionEditors";
import { BlankEditor, McqEditor, OpenEditor, TrueFalseEditor, type OnChange } from "./QuestionEditors";

interface Props {
  block: Block;
  number: number;
  lang: Lang;
  totalPoints: number; // of all questions (header score)
  onChange: OnChange;
  onLatex: (latex: string) => void;
  onReplaceImage: () => void;
  examFont?: string;
  meta?: ExamMeta; // the exam settings (an image caption's default font and size)
  onOpenTableStudio: (shape?: string) => void;
  onOpenChartStudio: () => void;
  onOpenImageStudio: () => void;
  keyboardOpen: boolean;
  onToggleKeyboard: () => void;
  onInsertBelow: (type: BlockType, preset: BlockPreset) => void; // a new block under this one (an equation's graph or table)
  sheet?: { config: SheetConfig; scores: SheetScores } | null; // the correction sheet, for its stickers
}

// Picks the right editor for the selected block type.
export function ContentEditorSwitch({ block, number, lang, totalPoints, onChange, onLatex, onReplaceImage, examFont, meta, onOpenTableStudio, onOpenChartStudio, onOpenImageStudio, keyboardOpen, onToggleKeyboard, onInsertBelow, sheet }: Props) {
  switch (block.type) {
    case "mcq":
      return <McqEditor b={block} onChange={onChange} />;
    case "truefalse":
      return <TrueFalseEditor b={block} onChange={onChange} />;
    case "blank":
      return <BlankEditor b={block} onChange={onChange} />;
    case "open":
      return <OpenEditor b={block} onChange={onChange} number={number} lang={lang} />;
    case "match":
      return <MatchEditor b={block} onChange={onChange} />;
    case "order":
      return <OrderEditor b={block} onChange={onChange} />;
    case "classify":
      return <ClassifyEditor b={block} onChange={onChange} />;
    case "text":
      return <TextEditor b={block} onChange={onChange} />;
    case "textbox":
      return <TextboxEditor b={block} onChange={onChange} />;
    case "table":
      return <TablePanel b={block} lang={lang} onChange={onChange} examFont={examFont} onOpenStudio={onOpenTableStudio} />;
    case "equation":
      return <EquationEditor b={block} onLatex={onLatex} keyboardOpen={keyboardOpen} onToggleKeyboard={onToggleKeyboard} lang={lang} onInsert={onInsertBelow} />;
    case "image":
      return <ImageEditor b={block} lang={lang} meta={meta} onChange={onChange} onReplace={onReplaceImage} onOpenChartStudio={onOpenChartStudio} onOpenImageStudio={onOpenImageStudio} />;
    case "graph":
      return <GraphEditor b={block} onChange={onChange} />;
    case "divider":
      return <DividerEditor b={block} onChange={onChange} />;
    case "mark":
      return <MarkEditor b={block} meta={meta ?? { title: "", lang, templateId: "" }} shown={sheet?.scores.shown.get(block.id)} onChange={onChange} />;
    case "rule":
      return <RuleEditor b={block} onChange={onChange} />;
    case "header":
      return <HeaderEditor b={block} meta={meta ?? { title: "", lang, templateId: "" }} totalPoints={totalPoints} onChange={onChange} />;
  }
}
