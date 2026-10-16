import type { Feature } from "@/app/_features/core/types";
import { SubjectTab } from "@/app/_features/core/ui";

export const subjectArabic: Feature = {
  id: "toggle.subject.arabic",
  kind: "toggle",
  label: "Arabic",
  order: 5,
  render: ({ ctx }) => <SubjectTab text={ctx.t("Arabic")} active={ctx.shell.subject === "Arabic"} onClick={() => ctx.shell.setSubject("Arabic")} />,
};
