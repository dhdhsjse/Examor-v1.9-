"use client";

import { useEffect } from "react";
import type { Ctx } from "@/app/_features/core/types";
import FloatingKeyboard from "./FloatingKeyboard";
import KeyboardLauncher from "./KeyboardLauncher";
import { trackTextFields } from "./fieldTarget";
import { keyboardState } from "./keyboardState";
import { setKeyboardSubject } from "./keyboardStore";

// The math keyboard over the pages: the button to show / hide it, and the keyboard itself, which types in the place last clicked to type:
// an equation, a text or a cell on the sheet, a box of the Properties panel. A studio
// that is open covers the page and has its own button and keyboard (StudioKeyboard), so this one steps aside then.
export default function PageKeyboard({ ctx }: { ctx: Ctx }) {
  const { shell } = ctx;

  // The exam's subject picks Math or Physics keys until the teacher picks by hand; the studios, which do not know the exam, read it here.
  useEffect(() => setKeyboardSubject(shell.subject), [shell.subject]);

  const studioOpen = shell.graphStudio.open || shell.circuitStudio.open || shell.tableStudio.open || shell.mathGraphStudio.open || shell.chartStudio.open || shell.molecule.open || shell.moleculeLab.open;
  // The page follows the places typed in only while the page is the one in front (a studio follows its own).
  useEffect(() => (studioOpen ? undefined : trackTextFields("text")), [studioOpen]);
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      <KeyboardLauncher ctx={ctx} />
      {!studioOpen && keyboardState(shell).visible && <FloatingKeyboard target="page" onClose={() => shell.toggleMathKeyboard(false)} />}
    </div>
  );
}
