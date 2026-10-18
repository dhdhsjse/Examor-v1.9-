"use client";

import { AlignCenter, AlignLeft, AlignRight, Bold, Files, FileText, Italic, Minus, Plus, Settings2 } from "lucide-react";
import { DEFAULT_SIZE } from "@/app/_lib/blockLayout";
import { editRegions, type EditField } from "@/app/_lib/editRegions";
import { chromeTextField, headerTemplateForStyle } from "@/app/_lib/onboarding/headerFooterLibrary";
import { applyStyle, decodeStyle, encodeStyle, plainText, styleAt, type RunStyle, type StylePatch } from "@/app/_lib/richText";
import type { Block, ExamMeta, HeaderFields, TextAlign } from "@/app/_lib/types";
import { useT } from "@/app/_lib/uiLang";

type DataFn = (data: Record<string, string>, b: Block) => Record<string, string>;

interface Props {
  block: Block; // a header/footer block of a page (meta.role)
  own: boolean; // its page has its own header/footer (not the document's)
  data: Record<string, string>; // its settings' texts and look (HeaderFooterConfig.data)
  editing: EditField | null; // the text being typed in on the page, if it is in this block
  meta: ExamMeta;
  onData: (fn: DataFn, key?: string) => void; // change its settings
  onScope: (to: "all" | "page") => void;
  onSettings: () => void; // Page layout → Header and footer, in the right panel
}

// The texts of the settings the bar changes: the one typed in on the page, else the header's title or
// the footer's line. `null` key: a footer filled in automatically (its look is `data.style`).
function targetOf(b: Block, editing: EditField | null, meta: ExamMeta): { keys: string[] | null; size: number; alignKey: string | null } {
  if (b.type === "header") {
    const keys = editing?.kind === "header" ? editing.keys : ["title"];
    const region = editRegions(b, 1, meta).find((r) => r.field.kind === "header" && r.field.keys.includes(keys[0]));
    return { keys, size: region?.spec.font.size ?? 18, alignKey: `align.${keys[0]}` };
  }
  const field = chromeTextField(b);
  const size = b.font?.size ?? DEFAULT_SIZE;
  if (b.meta?.role === "header") return { keys: field ? [field] : null, size, alignKey: null }; // logo / title lines: no alignment
  return { keys: field ? [field] : null, size, alignKey: "align" };
}

const btn = (on = false) =>
  `grid size-7 place-items-center rounded-md transition-colors disabled:opacity-35 ${on ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`;

// Floating bar under a page's header or footer (screen size): where it shows (every page, or only this
// one) and the look of its text. Changes go to its settings, so a header shown on every page changes on
// every page.
export default function ChromeBar({ block, own, data, editing, meta, onData, onScope, onSettings }: Props) {
  const t = useT();
  const target = targetOf(block, editing, meta);
  // The current text (with its styles) of a target key, for a header block or a text line.
  const textOf = (data: Record<string, string>, b: Block, k: string) =>
    data[k] ?? (b.type === "header" ? String(b.fields[k as keyof HeaderFields] ?? "") : b.type === "text" ? b.text : "");
  // The look of the target text as drawn (an automatic footer shows its `data.style` the same way).
  const shown = block.type === "header" ? String(block.fields[(target.keys?.[0] ?? "title") as keyof HeaderFields] ?? "") : block.type === "text" ? block.text : "";
  const current: RunStyle = styleAt(shown, 0, plainText(shown).length);

  // Style the whole of each target text (or, for an automatic footer, its look).
  const style = (patch: (st: RunStyle) => StylePatch, key?: string) =>
    onData((data, b) => {
      if (!target.keys) {
        const st = decodeStyle(data.style ?? "");
        const next = { ...st, ...patch(st) } as Record<string, unknown>;
        for (const k of Object.keys(next)) if (next[k] === null) delete next[k];
        const look = encodeStyle(next as RunStyle);
        return look ? { ...data, style: look } : Object.fromEntries(Object.entries(data).filter(([k]) => k !== "style"));
      }
      const out = { ...data };
      for (const k of target.keys) {
        const s = textOf(data, b, k);
        out[k] = applyStyle(s, 0, plainText(s).length, patch(styleAt(s, 0, plainText(s).length)));
      }
      return out;
    }, key);
  const size = current.size ?? target.size;
  const resize = (d: number) => style(() => ({ size: Math.max(8, Math.min(48, size + d)) }), `chrome-size-${block.id}`);
  const align = (a: TextAlign) => target.alignKey && onData((data) => ({ ...data, [target.alignKey!]: a }));
  const aligned = (target.alignKey ? data[target.alignKey] : undefined) as TextAlign | undefined;
  const role = block.meta?.role === "footer" ? "footer" : "header";
  const isTitle = block.type === "header" && !editing;
  const label = block.type === "header" && !isTitle ? fieldLabel(block.style, target.keys?.[0]) : isTitle ? "Exam title" : role === "footer" ? "Footer" : "Header";

  return (
    <div
      onMouseDown={(e) => e.preventDefault()} // keep the focus in the text being typed
      className="pointer-events-auto flex items-center gap-1 whitespace-nowrap rounded-lg bg-white p-1 text-xs shadow-lg ring-1 ring-black/10"
    >
      <div role="radiogroup" aria-label={t("Apply to")} className="flex rounded-md bg-slate-100 p-0.5">
        <button type="button" role="radio" aria-checked={!own} onClick={() => onScope("all")} title={t("Shown on every page that has no header/footer of its own")} className={`flex items-center gap-1 rounded px-2 py-1 ${!own ? "bg-white font-semibold text-ink shadow-sm" : "text-muted"}`}>
          <Files size={13} /> {t("All pages")}
        </button>
        <button type="button" role="radio" aria-checked={own} onClick={() => onScope("page")} title={t("Only on this page: later changes stay on it")} className={`flex items-center gap-1 rounded px-2 py-1 ${own ? "bg-white font-semibold text-ink shadow-sm" : "text-muted"}`}>
          <FileText size={13} /> {t("This page")}
        </button>
      </div>
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <span className="max-w-28 truncate px-1 text-[11px] text-muted" title={t(label)}>
        {t(label)}
      </span>
      <button type="button" onClick={() => resize(-1)} title={t("Smaller")} className={btn()}>
        <Minus size={14} />
      </button>
      <span className="w-6 text-center tabular-nums text-ink">{Math.round(size)}</span>
      <button type="button" onClick={() => resize(1)} title={t("Bigger")} className={btn()}>
        <Plus size={14} />
      </button>
      <button type="button" aria-pressed={!!current.b} onClick={() => style((st) => ({ b: st.b ? null : true }))} title={t("Bold")} className={btn(!!current.b)}>
        <Bold size={14} />
      </button>
      <button type="button" aria-pressed={!!current.i} onClick={() => style((st) => ({ i: st.i ? null : true }))} title={t("Italic")} className={btn(!!current.i)}>
        <Italic size={14} />
      </button>
      {target.alignKey && (
        <>
          <span className="mx-1 h-5 w-px bg-slate-200" />
          {(["left", "center", "right"] as const).map((a) => {
            const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
            return (
              <button key={a} type="button" aria-pressed={aligned === a} onClick={() => align(a)} title={t(a === "left" ? "Align left" : a === "center" ? "Center" : "Align right")} className={btn(aligned === a)}>
                <Icon size={14} />
              </button>
            );
          })}
        </>
      )}
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <button type="button" onClick={onSettings} title={t("Header and footer")} className={btn()}>
        <Settings2 size={14} />
      </button>
    </div>
  );
}

// The label of a field of the exam header (as in the right panel).
function fieldLabel(style: Parameters<typeof headerTemplateForStyle>[0], key: string | undefined): string {
  return headerTemplateForStyle(style).fields?.find((f) => f.key === key)?.label ?? "Header";
}
