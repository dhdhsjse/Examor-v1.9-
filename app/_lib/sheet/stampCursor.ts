import { formatMark } from "@/app/_lib/sheet/marks";
import type { ToolAction } from "@/app/_lib/tools";

// What a sticker in hand reads: its mark or word, a line, or Σ for a total
function labelOf(stamp: ToolAction, pad: boolean): string {
  if (stamp.kind !== "block") return "•";
  if (stamp.type === "rule") return "—";
  const p = (stamp.preset ?? {}) as { kind?: string; value?: number; text?: string };
  if (p.kind === "number" && typeof p.value === "number") return formatMark(p.value, pad);
  if (p.kind === "text") return p.text ?? "";
  if (p.kind === "total") return "Σ";
  return "•";
}

const FONT_SIZE = 10;
const FONT_FAMILY = "Arial, sans-serif"; // (a cursor picture cannot use the fonts of the page)
const HEIGHT = 16;
const MIN_WIDTH = 18;
const MAX_WIDTH = 128; // (the browser ignores a larger cursor)

const widthOf = (text: string) => {
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return text.length * FONT_SIZE * 0.7;
  ctx.font = `600 ${FONT_SIZE}px ${FONT_FAMILY}`;
  return ctx.measureText(text).width;
};

const escapeXml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// The Stamp tool in hand: the mouse itself is the sticker (the words are typed by the teacher, hence the escaping). Its centre is the tip of the
// mouse, because a click puts the sticker centred there.
export function stampCursor(stamp: ToolAction, pad: boolean): string {
  const label = labelOf(stamp, pad);
  const w = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, 2 * Math.ceil((widthOf(label) + 8) / 2)));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${HEIGHT}">` +
    `<rect x="1" y="1" width="${w - 2}" height="${HEIGHT - 2}" rx="3.5" fill="#059669" stroke="#ffffff" stroke-width="1"/>` +
    `<text x="${w / 2}" y="${HEIGHT / 2}" text-anchor="middle" dominant-baseline="central" font-family="${FONT_FAMILY}" font-size="${FONT_SIZE}" font-weight="600" fill="#ffffff">${escapeXml(label)}</text>` +
    `</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${w / 2} ${HEIGHT / 2}, crosshair`;
}
