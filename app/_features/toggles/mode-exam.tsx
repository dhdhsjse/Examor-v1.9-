import type { Feature } from "@/app/_features/core/types";
import { ModeTab } from "@/app/_features/core/ui";

export const modeExamToggle: Feature = {
  id: "toggle.mode.exam",
  kind: "toggle",
  label: "Exam",
  order: 1,
  render: ({ ctx }) => (
    <ModeTab text={ctx.t("Exam")} correction={false} active={ctx.shell.mode === "exam"} onClick={() => ctx.shell.setMode("exam")} />
  ),
};
