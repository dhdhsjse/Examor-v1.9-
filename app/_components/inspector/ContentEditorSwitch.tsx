"use client";

import type { Block } from "@/app/_lib/types";
import { HeaderEditor, ImageEditor, TableEditor, TextEditor } from "./ContentEditors";
import EquationEditor from "./EquationEditor";
import { BlankEditor, McqEditor, OpenEditor, TrueFalseEditor, type OnChange } from "./QuestionEditors";

interface Props {
  block: Block;
  onChange: OnChange;
  onLatex: (latex: string) => void;
  onReplaceImage: () => void;
}

// Picks the right editor for the selected block type.
export function ContentEditorSwitch({ block, onChange, onLatex, onReplaceImage }: Props) {
  switch (block.type) {
    case "mcq":
      return <McqEditor b={block} onChange={onChange} />;
    case "truefalse":
      return <TrueFalseEditor b={block} onChange={onChange} />;
    case "blank":
      return <BlankEditor b={block} onChange={onChange} />;
    case "open":
      return <OpenEditor b={block} onChange={onChange} />;
    case "text":
      return <TextEditor b={block} onChange={onChange} />;
    case "table":
      return <TableEditor b={block} onChange={onChange} />;
    case "equation":
      return <EquationEditor b={block} onLatex={onLatex} />;
    case "image":
      return <ImageEditor b={block} onChange={onChange} onReplace={onReplaceImage} />;
    case "header":
      return <HeaderEditor b={block} onChange={onChange} />;
  }
}
