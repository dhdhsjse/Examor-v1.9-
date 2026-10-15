import type { Feature } from "@/app/_features/core/types";
import { TabButton } from "@/app/_features/core/ui";

export const tabPropertiesToggle: Feature = {
  id: "toggle.tab.properties",
  kind: "toggle",
  label: "Properties",
  order: 1,
  render: ({ ctx }) => (
    <TabButton text={ctx.t("Properties")} active={ctx.shell.rightTab === "properties"} onClick={() => ctx.shell.setRightTab("properties")} />
  ),
};
