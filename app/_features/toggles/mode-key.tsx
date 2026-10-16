import type { Feature } from "@/app/_features/core/types";
import { ModeTab } from "@/app/_features/core/ui";

export const modeKeyToggle: Feature = {
  id: "toggle.mode.key",
  kind: "toggle",
  label: "Correction",
  order: 2,
  render: ({ ctx }) => (
    <ModeTab text={ctx.t("Correction")} correction active={ctx.shell.mode === "key"} onClick={() => ctx.shell.setMode("key")} />
  ),
};
