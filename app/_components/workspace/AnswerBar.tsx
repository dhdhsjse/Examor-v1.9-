"use client";

import { MAX_OPTIONS, addOrderItem, addPair, insertOption, reshuffle } from "@/app/_lib/blocks";
import type { EditField } from "@/app/_lib/editRegions";
import { isRtl } from "@/app/_lib/i18n";
import type { Lang, QuestionBlock } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";
import type { BlockPatch } from "@/app/_lib/useExam";

interface Props {
  block: QuestionBlock;
  lang: Lang;
  onPatch: (patch: BlockPatch, field: string) => void;
  onEdit: (field: EditField) => void; // start typing a text of the question on the page
}

const pointsInput =
  "w-12 rounded-md border border-emerald-200 bg-white px-1.5 py-0.5 text-end text-xs outline-none focus:border-emerald-400 disabled:opacity-60";
const addBtn =
  "shrink-0 rounded-md border border-dashed border-emerald-300 px-2 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:border-emerald-500 hover:bg-white";

// Small green bar under the selected question: its points, and adding options / statements / pairs / items right there on the page (an open
// question's sub-questions: SubQuestionButton). The right answers are set in the Properties panel.
export default function AnswerBar({ block: b, lang, onPatch, onEdit }: Props) {
  const ui = useT();
  const hasParts = b.type === "open" && !!b.parts?.length;

  // Add an item and start typing it on the page.
  const addOption = () => {
    if (b.type !== "mcq") return;
    onPatch(insertOption(b, b.options.length), "options");
    onEdit({ kind: "option", i: b.options.length });
  };
  const newPair = () => {
    if (b.type !== "match") return;
    onPatch(addPair(b), "pairs");
    onEdit({ kind: "left", i: b.pairs.length });
  };
  const newItem = () => {
    if (b.type !== "order") return;
    onPatch(addOrderItem(b), "items");
    onEdit({ kind: "item", i: b.items.length });
  };
  const addStatement = () => {
    if (b.type !== "truefalse") return;
    onPatch({ statements: [...b.statements, { text: "", answer: true }] }, "statements");
    onEdit({ kind: "statement", i: b.statements.length });
  };

  return (
    <div
      className="pointer-events-auto max-w-full self-start rounded-lg border border-emerald-200 bg-emerald-50/95 text-emerald-900 shadow-[0_8px_24px_-10px_rgba(5,150,105,0.45)] backdrop-blur"
      onMouseDown={(e) => e.stopPropagation()}
      dir={isRtl(lang) ? "rtl" : "ltr"}
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 empty:hidden">
          {(b.type === "match" || b.type === "order") && (
            <button
              className={addBtn}
              onClick={() => onPatch(reshuffle(b.type === "match" ? b.pairs.length : b.items.length), "order")}
              title={ui("Mix the printed order again")}
            >
              ⤨ {ui("Mix")}
            </button>
          )}
          {b.type === "match" && b.pairs.length < 12 && (
            <button className={addBtn} onClick={newPair} title={ui("Add a pair and type it on the page")}>
              + {ui("Pair")}
            </button>
          )}
          {b.type === "order" && b.style !== "sentence" && b.items.length < 12 && (
            <button className={addBtn} onClick={newItem} title={ui("Add an item and type it on the page")}>
              + {ui("Item")}
            </button>
          )}
          {b.type === "mcq" && b.options.length < MAX_OPTIONS && (
            <button className={addBtn} onClick={addOption} title={ui("Add an option and type it on the page")}>
              + {ui("Option")}
            </button>
          )}
          {b.type === "truefalse" && (
            <button className={addBtn} onClick={addStatement} title={ui("Add a statement and type it on the page")}>
              + {ui("Statement")}
            </button>
          )}
        </div>

        <label className="ms-auto flex shrink-0 items-center gap-1 text-xs" title={hasParts ? ui("Total of the sub-questions.") : ui("Points")}>
          <input
            type="number"
            min={0}
            step={0.25}
            value={b.points}
            disabled={hasParts}
            onChange={(e) => onPatch({ points: Math.max(0, Number(e.target.value) || 0) }, "points")}
            className={pointsInput}
          />
          {ui("pts")}
        </label>
      </div>

    </div>
  );
}

