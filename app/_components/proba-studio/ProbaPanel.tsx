"use client";

import { ArrowDown, ArrowRight, ChevronDown, ChevronRight, ChevronUp, Minus, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import ShapeProperties from "@/app/_components/shapes/ShapeProperties";
import { badSums, formatRational, numberStyle, treeTexts } from "@/app/_lib/proba/numbers";
import { vennRegions } from "@/app/_lib/proba/scene";
import { parentOf, stageCount, stageEvents } from "@/app/_lib/proba/tree";
import { MAX_AREA, MIN_AREA, PROBA_COLORS, type Cards, type Coin, type Dice, type ProbTree, type Spinner, type Urn, type Venn } from "@/app/_lib/proba/types";
import { useT } from "@/app/_lib/uiLang";
import type { ProbaStudioState } from "./useProbaStudio";

// The look of the panel: two text sizes (12px for labels and buttons, 14px for what is typed), 28px controls with 4px corners,
// spacing on a 4px grid, and the theme accent only for what is on or selected.
const input = "h-7 w-full min-w-0 rounded border border-line bg-white px-2 text-sm text-ink outline-none focus:border-accent";
const textBtn = "flex h-7 items-center justify-center gap-1 rounded border border-line bg-white px-2 text-xs font-medium text-ink hover:bg-hover disabled:opacity-40";
const iconBtn = "grid size-7 shrink-0 place-items-center rounded text-muted enabled:hover:bg-hover enabled:hover:text-ink disabled:opacity-40";
const deleteBtn = "grid size-7 shrink-0 place-items-center rounded text-muted enabled:hover:bg-red-50 enabled:hover:text-red-600 disabled:opacity-40";
const toggle = (on: boolean) => (on ? "border-accent bg-accent-soft text-accent-strong" : "border-line bg-white text-ink hover:bg-hover");

function Section({ title, testId, children }: { title: string; testId: string; children: ReactNode }) {
  return (
    <section data-testid={testId} className="flex flex-col gap-2 border-b border-line p-3 last:border-b-0">
      <h4 className="text-xs font-semibold text-ink">{title}</h4>
      {children}
    </section>
  );
}

/** Options shown on demand (closed at first). */
function More({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="group">
      <summary className="flex h-7 cursor-pointer list-none items-center gap-1 rounded text-xs text-muted outline-none hover:text-ink focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
        <ChevronRight size={14} className="shrink-0 group-open:rotate-90 rtl:-scale-x-100 rtl:group-open:scale-x-100" />
        {title}
      </summary>
      <div className="flex flex-col gap-2 pt-1">{children}</div>
    </details>
  );
}

function Field({ label, value, onChange, testId, placeholder, after }: { label: string; value: string; onChange: (s: string) => void; testId: string; placeholder?: string; after?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} data-testid={testId} dir="auto" className={input} />
        {after}
      </div>
    </div>
  );
}

function Check({ label, checked, onChange, testId }: { label: string; checked: boolean; onChange: (b: boolean) => void; testId: string }) {
  return (
    <label className="flex min-h-7 items-center gap-2 text-xs text-ink">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} className="size-4 shrink-0 accent-accent" />
      {label}
    </label>
  );
}

function Slider({ label, value, min, max, step = 1, onChange, testId }: { label: string; value: number; min: number; max: number; step?: number; onChange: (n: number) => void; testId: string }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted">
      <span className="flex justify-between">
        {label}
        <span className="tabular-nums text-ink">{value}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} data-testid={testId} className="accent-accent" />
    </label>
  );
}

function Segmented<T extends string | number>({ value, options, onChange, testId }: { value: T; options: { id: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void; testId: string }) {
  return (
    <div className="flex h-7 overflow-hidden rounded border border-line" data-testid={testId} role="radiogroup">
      {options.map((o) => (
        <button key={String(o.id)} role="radio" aria-checked={value === o.id} title={o.title} onClick={() => onChange(o.id)} className={`flex flex-1 items-center justify-center gap-1 px-2 text-xs not-first:border-s not-first:border-line ${value === o.id ? "bg-accent-soft font-medium text-accent-strong" : "bg-white text-muted hover:bg-hover hover:text-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Swatches({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const t = useT();
  return (
    <div className="flex flex-wrap gap-1">
      {PROBA_COLORS.map((c) => (
        <button key={c.id} onClick={() => onChange(c.id)} aria-pressed={value === c.id} title={t(c.name)} aria-label={t(c.name)} data-color={c.id} className={`size-5 rounded-full border border-gray-400 ${value === c.id ? "ring-2 ring-accent ring-offset-1" : ""}`} style={{ background: c.fill }} />
      ))}
    </div>
  );
}

function Stepper({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex h-7 shrink-0 items-center rounded border border-line" aria-label={label}>
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="−" className="grid h-full w-6 place-items-center text-muted enabled:hover:bg-hover enabled:hover:text-ink disabled:opacity-40">
        <Minus size={12} />
      </button>
      <span className="w-6 text-center text-sm tabular-nums text-ink">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="+" className="grid h-full w-6 place-items-center text-muted enabled:hover:bg-hover enabled:hover:text-ink disabled:opacity-40">
        <Plus size={12} />
      </button>
    </div>
  );
}

/** An event with its bar, in the panel (Ā). */
function EventName({ label, bar }: { label: string; bar?: boolean }) {
  return <span style={bar ? { textDecoration: "overline" } : undefined}>{label}</span>;
}

// A whole number the teacher types (the size of the drawing area): what is typed is theirs while the field has the focus.
function SizeField({ label, value, onCommit, testId }: { label: string; value: number; onCommit: (n: number) => void; testId: string }) {
  const t = useT();
  const id = useId();
  const [text, setText] = useState<string | null>(null);
  const n = Number((text ?? "").replace(",", "."));
  const bad = text !== null && (!Number.isFinite(n) || n < MIN_AREA || n > MAX_AREA);
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs text-muted">
        {label}
      </label>
      <input
        id={id}
        inputMode="numeric"
        value={text ?? String(value)}
        onFocus={() => setText(String(value))}
        onChange={(e) => {
          setText(e.target.value);
          const v = Number(e.target.value.replace(",", "."));
          if (Number.isFinite(v) && v >= MIN_AREA && v <= MAX_AREA) onCommit(v);
        }}
        onBlur={() => setText(null)}
        aria-invalid={bad ? true : undefined}
        data-testid={testId}
        className={`${input} tabular-nums ${bad ? "border-red-400" : ""}`}
      />
      {bad && (
        <p role="alert" className="text-xs text-red-600">
          {t("The size must be between {min} and {max} px.", { min: MIN_AREA, max: MAX_AREA })}
        </p>
      )}
    </div>
  );
}

/** The stages of a tree, one row each: every event of a stage in one box, so renaming it renames it on all its branches at once;
 * its bar (Ā), + for another event, × to take one away, and a stage added or taken away. */
function StagesSection({ studio, tree }: { studio: ProbaStudioState; tree: ProbTree }) {
  const t = useT();
  const count = stageCount(tree.root);
  return (
    <Section title={t("Stages")} testId="tree-stages">
      {Array.from({ length: count }, (_, k) => {
        const depth = k + 1;
        const events = stageEvents(tree.root, depth);
        return (
          <div key={depth} className="flex items-start gap-1" data-testid={`stage-${depth}`}>
            <span className="grid h-7 w-4 shrink-0 place-items-center text-xs tabular-nums text-muted" title={t("Stage {n}", { n: depth })}>
              {depth}
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
              {events.map((e, j) => (
                <span key={j} className="group relative flex h-7 items-center rounded border border-line bg-white focus-within:border-accent" data-testid={`stage-event-${depth}-${j}`}>
                  <input
                    value={e.label}
                    onChange={(ev) => studio.renameStage(tree.id, depth, e, { label: ev.target.value })}
                    aria-label={t("Event")}
                    dir="auto"
                    className="h-full w-8 bg-transparent text-center text-sm text-ink outline-none"
                    style={e.bar ? { textDecoration: "overline" } : undefined}
                  />
                  <button
                    onClick={() => studio.renameStage(tree.id, depth, e, { bar: !e.bar })}
                    aria-pressed={e.bar}
                    title={t("Complement (a bar over the event)")}
                    aria-label={t("Complement (a bar over the event)")}
                    className={`grid h-full w-5 place-items-center text-xs ${e.bar ? "bg-accent-soft text-accent-strong" : "text-muted hover:text-ink"}`}
                  >
                    <span style={{ textDecoration: "overline" }}>x</span>
                  </button>
                  <button
                    onClick={() => studio.removeEventFromStage(tree.id, depth, e)}
                    disabled={events.length < 2}
                    title={t("Remove this event")}
                    aria-label={t("Remove this event")}
                    className="absolute -start-2 -top-2 hidden size-4 place-items-center rounded-full border border-line bg-white text-muted hover:text-red-600 group-focus-within:grid group-hover:grid disabled:hidden!"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
              <button onClick={() => studio.addEventToStage(tree.id, depth)} title={t("Add an event")} aria-label={t("Add an event")} data-testid={`stage-add-event-${depth}`} className={iconBtn}>
                <Plus size={14} />
              </button>
            </div>
            <button onClick={() => studio.removeStageFrom(tree.id, depth)} disabled={count < 2} aria-label={t("Remove this stage")} title={t("Remove this stage")} className={deleteBtn}>
              <Trash2 size={14} />
            </button>
          </div>
        );
      })}
      <button onClick={() => studio.addStageTo(tree.id)} disabled={count >= 6} data-testid="add-stage" className={textBtn}>
        <Plus size={14} />
        {t("Stage")}
      </button>
    </Section>
  );
}

// ---- the panels of each kind ----

function TreePanel({ studio, tree }: { studio: ProbaStudioState; tree: ProbTree }) {
  const t = useT();
  const node = studio.selectedNode;
  const isRoot = node?.id === tree.root.id;
  const parent = node && !isRoot ? parentOf(tree.root, node.id) : null;
  const at = parent && node ? parent.children.findIndex((c) => c.id === node.id) : -1;
  const set = <K extends keyof ProbTree>(key: K, value: ProbTree[K]) => studio.changeTree(tree.id, (x) => ({ ...x, [key]: value }), `tree:${tree.id}:${String(key)}`);
  const style = numberStyle(treeTexts(tree.root));
  const bad = badSums(tree.root);

  return (
    <>
      {node && isRoot && (
        <Section title={t("Start of the tree")} testId="root-properties">
          <Field label={t("Name (optional)")} value={node.label} onChange={(label) => studio.setNode(tree.id, node.id, { label })} testId="root-label" placeholder="Ω" />
          <button onClick={() => studio.branch(tree.id, node.id)} className={textBtn} data-testid="add-child">
            <Plus size={14} />
            {t("Add a branch")}
          </button>
        </Section>
      )}

      {node && !isRoot && (
        <Section title={t("Branch")} testId="branch-properties">
          <Field
            label={t("Event")}
            value={node.label}
            onChange={(label) => studio.setNode(tree.id, node.id, { label })}
            testId="node-label"
            after={
              <button onClick={() => studio.setNode(tree.id, node.id, { bar: !node.bar })} aria-pressed={!!node.bar} title={t("Complement (a bar over the event)")} aria-label={t("Complement (a bar over the event)")} data-testid="node-bar" className={`grid size-7 shrink-0 place-items-center rounded border text-sm ${toggle(!!node.bar)}`}>
                <EventName label="A" bar />
              </button>
            }
          />
          <Field label={t("Probability of the branch")} value={node.prob} onChange={(prob) => studio.setNode(tree.id, node.id, { prob })} testId="node-prob" />
          <Check label={t("Hide it for the exercise (……)")} checked={!!node.hideProb} onChange={(hideProb) => studio.setNode(tree.id, node.id, { hideProb })} testId="node-hide" />
          <div className="flex items-center gap-1">
            <button onClick={() => studio.branch(tree.id, node.id)} className={`${textBtn} flex-1`} data-testid="add-child" title="Tab">
              <Plus size={14} />
              {t("Branch after it")}
            </button>
            <button onClick={() => studio.moveBranch(tree.id, node.id, -1)} disabled={at <= 0} className={iconBtn} aria-label={t("Move up")} title={t("Move up")}>
              <ChevronUp size={15} />
            </button>
            <button onClick={() => studio.moveBranch(tree.id, node.id, 1)} disabled={!parent || at >= parent.children.length - 1} className={iconBtn} aria-label={t("Move down")} title={t("Move down")}>
              <ChevronDown size={15} />
            </button>
            <button onClick={studio.deleteSelected} data-testid="delete-branch" className={deleteBtn} aria-label={t("Delete the branch")} title={`${t("Delete the branch")} (Delete)`}>
              <Trash2 size={14} />
            </button>
          </div>
        </Section>
      )}

      <StagesSection studio={studio} tree={tree} />

      <Section title={t("Probability tree")} testId="tree-properties">
        <Segmented
          value={tree.direction}
          onChange={(d) => set("direction", d)}
          testId="tree-direction"
          options={[
            { id: "right", label: <><ArrowRight size={12} /> {t("Left to right")}</> },
            { id: "down", label: <><ArrowDown size={12} /> {t("Top to bottom")}</> },
          ]}
        />
        <Check label={t("Outcome of each path (A ∩ B)")} checked={!!tree.showOutcomes} onChange={(v) => set("showOutcomes", v || undefined)} testId="tree-outcomes" />
        <Check label={t("Probability of each path")} checked={!!tree.showResults} onChange={(v) => set("showResults", v || undefined)} testId="tree-results" />
        <More title={t("Spacing and text size")}>
          <Slider label={t("Branch length")} value={tree.levelGap} min={60} max={260} step={5} onChange={(v) => set("levelGap", v)} testId="tree-level-gap" />
          <Slider label={t("Space between branches")} value={tree.leafGap} min={24} max={140} step={2} onChange={(v) => set("leafGap", v)} testId="tree-leaf-gap" />
          <Slider label={t("Text size")} value={tree.fontSize} min={11} max={30} onChange={(v) => set("fontSize", v)} testId="tree-font" />
        </More>
        {bad.length > 0 && (
          <div role="alert" data-testid="tree-warnings" className="flex flex-col gap-1 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
            {bad.map(({ node: n, sum }) => (
              <p key={n.id} className="flex items-start gap-1">
                <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                <span>
                  {t("The branches from {event} add up to {sum}, not 1.", { event: n.id === tree.root.id ? t("the start") : (n.bar ? `${n.label}̅` : n.label) || "…", sum: formatRational(sum, style) })}
                </span>
              </p>
            ))}
          </div>
        )}
      </Section>
    </>
  );
}

function regionName(key: string, labels: string[]) {
  return (
    <>
      {[...key].map((bit, i) => (
        <span key={i}>
          {i > 0 && " ∩ "}
          <EventName label={labels[i] || "ABC"[i]} bar={bit === "0"} />
        </span>
      ))}
    </>
  );
}

function VennPanel({ studio, venn }: { studio: ProbaStudioState; venn: Venn }) {
  const t = useT();
  const set = (patch: Partial<Venn>, key: string) => studio.changeItem<Venn>(venn.id, (v) => ({ ...v, ...patch }), `venn:${venn.id}:${key}`);
  return (
    <Section title={t("Venn diagram")} testId="venn-properties">
      <Segmented
        value={venn.sets}
        onChange={(sets) => set({ sets, shaded: venn.shaded.filter((k) => k.length === sets) }, "sets")}
        testId="venn-sets"
        options={[
          { id: 2, label: t("2 sets") },
          { id: 3, label: t("3 sets") },
        ]}
      />
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: venn.sets }, (_, i) => (
          <input key={i} value={venn.labels[i] ?? ""} onChange={(e) => set({ labels: venn.labels.map((l, j) => (j === i ? e.target.value : l)) }, `label${i}`)} aria-label={t("Name of set {n}", { n: i + 1 })} data-testid={`venn-label-${i}`} dir="auto" className={input} />
        ))}
      </div>
      <Check label={t("Universe frame")} checked={venn.showUniverse} onChange={(showUniverse) => set({ showUniverse }, "frame")} testId="venn-frame" />
      {venn.showUniverse && <Field label={t("Name of the universe")} value={venn.universe} onChange={(universe) => set({ universe }, "universe")} testId="venn-universe" placeholder="Ω" />}
      <div className="flex flex-col gap-1" data-testid="venn-regions">
        <div className="flex items-center justify-between text-xs text-muted">
          <span>{t("Region")}</span>
          <span>{t("Value · Shaded")}</span>
        </div>
        {vennRegions(venn.sets).map((key) => (
          <div key={key} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-sm text-ink">{regionName(key, venn.labels)}</span>
            <input value={venn.values[key] ?? ""} onChange={(e) => set({ values: { ...venn.values, [key]: e.target.value } }, `value${key}`)} aria-label={t("Value")} data-testid={`venn-value-${key}`} dir="auto" className={input} />
            <input type="checkbox" checked={venn.shaded.includes(key)} onChange={(e) => set({ shaded: e.target.checked ? [...venn.shaded, key] : venn.shaded.filter((k) => k !== key) }, `shade${key}`)} aria-label={t("Shaded")} data-testid={`venn-shade-${key}`} className="size-4 shrink-0 accent-accent" />
          </div>
        ))}
      </div>
    </Section>
  );
}

function UrnPanel({ studio, urn }: { studio: ProbaStudioState; urn: Urn }) {
  const t = useT();
  const set = (patch: Partial<Urn>, key: string) => studio.changeItem<Urn>(urn.id, (u) => ({ ...u, ...patch }), `urn:${urn.id}:${key}`);
  const setBall = (i: number, patch: Partial<Urn["balls"][number]>, key: string) => set({ balls: urn.balls.map((b, j) => (j === i ? { ...b, ...patch } : b)) }, `${key}${i}`);
  const total = urn.balls.reduce((a, b) => a + b.count, 0);
  return (
    <Section title={t("Urn")} testId="urn-properties">
      <Field label={t("Name (optional)")} value={urn.label} onChange={(label) => set({ label }, "label")} testId="urn-label" placeholder="U₁" />
      <div className="flex flex-col divide-y divide-line">
        {urn.balls.map((b, i) => (
          <div key={i} className="flex flex-col gap-1 py-2 first:pt-0" data-testid={`ball-${i}`}>
            <div className="flex items-center gap-1">
              <Stepper value={b.count} min={0} max={20} onChange={(count) => setBall(i, { count }, "count")} label={t("Number of balls")} />
              <input value={b.text} onChange={(e) => setBall(i, { text: e.target.value }, "text")} placeholder={t("Text")} aria-label={t("Text on the balls")} dir="auto" className={input} />
              <button onClick={() => set({ balls: urn.balls.filter((_, j) => j !== i) }, `remove${i}`)} aria-label={t("Delete")} title={t("Delete")} className={deleteBtn}>
                <Trash2 size={14} />
              </button>
            </div>
            <Swatches value={b.color} onChange={(color) => setBall(i, { color }, "color")} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => set({ balls: [...urn.balls, { color: PROBA_COLORS[urn.balls.length % PROBA_COLORS.length].id, count: 1, text: "" }] }, `add${urn.balls.length}`)} className={textBtn} data-testid="add-balls">
          <Plus size={14} />
          {t("Balls of another color")}
        </button>
        <p className="text-xs tabular-nums text-muted">{t("{count} balls in all", { count: total })}</p>
      </div>
    </Section>
  );
}

function DicePanel({ studio, dice }: { studio: ProbaStudioState; dice: Dice }) {
  const t = useT();
  const set = (faces: number[], key: string) => studio.changeItem<Dice>(dice.id, (d) => ({ ...d, faces }), `dice:${dice.id}:${key}`);
  return (
    <Section title={t("Dice")} testId="dice-properties">
      <div className="flex items-center justify-between text-xs text-muted">
        {t("Number of dice")}
        <Stepper value={dice.faces.length} min={1} max={4} onChange={(n) => set(Array.from({ length: n }, (_, i) => dice.faces[i] ?? ((i * 3) % 6) + 1), "count")} label={t("Number of dice")} />
      </div>
      {dice.faces.map((face, i) => (
        <div key={i} className="flex items-center gap-1" data-testid={`die-${i}`}>
          {[1, 2, 3, 4, 5, 6].map((v) => (
            <button key={v} onClick={() => set(dice.faces.map((f, j) => (j === i ? v : f)), `face${i}`)} aria-pressed={face === v} className={`grid size-7 place-items-center rounded border text-sm tabular-nums ${toggle(face === v)}`}>
              {v}
            </button>
          ))}
        </div>
      ))}
    </Section>
  );
}

function CoinPanel({ studio, coin }: { studio: ProbaStudioState; coin: Coin }) {
  const t = useT();
  const set = (sides: string[], key: string) => studio.changeItem<Coin>(coin.id, (c) => ({ ...c, sides }), `coin:${coin.id}:${key}`);
  return (
    <Section title={t("Coins")} testId="coin-properties">
      <div className="flex items-center justify-between text-xs text-muted">
        {t("Number of coins")}
        <Stepper value={coin.sides.length} min={1} max={5} onChange={(n) => set(Array.from({ length: n }, (_, i) => coin.sides[i] ?? coin.sides[0] ?? ""), "count")} label={t("Number of coins")} />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {coin.sides.map((s, i) => (
          <input key={i} value={s} onChange={(e) => set(coin.sides.map((x, j) => (j === i ? e.target.value : x)), `side${i}`)} aria-label={t("Text on coin {n}", { n: i + 1 })} dir="auto" className={input} />
        ))}
      </div>
    </Section>
  );
}

function SpinnerPanel({ studio, spinner }: { studio: ProbaStudioState; spinner: Spinner }) {
  const t = useT();
  const set = (patch: Partial<Spinner>, key: string) => studio.changeItem<Spinner>(spinner.id, (s) => ({ ...s, ...patch }), `spinner:${spinner.id}:${key}`);
  const setSector = (i: number, patch: Partial<Spinner["sectors"][number]>, key: string) => set({ sectors: spinner.sectors.map((s, j) => (j === i ? { ...s, ...patch } : s)) }, `${key}${i}`);
  return (
    <Section title={t("Spinner")} testId="spinner-properties">
      <Slider label={t("Size")} value={spinner.radius} min={40} max={160} step={5} onChange={(radius) => set({ radius }, "radius")} testId="spinner-radius" />
      <div className="flex items-center justify-between text-xs text-muted">
        <span>{t("Sector")}</span>
        <span className="pe-8">{t("Size (parts)")}</span>
      </div>
      <div className="flex flex-col divide-y divide-line">
        {spinner.sectors.map((s, i) => (
          <div key={i} className="flex flex-col gap-1 py-2 first:pt-0" data-testid={`sector-${i}`}>
            <div className="flex items-center gap-1">
              <input value={s.label} onChange={(e) => setSector(i, { label: e.target.value }, "label")} aria-label={t("Text of the sector")} dir="auto" className={input} />
              <Stepper value={s.weight} min={1} max={12} onChange={(weight) => setSector(i, { weight }, "weight")} label={t("Size (parts)")} />
              <button onClick={() => set({ sectors: spinner.sectors.filter((_, j) => j !== i) }, `remove${i}`)} disabled={spinner.sectors.length < 2} aria-label={t("Delete")} title={t("Delete")} className={deleteBtn}>
                <Trash2 size={14} />
              </button>
            </div>
            <Swatches value={s.color} onChange={(color) => setSector(i, { color }, "color")} />
          </div>
        ))}
      </div>
      <button onClick={() => set({ sectors: [...spinner.sectors, { label: String(spinner.sectors.length + 1), weight: 1, color: PROBA_COLORS[(spinner.sectors.length + 1) % PROBA_COLORS.length].id }] }, `add${spinner.sectors.length}`)} disabled={spinner.sectors.length >= 12} className={textBtn} data-testid="add-sector">
        <Plus size={14} />
        {t("Add a sector")}
      </button>
    </Section>
  );
}

function CardsPanel({ studio, cards }: { studio: ProbaStudioState; cards: Cards }) {
  const t = useT();
  const [text, setText] = useState<string | null>(null);
  return (
    <Section title={t("Cards")} testId="cards-properties">
      <Field
        label={t("Texts of the cards, separated by commas")}
        value={text ?? cards.texts.join(", ")}
        onChange={(v) => {
          setText(v);
          const texts = v.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12);
          studio.changeItem<Cards>(cards.id, (c) => ({ ...c, texts: texts.length ? texts : [""] }), `cards:${cards.id}`);
        }}
        testId="cards-texts"
        placeholder="1, 2, 3, ♥ 7"
      />
      <div className="flex gap-1">
        {["♠", "♥", "♦", "♣"].map((s) => (
          <button key={s} onClick={() => setText((x) => `${x ?? cards.texts.join(", ")}${s}`)} className={`grid size-7 place-items-center rounded border border-line bg-white text-sm hover:bg-hover ${s === "♥" || s === "♦" ? "text-red-600" : "text-ink"}`}>
            {s}
          </button>
        ))}
      </div>
    </Section>
  );
}

// The right panel of the Probability Studio: the properties of what is selected (a tree and its selected branch, a Venn
// diagram, an urn…, a drawing), or, with nothing selected, the size of the drawing area.
export default function ProbaPanel({ studio }: { studio: ProbaStudioState }) {
  const t = useT();
  const { config, selectedItem: item, selectedShape: shape } = studio;
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-testid="proba-panel">
      {item?.kind === "tree" && <TreePanel studio={studio} tree={item} />}
      {item?.kind === "venn" && <VennPanel studio={studio} venn={item} />}
      {item?.kind === "urn" && <UrnPanel studio={studio} urn={item} />}
      {item?.kind === "dice" && <DicePanel studio={studio} dice={item} />}
      {item?.kind === "coin" && <CoinPanel studio={studio} coin={item} />}
      {item?.kind === "spinner" && <SpinnerPanel studio={studio} spinner={item} />}
      {item?.kind === "cards" && <CardsPanel key={item.id} studio={studio} cards={item} />}

      {shape && (
        <ShapeProperties
          key={shape.id}
          item={shape}
          geometry
          onChange={(patch) => studio.changeShape(shape.id, patch, `shape:${shape.id}:${Object.keys(patch).sort().join(",")}`)}
          onOrder={(order) => studio.orderShape(shape.id, order)}
          onDuplicate={() => studio.duplicateShapeOf(shape.id)}
          onDelete={() => studio.deleteShape(shape.id)}
        />
      )}

      {!item && !shape && (
        <Section title={t("Drawing area")} testId="area-properties">
          <div className="grid grid-cols-2 gap-2">
            <SizeField label={t("Width (px)")} value={config.width} onCommit={(w) => studio.setArea(w, config.height)} testId="area-width" />
            <SizeField label={t("Height (px)")} value={config.height} onCommit={(h) => studio.setArea(config.width, h)} testId="area-height" />
          </div>
          <p className="text-xs tabular-nums text-muted">{t("{count} items on the drawing", { count: config.items.length })}</p>
        </Section>
      )}
    </div>
  );
}
