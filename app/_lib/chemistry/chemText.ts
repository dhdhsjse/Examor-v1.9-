// Chemistry text typed plainly and drawn properly: "H2SO4" → H₂SO₄, "Fe2+" → Fe²⁺, "OH-" → OH⁻.
// Pure functions: the layout takes the function that measures a text, so it is tested without a canvas.

export type ChemKind = "normal" | "sub" | "sup";
export type ChemSegment = { text: string; kind: ChemKind };

const isAtomEnd = (c: string) => /[A-Za-z)\]]/.test(c); // what a subscript or a charge can follow
const isSign = (c: string) => c === "+" || c === "-" || c === "−";
const sign = (c: string) => (c === "+" ? "+" : "−"); // a real minus sign

/**
 * Splits a text into normal, subscript and superscript pieces.
 * - Digits right after a letter or a closing bracket are subscripts: H2O, CH3COOH, (NH4)2SO4, C6H12O6.
 *   Other digits stay normal: "2 H2O", "1,2-dibromo".
 * - A + or − right after a letter or bracket, and not followed by a letter or digit, is a charge: H+, OH-, Na+.
 * - Digits followed by such a sign are a charge too, the last digit being its size: Fe2+, SO42- (SO₄²⁻).
 *   (So "H2+" reads as H²⁺, not H₂⁺: ions of metals are far more common than H₂⁺.)
 * A lone "+" or "−" (between two molecules, or in "->") is left alone.
 */
export function chemSegments(raw: string): ChemSegment[] {
  const out: ChemSegment[] = [];
  const push = (text: string, kind: ChemKind) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.kind === kind) last.text += text;
    else out.push({ text, kind });
  };
  // the sign at index j ends a token: nothing alphanumeric follows it
  const endsToken = (j: number) => j + 1 >= raw.length || !/[A-Za-z0-9]/.test(raw[j + 1]);

  let i = 0;
  while (i < raw.length) {
    const c = raw[i];
    const prev = i > 0 ? raw[i - 1] : "";
    if (/\d/.test(c) && isAtomEnd(prev)) {
      let j = i;
      while (j < raw.length && /\d/.test(raw[j])) j++;
      const run = raw.slice(i, j);
      if (j < raw.length && isSign(raw[j]) && endsToken(j)) {
        push(run.slice(0, -1), "sub");
        push(run.slice(-1) + sign(raw[j]), "sup");
        i = j + 1;
      } else {
        push(run, "sub");
        i = j;
      }
    } else if (isSign(c) && isAtomEnd(prev) && endsToken(i)) {
      push(sign(c), "sup");
      i++;
    } else {
      push(c, "normal");
      i++;
    }
  }
  return out;
}

/** What the segments look like once drawn: smaller, lower (sub) or higher (sup). Fractions of the font size. */
const SCALE = 0.7;
const ASCENT = 0.905; // baseline of Arial, from the top of a line
const SUB_DROP = 0.2;
const SUP_RAISE = 0.4;

export type Measure = (text: string, fontSize: number) => number;
export type ChemItem = { text: string; kind: ChemKind; x: number; y: number; fontSize: number };

/** Places the pieces of a text one after the other, from (0, 0) = the top-left corner of the line. */
export function layoutChemText(raw: string, fontSize: number, measure: Measure): { items: ChemItem[]; width: number; height: number } {
  const items: ChemItem[] = [];
  let x = 0;
  for (const seg of chemSegments(raw)) {
    const size = seg.kind === "normal" ? fontSize : fontSize * SCALE;
    const top = seg.kind === "normal" ? 0 : fontSize * (ASCENT + (seg.kind === "sub" ? SUB_DROP : -SUP_RAISE)) - size * ASCENT;
    items.push({ text: seg.text, kind: seg.kind, x, y: top, fontSize: size });
    x += measure(seg.text, size);
  }
  return { items, width: x, height: fontSize * 1.2 };
}
