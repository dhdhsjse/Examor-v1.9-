import type { Feature } from "@/app/_features/core/types";

// The exam's name, edited in place in the top bar.
export const titleField: Feature = {
  id: "field.title",
  kind: "field",
  label: "Exam name",
  render: ({ ctx }) => (
    <input
      value={ctx.shell.title}
      onChange={(e) => ctx.shell.setTitle(e.target.value)}
      dir="auto"
      className="min-w-0 flex-1 truncate rounded px-1.5 py-1 text-[13px] text-muted outline-none hover:bg-subtle focus:bg-subtle focus:text-ink"
      title={ctx.t("Exam name")}
    />
  ),
};
