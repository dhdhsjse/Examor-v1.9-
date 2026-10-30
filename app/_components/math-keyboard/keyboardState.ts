import type { Ctx, Shell } from "@/app/_features/core/types";

// The keyboard types into the equation being edited, so it is drawn while an equation is selected and the
// teacher has not closed it (`shell.mathKeyboard` is that choice, remembered in the browser).
export function keyboardState(shell: Shell) {
  const canType = shell.selected?.type === "equation";
  return { canType, visible: shell.mathKeyboard && canType };
}

// Shared by the button on the canvas and the one in the top bar. Opening it with no equation selected
// cannot show anything yet, so say what it waits for.
export function toggleKeyboard(ctx: Ctx) {
  const { shell, t } = ctx;
  const { canType, visible } = keyboardState(shell);
  shell.toggleMathKeyboard(!visible);
  if (!visible && !canType) shell.notify(t("Select an equation to use the math keyboard."));
}
