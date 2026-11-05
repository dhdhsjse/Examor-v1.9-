"use client";

import { ChevronsUpDown, EyeOff, Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import InfoTip from "@/app/_components/InfoTip";
import { MAX_PAPER, MIN_PAPER, type GraphIssue } from "@/app/_lib/graph/grid";
import { useT } from "@/app/_lib/uiLang";

// The controls of the Graph Studio's panels. Settings sit in rounded grey groups, one row each: its name on the left, its control on the right (a
// white field with a hairline, a switch, a small menu). A text that is long to type is the one exception: its name is over it.
const control =
  "rounded-lg bg-white px-2.5 text-[13px] text-ink shadow-[0_0_0_1px_rgba(0,0,0,0.07)] outline-none transition-shadow duration-150 placeholder:text-faint focus:shadow-[0_0_0_2px_var(--color-accent,#4f46e5)]";
const bad = "shadow-[0_0_0_2px_#f87171]!";
// A number as it is written in a field, without the noise a computation leaves (4.800000000000001 → 4.8)
const written = (n: number) => String(Number(n.toPrecision(10)));

/** What a refused change says, as an interface text (`t` of the Studio). */
export function issueText(issue: GraphIssue, t: (s: string, v?: Record<string, string | number>) => string, limits?: { min: number; max: number }): string {
  switch (issue) {
    case "x-range":
    case "y-range":
      return t("The minimum must be less than the maximum.");
    case "major-step":
    case "minor-step":
      return t("The step must be greater than zero.");
    case "size":
      return t("The paper must be between {min} and {max} px.", { min: limits?.min ?? 0, max: limits?.max ?? 0 });
    case "dense-major":
      return t("The main steps are too fine: their lines are left out.");
    case "dense-minor":
      return t("The fine steps are too fine: their lines are left out.");
    case "minor-larger":
      return t("The fine step is larger than the main step.");
  }
}

/** A rounded grey group of rows */
export function Group({ children, className = "", role, label }: { children: ReactNode; className?: string; role?: "listbox"; label?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl bg-subtle ${className}`}>
      <div role={role} aria-label={label} className="flex flex-col divide-y divide-line/70">
        {children}
      </div>
    </div>
  );
}

/** One row of a group: its name and its control; `info` explains it in a bubble, `stacked` puts the control under the name */
export function Row({ label, htmlFor, title, info, stacked = false, children }: { label: ReactNode; htmlFor?: string; title?: string; info?: string; stacked?: boolean; children: ReactNode }) {
  const t = useT();
  const name = (
    <span className="flex min-w-0 items-center gap-1.5">
      <label htmlFor={htmlFor} title={title} className={`min-w-0 text-[13px] leading-snug tracking-[-0.01em] ${stacked ? "text-muted" : "text-ink"}`}>
        {label}
      </label>
      {info && <InfoTip label={t("More info")} text={info} />}
    </span>
  );
  return stacked ? (
    <div className="flex flex-col gap-1.5 px-3.5 py-2.5">
      {name}
      {children}
    </div>
  ) : (
    <div className="flex min-h-10 items-center justify-between gap-3 px-3.5 py-1.5">
      {name}
      <div className="flex shrink-0 flex-col items-end gap-0.5">{children}</div>
    </div>
  );
}

const ErrorText = ({ id, children }: { id: string; children: ReactNode }) => (
  <p role="alert" data-testid={`${id}-error`} className="max-w-48 text-end text-[11px] leading-snug text-red-600">
    {children}
  </p>
);

// A number the teacher types: the text is theirs while the field has the focus (so "-", "0." or "1e" can be typed on the way
// to a number), and the value of the Studio otherwise. A number is given to `onCommit` as it is typed; when the Studio refuses
// it (it would make the paper impossible to draw) the reason is shown under the field and the paper keeps its last good state.
// `compact`: only the field (a cell of a table).
export function NumberField({ label, value, onCommit, testId, compact = false, title }: { label: string; value: number; onCommit: (n: number) => GraphIssue | null; testId: string; compact?: boolean; title?: string }) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState<string | null>(null); // null = not being typed in
  const [error, setError] = useState<string | null>(null);

  const change = (raw: string) => {
    setText(raw);
    const n = Number(raw.replace(",", "."));
    if (raw.trim() === "" || !Number.isFinite(n)) return setError(t("Enter a number."));
    const issue = onCommit(n);
    setError(issue ? issueText(issue, t, { min: MIN_PAPER, max: MAX_PAPER }) : null);
  };

  const field = (
    <input
      id={id}
      type="text"
      inputMode="decimal"
      value={text ?? written(value)}
      onFocus={() => setText(written(value))}
      onChange={(e) => change(e.target.value)}
      onBlur={() => {
        setText(null);
        setError(null);
      }}
      title={title}
      dir="ltr"
      aria-invalid={error ? true : undefined}
      data-testid={testId}
      className={`${control} h-8 tabular-nums ${compact ? "w-full" : "w-24 text-end"} ${error ? bad : ""}`}
    />
  );
  if (compact) {
    return (
      <div className="flex flex-col gap-1">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        {field}
        {error && <ErrorText id={testId}>{error}</ErrorText>}
      </div>
    );
  }
  return (
    <Row label={label} htmlFor={id} title={title}>
      {field}
      {error && <ErrorText id={testId}>{error}</ErrorText>}
    </Row>
  );
}

// A number that may also be left empty (the limits of a curve: empty = as far as the paper goes). Typing a number gives it to
// `onCommit`, emptying the field gives it undefined.
export function OptionalNumberField({ label, value, onCommit, testId, placeholder }: { label: string; value: number | undefined; onCommit: (n: number | undefined) => void; testId: string; placeholder?: string }) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const change = (raw: string) => {
    setText(raw);
    if (raw.trim() === "") {
      setError(null);
      return onCommit(undefined);
    }
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return setError(t("Enter a number."));
    setError(null);
    onCommit(n);
  };

  return (
    <Row label={label} htmlFor={id}>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={text ?? (value === undefined ? "" : written(value))}
        placeholder={placeholder}
        onFocus={() => setText(value === undefined ? "" : written(value))}
        onChange={(e) => change(e.target.value)}
        onBlur={() => {
          setText(null);
          setError(null);
        }}
        dir="ltr"
        aria-invalid={error ? true : undefined}
        data-testid={testId}
        className={`${control} h-8 w-24 text-end tabular-nums ${error ? bad : ""}`}
      />
      {error && <ErrorText id={testId}>{error}</ErrorText>}
    </Row>
  );
}

// `keyboard="formula"`: a formula the Studio reads (y = f(x)), so the math keyboard types "√(x)" and "x^2" there, not label markup. `hint`: how to write it,
// in a bubble.
export function TextField({ label, value, onChange, testId, hint, keyboard }: { label: string; value: string; onChange: (s: string) => void; testId: string; hint?: string; keyboard?: "formula" }) {
  const id = useId();
  return (
    <Row label={label} htmlFor={id} info={hint} stacked>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} data-keyboard={keyboard} className={`${control} h-9 w-full`} />
    </Row>
  );
}

// A choice between a few things, as a small menu (the labels are already in the app's language).
export function SelectField({ label, value, options, onChange, testId, title }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; testId: string; title?: string }) {
  const id = useId();
  return (
    <Row label={label} htmlFor={id} title={title}>
      <span className="relative">
        <select id={id} value={value} title={title} onChange={(e) => onChange(e.target.value)} data-testid={testId} className={`${control} h-8 w-36 max-w-full cursor-pointer appearance-none pe-7`}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronsUpDown size={13} strokeWidth={2} aria-hidden className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-muted" />
      </span>
    </Row>
  );
}

/** An on/off setting: its name and a switch */
export function SwitchRow({ label, checked, onChange, testId, title }: { label: string; checked: boolean; onChange: (v: boolean) => void; testId: string; title?: string }) {
  const id = useId();
  return (
    <Row label={label} htmlFor={id} title={title}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        data-testid={testId}
        className="relative h-[22px] w-[38px] shrink-0 cursor-pointer appearance-none rounded-full bg-slate-300 transition-colors duration-200 outline-none before:absolute before:top-[2px] before:left-[2px] before:size-[18px] before:rounded-full before:bg-white before:shadow before:transition-transform before:duration-200 before:content-[''] checked:bg-emerald-500 checked:before:translate-x-[16px] focus-visible:ring-2 focus-visible:ring-accent rtl:before:right-[2px] rtl:before:left-auto rtl:checked:before:-translate-x-[16px]"
      />
    </Row>
  );
}

/** A colour: its name and a round swatch that opens the colour picker */
export function ColorRow({ label, value, onChange, testId }: { label: string; value: string; onChange: (v: string) => void; testId: string }) {
  const id = useId();
  return (
    <Row label={label} htmlFor={id}>
      <input
        id={id}
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testId}
        className="size-7 cursor-pointer appearance-none rounded-full border-0 bg-transparent p-0 [&::-webkit-color-swatch]:rounded-full [&::-webkit-color-swatch]:border [&::-webkit-color-swatch]:border-black/15 [&::-webkit-color-swatch-wrapper]:p-0"
      />
    </Row>
  );
}

/** A warning: amber, with a "!" in front (what is wrong with the selected thing, a setting that makes the paper impossible to draw) */
export function Notice({ children, testId }: { children: ReactNode; testId?: string }) {
  return (
    <p role="status" data-testid={testId} className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
      <span className="grid size-4 shrink-0 place-items-center rounded-full bg-amber-600 text-[10px] font-bold text-white">!</span>
      {children}
    </p>
  );
}

/** The red button that takes the selected thing off the paper */
export function DeleteButton({ label, onClick, testId }: { label: string; onClick: () => void; testId: string }) {
  return (
    <button
      onClick={onClick}
      data-testid={testId}
      className="flex h-9 w-full items-center justify-center gap-2 rounded-xl bg-subtle text-[13px] font-medium tracking-[-0.01em] text-red-600 transition-[transform,background-color] duration-100 ease-out outline-none hover:bg-red-50 focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.98]"
    >
      <Trash2 size={14} />
      {label}
    </button>
  );
}

/** One line of a list the teacher picks from (a curve, an annotation): the one picked is white and bold; `color` puts its colour in front; `hidden` shows the
 * crossed eye (the students do not see it); `attrs` says which one it is (`data-curve`, `data-annotation`). */
export function PickRow({ on, onPick, color, hidden = false, attrs, children }: { on: boolean; onPick: () => void; color?: string; hidden?: boolean; attrs: Record<`data-${string}`, string>; children: ReactNode }) {
  const t = useT();
  return (
    <button
      role="option"
      aria-selected={on}
      onClick={onPick}
      {...attrs}
      className={`flex min-h-10 w-full items-center gap-2.5 px-3.5 py-2 text-start text-[13px] tracking-[-0.01em] transition-colors outline-none focus-visible:bg-white ${on ? "bg-accent-soft font-semibold text-accent-strong" : "text-ink hover:bg-hover"}`}
    >
      {color && <span className="size-3 shrink-0 rounded-full ring-1 ring-black/15" style={{ background: color }} />}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hidden && <EyeOff size={14} className="shrink-0 text-muted" aria-label={t("Hidden from the students")} />}
    </button>
  );
}

/** A value on a slider: its name and the slider */
export function SliderRow({ label, value, min, max, step, onChange, testId }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; testId: string }) {
  const id = useId();
  return (
    <Row label={label} htmlFor={id}>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} data-testid={testId} className="w-32 accent-indigo-600" />
    </Row>
  );
}
