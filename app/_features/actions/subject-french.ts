import type { Feature } from "@/app/_features/core/types";
import { SubjectTab } from "@/app/_features/core/ui";

export const subjectFrench: Feature = {
  id: "toggle.subject.french",
  kind: "toggle",
  label: "French",
  order: 6,
  render: ({ ctx }) => <SubjectTab text={ctx.t("French")} active={ctx.shell.subject === "French"} onClick={() => ctx.shell.setSubject("French")} />,
};
