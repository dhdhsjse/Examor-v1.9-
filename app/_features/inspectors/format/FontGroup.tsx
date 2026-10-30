"use client";

import { AArrowDown, AArrowUp, Baseline, Bold, CaseSensitive, ChevronDown, Eraser, Highlighter, Italic, Sparkles, Strikethrough, Subscript, Superscript, Underline } from "lucide-react";
import { useCallback, useRef, useState, type CSSProperties } from "react";
import { FontSelect } from "@/app/_components/rich/FormatBar";
import type { Ctx } from "@/app/_features/core/types";
import { DEFAULT_FONT, FILL_COLORS } from "@/app/_lib/fonts";
import { FONT_SIZES, MAX_SIZE, MIN_SIZE, stepSize } from "@/app/_lib/fontSizes";
import { EFFECT_CSS, type TextEffect, type UnderlineStyle } from "@/app/_lib/richText";
import type { CaseMode } from "@/app/_lib/textCase";
import type { T } from "@/app/_lib/uiLang";
import type { FormatTarget, StyleKey } from "./formatTarget";
import { ColorMenu, Divider, Menu, MenuButton, MenuItem, MenuSeparator, Popover, RibbonButton, RibbonGroup, RibbonRow, fieldCls, keepFocus } from "./ribbonUi";


const CASES: { mode: CaseMode; label: string }[] = [
  { mode: "sentence", label: "Sentence case" },
  { mode: "lower", label: "lowercase" },
  { mode: "upper", label: "UPPERCASE" },
  { mode: "title", label: "Capitalize Each Word" },
  { mode: "toggle", label: "tOGGLE cASE" },
];

const STYLES: { key: StyleKey; label: string; shortcut?: string; Icon: typeof Bold }[] = [
  { key: "bold", label: "Bold", shortcut: "Ctrl+B", Icon: Bold },
  { key: "italic", label: "Italic", shortcut: "Ctrl+I", Icon: Italic },
  { key: "strike", label: "Strikethrough", Icon: Strikethrough },
];

const UNDERLINES: { kind: UnderlineStyle | "single"; label: string }[] = [
  { kind: "single", label: "Single underline" },
  { kind: "double", label: "Double underline" },
  { kind: "dotted", label: "Dotted underline" },
  { kind: "dashed", label: "Dashed underline" },
  { kind: "wavy", label: "Wavy underline" },
];

const EFFECTS: { effect: TextEffect; label: string }[] = [
  { effect: "shadow", label: "Shadow" },
  { effect: "outline", label: "Outline" },
  { effect: "glow", label: "Glow" },
];

// The CSS of an effect as a style object of React ("webkitTextStroke" is "WebkitTextStroke" there).
const reactCss = (css: Partial<CSSStyleDeclaration>): CSSProperties => Object.fromEntries(Object.entries(css).map(([k, v]) => [k.replace(/^webkit/, "Webkit"), v])) as CSSProperties;

// Underline: the icon underlines (or takes it off), the arrow lists the kinds (each shown as it looks).
function UnderlineMenu({ t, target }: { t: T; target: FormatTarget }) {
  const current = target.style.underline ? (target.underlineStyle ?? "single") : null;
  return (
    <MenuButton title={t("Underline")} shortcut="Ctrl+U" icon={<Underline size={15} />} pressed={target.style.underline} onMain={() => target.toggle("underline")} width={236}>
      {(close) => (
        <Menu label={t("Underline")}>
          {UNDERLINES.map(({ kind, label }) => (
            <MenuItem
              key={kind}
              label={t(label)}
              labelStyle={{ textDecorationLine: "underline", textDecorationStyle: kind === "single" ? "solid" : kind }}
              checked={current === kind}
              disabled={!target.canUnderlineStyle}
              onSelect={() => {
                target.setUnderline(kind);
                close();
              }}
            />
          ))}
          <MenuSeparator />
          <MenuItem
            label={t("Remove underline")}
            disabled={!target.style.underline}
            onSelect={() => {
              target.toggle("underline");
              close();
            }}
          />
        </Menu>
      )}
    </MenuButton>
  );
}

// Word's "Text effects": a shadow, an outline or a glow around the letters.
function EffectsMenu({ t, target }: { t: T; target: FormatTarget }) {
  return (
    <MenuButton title={t("Text effects")} icon={<Sparkles size={16} />} pressed={!!target.effect} disabled={!target.canEffect} width={200}>
      {(close) => (
        <Menu label={t("Text effects")}>
          {EFFECTS.map(({ effect, label }) => (
            <MenuItem
              key={effect}
              label={t(label)}
              labelStyle={{ ...reactCss(EFFECT_CSS[effect]), fontWeight: 600 }}
              checked={target.effect === effect}
              onSelect={() => {
                target.setEffect(target.effect === effect ? undefined : effect);
                close();
              }}
            />
          ))}
          <MenuSeparator />
          <MenuItem
            label={t("No effect")}
            disabled={!target.effect}
            onSelect={() => {
              target.setEffect(undefined);
              close();
            }}
          />
        </Menu>
      )}
    </MenuButton>
  );
}

// Word's size box: type a size (Enter or leaving the box applies it; arrow keys change it by 1), pick one of the usual
// sizes from its list.
function SizeCombo({ t, target }: { t: T; target: FormatTarget }) {
  const size = Math.round(target.size * 10) / 10;
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const set = (v: number) => {
    setDraft(null);
    if (Number.isFinite(v) && v > 0) target.setSize(Math.max(MIN_SIZE, Math.min(Math.round(v), MAX_SIZE)));
  };
  return (
    <div ref={anchor} className="flex h-7 flex-none items-center rounded-md border border-line bg-white focus-within:border-indigo-400">
      <input
        type="text"
        inputMode="numeric"
        value={draft ?? String(size)}
        title={t("Font size")}
        aria-label={t("Font size")}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== null && set(Number(draft.replace(",", ".")))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && draft !== null) set(Number(draft.replace(",", ".")));
          else if (e.key === "Escape") setDraft(null);
          else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            set(size + (e.key === "ArrowUp" ? 1 : -1));
          }
        }}
        className="h-full w-9 rounded-s-md bg-transparent text-center text-[12.5px] text-ink tabular-nums outline-none"
      />
      <button type="button" tabIndex={-1} aria-label={t("Font size")} aria-haspopup="listbox" aria-expanded={open} onMouseDown={keepFocus} onClick={() => setOpen((o) => !o)} className="grid h-full w-5 place-items-center rounded-e-md text-muted hover:bg-subtle">
        <ChevronDown size={12} />
      </button>
      {open && (
        <Popover anchor={anchor} onClose={close} width={64}>
          <ul role="listbox" aria-label={t("Font size")}>
            {FONT_SIZES.map((s) => (
              <li key={s} role="option" aria-selected={s === size}>
                <button
                  type="button"
                  onMouseDown={keepFocus}
                  onClick={() => {
                    set(s);
                    close();
                  }}
                  className={`w-full rounded px-2 py-1 text-center text-[13px] tabular-nums hover:bg-subtle ${s === size ? "font-semibold text-accent" : "text-ink"}`}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </Popover>
      )}
    </div>
  );
}

// Font, size, style, color: the "Font" group of the Word ribbon.
export default function FontGroup({ ctx, target }: { ctx: Ctx; target: FormatTarget }) {
  const { t, doc } = ctx;
  return (
    <RibbonGroup title={t("Font")}>
      <RibbonRow className="gap-1">
        {/* (the font has a line of its own when the panel is narrow) */}
        <div className="min-w-0 flex-1 basis-[7.5rem]">
          <FontSelect value={target.family} onChange={target.setFamily} defaultLabel={`${t("Exam font")} (${doc.meta.fontFamily ?? DEFAULT_FONT})`} className={fieldCls} />
        </div>
        <SizeCombo t={t} target={target} />
        <RibbonButton title={t("Bigger")} shortcut="Ctrl+Shift+>" icon={<AArrowUp size={16} />} disabled={target.size >= MAX_SIZE} onClick={() => target.setSize(stepSize(target.size, true))} />
        <RibbonButton title={t("Smaller")} shortcut="Ctrl+Shift+<" icon={<AArrowDown size={16} />} disabled={target.size <= MIN_SIZE} onClick={() => target.setSize(stepSize(target.size, false))} />
      </RibbonRow>

      <RibbonRow>
        {STYLES.slice(0, 2).map(({ key, label, shortcut, Icon }) => (
          <RibbonButton key={key} title={t(label)} shortcut={shortcut} icon={<Icon size={15} />} pressed={target.style[key]} onClick={() => target.toggle(key)} />
        ))}
        <UnderlineMenu t={t} target={target} />
        {STYLES.slice(2).map(({ key, label, shortcut, Icon }) => (
          <RibbonButton key={key} title={t(label)} shortcut={shortcut} icon={<Icon size={15} />} pressed={target.style[key]} onClick={() => target.toggle(key)} />
        ))}
        <Divider />
        <RibbonButton title={t("Subscript")} shortcut="Ctrl+," icon={<Subscript size={15} />} pressed={target.script === "sub"} disabled={!target.canScript} onClick={() => target.toggleScript("sub")} />
        <RibbonButton title={t("Superscript")} shortcut="Ctrl+." icon={<Superscript size={15} />} pressed={target.script === "sup"} disabled={!target.canScript} onClick={() => target.toggleScript("sup")} />
      </RibbonRow>

      <RibbonRow>
        <MenuButton title={t("Change case")} shortcut="Shift+F3" icon={<CaseSensitive size={17} />} disabled={!target.canChangeCase}>
          {(close) => (
            <Menu label={t("Change case")}>
              {CASES.map(({ mode, label }) => (
                <MenuItem
                  key={mode}
                  label={t(label)}
                  onSelect={() => {
                    target.changeCase(mode);
                    close();
                  }}
                />
              ))}
            </Menu>
          )}
        </MenuButton>
        <RibbonButton title={t("Clear all formatting")} shortcut="Ctrl+Space" icon={<Eraser size={15} />} onClick={target.clearFormatting} />
        <Divider />
        <ColorMenu
          title={t("Highlight color")}
          icon={<Highlighter size={15} />}
          value={target.highlight}
          initial="#fef08a"
          autoLabel={t("None")}
          colors={FILL_COLORS}
          disabled={!target.canHighlight}
          toggle
          onChange={target.setHighlight}
        />
        <ColorMenu title={t("Text color")} icon={<Baseline size={15} />} value={target.colorSet} initial="#dc2626" autoLabel={t("Auto")} onChange={target.setColor} />
        <Divider />
        <EffectsMenu t={t} target={target} />
      </RibbonRow>
    </RibbonGroup>
  );
}
