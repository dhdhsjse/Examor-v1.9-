import type { Feature } from "@/app/_features/core/types";
import { SubjectTab } from "@/app/_features/core/ui";

export const subjectSciences: Feature = {
  id: "toggle.subject.sciences",
  kind: "toggle",
  label: "Sciences",
  order: 4,
  render: ({ ctx }) => <SubjectTab text={ctx.t("Sciences")} active={ctx.shell.subject === "Sciences"} onClick={() => ctx.shell.setSubject("Sciences")} />,
};
