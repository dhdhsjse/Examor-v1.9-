import { getCurrentWindow } from "@tauri-apps/api/window";
import { isTauri } from "./storage";

// The desktop window has no native title bar (tauri.conf.json: "decorations": false).
// The top bar draws the minimize / maximize / close buttons and acts as the drag area.
// Outside the desktop app (plain browser) these do nothing.

export const hasWindowControls = isTauri;

export function minimizeWindow() {
  if (isTauri()) void getCurrentWindow().minimize();
}

export function toggleMaximizeWindow() {
  if (isTauri()) void getCurrentWindow().toggleMaximize();
}

export function closeWindow() {
  if (isTauri()) void getCurrentWindow().close();
}

// Calls `onChange` with the maximized state now and after every resize. Returns the cleanup.
export function watchMaximized(onChange: (maximized: boolean) => void): () => void {
  if (!isTauri()) return () => {};
  const win = getCurrentWindow();
  let stopped = false;
  let unlisten: (() => void) | undefined;
  const update = () => void win.isMaximized().then((m) => !stopped && onChange(m));
  update();
  void win.onResized(update).then((fn) => (stopped ? fn() : (unlisten = fn)));
  return () => {
    stopped = true;
    unlisten?.();
  };
}

// A Studio covers the whole window, but the window buttons stay above it (they are the title bar): its header keeps their corner
// free, so its Insert and close buttons are never under them, and its empty parts move the window like the top bar.
// `compact`: a header no higher than it has to be (as high as the top bar and the window buttons).
export const studioHeaderProps = (compact = false) => ({
  className: `flex items-center border-b border-line ${compact ? "h-9 shrink-0 gap-2 px-3" : "gap-3 px-4 py-2.5"}${hasWindowControls() ? " pe-[150px]" : ""}`,
  "data-tauri-drag-region": hasWindowControls() ? "" : undefined,
});
