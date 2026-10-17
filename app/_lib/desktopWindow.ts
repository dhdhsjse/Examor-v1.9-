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
