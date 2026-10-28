"use client";

import { useState } from "react";
import { SYMBOL_GROUPS, codePoint, loadRecentSymbols, saveRecentSymbols, symbolsOf, withRecent } from "@/app/_lib/symbols";
import type { T } from "@/app/_lib/uiLang";
import { keepFocus } from "./ribbonUi";

// A group of symbols to click: each goes into the text being typed in, where the cursor is. The ones used last come first.
export default function SymbolPicker({ t, onPick, disabled }: { t: T; onPick: (symbol: string) => void; disabled?: boolean }) {
  const [group, setGroup] = useState(0);
  const [recent, setRecent] = useState<string[]>(loadRecentSymbols);
  const symbols = symbolsOf(SYMBOL_GROUPS[group]);
  const pick = (symbol: string) => {
    onPick(symbol);
    const next = withRecent(recent, symbol);
    setRecent(next);
    saveRecentSymbols(next);
  };
  const cell = (symbol: string, key: string) => (
    <button
      key={key}
      type="button"
      title={`${symbol}  ${codePoint(symbol)}`}
      aria-label={symbol}
      disabled={disabled}
      onMouseDown={keepFocus}
      onClick={() => pick(symbol)}
      className="grid size-7 place-items-center rounded-md border border-transparent text-[15px] text-ink transition-colors hover:border-indigo-200 hover:bg-indigo-50 disabled:opacity-35 disabled:hover:border-transparent disabled:hover:bg-transparent"
    >
      {symbol}
    </button>
  );
  return (
    <div className="flex flex-col gap-2 p-1.5">
      <select value={group} onChange={(e) => setGroup(Number(e.target.value))} aria-label={t("Symbols")} className="h-7 w-full rounded-md border border-line bg-white px-1.5 text-[12.5px] text-ink outline-none focus:border-indigo-400">
        {SYMBOL_GROUPS.map((g, i) => (
          <option key={g.name} value={i}>
            {t(g.name)}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-8 gap-0.5" dir="ltr" role="group" aria-label={t(SYMBOL_GROUPS[group].name)}>
        {symbols.map((s) => cell(s, s))}
      </div>
      {recent.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-line pt-1.5">
          <span className="text-[10px] font-semibold tracking-wide text-faint uppercase">{t("Recently used")}</span>
          <div className="grid grid-cols-8 gap-0.5" dir="ltr">
            {recent.map((s) => cell(s, `recent-${s}`))}
          </div>
        </div>
      )}
    </div>
  );
}
