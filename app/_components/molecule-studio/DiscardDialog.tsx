"use client";

import { useEffect } from "react";
import { useT } from "@/app/_lib/uiLang";

interface Props {
  onKeep: () => void;
  onDiscard: () => void;
}

// "Discard this drawing?": asked before the Studio closes with changes in it (Esc and the close button
// would otherwise throw a drawing away without a word). The safe answer is the default one.
export default function DiscardDialog({ onKeep, onDiscard }: Props) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onKeep();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKeep]);

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onKeep()}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="discard-title" aria-describedby="discard-text" data-testid="discard-dialog" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h3 id="discard-title" className="text-base font-semibold text-ink">
          {t("Discard this drawing?")}
        </h3>
        <p id="discard-text" className="mt-1.5 text-sm text-muted">
          {t("Your changes will be lost.")}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button autoFocus onClick={onKeep} data-testid="discard-keep" className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-strong">
            {t("Keep drawing")}
          </button>
          <button onClick={onDiscard} data-testid="discard-confirm" className="rounded-lg border border-line px-4 py-1.5 text-sm font-medium text-ink hover:bg-subtle">
            {t("Discard")}
          </button>
        </div>
      </div>
    </div>
  );
}
