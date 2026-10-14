// Text measuring + word wrapping, shared by the canvas and the layout code,
// so the drawn text and the computed block heights always match.

export const FONT_FAMILY = "Segoe UI, Tahoma, Arial, sans-serif"; // render Arabic + French

let ctx: CanvasRenderingContext2D | null = null;
const cache = new Map<string, string[]>();

function measure(text: string, size: number, bold: boolean): number {
  if (typeof document === "undefined") return text.length * size * 0.55; // fallback (no browser)
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * size * 0.55;
  ctx.font = `${bold ? "bold" : "normal"} ${size}px ${FONT_FAMILY}`;
  return ctx.measureText(text).width;
}

// Split text into lines that fit in `width` (keeps the user's own line breaks).
export function wrapText(text: string, width: number, size: number, bold = false): string[] {
  const key = `${size}|${bold}|${Math.round(width)}|${text}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (!line || measure(test, size, bold) <= width) line = test;
      else {
        lines.push(line);
        line = word;
      }
    }
    lines.push(line);
  }

  if (cache.size > 3000) cache.clear();
  cache.set(key, lines);
  return lines;
}
