"use client";

import { ChevronDown, GraduationCap } from "lucide-react";
import { useT } from "@/app/_lib/uiLang";
import { Menu, MenuItem } from "./ui";

export type InsertKind = "drawing" | "student" | "answer" | "both";

interface Props {
  ready: boolean; // a molecule is chosen
  editing: boolean; // the molecule is already on the page
  changed: number; // parts the student version changes
  onInsert: (kind: InsertKind) => void;
  onUpdate: () => void;
}

// One clear way to finish: what will be put on the page is written next to the button, and the main button does
// the sensible thing (both versions as soon as something is hidden).
export default function InsertBar({ ready, editing, changed, onInsert, onUpdate }: Props) {
  const t = useT();
  const both = changed > 0;
  const summary = editing
    ? t("This molecule is already on the page.")
    : both
      ? t("Will insert the student version ({n} parts changed) and the answer key, one under the other.", { n: changed })
      : t("Will insert the drawing as you see it.");

  const primary = editing ? t("Update the molecule") : both ? t("Insert both versions") : t("Insert in the exam");
  const primaryKind: InsertKind = both ? "both" : "drawing";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white px-5 py-3">
      <p className="flex min-w-0 items-center gap-2 text-xs text-muted" data-testid="insert-summary">
        <GraduationCap size={15} className={both && !editing ? "text-accent" : "text-faint"} />
        <span>{summary}</span>
      </p>
      <div className="flex items-stretch">
        <button
          disabled={!ready}
          onClick={() => (editing ? onUpdate() : onInsert(primaryKind))}
          data-testid="insert-primary"
          className={`bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-40 ${editing ? "rounded-lg" : "rounded-s-lg"}`}
        >
          {primary}
        </button>
        {!editing && (
          <Menu
            align="end"
            up
            trigger={(open, toggle) => (
              <button
                disabled={!ready}
                onClick={toggle}
                aria-label={t("Other ways to insert")}
                aria-expanded={open}
                title={t("Other ways to insert")}
                className="h-full rounded-e-lg border-s border-white/30 bg-accent px-2.5 text-white transition-colors hover:bg-accent-strong disabled:opacity-40"
              >
                <ChevronDown size={16} />
              </button>
            )}
          >
            {(close) => (
              <>
                <MenuItem onClick={() => (onInsert("drawing"), close())} hint={t("as shown")}>
                  {t("Only this drawing")}
                </MenuItem>
                <MenuItem onClick={() => (onInsert("student"), close())}>{t("Student version only")}</MenuItem>
                <MenuItem onClick={() => (onInsert("answer"), close())}>{t("Answer key only")}</MenuItem>
                <MenuItem onClick={() => (onInsert("both"), close())}>{t("Both versions")}</MenuItem>
              </>
            )}
          </Menu>
        )}
      </div>
    </div>
  );
}
