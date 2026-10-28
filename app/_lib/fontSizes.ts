// The sizes of the size box of the ribbon, and the steps of Grow / Shrink font (the buttons and Ctrl+Shift+> / Ctrl+Shift+<).

export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]; // as in Word
export const MIN_SIZE = 8;
export const MAX_SIZE = 72;

/** The next usual size above (or under) `size`. */
export const stepSize = (size: number, up: boolean) => (up ? (FONT_SIZES.find((s) => s > size) ?? MAX_SIZE) : ([...FONT_SIZES].reverse().find((s) => s < size) ?? MIN_SIZE));

/** Ctrl+Shift+> and Ctrl+Shift+< (by the character the key gives, so it is the same on every keyboard): which way, or null for another key. */
export function sizeKey(e: { key: string; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; altKey: boolean }): "up" | "down" | null {
  if (!(e.ctrlKey || e.metaKey) || !e.shiftKey || e.altKey) return null;
  return e.key === ">" ? "up" : e.key === "<" ? "down" : null;
}
