// Sub- and superscripts in the texts of the graph paper ("u_C(V)", "n(H_2O_2)(×10^-4 mol)", "V_{E}/2"): one markup for the axis
// titles, the texts, the names of curves and the marks, turned into runs that the Konva canvas and the SVG picture each lay
// out in their own way. _ takes a run of letters or a number (u_C, x_max, H_2O), ^ one letter or a number with its sign (e^x,
// 10^-4, Na^+); _{...} and ^{...} take what is between the braces; \_ and \^ are the characters themselves. Text with no
// markup is one plain run. Pure functions (no React).

export type TextRun = { text: string; script?: "sub" | "sup" };

/** A script is this much of the size of the text around it, and sits this far (in sizes of that text) below or above its baseline. */
export const SCRIPT_SIZE = 0.7;
export const SUB_SHIFT = 0.28;
export const SUP_SHIFT = -0.42;
/** What a character is worth in sizes of its text: texts are laid out by the renderers, this only sizes the frames drawn around them. */
const AVERAGE_CHAR = 0.6;

// What a "_" or "^" takes after it, or null when there is nothing to take (then it is just the character).
function takeScript(rest: string, sup: boolean): { body: string; used: number } | null {
  if (rest.startsWith("{")) {
    const end = rest.indexOf("}");
    return end > 1 ? { body: rest.slice(1, end), used: end + 1 } : null;
  }
  const number = (sup ? /^[+\-−]?\d+/ : /^\d+/).exec(rest);
  if (number) return { body: number[0], used: number[0].length };
  const charge = sup ? /^[+\-−]/.exec(rest) : null; // Na^+
  if (charge) return { body: charge[0], used: 1 };
  const letters = (sup ? /^\p{L}/u : /^\p{L}+/u).exec(rest);
  return letters ? { body: letters[0], used: letters[0].length } : null;
}

/** The text as runs: "u_C(V)" is "u", "C" (subscript), "(V)". */
export function parseLabel(src: string): TextRun[] {
  if (!/[_^\\]/.test(src)) return [{ text: src }];
  const runs: TextRun[] = [];
  const push = (text: string, script?: "sub" | "sup") => {
    if (!text) return;
    const last = runs[runs.length - 1];
    if (last && last.script === script) last.text += text;
    else runs.push(script ? { text, script } : { text });
  };
  let plain = "";
  for (let i = 0; i < src.length; ) {
    const ch = src[i];
    if (ch === "\\" && "_^\\".includes(src[i + 1] ?? "\0")) {
      plain += src[i + 1];
      i += 2;
      continue;
    }
    if (ch === "_" || ch === "^") {
      const taken = takeScript(src.slice(i + 1), ch === "^");
      if (taken) {
        push(plain);
        plain = "";
        push(ch === "^" ? taken.body.replace(/-/g, "−") : taken.body, ch === "_" ? "sub" : "sup"); // (a real minus in an exponent)
        i += 1 + taken.used;
        continue;
      }
    }
    plain += ch;
    i++;
  }
  push(plain);
  return runs.length ? runs : [{ text: "" }];
}

/** Whether the text has any sub- or superscript (otherwise it is drawn as plain text, as before). */
export const hasScripts = (src: string) => /[_^]/.test(src) && parseLabel(src).some((r) => r.script);

/** What the text says without the markup: "u_C(V)" reads "uC(V)". */
export const plainLabel = (src: string) => parseLabel(src).map((r) => r.text).join("");

/** About how wide the runs are at this size, in px (a script counts at its smaller size). */
export const labelWidth = (runs: TextRun[], size: number) => runs.reduce((w, r) => w + r.text.length * size * (r.script ? SCRIPT_SIZE : 1) * AVERAGE_CHAR, 0);
