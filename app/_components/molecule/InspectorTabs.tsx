"use client";

import type { ReactNode } from "react";
import { FlaskConical, Pencil, Ruler, SlidersHorizontal } from "lucide-react";
import { useT } from "@/app/_lib/uiLang";
import { TAB_TEXT } from "@/app/_molecule/strings";

export type TabId = "display" | "exam" | "geometry" | "edit";

const TABS: { id: TabId; icon: ReactNode }[] = [
  { id: "display", icon: <SlidersHorizontal size={14} /> },
  { id: "exam", icon: <FlaskConical size={14} /> },
  { id: "geometry", icon: <Ruler size={14} /> },
  { id: "edit", icon: <Pencil size={14} /> },
];

interface Props {
  tab: TabId;
  onChange: (t: TabId) => void;
  atomLevel: boolean; // the current drawing is made of atoms and bonds (Exam, Geometry and Edit work on those)
  children: ReactNode;
}

// The right-hand panel shows one task at a time, so the teacher sees only the controls that matter for it.
export default function InspectorTabs({ tab, onChange, atomLevel, children }: Props) {
  const t = useT();
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="tablist" aria-label={t("Tools")} className="flex border-b border-line px-2 pt-2">
        {TABS.map((x) => {
          const off = !atomLevel && x.id !== "display";
          return (
            <button
              key={x.id}
              role="tab"
              aria-selected={tab === x.id}
              disabled={off}
              title={off ? t("Choose Developed, Skeletal, Lewis or Cram to use this") : t(TAB_TEXT[x.id].hint)}
              onClick={() => onChange(x.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-1 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${tab === x.id ? "border-accent text-accent-strong" : "border-transparent text-muted hover:text-ink"}`}
            >
              {x.icon}
              {t(TAB_TEXT[x.id].label)}
            </button>
          );
        })}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}
