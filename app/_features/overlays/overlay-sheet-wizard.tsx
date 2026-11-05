import SheetWizard from "@/app/_components/sheet/SheetWizard";
import type { Feature } from "@/app/_features/core/types";
import { isQuestion, totalPoints } from "@/app/_lib/blocks";
import { examFullMark } from "@/app/_lib/examMark";

// The window that makes the correction sheet: it opens on the Correction tab while there is none, and from the sheet's settings to make it again.
export const sheetWizardOverlay: Feature = {
  id: "overlay.sheet-wizard",
  kind: "overlay",
  label: "Correction sheet",
  render: ({ ctx }) => {
    const { shell } = ctx;
    if (!shell.sheetWizard.open) return null;
    const c = shell.fullDoc.correction;
    // (made again: what it was made from and on which paper is where the choice starts; it had marks if it has stickers)
    const initial = shell.sheetWizard.rebuild && c ? { template: c.template ?? "blank", paper: c.sheet.paper, marks: c.blocks.some((b) => b.type === "mark") } : undefined;
    return (
      <SheetWizard
        key={String(shell.sheetWizard.rebuild)}
        rebuild={shell.sheetWizard.rebuild}
        questions={shell.fullDoc.blocks.filter(isQuestion).length}
        points={totalPoints(shell.fullDoc.blocks)}
        fullMark={examFullMark(shell.fullDoc)}
        initial={initial}
        onMake={shell.makeSheet}
        onClose={shell.closeSheetWizard}
      />
    );
  },
};
