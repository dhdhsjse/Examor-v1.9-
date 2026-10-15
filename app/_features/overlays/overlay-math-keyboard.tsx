import MathKeyboard from "@/app/_components/math/MathKeyboard";
import type { Feature } from "@/app/_features/core/types";

// Math keyboard shown while an equation is selected (sits over the pages).
export const mathKeyboardOverlay: Feature = {
  id: "overlay.math-keyboard",
  kind: "overlay",
  label: "Math keyboard",
  render: ({ ctx }) => {
    const { shell } = ctx;
    if (shell.selected?.type !== "equation" || !shell.mathKeyboard) return null;
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-16 z-40 flex justify-center px-4">
        <div className="w-full max-w-[720px]">
          <MathKeyboard onClose={() => shell.toggleMathKeyboard(false)} />
        </div>
      </div>
    );
  },
};
