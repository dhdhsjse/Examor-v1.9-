import Inspector from "@/app/_components/inspector/Inspector";
import type { Feature } from "@/app/_features/core/types";

// Properties of the selected block (the Properties tab).
export const inspectorPanel: Feature = {
  id: "panel.inspector",
  kind: "panel",
  label: "Properties",
  render: ({ ctx }) => {
    const { shell, doc } = ctx;
    const block = shell.selected;
    return (
      <Inspector
        block={block}
        number={block ? (shell.numbers.get(block.id) ?? 1) : 1}
        keyboardOpen={shell.mathKeyboard}
        onToggleKeyboard={() => shell.toggleMathKeyboard()}
        meta={doc.meta}
        stats={shell.stats}
        onChange={shell.updateBlock}
        onLatex={shell.onLatex}
        onDelete={shell.deleteBlock}
        onDuplicate={shell.duplicateBlock}
        onReplaceImage={shell.replaceImage}
        onMeta={shell.setMeta}
        onChangeTemplate={shell.openPicker}
      />
    );
  },
};
