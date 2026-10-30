import { CornerDownRight } from "lucide-react";
import type { Feature } from "@/app/_features/core/types";

// Above the question types while a text box is being typed in: they go inside it now, not as new blocks.
export const hintQuestionsInText: Feature = {
  id: "hint.questions.in-text",
  kind: "field",
  order: -1,
  label: "Typing in a text box",
  render: ({ ctx }) =>
    ctx.shell.textEditor ? (
      // (a press here keeps the text box open, with its cursor)
      <p
        data-text-format=""
        onMouseDown={(e) => e.preventDefault()}
        className="mx-1 mb-1 flex items-start gap-2 rounded-md bg-accent-soft px-2 py-1.5 text-[11px] leading-snug text-accent"
      >
        <CornerDownRight size={13} strokeWidth={1.8} aria-hidden className="mt-px shrink-0 rtl:-scale-x-100" />
        {ctx.t("Typing in a text box: the question types marked with an arrow go inside it, at the cursor.")}
      </p>
    ) : null,
};
