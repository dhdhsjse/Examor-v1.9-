"use client";

import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  AlignVerticalJustifyStart,
} from "lucide-react";
import { useT } from "@/app/_lib/uiLang";
import type { TableActions } from "./tableActions";

const seg = "flex h-7 min-w-0 flex-1 items-center rounded-[5px] bg-subtle p-0.5";
const segBtn = (on: boolean) =>
  `grid h-6 flex-1 place-items-center rounded-[4px] text-ink transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent ${on ? "bg-surface shadow-sm text-accent" : "hover:bg-hover"}`;

// "Ab" across, or turned to read from the top down (90) or from the bottom up (270), with an arrow the way it reads
function TurnIcon({ rot }: { rot: 0 | 90 | 270 }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden>
      <g transform={rot ? `rotate(${rot === 90 ? 90 : -90} 8 8)` : undefined}>
        <text x="8" y="9" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="currentColor" fontFamily="system-ui, sans-serif">
          Ab
        </text>
        <path d="M3 12.5h9m-2-2 2 2-2 2" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

// How the text sits in the selected cells (or in the whole table when none is selected), in the table's Properties: its alignment across
// and up and down, and the way it reads.
export default function TableStyleSection({
  actions,
  onWhole,
}: {
  actions: TableActions;
  /** Forget the selected cells: the look goes to the whole table */ onWhole: () => void;
}) {
  const t = useT();
  const align = actions.common("align");
  const valign = actions.common("valign") ?? "middle";
  const turned = actions.common("rot") ?? 0;

  return (
    <>
      <div className="-mb-1 flex min-h-5 items-center justify-between gap-2">
        <span className="text-xs text-muted">{t("Alignment")}</span>
        {actions.hasSelection && (
          <button
            type="button"
            onClick={onWhole}
            data-testid="table-style-whole"
            className="h-5 rounded-[4px] px-1 text-xs font-medium text-accent outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("Whole table")}
          </button>
        )}
      </div>

      <div className="flex gap-1.5">
        <div className={seg}>
          {(
            [
              ["left", "Align left", AlignLeft],
              ["center", "Center", AlignCenter],
              ["right", "Align right", AlignRight],
            ] as const
          ).map(([a, title, Icon]) => (
            <button
              key={a}
              type="button"
              onClick={() => actions.style({ align: align === a ? undefined : a })}
              aria-pressed={align === a}
              title={t(title)}
              aria-label={t(title)}
              className={segBtn(align === a)}
            >
              <Icon size={13} />
            </button>
          ))}
        </div>
        <div className={seg}>
          {(
            [
              ["top", "Align text to the top", AlignVerticalJustifyStart],
              ["middle", "Center text vertically", AlignVerticalJustifyCenter],
              ["bottom", "Align text to the bottom", AlignVerticalJustifyEnd],
            ] as const
          ).map(([v, title, Icon]) => (
            <button
              key={v}
              type="button"
              onClick={() => actions.style({ valign: v === "middle" ? undefined : v })}
              aria-pressed={valign === v}
              title={t(title)}
              aria-label={t(title)}
              className={segBtn(valign === v)}
            >
              <Icon size={13} />
            </button>
          ))}
        </div>
      </div>

      <div className="flex">
        <div className={seg}>
          {(
            [
              [0, "Text across"],
              [90, "Text from the top down"],
              [270, "Text from the bottom up"],
            ] as const
          ).map(([rot, title]) => (
            <button
              key={rot}
              type="button"
              onClick={() => actions.style({ rot: rot || undefined })}
              aria-pressed={turned === rot}
              title={t(title)}
              aria-label={t(title)}
              data-testid={`table-text-rot-${rot}`}
              className={segBtn(turned === rot)}
            >
              <TurnIcon rot={rot} />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
