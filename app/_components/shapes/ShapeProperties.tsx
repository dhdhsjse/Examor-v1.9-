"use client";

import { AlignCenter, AlignLeft, AlignRight, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd, AlignVerticalJustifyStart, ArrowDown, ArrowUp, Bold, BringToFront, Copy, FlipHorizontal2, FlipVertical2, Italic, SendToBack, Trash2, type LucideIcon } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { FILL_COLORS, TEXT_COLORS } from "@/app/_lib/fonts";
import { DEFAULT_FONT_SIZE, DEFAULT_STROKE, DEFAULT_TEXT_COLOR, MIN_SHAPE_SIZE, isLine, resolveStyle, shapeDef, type DashKind, type Order, type ShapeStyle, type ShapeTextAlign, type ShapeVAlign } from "@/app/_lib/shapes";
import { useT } from "@/app/_lib/uiLang";
import { ShapesMenuButton, ShapeThumb } from "./ShapeGallery";

const input = "w-full rounded-lg border border-line bg-subtle px-2.5 py-1.5 text-sm text-ink outline-none focus:border-accent";
const PALETTE = [...TEXT_COLORS, "#ffffff", ...FILL_COLORS];

function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-2.5 border-b border-line px-4 py-3.5 last:border-b-0">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-faint">{title}</h4>
      {children}
    </section>
  );
}

function IconToggle({ icon: Icon, label, pressed, disabled, onClick, testId }: { icon: LucideIcon; label: string; pressed?: boolean; disabled?: boolean; onClick: () => void; testId?: string }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      data-testid={testId}
      onClick={onClick}
      className={`grid size-8 place-items-center rounded-lg border transition-colors disabled:opacity-40 ${pressed ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-white text-muted enabled:hover:border-accent enabled:hover:text-ink"}`}
    >
      <Icon size={15} />
    </button>
  );
}

// A number the teacher types: what is typed is theirs while the field has the focus, and what is valid goes to the shape as it is typed.
function NumberInput({ label, value, min, max, step = 1, onCommit, testId }: { label: string; value: number; min: number; max: number; step?: number; onCommit: (n: number) => void; testId: string }) {
  const id = useId();
  const [text, setText] = useState<string | null>(null);
  const n = Number((text ?? "").replace(",", "."));
  const bad = text !== null && (text.trim() === "" || !Number.isFinite(n) || n < min || n > max);
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={text ?? String(Math.round(value * 100) / 100)}
        data-testid={testId}
        aria-invalid={bad || undefined}
        onFocus={(e) => {
          setText(String(Math.round(value * 100) / 100));
          e.target.select();
        }}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value.replace(",", "."));
          if (e.target.value.trim() !== "" && Number.isFinite(v) && v >= min && v <= max) onCommit(v);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            const v = Math.min(max, Math.max(min, value + (e.key === "ArrowUp" ? step : -step)));
            setText(String(v));
            onCommit(v);
          }
        }}
        onBlur={() => setText(null)}
        className={`${input} tabular-nums ${bad ? "border-red-400" : ""}`}
      />
    </div>
  );
}

// A color: swatches, a free choice, and (when it can be left out) "none".
function ColorRow({ label, value, none, onChange, testId }: { label: string; value: string | null; none?: string; onChange: (c: string | null) => void; testId: string }) {
  const t = useT();
  return (
    <div data-testid={testId} className="flex flex-col gap-1.5">
      <div className="flex items-center justify-end">
        <span className="sr-only">{label}</span>
        {none !== undefined && (
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={value === null} onChange={(e) => onChange(e.target.checked ? null : (PALETTE[0] as string))} data-testid={`${testId}-none`} />
            {none}
          </label>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            aria-label={`${label} ${c}`}
            aria-pressed={value === c}
            onClick={() => onChange(c)}
            style={{ background: c }}
            className={`size-5 rounded border ${value === c ? "ring-2 ring-accent ring-offset-1" : "border-line"}`}
          />
        ))}
        <input type="color" aria-label={`${label}: ${t("Color")}`} value={/^#[0-9a-f]{6}$/i.test(value ?? "") ? (value as string) : "#ffffff"} onChange={(e) => onChange(e.target.value)} className="size-6 cursor-pointer rounded border border-line bg-white p-0" />
      </div>
    </div>
  );
}

type Geometry = { x: number; y: number; w: number; h: number; rotation?: number };
export type ShapeFields = ShapeStyle & Partial<Geometry>;

type Props = {
  item: ShapeFields;
  onChange: (patch: Partial<ShapeFields>) => void;
  /** Shows where it is, how big and how turned (a Studio's shape; on the page a block has its own handles) */
  geometry?: boolean;
  /** Only the size, in `item.w` and `item.h` (a block on the page: it has its own place) */
  size?: boolean;
  /** Put the shape in front of or behind the others (a Studio's shapes are stacked) */
  onOrder?: (order: Order) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
};

// The properties of a selected shape, in the right panel of a Studio and in the page editor's: which shape, its fill and outline,
// its text, and (in a Studio) where it is and how it is stacked. `onChange` gets only what changed.
export default function ShapeProperties({ item, onChange, geometry, size, onOrder, onDuplicate, onDelete }: Props) {
  const t = useT();
  const def = shapeDef(item.shape);
  const line = isLine(item);
  const { stroke, strokeWidth } = resolveStyle(item);
  const align: ShapeTextAlign = item.textAlign ?? "center";
  const valign: ShapeVAlign = item.textVAlign ?? "middle";
  const dashes: { value: DashKind; label: string }[] = [
    { value: "solid", label: t("Solid line") },
    { value: "dashed", label: t("Dashed line") },
    { value: "dotted", label: t("Dotted line") },
  ];

  return (
    <div data-testid="shape-properties">
      <Section title={t("Shape")}>
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg border border-line bg-subtle">
            <ShapeThumb shape={item.shape} size={30} />
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{t(def.label)}</span>
        </div>
        <ShapesMenuButton current={item.shape} testId="shape-change" onPick={(shape) => onChange({ shape, adj: undefined })} />
      </Section>

      {!line && (
        <Section title={t("Fill")}>
          <ColorRow label={t("Fill")} value={item.fill ?? null} none={t("No fill")} onChange={(fill) => onChange({ fill })} testId="shape-fill" />
        </Section>
      )}

      <Section title={t("Shape outline")}>
        <ColorRow label={t("Shape outline")} value={stroke} none={line ? undefined : t("No outline")} onChange={(c) => onChange({ stroke: c })} testId="shape-stroke" />
        <div className="flex gap-2.5">
          <NumberInput label={t("Outline width")} value={strokeWidth} min={0.5} max={24} step={0.5} onCommit={(strokeWidth) => onChange({ strokeWidth })} testId="shape-stroke-width" />
          <div className="flex min-w-0 flex-[1.4] flex-col gap-1">
            <label className="text-xs text-muted" htmlFor="shape-dash">
              {t("Line style")}
            </label>
            <select id="shape-dash" value={item.dash ?? "solid"} data-testid="shape-dash" onChange={(e) => onChange({ dash: e.target.value === "solid" ? undefined : (e.target.value as DashKind) })} className={input}>
              {dashes.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      {!line && (
        <Section title={t("Text in the shape")}>
          <textarea
            value={item.text ?? ""}
            rows={3}
            onChange={(e) => onChange({ text: e.target.value || undefined })}
            placeholder={t("Type the text of the shape")}
            aria-label={t("Text in the shape")}
            data-testid="shape-text"
            className={`${input} resize-y`}
          />
          <div className="flex items-end gap-2.5">
            <NumberInput label={t("Font size")} value={item.fontSize ?? DEFAULT_FONT_SIZE} min={6} max={120} onCommit={(fontSize) => onChange({ fontSize })} testId="shape-font-size" />
            <ColorSwatch label={t("Text color")} value={item.textColor ?? DEFAULT_TEXT_COLOR} onChange={(textColor) => onChange({ textColor })} />
          </div>
          <div className="flex flex-wrap gap-1">
            <IconToggle icon={Bold} label={t("Bold text")} pressed={!!item.bold} onClick={() => onChange({ bold: !item.bold || undefined })} testId="shape-bold" />
            <IconToggle icon={Italic} label={t("Italic")} pressed={!!item.italic} onClick={() => onChange({ italic: !item.italic || undefined })} testId="shape-italic" />
            <span className="mx-1 w-px self-stretch bg-line" aria-hidden />
            <IconToggle icon={AlignLeft} label={t("Align text left")} pressed={align === "left"} onClick={() => onChange({ textAlign: "left" })} />
            <IconToggle icon={AlignCenter} label={t("Center text")} pressed={align === "center"} onClick={() => onChange({ textAlign: undefined })} />
            <IconToggle icon={AlignRight} label={t("Align text right")} pressed={align === "right"} onClick={() => onChange({ textAlign: "right" })} />
            <span className="mx-1 w-px self-stretch bg-line" aria-hidden />
            <IconToggle icon={AlignVerticalJustifyStart} label={t("Align text to the top")} pressed={valign === "top"} onClick={() => onChange({ textVAlign: "top" })} />
            <IconToggle icon={AlignVerticalJustifyCenter} label={t("Center text vertically")} pressed={valign === "middle"} onClick={() => onChange({ textVAlign: undefined })} />
            <IconToggle icon={AlignVerticalJustifyEnd} label={t("Align text to the bottom")} pressed={valign === "bottom"} onClick={() => onChange({ textVAlign: "bottom" })} />
          </div>
        </Section>
      )}

      <Section title={t("Arrange")}>
        <div className="flex flex-wrap gap-1">
          <IconToggle icon={FlipHorizontal2} label={t("Flip horizontally")} pressed={!!item.flipX} onClick={() => onChange({ flipX: !item.flipX || undefined })} testId="shape-flip-x" />
          <IconToggle icon={FlipVertical2} label={t("Flip vertically")} pressed={!!item.flipY} onClick={() => onChange({ flipY: !item.flipY || undefined })} testId="shape-flip-y" />
          {onOrder && (
            <>
              <span className="mx-1 w-px self-stretch bg-line" aria-hidden />
              <IconToggle icon={BringToFront} label={t("Bring to front")} onClick={() => onOrder("front")} testId="shape-front" />
              <IconToggle icon={ArrowUp} label={t("Bring forward")} onClick={() => onOrder("forward")} testId="shape-forward" />
              <IconToggle icon={ArrowDown} label={t("Send backward")} onClick={() => onOrder("backward")} testId="shape-backward" />
              <IconToggle icon={SendToBack} label={t("Send to back")} onClick={() => onOrder("back")} testId="shape-back" />
            </>
          )}
        </div>
        {geometry && item.w !== undefined && item.h !== undefined && item.x !== undefined && item.y !== undefined && (
          <>
            <div className="flex gap-2.5">
              <NumberInput label="X" value={item.x} min={-5000} max={5000} onCommit={(x) => onChange({ x })} testId="shape-x" />
              <NumberInput label="Y" value={item.y} min={-5000} max={5000} onCommit={(y) => onChange({ y })} testId="shape-y" />
            </div>
            <div className="flex gap-2.5">
              <NumberInput label={t("Width")} value={item.w} min={line ? 0 : MIN_SHAPE_SIZE} max={5000} onCommit={(w) => onChange({ w })} testId="shape-w" />
              <NumberInput label={t("Height")} value={item.h} min={line ? 0 : MIN_SHAPE_SIZE} max={5000} onCommit={(h) => onChange({ h })} testId="shape-h" />
              {!line && <NumberInput label={t("Rotation")} value={item.rotation ?? 0} min={-360} max={360} onCommit={(rotation) => onChange({ rotation: rotation % 360 || undefined })} testId="shape-rotation" />}
            </div>
          </>
        )}
        {!geometry && size && item.w !== undefined && item.h !== undefined && (
          <div className="flex gap-2.5">
            <NumberInput label={t("Width")} value={item.w} min={line ? 0 : MIN_SHAPE_SIZE} max={5000} onCommit={(w) => onChange({ w })} testId="shape-w" />
            <NumberInput label={t("Height")} value={item.h} min={line ? 0 : MIN_SHAPE_SIZE} max={5000} onCommit={(h) => onChange({ h })} testId="shape-h" />
          </div>
        )}
        {(onDuplicate || onDelete) && (
          <div className="flex gap-2">
            {onDuplicate && (
              <button type="button" onClick={onDuplicate} data-testid="shape-duplicate" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-ink hover:border-accent">
                <Copy size={14} />
                {t("Duplicate")}
              </button>
            )}
            {onDelete && (
              <button type="button" onClick={onDelete} data-testid="shape-delete" className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line bg-white px-2.5 py-1.5 text-sm text-red-600 hover:border-red-400">
                <Trash2 size={14} />
                {t("Delete")}
              </button>
            )}
          </div>
        )}
      </Section>
    </div>
  );
}

// A single color to pick (the text color): a button that opens the browser's color chooser.
function ColorSwatch({ label, value, onChange }: { label: string; value: string; onChange: (c: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <input id={id} type="color" value={/^#[0-9a-f]{6}$/i.test(value) ? value : DEFAULT_STROKE} onChange={(e) => onChange(e.target.value)} data-testid="shape-text-color" className="h-[34px] w-12 cursor-pointer rounded-lg border border-line bg-white p-0.5" />
    </div>
  );
}

