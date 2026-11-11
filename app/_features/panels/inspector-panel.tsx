import Inspector from "@/app/_components/inspector/Inspector";
import { examFullMark } from "@/app/_lib/examMark";
import { canStepSlot } from "@/app/_lib/textboxSlots";
import type { Feature } from "@/app/_features/core/types";
import { Search } from "lucide-react";

// Properties of the selected block (the Properties tab).
export const inspectorPanel: Feature = {
  id: "panel.inspector",
  kind: "panel",
  label: "Properties",
  render: ({ ctx }) => {
    const { shell, doc } = ctx;
    const block = shell.selected;
    return (
      <>
      <Inspector
        block={block}
        number={block ? (shell.numbers.get(block.id) ?? 1) : 1}
        keyboardOpen={shell.mathKeyboard}
        onToggleKeyboard={() => shell.toggleMathKeyboard()}
        onInsertBelow={shell.insertBelow}
        inBox={block?.meta?.slot ? { up: canStepSlot(doc, block.id, -1), down: canStepSlot(doc, block.id, 1) } : undefined}
        onStepInBox={(dir) => block && shell.stepInBox(block.id, dir)}
        meta={doc.meta}
        stats={shell.stats}
        fullMark={examFullMark(shell.fullDoc)}
        onFullMark={shell.setFullMark}
        onGoTo={shell.selectBlock}
        onChange={shell.updateBlock}
        onLatex={shell.onLatex}
        onDelete={shell.deleteBlock}
        onDuplicate={shell.duplicateBlock}
        onOrder={shell.orderBlock}
        onSaveToLibrary={shell.saveToLibrary}
        onReplaceImage={shell.replaceImage}
        onOpenTableStudio={(start) => block && shell.openTableStudio(block.id, start)}
        onOpenChartStudio={() => block && shell.openChartStudio(block.id)}
        onOpenImageStudio={() => block && shell.openImageStudio(block.id)}
        onMeta={shell.setMeta}
        onChangeTemplate={shell.openPicker}
        sheet={shell.sheet}
        sheetReport={shell.sheetReport}
        sheetFix={shell.sheetFix}
        onSheet={shell.setSheet}
        hasSheet={shell.hasSheet}
        onOpenCorrection={() => shell.setMode("key")}
        onDeleteSheet={shell.deleteSheet}
        onRemakeSheet={() => shell.openSheetWizard(true)}
        onClose={shell.selectNone}
      />
      <button type="button" onClick={() => ctx.openInspector("inspector.home.find")} className="flex h-9 w-full items-center gap-2 border-t border-line px-3 text-start text-xs font-semibold text-ink outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent">
        <Search size={14} strokeWidth={1.8} aria-hidden className="text-muted" />
        {ctx.t("Find and replace")}
      </button>
      </>
    );
  },
};
