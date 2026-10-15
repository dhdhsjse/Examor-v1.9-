import type { Feature } from "@/app/_features/core/types";
import { PanelIcon } from "@/app/_features/core/PanelIcon";
import { iconBtn } from "@/app/_features/core/ui";

const BAR_ID = "bar.outils-generaux";

// Shows or hides the toolbox (left bar).
export const barLeftToggle: Feature = {
  id: "toggle.bar.left",
  kind: "toggle",
  label: "Toolbox",
  order: 1,
  render: ({ ctx }) => {
    const open = !ctx.shell.hiddenBars.includes(BAR_ID);
    const text = open ? ctx.t("Hide toolbox") : ctx.t("Show toolbox");
    return (
      <button className={iconBtn} onClick={() => ctx.shell.toggleBar(BAR_ID)} title={text} aria-label={text} aria-pressed={open}>
        <PanelIcon side="left" open={open} />
      </button>
    );
  },
};
