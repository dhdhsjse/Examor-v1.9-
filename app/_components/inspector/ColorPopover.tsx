"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import ColorPicker from "./ColorPicker";

const GAP = 6; // px between the button and the panel
const MARGIN = 8; // px kept from the window's edges

// A button that opens the color picker (the one of the table tools' Cell fill: a square of shades, a strip of hues, the code and the
// pipette) in a small panel next to it, for any color. The button keeps the look it is given (`className`, `style`, `children`), so it
// takes the place of the browser's color input without changing the tool it is in.
//
// The panel stays in the page where the button is (not moved to the end of the page), so the menus and the text being typed that hold
// the button take a press in it as one of their own and stay open. It is `fixed`, so a scrolled or clipped panel does not cut it.
export default function ColorPopover({ id, value, onChange, label, title, className, style, children, testId, tabIndex }: {
  /** (for a `<label htmlFor>` that names it) */
  id?: string;
  /** The color chosen now (undefined: none) */
  value: string | undefined;
  /** A color is chosen in the picker (the panel stays open, to try more than one) */
  onChange: (color: string) => void;
  /** What the color is for: the button's name and tooltip */
  label: string;
  title?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  testId?: string;
  tabIndex?: number;
}) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Under the button (above it when there is no room below), lined up with its start, kept inside the window
  useLayoutEffect(() => {
    if (!open) return;
    const el = panel.current;
    const at = button.current;
    if (!el || !at) return;
    const place = () => {
      const r = at.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const below = r.bottom + GAP + h <= innerHeight - MARGIN || r.top - GAP - h < MARGIN;
      const rtl = getComputedStyle(at).direction === "rtl";
      const left = Math.max(MARGIN, Math.min(rtl ? r.right - w : r.left, innerWidth - MARGIN - w));
      const top = Math.max(MARGIN, below ? Math.min(r.bottom + GAP, innerHeight - MARGIN - h) : r.top - GAP - h);
      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      // (inside a moved or scaled box, `fixed` counts from that box: put right by what it is off by)
      const got = el.getBoundingClientRect();
      el.style.left = `${2 * left - got.left}px`;
      el.style.top = `${2 * top - got.top}px`;
      el.style.visibility = "visible";
    };
    place();
  }, [open]);

  // A press elsewhere, Esc (it closes only this panel), a scroll of what is under it or a change of the window's size close it
  useEffect(() => {
    if (!open) return;
    const inside = (e: Event) => button.current?.contains(e.target as Node) || panel.current?.contains(e.target as Node);
    const away = (e: Event) => !inside(e) && setOpen(false);
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
    };
    const scrolled = (e: Event) => !panel.current?.contains(e.target as Node) && setOpen(false);
    const resized = () => setOpen(false);
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", esc, true);
    window.addEventListener("scroll", scrolled, true);
    window.addEventListener("resize", resized);
    return () => {
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", esc, true);
      window.removeEventListener("scroll", scrolled, true);
      window.removeEventListener("resize", resized);
    };
  }, [open]);

  // (a press keeps the focus where it is, the selected text in an editor: only the color's code takes it)
  const keep = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest("input")) e.preventDefault();
  };

  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        title={title ?? label}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        tabIndex={tabIndex}
        data-testid={testId}
        onMouseDown={keep}
        onClick={() => setOpen(!open)}
        className={className}
        style={style}
      >
        {children}
      </button>
      {open && (
        <div
          ref={panel}
          role="dialog"
          aria-label={label}
          data-testid={testId ? `${testId}-pop` : "color-popover"}
          onMouseDown={keep}
          className="fixed z-[70] w-[196px] rounded-lg border border-line bg-surface p-2 text-start shadow-lg"
          style={{ left: 0, top: 0, visibility: "hidden" }}
        >
          <ColorPicker value={value} onChange={onChange} />
        </div>
      )}
    </>
  );
}
