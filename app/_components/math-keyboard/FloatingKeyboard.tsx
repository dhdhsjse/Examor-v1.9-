"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { hasActiveMathfield, mathCommand, subscribeActiveMathfield } from "@/app/_lib/activeMathfield";
import { keyLabel, type KeyButton, type KeyboardTab } from "@/app/_lib/keyboard/keys";
import { svgUrl } from "@/app/_lib/library";
import { renderEquation } from "@/app/_lib/math";
import { useT } from "@/app/_lib/uiLang";

const TAB_KEY = "examBuilder.mathTab";
const labelCache = new Map<string, string>();

type Offset = { x: number; y: number };
type Bounds = { minX: number; maxX: number; minY: number; maxY: number };

// Where the keyboard was dragged to. Kept while the app runs, so it comes back there when it is reopened.
let savedOffset: Offset = { x: 0, y: 0 };
const EDGE = 8; // the keyboard stays this far from the window edge...
const TOP = 48; // ...and under the top bar

const clampTo = (v: number, min: number, max: number) => Math.min(Math.max(v, min), Math.max(min, max));

// How far the keyboard (drawn `applied` away from its place) can move without leaving the window.
function boundsOf(el: HTMLElement, applied: Offset): Bounds {
  const r = el.getBoundingClientRect();
  const left = r.left - applied.x;
  const top = r.top - applied.y;
  return {
    minX: EDGE - left,
    maxX: window.innerWidth - EDGE - r.width - left,
    minY: TOP - top,
    maxY: window.innerHeight - EDGE - r.height - top,
  };
}
const within = (o: Offset, b: Bounds): Offset => ({ x: clampTo(o.x, b.minX, b.maxX), y: clampTo(o.y, b.minY, b.maxY) });

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

// Floating keyboard under the pages while an equation is selected: the tabs it is given (they depend on the
// subject), typed into the equation field open in the Properties panel. Drag it by its handle; "×" closes it.
export default function FloatingKeyboard({ tabs, onClose }: { tabs: KeyboardTab[]; onClose: () => void }) {
  const t = useT();
  // False when the field is not open (e.g. the Properties panel shows another tab): a key would do nothing.
  const typing = useSyncExternalStore(subscribeActiveMathfield, hasActiveMathfield, () => false);
  const [tabId, setTabId] = useState(() => {
    try {
      return localStorage.getItem(TAB_KEY) ?? tabs[0].id;
    } catch {
      return tabs[0].id;
    }
  });
  // The tab picked before may not exist in this subject's keyboard: the first one is shown then.
  const tab = tabs.find((x) => x.id === tabId) ?? tabs[0];

  const pickTab = (id: string) => {
    setTabId(id);
    try {
      localStorage.setItem(TAB_KEY, id);
    } catch {}
  };

  // Buttons never take the focus away from the equation field.
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const press = (key: KeyButton) => mathCommand(["insert", key.latex, { selectionMode: "placeholder" }]);

  // ---- Moving the keyboard ----
  const boxRef = useRef<HTMLDivElement>(null);
  const grab = useRef<{ x: number; y: number; from: Offset; bounds: Bounds } | null>(null);
  const [offset, setOffset] = useState(savedOffset);

  useEffect(() => {
    savedOffset = offset;
  }, [offset]);

  // A smaller window (or a saved place from a bigger one) must not leave the keyboard outside it.
  useEffect(() => {
    const fit = () => setOffset((cur) => (boxRef.current ? within(cur, boundsOf(boxRef.current, cur)) : cur));
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const startDrag = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !boxRef.current) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    grab.current = { x: e.clientX, y: e.clientY, from: offset, bounds: boundsOf(boxRef.current, offset) };
  };
  const drag = (e: PointerEvent<HTMLDivElement>) => {
    const g = grab.current;
    if (g) setOffset(within({ x: g.from.x + e.clientX - g.x, y: g.from.y + e.clientY - g.y }, g.bounds));
  };
  const endDrag = () => {
    grab.current = null;
  };

  return (
    <div ref={boxRef} className="pointer-events-auto" style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }} onMouseDown={keep}>
      <div
        role="group"
        aria-label={t("Math keyboard")}
        className="keyboard-rise flex max-h-[46vh] flex-col overflow-hidden rounded-xl border border-line bg-white/95 shadow-[0_18px_50px_-12px_rgba(16,24,40,0.35)] backdrop-blur-md"
      >
        {/* Handle, tabs and close */}
        <div className="flex items-start gap-1 border-b border-line bg-subtle/70 px-2 py-1.5">
          <div
            title={t("Drag to move · double-click to put it back")}
            onPointerDown={startDrag}
            onPointerMove={drag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => setOffset({ x: 0, y: 0 })}
            className="grid h-7 w-5 shrink-0 cursor-grab touch-none place-items-center rounded-md text-faint hover:bg-white active:cursor-grabbing"
          >
            <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden>
              {[2, 7, 12].flatMap((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.2" />))}
            </svg>
          </div>
          {/* The tabs wrap onto a second row rather than scroll: a tab hidden off to the side would not be found. */}
          <div className="flex min-w-0 flex-1 flex-wrap gap-1">
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
          <button onClick={onClose} title={t("Close the keyboard")} aria-label={t("Close the keyboard")} className="grid size-7 shrink-0 place-items-center rounded-md text-muted hover:bg-red-50 hover:text-red-600">
            <svg width="11" height="11" viewBox="0 0 10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
              <path d="M2 2l6 6M8 2L2 8" />
            </svg>
          </button>
        </div>

        {/* Keys */}
        <div key={tab.id} className="grid min-h-0 grid-cols-[repeat(auto-fill,minmax(58px,1fr))] gap-1.5 overflow-y-auto p-2.5" dir="ltr">
          {tab.buttons.map((key) => (
            <button
              key={key.latex + key.title}
              title={t(key.title)}
              aria-label={t(key.title)}
              aria-disabled={!typing}
              onMouseDown={keep}
              onClick={() => press(key)}
              className={`flex h-11 items-center justify-center rounded-lg border border-line bg-white px-1.5 transition hover:-translate-y-px hover:border-indigo-300 hover:bg-indigo-50/60 hover:shadow-sm active:translate-y-0 ${
                key.wide ? "col-span-3" : ""
              } ${typing ? "" : "opacity-60"}`}
            >
              <KeyFace latex={keyLabel(key)} />
            </button>
          ))}
        </div>

        {/* Editing keys */}
        <div className="flex items-center gap-1.5 border-t border-line px-2.5 py-1.5 text-xs">
          <EditKey title={t("Move left")} onClick={() => mathCommand("moveToPreviousChar")}>◀</EditKey>
          <EditKey title={t("Move right")} onClick={() => mathCommand("moveToNextChar")}>▶</EditKey>
          <EditKey title={t("Delete")} onClick={() => mathCommand("deleteBackward")}>⌫ {t("Delete")}</EditKey>
          <EditKey title={t("Undo")} onClick={() => mathCommand("undo")}>↶ {t("Undo")}</EditKey>
          <span className={`ms-auto text-[11px] ${typing ? "text-faint" : "font-medium text-amber-700"}`}>
            {typing ? t("Tip: you can also type — x^2, sqrt, pi, lim…") : t("Show the Properties panel to type in this equation.")}
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
