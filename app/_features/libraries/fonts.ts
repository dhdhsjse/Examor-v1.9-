// The fonts the teacher can pick, everywhere in the app (Home → Font, the font menus, the format bar on
// the page). Add a font here and it is offered everywhere; nothing else changes.
//
// They are fonts of the computer (the app works offline): a font that is not installed is shown greyed
// out and can't be picked. `value` is what a block stores (BlockFont.family); the page draws it with
// fallbacks (fontStack in _lib/fonts.ts), so Arabic letters always render even with a Latin-only font.

export type FontCategory = "sans-serif" | "serif" | "monospace" | "arabic" | "fun";

export type FontDefinition = {
  id: string; // e.g. "arial"
  label: string; // shown name, e.g. "Arial"
  value: string; // font family name, e.g. "Arial"
  category: FontCategory;
  script: "both" | "latin" | "arabic"; // the letters it has (an Arabic sample is used to find Arabic-only fonts)
};

// The order of the groups in Home → Font. `label` is an English key (translated).
export const FONT_CATEGORIES: { id: FontCategory; label: string }[] = [
  { id: "sans-serif", label: "Sans serif" },
  { id: "serif", label: "Serif" },
  { id: "arabic", label: "Arabic" },
  { id: "monospace", label: "Monospace" },
  { id: "fun", label: "Fun" },
];

const font = (label: string, category: FontCategory, script: FontDefinition["script"] = "latin"): FontDefinition => ({
  id: label.toLowerCase().replace(/\s+/g, "-"),
  label,
  value: label,
  category,
  script,
});

export const fontLibrary: FontDefinition[] = [
  // Sans serif
  font("Segoe UI", "sans-serif", "both"),
  font("Arial", "sans-serif", "both"),
  font("Tahoma", "sans-serif", "both"),
  font("Roboto", "sans-serif"),
  font("Calibri", "sans-serif"),
  font("Verdana", "sans-serif"),
  font("Trebuchet MS", "sans-serif"),
  font("Century Gothic", "sans-serif"),
  // Serif
  font("Times New Roman", "serif", "both"),
  font("Georgia", "serif"),
  font("Cambria", "serif"),
  font("Garamond", "serif"),
  font("Book Antiqua", "serif"),
  // Arabic
  font("Cairo", "arabic", "both"),
  font("Amiri", "arabic", "both"),
  font("Traditional Arabic", "arabic", "arabic"),
  font("Simplified Arabic", "arabic", "arabic"),
  font("Arabic Typesetting", "arabic", "arabic"),
  font("Sakkal Majalla", "arabic", "arabic"),
  font("Aldhabi", "arabic", "arabic"),
  font("Andalus", "arabic", "arabic"),
  // Monospace
  font("Courier New", "monospace", "both"),
  font("Consolas", "monospace"),
  // Fun
  font("Comic Sans MS", "fun"),
];
