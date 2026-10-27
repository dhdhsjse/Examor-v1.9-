import { Keyboard } from "lucide-react";
import { keyboardState, toggleKeyboard } from "@/app/_components/math-keyboard/keyboardState";
import type { Feature } from "@/app/_features/core/types";
import { toggleBtn } from "@/app/_features/core/ui";

// Shows or hides the math keyboard. Highlighted while the keyboard is on the page.
export const mathKeyboardToggle: Feature = {
  id: "toggle.math-keyboard",
  kind: "toggle",
  label: "Math keyboard",
  order: 3,
  render: ({ ctx }) => {
    const { visible } = keyboardState(ctx.shell);
    const text = visible ? ctx.t("Hide math keyboard") : ctx.t("Show math keyboard");
    return (
      <button type="button" className={toggleBtn(visible)} onClick={() => toggleKeyboard(ctx)} title={text} aria-label={text} aria-pressed={visible}>
        <Keyboard size={16} strokeWidth={1.75} aria-hidden />
      </button>
    );
  },
};
