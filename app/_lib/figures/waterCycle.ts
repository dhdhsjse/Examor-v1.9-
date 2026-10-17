import { arrowDefs, ink, str, svg, text } from "./svg";
import type { FigureDef } from "./types";
import type { Lang } from "../types";

const NAMES: Record<Lang, string[]> = {
  fr: ["Évaporation", "Condensation", "Précipitations", "Ruissellement"],
  ar: ["التبخر", "التكاثف", "التساقطات", "الجريان السطحي"],
};

// Sun, sea, cloud and mountain with the four steps: numbered, named or blank lines.
export const waterCycleFigure: FigureDef = {
  id: "water-cycle",
  name: "Water cycle",
  params: [
    {
      key: "labels",
      label: "Labels",
      kind: "select",
      options: [
        { value: "numbers", label: "Numbers" },
        { value: "names", label: "Names" },
        { value: "lines", label: "Lines to fill" },
      ],
    },
  ],
  defaults: () => ({ labels: "numbers" }),
  build: (p, lang) => {
    const color = ink(p);
    const mode = str(p, "labels", "numbers");
    const names = NAMES[lang] ?? NAMES.fr;
    let body = arrowDefs(color);
    body += `<circle cx="45" cy="40" r="18" fill="#fde68a"/>`;
    body += `<path d="M215 55a18 18 0 0 1 30-14a20 20 0 0 1 36 8a14 14 0 0 1-4 28H220a14 14 0 0 1-5-22z" fill="#f4f4f5"/>`;
    body += `<polygon points="230,170 270,110 310,170" fill="#e7e5e4"/>`;
    body += `<path d="M10 175q20-8 40 0t40 0t40 0t40 0t40 0V210H10z" fill="#dbeafe"/>`;
    body += `<path d="M100 165Q120 110 205 70" marker-end="url(#a)" stroke-dasharray="6 4"/>`;
    body += `<path d="M240 92v18M255 92v18M270 92v18" stroke="#2563eb" stroke-dasharray="4 4"/>`;
    body += `<path d="M250 172Q220 190 190 182" marker-end="url(#a)"/>`;
    // Where each label goes: evaporation, condensation, precipitation, runoff.
    const spots: [number, number][] = [
      [112, 122],
      [250, 30],
      [290, 100],
      [205, 200],
    ];
    const size = mode === "numbers" ? 15 : 12;
    spots.forEach(([x, y], i) => {
      const s = mode === "names" ? names[i] : mode === "lines" ? `${i + 1} ………` : String(i + 1);
      body += text(x, y, s, { size, fill: color, bold: mode === "numbers", anchor: mode === "numbers" ? "start" : "middle" });
    });
    return svg(mode === "numbers" ? 320 : 350, 220, body, color);
  },
};
