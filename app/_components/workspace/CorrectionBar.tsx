"use client";

import { useState } from "react";
import { ANSWER_COLOR, DEFAULT_SIZE } from "@/app/_lib/blockLayout";
import type { ExamMeta } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import { ColorGrid } from "../rich/FormatBar";

interface Props {
  meta: ExamMeta;
  onMeta: (patch: Partial<ExamMeta>, key?: string) => void;
}

const btn = "grid size-7 place-items-center rounded-md text-xs font-semibold text-ink transition-colors hover:bg-black/5";

// Shown on the correction sheet: color and size of all the written answers.
// (Single words can still be styled with the format bar while typing.)
export default function CorrectionBar({ meta, onMeta }: Props) {
  const t = useT();
  const [colors, setColors] = useState(false);
  const color = meta.answerColor ?? ANSWER_COLOR;
  const size = meta.answerSize ?? meta.fontSize ?? DEFAULT_SIZE;
  const setSize = (n: number) => onMeta({ answerSize: Math.max(9, Math.min(28, n)) }, "answerSize");

  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-emerald-200 bg-white/90 p-1 ps-2.5 shadow-[0_6px_20px_-6px_rgba(5,150,105,0.35)] backdrop-blur-md">
      <span className="text-xs font-semibold text-emerald-700">{t("Answers")}</span>
      <div className="relative">
        <button className={btn} onClick={() => setColors(!colors)} title={t("Color of the answers")}>
          <span className="size-4 rounded-full ring-1 ring-black/10" style={{ background: color }} />
        </button>
        {colors && (
          <div className="absolute top-full right-0 z-10 mt-1.5 w-[188px] rounded-lg border border-line bg-white p-2 shadow-lg">
            <ColorGrid
              value={meta.answerColor}
              autoLabel={t("Green")}
              onChange={(c) => {
                onMeta({ answerColor: c });
                setColors(false);
              }}
            />
          </div>
        )}
      </div>
      <div className="mx-0.5 h-4 w-px bg-line" />
      <button className={btn} onClick={() => setSize(size - 1)} title={t("Smaller")}>
        A−
      </button>
      <span className="w-6 text-center text-xs font-semibold tabular-nums" title={t("Size of the answers")}>
        {size}
      </span>
      <button className={btn} onClick={() => setSize(size + 1)} title={t("Bigger")}>
        A+
      </button>
    </div>
  );
}
