import PageKeyboard from "@/app/_components/math-keyboard/PageKeyboard";
import type { Feature } from "@/app/_features/core/types";

// The math keyboard over the pages: a button to show / hide it, and the keyboard itself (a window that can be moved anywhere) while an
// equation is selected. Its keys are Math or Physics, as the exam's subject says until the teacher picks by hand. It stays under the
// full-screen dialogs (onboarding, template picker…), which are z-50. The studios have their own (StudioKeyboard).
export const mathKeyboardOverlay: Feature = {
  id: "overlay.math-keyboard",
  kind: "overlay",
  label: "Math keyboard",
  render: ({ ctx }) => <PageKeyboard ctx={ctx} />,
};
