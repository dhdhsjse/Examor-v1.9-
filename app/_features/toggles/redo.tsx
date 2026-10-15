import { RedoIcon } from "@/app/_components/icons";
import type { Feature } from "@/app/_features/core/types";
import { iconBtn } from "@/app/_features/core/ui";

export const redoToggle: Feature = {
  id: "toggle.redo",
  kind: "toggle",
  label: "Redo",
  order: 2,
  render: ({ ctx }) => (
    <button className={iconBtn} onClick={ctx.shell.redo} disabled={!ctx.shell.canRedo} title={`${ctx.t("Redo")} (Ctrl+Y)`}>
      <RedoIcon />
    </button>
  ),
};
