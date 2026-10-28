"use client";

import { useEffect } from "react";
import type { Ctx } from "@/app/_features/core/types";
import FloatingKeyboard from "./FloatingKeyboard";
import KeyboardLauncher from "./KeyboardLauncher";
import { keyboardState } from "./keyboardState";
import { setKeyboardSubject } from "./keyboardStore";

// The math keyboard over the pages: the button to show / hide it, and the keyboard itself while an equation is selected. A studio
// that is open covers the page and has its own button and keyboard (StudioKeyboard), so this one steps aside then.
export default function PageKeyboard({ ctx }: { ctx: Ctx }) {
  const { shell } = ctx;

  // The exam's subject picks Math or Physics keys until the teacher picks by hand; the studios, which do not know the exam, read it here.
  useEffect(() => setKeyboardSubject(shell.subject), [shell.subject]);

  const studioOpen = shell.graphStudio.open || shell.circuitStudio.open || shell.molecule.open || shell.moleculeLab.open;
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <KeyboardLauncher ctx={ctx} />
      {!studioOpen && keyboardState(shell).visible && <FloatingKeyboard target="equation" onClose={() => shell.toggleMathKeyboard(false)} />}
    </div>
  );
}
