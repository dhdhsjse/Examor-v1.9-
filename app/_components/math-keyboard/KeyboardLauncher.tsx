"use client";

import { Keyboard } from "lucide-react";
import type { Ctx } from "@/app/_features/core/types";
import { keyboardState, toggleKeyboard } from "./keyboardState";

// The button on the canvas that shows / hides the math keyboard. It sits above the tool bar and the zoom bar
// (bottom-right of the pages), the same frosted look.
export default function KeyboardLauncher({ ctx }: { ctx: Ctx }) {
  const { visible } = keyboardState(ctx.shell);
  const text = visible ? ctx.t("Hide math keyboard") : ctx.t("Show math keyboard");
  return (
    <div className="pointer-events-auto absolute right-4 bottom-16 rounded-lg border border-white/70 bg-white/80 p-1 shadow-[0_6px_20px_-6px_rgba(16,24,40,0.25)] backdrop-blur-md">
      <button
        type="button"
        onClick={() => toggleKeyboard(ctx)}
        title={text}
        aria-label={text}
        aria-pressed={visible}
        className={`grid size-7 place-items-center rounded-md transition-colors ${
          visible ? "bg-indigo-600 text-white shadow-sm" : "text-muted hover:bg-black/5 hover:text-ink"
        }`}
      >
        <Keyboard size={16} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}
