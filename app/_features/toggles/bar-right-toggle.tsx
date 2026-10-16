import type { Feature } from "@/app/_features/core/types";
import { PanelIcon } from "@/app/_features/core/PanelIcon";
import { iconBtn } from "@/app/_features/core/ui";

const BAR_ID = "bar.right-panel";

// Shows or hides the Properties / Library panel (right bar).
export const barRightToggle: Feature = {
  id: "toggle.bar.right",
  kind: "toggle",
  label: "Properties panel",
  order: 2,
  render: ({ ctx }) => {
    const open = !ctx.shell.hiddenBars.includes(BAR_ID);
    const text = open ? ctx.t("Hide properties panel") : ctx.t("Show properties panel");
    return (
      <button className={iconBtn} onClick={() => ctx.shell.toggleBar(BAR_ID)} title={text} aria-label={text} aria-pressed={open}>
        <PanelIcon side="right" open={open} />
      </button>
    );
  },
};
