import { SlidersHorizontal } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import { iconBtn } from "@/app/_features/core/ui";

const BAR_ID = "bar.right-panel";

// In the strip of the closed right panel: reopens it on the Properties tab.
export const stripPropertiesToggle: Feature = {
  id: "toggle.strip.properties",
  kind: "toggle",
  label: "Properties",
  order: 1,
  render: ({ ctx }) => (
    <button
      type="button"
      className={iconBtn}
      title={ctx.t("Properties")}
      aria-label={ctx.t("Properties")}
      onClick={() => {
        ctx.shell.setRightTab("properties");
        ctx.shell.showBar(BAR_ID);
      }}
    >
      <SlidersHorizontal size={15} strokeWidth={1.7} aria-hidden />
    </button>
  ),
};
