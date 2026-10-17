import { Library } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";
import { iconBtn } from "@/app/_features/core/ui";

const BAR_ID = "bar.right-panel";

// In the strip of the closed right panel: reopens it on the Library tab.
export const stripLibraryToggle: Feature = {
  id: "toggle.strip.library",
  kind: "toggle",
  label: "Library",
  order: 2,
  render: ({ ctx }) => (
    <button
      type="button"
      className={iconBtn}
      title={ctx.t("Library")}
      aria-label={ctx.t("Library")}
      onClick={() => {
        ctx.shell.setRightTab("library");
        ctx.shell.showBar(BAR_ID);
      }}
    >
      <Library size={15} strokeWidth={1.7} aria-hidden />
    </button>
  ),
};
