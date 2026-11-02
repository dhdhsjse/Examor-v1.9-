"use client";

import { useEffect } from "react";
import type { Ctx } from "@/app/_features/core/types";
import { trackTextFields } from "./fieldTarget";
import FloatingKeyboard from "./FloatingKeyboard";
import { keyboardState } from "./keyboardState";
import { setKeyboardSubject } from "./keyboardStore";

// The math keyboard over the pages, while the teacher has it on (its button is in the tool bar, next to Select and Text). It types in
// the text last clicked in, or else the equation of the Properties panel; with neither, a key opens the selected block's text (or a new
// equation) and types there (shell.openForTyping). A studio that is open covers the page and has its own button
// and keyboard (StudioKeyboard), so this one steps aside then.
export default function PageKeyboard({ ctx }: { ctx: Ctx }) {
  const { shell } = ctx;

  // The exam's subject picks Math or Physics keys until the teacher picks by hand; the studios, which do not know the exam, read it here.
  useEffect(() => setKeyboardSubject(shell.subject), [shell.subject]);
  useEffect(() => trackTextFields(), []);

  const studioOpen = shell.graphStudio.open || shell.circuitStudio.open || shell.tableStudio.open || shell.molecule.open || shell.moleculeLab.open;
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {!studioOpen && keyboardState(shell).visible && <FloatingKeyboard where="page" onClose={() => shell.toggleMathKeyboard(false)} openTarget={shell.openForTyping} />}
    </div>
  );
}
