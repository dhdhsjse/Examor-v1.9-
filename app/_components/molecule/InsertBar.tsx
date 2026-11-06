"use client";

import { useT } from "@/app/_lib/uiLang";

interface Props {
  ready: boolean; // a molecule is chosen
  editing: boolean; // the molecule is already on the page
  onInsert: () => void;
  onUpdate: () => void;
}

// The Insert button of the header: it puts the drawing on the page as it is (what was hidden stays hidden, blanks stay blank).
export default function InsertBar({ ready, editing, onInsert, onUpdate }: Props) {
  const t = useT();
  return (
    <button
      disabled={!ready}
      onClick={() => (editing ? onUpdate() : onInsert())}
      data-testid="insert-primary"
      className="h-7 shrink-0 rounded bg-accent px-3 text-xs font-medium text-white transition-colors outline-none hover:bg-accent-strong focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 disabled:opacity-40"
    >
      {editing ? t("Update the molecule") : t("Insert")}
    </button>
  );
}
