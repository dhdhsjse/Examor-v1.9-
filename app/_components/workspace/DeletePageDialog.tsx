"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";
import { useUi } from "@/app/_lib/uiLang";

interface Props {
  page: number; // 1 = first page
  blocks: number; // how many blocks the page holds
  onConfirm: () => void;
  onCancel: () => void;
}

// Warning before a page is deleted with everything on it. Cancel has the focus; Esc or a click outside cancels.
export default function DeletePageDialog({ page, blocks, onConfirm, onCancel }: Props) {
  const { t, rtl } = useUi();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-page-title"
        aria-describedby="delete-page-text"
        dir={rtl ? "rtl" : "ltr"}
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle size={20} strokeWidth={2} />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[11px] font-semibold tracking-wide text-amber-600 uppercase">{t("Warning")}</span>
            <h2 id="delete-page-title" className="text-base font-semibold text-ink">
              {t("Do you really want to delete page {n}?", { n: page })}
            </h2>
            <p id="delete-page-text" className="text-sm leading-snug text-muted">
              {blocks > 0 ? t("Everything on it ({n} blocks) will be deleted too.", { n: blocks }) : t("The page is empty.")}{" "}
              {t("You can undo it with Ctrl+Z.")}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-line bg-white px-3.5 py-2 text-sm font-medium text-ink transition-colors hover:bg-subtle"
          >
            {t("Cancel")}
          </button>
          <button type="button" onClick={onConfirm} className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700">
            {t("Delete page")}
          </button>
        </div>
      </div>
    </div>
  );
}
