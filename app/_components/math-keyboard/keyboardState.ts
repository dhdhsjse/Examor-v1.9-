import type { Ctx, Shell } from "@/app/_features/core/types";

// The keyboard types into any text being written (a text box, a question…) or the equation being edited, so it is drawn whenever the
// teacher has it on (`shell.mathKeyboard` is that choice, remembered in the browser).
export function keyboardState(shell: Shell) {
  return { visible: shell.mathKeyboard };
}

// Shared by the button of the tool bar and the one in the top bar.
export function toggleKeyboard(ctx: Ctx) {
  ctx.shell.toggleMathKeyboard(!ctx.shell.mathKeyboard);
}
