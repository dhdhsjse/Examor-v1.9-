import { UndoIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import { iconBtn } from "@/app/_features/core/ui";

export const undoToggle: Feature = {
  id: "toggle.undo",
  kind: "toggle",
  label: "Undo",
  order: 1,
  render: ({ ctx }) => (
    <button className={iconBtn} onClick={ctx.shell.undo} disabled={!ctx.shell.canUndo} title={`${ctx.t("Undo")} (Ctrl+Z)`}>
      <UndoIcon />
    </button>
  ),
};
