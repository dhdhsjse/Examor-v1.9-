import TemplatePicker from "@/app/_components/templates/TemplatePicker";
import type { Feature } from "@/app/_features/core/types";

export const pickerOverlay: Feature = {
  id: "overlay.picker",
  kind: "overlay",
  label: "Template picker",
  render: ({ ctx }) =>
    ctx.shell.picker.open ? (
      <TemplatePicker canClose={!ctx.shell.picker.mustPick} onClose={ctx.shell.closePicker} onPick={ctx.shell.pickTemplate} />
    ) : null,
};
