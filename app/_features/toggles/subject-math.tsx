import type { Feature } from "@/app/_features/core/types";
import { SubjectTab } from "@/app/_features/core/ui";

export const subjectMath: Feature = {
  id: "toggle.subject.math",
  kind: "toggle",
  label: "Math",
  order: 2,
  render: ({ ctx }) => <SubjectTab text={ctx.t("Math")} active={ctx.shell.subject === "Math"} onClick={() => ctx.shell.setSubject("Math")} />,
};
