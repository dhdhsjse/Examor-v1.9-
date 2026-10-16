import type { Feature } from "@/app/_features/core/types";
import { TabButton } from "@/app/_features/core/ui";

export const tabLibraryToggle: Feature = {
  id: "toggle.tab.library",
  kind: "toggle",
  label: "Library",
  order: 2,
  render: ({ ctx }) => <TabButton text={ctx.t("Library")} active={ctx.shell.rightTab === "library"} onClick={() => ctx.shell.setRightTab("library")} />,
};
