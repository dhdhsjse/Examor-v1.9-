import { tablePatch } from "@/app/_components/table-studio/tablePreset";
import TableStudio from "@/app/_components/table-studio/TableStudio";
import type { Feature } from "@/app/_features/core/types";

// The Table Studio, full screen over the app. A new table is inserted as an ordinary table block (one step of the exam's undo history);
// the Properties panel of a table has a button that reopens the Studio on it, and Update puts the table back in its block.
export const tableStudioOverlay: Feature = {
  id: "overlay.table-studio",
  kind: "overlay",
  label: "Table Studio",
  render: ({ ctx }) => {
    const { tableStudio, closeTableStudio, runTool, updateBlock } = ctx.shell;
    if (!tableStudio.open) return null;
    const block = tableStudio.blockId ? ctx.doc.blocks.find((b) => b.id === tableStudio.blockId) : undefined;
    const editing = block?.type === "table" ? block : null;
    return (
      <TableStudio
        key={tableStudio.blockId ?? "new"}
        meta={ctx.doc.meta}
        editing={editing}
        startShape={tableStudio.shape}
        onClose={closeTableStudio}
        onInsert={(table) => {
          runTool({ kind: "block", type: "table", preset: table });
          closeTableStudio();
        }}
        onUpdate={(table) => {
          if (editing) updateBlock(editing.id, tablePatch(table), "table-studio");
          closeTableStudio();
        }}
      />
    );
  },
};
