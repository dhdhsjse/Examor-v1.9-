import FloatingKeyboard from "@/app/_components/math-keyboard/FloatingKeyboard";
import KeyboardLauncher from "@/app/_components/math-keyboard/KeyboardLauncher";
import { keyboardState } from "@/app/_components/math-keyboard/keyboardState";
import type { Feature } from "@/app/_features/core/types";
import { keyboardTabsFor } from "@/app/_lib/keyboard/layouts";

// The math keyboard over the pages: a button to show / hide it, and the keyboard itself while an equation is
// selected. Its tabs follow the exam's subject (Physics has its own). It stays under the full-screen dialogs
// (onboarding, template picker…), which are z-50.
export const mathKeyboardOverlay: Feature = {
  id: "overlay.math-keyboard",
  kind: "overlay",
  label: "Math keyboard",
  render: ({ ctx }) => {
    const { shell } = ctx;
    return (
      <div className="pointer-events-none absolute inset-0 z-40">
        <KeyboardLauncher ctx={ctx} />
        {keyboardState(shell).visible && (
          // Leaves room on the right for the button above.
          <div className="absolute right-16 bottom-16 left-4 flex justify-center">
            <div className="w-full max-w-[720px]">
              <FloatingKeyboard tabs={keyboardTabsFor(shell.subject)} onClose={() => shell.toggleMathKeyboard(false)} />
            </div>
          </div>
        )}
      </div>
    );
  },
};
