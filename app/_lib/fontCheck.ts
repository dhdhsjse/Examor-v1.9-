import { FONT_FAMILY } from "./measure";

// Which font of our list the canvas really uses, for Latin and for Arabic letters.
// Trick: a font that is installed AND has the letters draws them at a different width than
// the generic fallback font does.

export interface FontReport {
  latin: string | null; // e.g. "Segoe UI"; null = only a fallback font
  arabic: string | null;
}

const LATIN_SAMPLE = "Évaluation — Devoir n°1 : Mathématiques";
const ARABIC_SAMPLE = "فرض محروس رقم 1 في مادة الرياضيات — أجب عن الأسئلة";
const FAMILIES = FONT_FAMILY.split(",").map((f) => f.trim().replace(/^["']|["']$/g, "")).filter((f) => f !== "sans-serif");

function usable(ctx: CanvasRenderingContext2D, family: string, sample: string): boolean {
  return ["monospace", "serif"].some((fallback) => {
    ctx.font = `40px ${fallback}`;
    const base = ctx.measureText(sample).width;
    ctx.font = `40px "${family}", ${fallback}`;
    return Math.abs(ctx.measureText(sample).width - base) > 0.5;
  });
}

export async function checkFonts(): Promise<FontReport> {
  try {
    await document.fonts.ready;
  } catch {}
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return { latin: null, arabic: null };
  return {
    latin: FAMILIES.find((f) => usable(ctx, f, LATIN_SAMPLE)) ?? null,
    arabic: FAMILIES.find((f) => usable(ctx, f, ARABIC_SAMPLE)) ?? null,
  };
}
