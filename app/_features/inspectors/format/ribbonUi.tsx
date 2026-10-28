"use client";

import { Check, ChevronDown } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ColorGrid } from "@/app/_components/rich/FormatBar";

// The parts the Home ribbon (and the text box ribbon) is made of: groups of small buttons, split buttons with a
// menu, and the dropdowns under them. Pressing any of them must not take the focus from the text being typed in
// (it would lose its selection, and the words the button is for): see `keepFocus`.

/** `onMouseDown` of every ribbon control that is not a text field. */
export const keepFocus = (e: MouseEvent) => e.preventDefault();

// A press in a field (a size, a spacing) must focus it: everything else in a dropdown keeps the editor's focus.
const keepFocusExceptFields = (e: MouseEvent) => {
  if (!(e.target instanceof HTMLElement) || !e.target.closest("input, select, textarea, label")) e.preventDefault();
};

const toneCls = (on: boolean) => (on ? "border-indigo-300 bg-indigo-50 text-accent" : "border-transparent text-ink hover:bg-subtle");
const BASE = "grid h-7 flex-none place-items-center border transition-colors disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

// A titled part of the panel, like a group of the Word ribbon.
export function RibbonGroup({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="flex flex-col gap-1.5 rounded-lg border border-line p-2.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

// A line of controls; it wraps in a narrow panel.
export function RibbonRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-wrap items-center gap-0.5 ${className}`}>{children}</div>;
}

export const Divider = () => <span className="mx-0.5 h-5 w-px flex-none bg-line" aria-hidden />;

interface ButtonProps {
  title: string; // the tooltip, also the name of the button
  shortcut?: string;
  icon?: ReactNode;
  label?: string; // text next to the icon (the big buttons: Paste, Find…)
  pressed?: boolean;
  disabled?: boolean;
  onClick?: (e: MouseEvent) => void; // (`e.detail` is 2 for the second click of a double click)
  className?: string;
}

const tip = (title: string, shortcut?: string) => (shortcut ? `${title} (${shortcut})` : title);

// A square button; `pressed` = the format is on (a toggle).
export function RibbonButton({ title, shortcut, icon, label, pressed, disabled, onClick, className = "" }: ButtonProps) {
  return (
    <button
      type="button"
      title={tip(title, shortcut)}
      aria-label={title}
      aria-pressed={pressed}
      disabled={disabled}
      onMouseDown={keepFocus}
      onClick={onClick}
      className={`${BASE} rounded-md ${label ? "gap-1.5 px-2 text-[12px] font-medium" : "w-7"} ${label ? "grid-flow-col" : ""} ${toneCls(!!pressed)} ${className}`}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

// ---- dropdowns ----

interface PopoverProps {
  anchor: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  width?: number;
  byKeyboard?: boolean; // opened with the keyboard: the first item takes the focus, and the button gets it back when it closes
}

// A panel under (or over, when there is no room) its anchor. It is drawn on the page itself, not in the side panel, so the
// panel's scrolling cannot clip it, and it stays inside the window. It closes on a press outside, on Escape (which then goes
// no further: the text stays open and the block selected) and when the page scrolls or resizes.
export function Popover({ anchor, onClose, children, width, byKeyboard }: PopoverProps) {
  const box = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  // Place it under its anchor, or over it when there is more room there; its height is what the content needs, up to the room
  // (then it scrolls). The content can change its size while it is open (another group of symbols), so this is done again then.
  useLayoutEffect(() => {
    const el = box.current;
    const inner = content.current;
    const anchorEl = anchor.current;
    if (!el || !inner || !anchorEl) return;
    const margin = 8;
    const place = () => {
      const a = anchorEl.getBoundingClientRect();
      const rtl = getComputedStyle(anchorEl).direction === "rtl";
      const left = Math.max(margin, Math.min(rtl ? a.right - el.offsetWidth : a.left, window.innerWidth - el.offsetWidth - margin));
      const wanted = inner.offsetHeight + 10; // (the padding and border of the box)
      const below = window.innerHeight - a.bottom - 4 - margin;
      const above = a.top - 4 - margin;
      const under = wanted <= below || below >= above;
      const room = Math.max(120, under ? below : above);
      el.style.maxHeight = `${room}px`;
      el.style.left = `${left}px`;
      el.style.top = `${under ? a.bottom + 4 : Math.max(margin, a.top - 4 - Math.min(wanted, room))}px`;
      el.style.visibility = "visible";
    };
    place();
    if (byKeyboard) el.querySelector<HTMLElement>("[role^='menuitem']:not(:disabled)")?.focus();
    const resize = new ResizeObserver(place);
    resize.observe(inner);
    return () => resize.disconnect();
  }, [anchor, byKeyboard]);

  useEffect(
    () => () => {
      if (byKeyboard) anchor.current?.querySelector<HTMLElement>("[aria-haspopup]")?.focus();
    },
    [anchor, byKeyboard],
  );

  useEffect(() => {
    const away = (e: Event) => {
      const target = e.target as Node;
      if (!box.current?.contains(target) && !anchor.current?.contains(target)) onClose();
    };
    const escape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    const scrolled = (e: Event) => !box.current?.contains(e.target as Node) && onClose();
    document.addEventListener("mousedown", away, true);
    document.addEventListener("keydown", escape, true);
    window.addEventListener("scroll", scrolled, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", away, true);
      document.removeEventListener("keydown", escape, true);
      window.removeEventListener("scroll", scrolled, true);
      window.removeEventListener("resize", onClose);
    };
  }, [anchor, onClose]);

  return createPortal(
    // data-text-format: a press in here keeps the text being typed in open
    <div
      ref={box}
      data-text-format
      onMouseDown={keepFocusExceptFields}
      className="fixed z-[60] overflow-y-auto rounded-lg border border-line bg-white p-1 shadow-[0_12px_32px_-10px_rgba(16,24,40,0.4)]"
      style={{ left: 0, top: 0, visibility: "hidden", width: width ?? "max-content", minWidth: 150, maxWidth: "calc(100vw - 16px)" }}
    >
      <div ref={content}>{children}</div>
    </div>,
    document.body,
  );
}

interface MenuButtonProps extends Omit<ButtonProps, "onClick"> {
  onMain?: () => void; // a split button: this part does the usual thing, the arrow opens the menu
  width?: number;
  children: (close: () => void) => ReactNode;
}

// A button with a menu: either all of it opens the menu, or (with `onMain`) the icon acts and the little arrow opens it.
export function MenuButton({ title, shortcut, icon, label, pressed, disabled, onMain, width, children, className = "" }: MenuButtonProps) {
  const [open, setOpen] = useState(false);
  const [keyboard, setKeyboard] = useState(false); // opened with the keyboard: the menu takes the focus (arrows move in it, Escape gives it back)
  const anchor = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const toggle = (e: MouseEvent) => {
    setKeyboard(e.detail === 0);
    setOpen((o) => !o);
  };
  const arrow = <ChevronDown size={11} strokeWidth={2} className="text-muted" />;
  return (
    <div ref={anchor} className={`inline-flex flex-none ${className}`}>
      {onMain ? (
        <>
          <button type="button" title={tip(title, shortcut)} aria-label={title} aria-pressed={pressed} disabled={disabled} onMouseDown={keepFocus} onClick={onMain} className={`${BASE} rounded-s-md ${label ? "grid-flow-col gap-1.5 px-2 text-[12px] font-medium" : "w-7"} ${toneCls(!!pressed)}`}>
            {icon}
            {label && <span>{label}</span>}
          </button>
          <button type="button" title={title} aria-label={`${title} ▾`} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onMouseDown={keepFocus} onClick={toggle} className={`${BASE} w-3.5 rounded-e-md ${toneCls(open)}`}>
            {arrow}
          </button>
        </>
      ) : (
        <button type="button" title={tip(title, shortcut)} aria-label={title} aria-haspopup="menu" aria-expanded={open} aria-pressed={pressed} disabled={disabled} onMouseDown={keepFocus} onClick={toggle} className={`${BASE} grid-flow-col gap-0.5 rounded-md ${label ? "px-2" : "px-1.5"} ${toneCls(!!pressed || open)}`}>
          {icon}
          {label && <span className="ps-0.5 text-[12px] font-medium">{label}</span>}
          {arrow}
        </button>
      )}
      {open && (
        <Popover anchor={anchor} onClose={close} width={width} byKeyboard={keyboard}>
          {children(close)}
        </Popover>
      )}
    </div>
  );
}

// ---- what goes in a dropdown ----

// Arrow keys move between the items of a menu.
function moveInMenu(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>("[role^='menuitem']:not(:disabled)")];
  const at = items.indexOf(document.activeElement as HTMLElement);
  if (!items.length) return;
  e.preventDefault();
  items[(at + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length].focus();
}

export function Menu({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <div role="menu" aria-label={label} onKeyDown={moveInMenu} className="flex flex-col">
      {children}
    </div>
  );
}

export const MenuHeading = ({ children }: { children: ReactNode }) => <p className="px-2 pt-1.5 pb-1 text-[10px] font-semibold tracking-wide text-faint uppercase">{children}</p>;
export const MenuSeparator = () => <hr className="my-1 border-line" />;

interface ItemProps {
  label: string;
  labelStyle?: CSSProperties; // the label looks like what the item does (an underline, a shadow…)
  icon?: ReactNode;
  shortcut?: string;
  checked?: boolean; // a choice among others (shows a check mark)
  disabled?: boolean;
  onSelect: () => void;
}

export function MenuItem({ label, labelStyle, icon, shortcut, checked, disabled, onSelect }: ItemProps) {
  return (
    <button
      type="button"
      role={checked === undefined ? "menuitem" : "menuitemradio"}
      aria-checked={checked}
      disabled={disabled}
      onMouseDown={keepFocus}
      onClick={onSelect}
      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-start text-[13px] text-ink transition-colors hover:bg-subtle focus:bg-subtle focus:outline-none disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <span className="grid size-4 flex-none place-items-center text-accent">{checked ? <Check size={14} strokeWidth={2.4} /> : icon}</span>
      <span className="min-w-0 flex-1 truncate" style={labelStyle}>
        {label}
      </span>
      {shortcut && <span className="ps-3 text-[11px] text-faint">{shortcut}</span>}
    </button>
  );
}

// Word's "Font color" and "Highlight": the icon applies the color used last (the one shown under it), the arrow opens the
// swatches. `toggle`: the icon takes the color off when the words already have it.
export function ColorMenu({ title, icon, value, initial, autoLabel, colors, disabled, toggle, onChange, className = "" }: {
  title: string;
  icon: ReactNode;
  value: string | undefined; // what the words have (undefined = automatic)
  initial: string; // the color of the icon until another one is picked
  autoLabel: string;
  colors?: string[];
  disabled?: boolean;
  toggle?: boolean;
  onChange: (color: string | undefined) => void;
  className?: string;
}) {
  const [last, setLast] = useState(initial);
  return (
    <MenuButton
      title={title}
      disabled={disabled}
      className={className}
      width={216}
      pressed={toggle && !!value}
      onMain={() => onChange(toggle && value === last ? undefined : last)}
      icon={
        <span className="flex flex-col items-center leading-none">
          {icon}
          <span className="mt-0.5 h-[3px] w-4 rounded-full ring-1 ring-black/10" style={{ background: last }} />
        </span>
      }
    >
      {(close) => (
        <div className="p-1.5">
          <ColorGrid
            value={value}
            autoLabel={autoLabel}
            colors={colors}
            onChange={(c) => {
              if (c) setLast(c);
              onChange(c);
              close();
            }}
          />
        </div>
      )}
    </MenuButton>
  );
}

// A text field or a list, as high as the buttons.
export const fieldCls = "h-7 w-full min-w-0 rounded-md border border-line bg-white px-1.5 text-[12.5px] text-ink outline-none focus:border-indigo-400";
