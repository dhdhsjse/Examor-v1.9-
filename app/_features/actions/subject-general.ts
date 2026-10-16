import type { Feature } from "@/app/_features/core/types";
import { LayersIcon, SubjectTab } from "@/app/_features/core/ui";

export const subjectGeneral: Feature = {
  id: "toggle.subject.general",
  kind: "toggle",
  label: "General",
  order: 1,
  render: ({ ctx }) => (
    <SubjectTab
      text=""
      title={ctx.t("General tools")}
      icon={<LayersIcon />}
      active={ctx.shell.subject === "General"}
      onClick={() => ctx.shell.setSubject("General")}
    />
  ),
};
