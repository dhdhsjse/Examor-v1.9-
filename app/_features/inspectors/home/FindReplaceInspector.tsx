"use client";

import { CaseSensitive, ChevronDown, ChevronUp, Replace, ReplaceAll, Search, WholeWord } from "lucide-react";
import { useMemo, useState } from "react";
import type { Ctx } from "@/app/_features/core/types";
import { RibbonButton, RibbonGroup, RibbonRow, fieldCls } from "@/app/_features/inspectors/format/ribbonUi";
import { BLOCK_TYPE_NAMES } from "@/app/_lib/blocks";
import type { EditField } from "@/app/_lib/editRegions";
import { buildPattern, findAll, replaceAll, replaceOne, type FindOptions, type Match } from "@/app/_lib/findReplace";
import type { T } from "@/app/_lib/uiLang";

const SHOWN = 200; // matches listed (all of them are replaced)
const ACTION = "inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-2.5 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-line";

function fieldLabel(t: T, f: EditField): string {
  switch (f.kind) {
    case "text":
      return t("Text");
    case "option":
      return t("Option {n}", { n: f.i + 1 });
    case "statement":
      return t("Statement {n}", { n: f.i + 1 });
    case "fix":
      return t("Correction {n}", { n: f.i + 1 });
    case "content":
      return t("Sentence");
    case "context":
      return t("Context");
    case "answer":
      return t("Model answer");
    case "part":
      return t("Part {n}", { n: f.i + 1 });
    case "partAnswer":
      return t("Answer to part {n}", { n: f.i + 1 });
    case "left":
      return t("Left item {n}", { n: f.i + 1 });
    case "right":
      return t("Right item {n}", { n: f.i + 1 });
    case "item":
      return t("Item {n}", { n: f.i + 1 });
    case "group":
      return t("Group {n}", { n: f.i + 1 });
    case "cell":
      return t("Cell {r}, {c}", { r: f.r + 1, c: f.c + 1 });
    case "header":
      return t("Header");
  }
}

// Home → Find and replace, in the right panel: every text of the exam, the matches listed, a click on one goes to its block. It stays
// open while blocks are selected (Feature.followsSelection), and replaces one match or all of them (one undo step).
export default function FindReplaceInspector({ ctx }: { ctx: Ctx }) {
  const { t, doc, shell } = ctx;
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [opts, setOpts] = useState<FindOptions>({ matchCase: false, wholeWord: false });
  const [at, setAt] = useState(0); // the current match
  const matches = useMemo(() => findAll(doc.blocks, find, opts), [doc.blocks, find, opts]);
  const current = Math.min(at, Math.max(0, matches.length - 1));
  const blocks = new Set(matches.map((m) => m.blockId)).size;
  const typeOf = (id: string) => doc.blocks.find((b) => b.id === id);

  const go = (i: number) => {
    if (!matches.length) return;
    const next = (i + matches.length) % matches.length;
    setAt(next);
    shell.selectBlock(matches[next].blockId);
  };

  const replaceCurrent = () => {
    const m: Match | undefined = matches[current];
    const b = m && typeOf(m.blockId);
    const patch = m && b ? replaceOne(b, m, replace) : null;
    if (!m || !b || !patch) return;
    shell.updateBlock(b.id, patch, "replace");
    // (the next match comes to this place in the list; when the replacement is a match itself, it is the one after)
    if (buildPattern(find, opts)?.test(replace)) setAt(current + 1);
    shell.selectBlock(b.id);
  };

  const replaceEvery = () => {
    const { patches, count } = replaceAll(doc.blocks, find, opts, replace);
    if (!count) return;
    shell.updateBlocks(patches);
    shell.notify(t("{n} replaced", { n: count }));
  };

  const toggle = (key: keyof FindOptions) => setOpts((o) => ({ ...o, [key]: !o[key] }));

  return (
    <div className="flex flex-col gap-3">
      <RibbonGroup title={t("Find and replace")}>
        <div className="flex items-center gap-1.5">
          <Search size={15} className="flex-none text-muted" aria-hidden />
          <input
            type="text"
            autoFocus
            value={find}
            placeholder={t("Find")}
            aria-label={t("Find")}
            onChange={(e) => {
              setFind(e.target.value);
              setAt(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") go(current + (e.shiftKey ? -1 : 1));
            }}
            className={fieldCls}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Replace size={15} className="flex-none text-muted" aria-hidden />
          <input
            type="text"
            value={replace}
            placeholder={t("Replace with")}
            aria-label={t("Replace with")}
            onChange={(e) => setReplace(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") replaceCurrent();
            }}
            className={fieldCls}
          />
        </div>
        <RibbonRow>
          <RibbonButton title={t("Match case")} icon={<CaseSensitive size={16} />} pressed={opts.matchCase} onClick={() => toggle("matchCase")} />
          <RibbonButton title={t("Whole words only")} icon={<WholeWord size={16} />} pressed={opts.wholeWord} onClick={() => toggle("wholeWord")} />
          <span className="flex-1" />
          <RibbonButton title={t("Previous")} shortcut="Shift+Enter" icon={<ChevronUp size={16} />} disabled={!matches.length} onClick={() => go(current - 1)} />
          <RibbonButton title={t("Next")} shortcut="Enter" icon={<ChevronDown size={16} />} disabled={!matches.length} onClick={() => go(current + 1)} />
        </RibbonRow>
        <RibbonRow className="gap-1.5">
          <button type="button" disabled={!matches.length} onClick={replaceCurrent} className={ACTION}>
            <Replace size={15} />
            {t("Replace")}
          </button>
          <button type="button" disabled={!matches.length} onClick={replaceEvery} className={ACTION}>
            <ReplaceAll size={15} />
            {t("Replace all")}
          </button>
        </RibbonRow>
      </RibbonGroup>

      <p className="text-xs text-muted" aria-live="polite">
        {!find ? t("Type the words to find in all the texts of the exam.") : matches.length ? t("{n} found in {b} blocks", { n: matches.length, b: blocks }) : t("Nothing found")}
      </p>

      {matches.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label={t("Results")}>
          {matches.slice(0, SHOWN).map((m, i) => {
            const b = typeOf(m.blockId);
            const n = shell.numbers.get(m.blockId);
            return (
              <li key={`${m.blockId}:${m.fieldId}:${m.paragraph}:${m.index}`}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  className={`flex w-full flex-col gap-0.5 rounded-md border px-2 py-1.5 text-start transition-colors ${i === current ? "border-indigo-300 bg-indigo-50" : "border-line bg-white hover:border-indigo-200"}`}
                >
                  <span className="text-[10px] font-semibold tracking-wide text-muted uppercase">
                    {b ? t(BLOCK_TYPE_NAMES[b.type]) : ""}
                    {n ? ` ${n}` : ""} · {fieldLabel(t, m.field)}
                  </span>
                  <span className="text-[12.5px] leading-snug break-words text-ink">
                    {m.before}
                    <mark className="rounded-sm bg-yellow-200 px-px text-ink">{m.hit}</mark>
                    {m.after}
                  </span>
                </button>
              </li>
            );
          })}
          {matches.length > SHOWN && <li className="px-1 text-[11px] text-faint">{t("Only the first {n} are listed.", { n: SHOWN })}</li>}
        </ul>
      )}
    </div>
  );
}
