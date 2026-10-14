"use client";

import type { Block, Lang } from "@/app/_lib/types";
import { HeaderEditor, ImageEditor, TableEditor, TextEditor } from "./ContentEditors";
import EquationEditor from "./EquationEditor";
import { GraphEditor } from "./GraphEditor";
import { BlankEditor, McqEditor, OpenEditor, TrueFalseEditor, type OnChange } from "./QuestionEditors";

interface Props {
  block: Block;
  number: number;
  lang: Lang;
  totalPoints: number; // of all questions (header score)
  onChange: OnChange;
  onLatex: (latex: string) => void;
  onReplaceImage: () => void;
  keyboardOpen: boolean;
  onToggleKeyboard: () => void;
}

// Picks the right editor for the selected block type.
export function ContentEditorSwitch({ block, number, lang, totalPoints, onChange, onLatex, onReplaceImage, keyboardOpen, onToggleKeyboard }: Props) {
  switch (block.type) {
    case "mcq":
      return <McqEditor b={block} onChange={onChange} />;
    case "truefalse":
      return <TrueFalseEditor b={block} onChange={onChange} />;
    case "blank":
      return <BlankEditor b={block} onChange={onChange} />;
    case "open":
      return <OpenEditor b={block} onChange={onChange} number={number} lang={lang} />;
    case "text":
      return <TextEditor b={block} onChange={onChange} />;
    case "table":
      return <TableEditor b={block} lang={lang} onChange={onChange} />;
    case "equation":
      return <EquationEditor b={block} onLatex={onLatex} keyboardOpen={keyboardOpen} onToggleKeyboard={onToggleKeyboard} />;
    case "image":
      return <ImageEditor b={block} onChange={onChange} onReplace={onReplaceImage} />;
    case "graph":
      return <GraphEditor b={block} onChange={onChange} />;
    case "header":
      return <HeaderEditor b={block} totalPoints={totalPoints} onChange={onChange} />;
  }
}
