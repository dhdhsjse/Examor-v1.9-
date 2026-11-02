"use client";

import { CornerDownRight, Plus } from "lucide-react";
import { partLabel } from "@/app/_lib/blockLayout";
import type { Lang, OpenBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";

interface Props {
  block: OpenBlock;
  number: number;
  lang: Lang;
  onAdd: () => void;
}

// Right under the selected open question, on the page: adds its next sub-question (named as it will be printed,
// "1b)") and starts typing it there.
export default function SubQuestionButton({ block: b, number, lang, onAdd }: Props) {
  const t = useT();
  const parts = b.parts ?? [];
  const next = partLabel({ ...b, parts: [...parts, { text: "", lines: 0, answer: "", points: 0 }] }, number, parts.length, lang);
  return (
    <button
      type="button"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={onAdd}
      title={t("Add a sub-question and type it on the page")}
      className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-dashed border-indigo-300 bg-white/95 py-1 ps-2 pe-3 text-xs font-semibold text-indigo-600 shadow-[0_6px_18px_-10px_rgba(79,70,229,0.6)] backdrop-blur transition-colors hover:border-solid hover:border-indigo-500 hover:bg-indigo-50"
    >
      <span className="grid size-4 place-items-center rounded-full bg-indigo-600 text-white">
        <Plus size={11} strokeWidth={3} aria-hidden />
      </span>
      {t("Sub-question")}
      {next && <span className="rounded bg-indigo-50 px-1 font-mono text-[11px] text-indigo-500">{next}</span>}
      {parts.length === 0 && (
        <span className="flex items-center gap-1 font-normal text-indigo-400">
          <CornerDownRight size={11} aria-hidden className="rtl:-scale-x-100" />
          {t("split it into 1a), 1b)…")}
        </span>
      )}
    </button>
  );
}
