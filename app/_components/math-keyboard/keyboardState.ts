import type { Ctx, Shell } from "@/app/_features/core/types";

// The keyboard types wherever the teacher last clicked to type (an equation, a text on the sheet, a box of the panel), so it is drawn
// whenever it is on (`shell.mathKeyboard` is that choice, remembered in the browser).
export function keyboardState(shell: Shell) {
  return { visible: shell.mathKeyboard };
}

// Shared by the button on the canvas and the one in the top bar.
export function toggleKeyboard(ctx: Ctx) {
  ctx.shell.toggleMathKeyboard(!keyboardState(ctx.shell).visible);
}
