// Keys of the math keyboard, and the tabs that group them. The tabs of each subject are in mathLayout.ts
// and physicsLayout.ts; layouts.ts picks the ones to show.
//
// `latex` is what the key inserts in the equation: #? = a box to fill, #0 = the selected part,
// #@ = the thing just before the cursor (so "x" then "x²" gives x²). After the insert the cursor is in
// the first box, which is how a key "puts the cursor inside the numerator". MathLive moves by its own
// atoms, not by characters of the LaTeX, so counting characters back from the end would land elsewhere.

export interface KeyButton {
  latex: string;
  title: string; // tooltip (English; translated when the interface has a translation)
  label?: string; // drawn with this LaTeX instead of `latex` (for long templates)
  wide?: boolean;
}

/** A part of a tab, picked by a chip under the tabs (the Formulas tab: Mechanics, Electricity…). */
export interface KeyGroup {
  id: string; // unique in its tab
  label: string; // English, translated by the keyboard
  buttons: KeyButton[];
}

export interface KeyboardTab {
  id: string; // unique in its layout
  label: string; // English, translated by the keyboard
  buttons: KeyButton[]; // every key of the tab (all its groups, when it has some)
  groups?: KeyGroup[];
}

export const k = (latex: string, title: string, extra: Partial<KeyButton> = {}): KeyButton => ({ latex, title, ...extra });

/** A tab cut into groups: its keys are those of all its groups. */
export const groupedTab = (id: string, label: string, groups: KeyGroup[]): KeyboardTab => ({
  id,
  label,
  groups,
  buttons: groups.flatMap((g) => g.buttons),
});

/** A whole formula: drawn on a wide key. */
export const f = (latex: string, title: string, extra: Partial<KeyButton> = {}): KeyButton => k(latex, title, { wide: true, ...extra });

// LaTeX drawn on a key: boxes to fill are shown as small squares.
export const keyLabel = (key: KeyButton) => (key.label ?? key.latex).replace(/#\?|#0|#@/g, "\\square");
