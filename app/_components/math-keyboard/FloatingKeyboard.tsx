"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { hasActiveMathfield, mathCommand, subscribeActiveMathfield } from "@/app/_lib/activeMathfield";
import { keyboardTabsOf, KEYBOARD_LAYOUTS } from "@/app/_lib/keyboard/layouts";
import { keyLabel, type KeyButton } from "@/app/_lib/keyboard/keys";
import { plainFromLatex } from "@/app/_lib/keyboard/plainText";
import { svgUrl } from "@/app/_lib/library";
import { renderEquation } from "@/app/_lib/math";
import { useT } from "@/app/_lib/uiLang";
import { commandInField, fieldFlavor, fieldSelection, moveInField, typeInField, useFieldFlavor } from "./fieldTarget";
import { chooseKeyboardLayout, setKeyboardPos, useKeyboardStore, type Point } from "./keyboardStore";

const TAB_KEY = "examBuilder.mathTab";
const labelCache = new Map<string, string>();

const EDGE = 8; // the window stays this far from the edge of the screen...
const TOP = 56; // ...and under the top bar of the page or of a studio

const clampTo = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));
const keepOnScreen = (p: Point, width: number, height: number): Point => ({
  x: clampTo(p.x, EDGE, window.innerWidth - EDGE - width),
  y: clampTo(p.y, TOP, window.innerHeight - EDGE - height),
});

// The key's formula drawn by MathJax (same look as on the page).
function KeyFace({ latex }: { latex: string }) {
  const [src, setSrc] = useState(() => labelCache.get(latex) ?? null);
  useEffect(() => {
    if (src) return;
    let alive = true;
    renderEquation(latex)
      .then((r) => {
        const url = svgUrl(r.svg);
        labelCache.set(latex, url);
        if (alive) setSrc(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [latex, src]);
  // eslint-disable-next-line @next/next/no-img-element -- small local svg
  return src ? <img src={src} alt="" className="pointer-events-none max-h-7 max-w-full object-contain" draggable={false} /> : <span className="text-faint">…</span>;
}

interface Props {
  /** Where the keys type: the equation open in the Properties panel (the page), or the text field last clicked in a studio. */
  target: "equation" | "field";
  onClose: () => void;
}

// The math keyboard, a window over the page or over a studio: drag it by its title bar anywhere on the screen (double-click the bar to
// dock it again), pick Math or Physics keys by hand, "×" closes it. Its keys are the LaTeX of the layout; they type that in the equation
// field, or its text form (plainText.ts) in the text field of a studio.
export default function FloatingKeyboard({ target, onClose }: Props) {
  const t = useT();
  const { layout, pos: savedPos } = useKeyboardStore();
  const tabs = keyboardTabsOf(layout);
  // False when there is nowhere to type: the equation field is not open (the Properties panel shows another tab), or no text field of
  // the studio has been clicked yet. A key would do nothing.
  const mathOpen = useSyncExternalStore(subscribeActiveMathfield, hasActiveMathfield, () => false);
  const flavor = useFieldFlavor();
  const typing = target === "equation" ? mathOpen : flavor !== null;

  const [tabId, setTabId] = useState(() => {
    try {
      return localStorage.getItem(TAB_KEY) ?? tabs[0].id;
    } catch {
      return tabs[0].id;
    }
  });
  // The tab picked before may not exist in the other layout: the first one is shown then.
  const tab = tabs.find((x) => x.id === tabId) ?? tabs[0];

  const pickTab = (id: string) => {
    setTabId(id);
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {}
  };

  // Buttons never take the focus away from the field being typed in.
  const keep = (e: React.MouseEvent) => e.preventDefault();

  // In a text field a key may have no text form (a matrix…): it is greyed out there.
  const textForms = useMemo(() => (target === "field" && flavor ? tab.buttons.map((key) => plainFromLatex(key.latex, flavor)) : null), [target, flavor, tab]);

  const press = (key: KeyButton) => {
    if (target === "equation") return mathCommand(["insert", key.latex, { selectionMode: "placeholder" }]);
    const kind = fieldFlavor();
    const text = kind && plainFromLatex(key.latex, kind, fieldSelection());
    if (text) typeInField(text.text, text.caret);
  };
  const edit = {
    left: () => (target === "equation" ? mathCommand("moveToPreviousChar") : moveInField(-1)),
    right: () => (target === "equation" ? mathCommand("moveToNextChar") : moveInField(1)),
    delete: () => (target === "equation" ? mathCommand("deleteBackward") : commandInField("delete")),
    undo: () => (target === "equation" ? mathCommand("undo") : commandInField("undo")),
  };

  // ---- Moving the window ----
  const boxRef = useRef<HTMLDivElement>(null);
  const grab = useRef<{ x: number; y: number; from: Point; width: number; height: number; last: Point | null } | null>(null);
  // null = docked at the bottom, centred. Kept here while it is dragged; stored when the drag ends.
  const [pos, setPos] = useState<Point | null>(savedPos);

  // A smaller window (or a place saved on a bigger one), or a keyboard that grows with a longer tab, must not leave it off the screen.
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const fit = () =>
      setPos((cur) => {
        if (!cur) return cur;
        const { width, height } = box.getBoundingClientRect();
        const next = keepOnScreen(cur, width, height);
        return next.x === cur.x && next.y === cur.y ? cur : next;
      });
    fit();
    const watch = new ResizeObserver(fit);
    watch.observe(box);
    window.addEventListener("resize", fit);
    return () => {
      watch.disconnect();
      window.removeEventListener("resize", fit);
    };
  }, []);

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    const box = boxRef.current;
    if (e.button !== 0 || !box || (e.target as HTMLElement).closest("button")) return;
    const r = box.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = { x: e.clientX, y: e.clientY, from: { x: r.left, y: r.top }, width: r.width, height: r.height, last: null };
  };
  const drag = (e: PointerEvent<HTMLDivElement>) => {
    const g = grab.current;
    if (!g) return;
    g.last = keepOnScreen({ x: g.from.x + e.clientX - g.x, y: g.from.y + e.clientY - g.y }, g.width, g.height);
    setPos(g.last);
  };
  const endDrag = () => {
    const g = grab.current;
    grab.current = null;
    if (g?.last) setKeyboardPos(g.last);
  };
  const dock = () => {
    setPos(null);
    setKeyboardPos(null);
  };

  return (
    <div
      ref={boxRef}
      // The keyboard window is not a field of the studio: clicking in it does not change where the keys type (fieldTarget.ts).
      data-math-keyboard=""
      className="pointer-events-auto fixed z-40 w-[min(720px,calc(100vw-8rem))]"
      style={pos ? { left: pos.x, top: pos.y } : { left: "50%", bottom: "4rem", transform: "translateX(-50%)" }}
      onMouseDown={keep}
    >
      <div
        role="group"
        aria-label={t("Math keyboard")}
        data-testid="math-keyboard"
        className="keyboard-rise flex max-h-[46vh] flex-col overflow-hidden rounded-xl border border-line bg-white/95 shadow-[0_18px_50px_-12px_rgba(16,24,40,0.35)] backdrop-blur-md"
      >
        {/* Title bar: drag it to move the window. Math / Physics and close. */}
        <div
          title={t("Drag to move · double-click to put it back")}
          data-testid="math-keyboard-bar"
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={dock}
          className="flex cursor-grab touch-none select-none items-center gap-2 border-b border-line bg-subtle/70 px-2 py-1.5 active:cursor-grabbing"
        >
          <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" className="shrink-0 text-faint" aria-hidden>
            {[2, 7, 12].flatMap((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" />))}
          </svg>
          <span className="truncate text-xs font-semibold text-ink">{t("Math keyboard")}</span>

          {/* Which keys: chosen by hand, whatever the subject of the exam. */}
          <div role="group" aria-label={t("Keyboard keys")} data-testid="keyboard-layout" className="ms-auto flex shrink-0 rounded-lg bg-white/80 p-0.5 ring-1 ring-line">
            {KEYBOARD_LAYOUTS.map((l) => (
              <button
                key={l}
                aria-pressed={l === layout}
                data-layout={l}
                onClick={() => chooseKeyboardLayout(l)}
                title={l === "math" ? t("Math keys: fractions, trigonometry, limits, sets…") : t("Physics keys: vectors, units, constants, formulas…")}
                className={`cursor-pointer rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${l === layout ? "bg-indigo-600 text-white shadow-sm" : "text-muted hover:text-ink"}`}
              >
                {l === "math" ? t("Math") : t("Physics")}
              </button>
            ))}
          </div>
          <button onClick={onClose} title={t("Close the keyboard")} aria-label={t("Close the keyboard")} className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-md text-muted hover:bg-red-50 hover:text-red-600">
            <svg width="11" height="11" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
              <path d="M2 2l6 6M8 2L2 8" />
            </svg>
          </button>
        </div>

        {/* The tabs wrap onto a second row rather than scroll: a tab hidden off to the side would not be found. */}
        <div className="flex flex-wrap gap-1 border-b border-line px-2 py-1.5">
          {tabs.map((x) => (
            <button
              key={x.id}
              aria-pressed={x.id === tab.id}
              onClick={() => pickTab(x.id)}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                x.id === tab.id ? "bg-white text-indigo-600 shadow-sm ring-1 ring-line" : "text-muted hover:text-ink"
              }`}
            >
              {t(x.label)}
            </button>
          ))}
        </div>

        {/* Keys */}
        <div key={`${layout}-${tab.id}`} className="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-1.5 overflow-y-auto p-2.5" dir="ltr">
          {tab.buttons.map((key, i) => {
            const noText = textForms !== null && textForms[i] === null;
            const off = !typing || noText;
            return (
              <button
                key={key.latex + key.title}
                title={noText ? `${t(key.title)} — ${t("no text form in this field")}` : t(key.title)}
                aria-label={t(key.title)}
                aria-disabled={off}
                onMouseDown={keep}
                onClick={() => !noText && press(key)}
                className={`flex h-11 items-center justify-center rounded-lg border border-line bg-white px-1.5 transition hover:-translate-y-px hover:border-indigo-300 hover:bg-indigo-50/60 hover:shadow-sm active:translate-y-0 ${
                  key.wide ? "col-span-3" : ""
                } ${noText ? "opacity-30" : typing ? "" : "opacity-60"}`}
              >
                <KeyFace latex={keyLabel(key)} />
              </button>
            );
          })}
        </div>

        {/* Editing keys */}
        <div className="flex items-center gap-1.5 border-t border-line px-2.5 py-1.5 text-xs">
          <EditKey title={t("Move left")} onClick={edit.left}>◀</EditKey>
          <EditKey title={t("Move right")} onClick={edit.right}>▶</EditKey>
          <EditKey title={t("Delete")} onClick={edit.delete}>⌫ {t("Delete")}</EditKey>
          <EditKey title={t("Undo")} onClick={edit.undo}>↶ {t("Undo")}</EditKey>
          <span className={`ms-auto text-[11px] ${typing ? "text-faint" : "font-medium text-amber-700"}`}>
            {target === "equation"
              ? typing
                ? t("Tip: you can also type — x^2, sqrt, pi, lim…")
                : t("Show the Properties panel to type in this equation.")
              : typing
                ? t("The keys type in the field you last clicked.")
                : t("Click a text field to type in it.")}
          </span>
        </div>
      </div>
    </div>
  );
}

function EditKey({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className="rounded-md border border-line bg-white px-2.5 py-1 font-medium text-ink hover:border-indigo-300 hover:bg-indigo-50"
    >
      {children}
    </button>
  );
}
