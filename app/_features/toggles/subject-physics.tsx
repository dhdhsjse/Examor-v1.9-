import type { Feature } from "@/app/_features/core/types";
import { SubjectTab } from "@/app/_features/core/ui";

export const subjectPhysics: Feature = {
  id: "toggle.subject.physics",
  kind: "toggle",
  label: "Physics",
  order: 3,
  render: ({ ctx }) => <SubjectTab text={ctx.t("Physics")} active={ctx.shell.subject === "Physics"} onClick={() => ctx.shell.setSubject("Physics")} />,
};
