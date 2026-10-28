"use client";

import type { Block, Lang } from "@/app/_lib/types";
import TablePanel from "@/app/_components/table/TablePanel";
import { HeaderEditor, ImageEditor, TextboxEditor, TextEditor } from "./ContentEditors";
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
  onOpenTableStudio: (shape?: string) => void;
  keyboardOpen: boolean;
  onToggleKeyboard: () => void;
}

// Picks the right editor for the selected block type.
export function ContentEditorSwitch({ block, number, lang, totalPoints, onChange, onLatex, onReplaceImage, examFont, onOpenTableStudio, keyboardOpen, onToggleKeyboard }: Props) {
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
      return <EquationEditor b={block} onLatex={onLatex} keyboardOpen={keyboardOpen} onToggleKeyboard={onToggleKeyboard} />;
    case "image":
      return <ImageEditor b={block} lang={lang} onChange={onChange} onReplace={onReplaceImage} />;
    case "graph":
      return <GraphEditor b={block} onChange={onChange} />;
    case "header":
      return <HeaderEditor b={block} totalPoints={totalPoints} onChange={onChange} />;
  }
}
