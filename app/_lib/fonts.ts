// Fonts the teacher can pick. They are system fonts (the app works offline); fonts missing on
// this computer are shown greyed out. Every font falls back to Segoe UI / Tahoma / Arial, so
// Arabic letters always render even with a Latin-only font.

export interface FontChoice {
  name: string;
  script: "both" | "latin" | "arabic";
}

export const DEFAULT_FONT = "Segoe UI";
const FALLBACK = ["Segoe UI", "Tahoma", "Arial", "sans-serif"];

export const FONT_CHOICES: FontChoice[] = [
  { name: "Segoe UI", script: "both" },
  { name: "Arial", script: "both" },
  { name: "Tahoma", script: "both" },
  { name: "Times New Roman", script: "both" },
  { name: "Calibri", script: "latin" },
  { name: "Cambria", script: "latin" },
  { name: "Georgia", script: "latin" },
  { name: "Verdana", script: "latin" },
  { name: "Trebuchet MS", script: "latin" },
  { name: "Century Gothic", script: "latin" },
  { name: "Garamond", script: "latin" },
  { name: "Book Antiqua", script: "latin" },
  { name: "Comic Sans MS", script: "latin" },
  { name: "Courier New", script: "both" },
  { name: "Consolas", script: "latin" },
  { name: "Traditional Arabic", script: "arabic" },
  { name: "Simplified Arabic", script: "arabic" },
  { name: "Arabic Typesetting", script: "arabic" },
  { name: "Sakkal Majalla", script: "arabic" },
  { name: "Aldhabi", script: "arabic" },
  { name: "Andalus", script: "arabic" },
];

// "Georgia" → "Georgia, Segoe UI, Tahoma, Arial, sans-serif" (for the canvas and CSS).
export function fontStack(name?: string): string {
  const first = name?.trim() || DEFAULT_FONT;
  return [first, ...FALLBACK.filter((f) => f !== first)].join(", ");
}

// ---- Which fonts are installed (same trick as fontCheck.ts: an installed font changes the width) ----

let installed: Promise<Set<string>> | null = null;

export function installedFonts(): Promise<Set<string>> {
  installed ??= (async () => {
    try {
      await document.fonts.ready;
    } catch {}
    const ctx = document.createElement("canvas").getContext("2d");
    const out = new Set<string>();
    if (!ctx) return new Set(FONT_CHOICES.map((f) => f.name));
    for (const f of FONT_CHOICES) {
      const sample = f.script === "arabic" ? "أجب عن الأسئلة التالية" : "Évaluation — Devoir n°1";
      const found = ["monospace", "serif"].some((fallback) => {
        ctx.font = `40px ${fallback}`;
        const base = ctx.measureText(sample).width;
        ctx.font = `40px "${f.name}", ${fallback}`;
        return Math.abs(ctx.measureText(sample).width - base) > 0.5;
      });
      if (found) out.add(f.name);
    }
    return out;
  })();
  return installed;
}

// Colors offered in the color pickers (the last one is "custom").
export const TEXT_COLORS = ["#111827", "#4b5563", "#dc2626", "#ea580c", "#ca8a04", "#15803d", "#0d9488", "#2563eb", "#4f46e5", "#9333ea", "#db2777"];
