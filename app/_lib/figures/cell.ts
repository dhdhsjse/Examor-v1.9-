import { ink, line, str, svg, text, type Pt } from "./svg";
import type { FigureDef } from "./types";
import type { Lang } from "../types";

const NAMES: Record<Lang, Record<string, string>> = {
  fr: { wall: "Paroi", membrane: "Membrane", cytoplasm: "Cytoplasme", nucleus: "Noyau", vacuole: "Vacuole", chloroplast: "Chloroplaste", mitochondrion: "Mitochondrie" },
  ar: {
    wall: "الجدار الخلوي",
    membrane: "الغشاء السيتوبلازمي",
    cytoplasm: "السيتوبلازم",
    nucleus: "النواة",
    vacuole: "الفجوة",
    chloroplast: "البلاستيدة الخضراء",
    mitochondrion: "الميتوكوندري",
  },
};

// A plant or animal cell with lines pointing to its parts: numbered, named, or blank lines to fill.
export const cellFigure: FigureDef = {
  id: "cell",
  name: "Cell",
  params: [
    {
      key: "type",
      label: "Cell",
      kind: "select",
      options: [
        { value: "plant", label: "Plant" },
        { value: "animal", label: "Animal" },
      ],
    },
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
  defaults: () => ({ type: "plant", labels: "numbers" }),
  build: (p, lang) => {
    const color = ink(p);
    const plant = str(p, "type", "plant") !== "animal";
    const mode = str(p, "labels", "numbers");
    let body = "";
    // [part, point on the drawing]
    let parts: [string, Pt][];
    if (plant) {
      body += `<rect x="20" y="20" width="220" height="160" rx="24" stroke-width="3"/><rect x="30" y="30" width="200" height="140" rx="18" stroke-width="1.2"/>`;
      body += `<ellipse cx="150" cy="110" rx="62" ry="40" fill="#e0e7ff"/><circle cx="74" cy="72" r="22" fill="#e4e4e7"/><circle cx="78" cy="68" r="6" fill="#71717a" stroke="none"/>`;
      body += `<ellipse cx="200" cy="55" rx="12" ry="7" fill="#86efac"/><ellipse cx="62" cy="148" rx="12" ry="7" fill="#86efac"/><ellipse cx="212" cy="150" rx="10" ry="6" fill="#86efac"/>`;
      parts = [
        ["wall", [240, 36]],
        ["membrane", [229, 62]],
        ["chloroplast", [210, 55]],
        ["nucleus", [88, 76]],
        ["vacuole", [200, 112]],
        ["cytoplasm", [120, 160]],
      ];
    } else {
      body += `<path d="M40 100C30 50 90 22 140 30C200 38 240 60 236 110C232 160 180 182 130 176C70 170 48 150 40 100Z" stroke-width="2.2"/>`;
      body += `<circle cx="128" cy="100" r="26" fill="#e4e4e7"/><circle cx="132" cy="96" r="7" fill="#71717a" stroke="none"/>`;
      body += `<ellipse cx="190" cy="78" rx="16" ry="8" fill="#fde68a" transform="rotate(-20 190 78)"/><ellipse cx="80" cy="140" rx="15" ry="7" fill="#fde68a" transform="rotate(15 80 140)"/>`;
      parts = [
        ["membrane", [234, 92]],
        ["nucleus", [148, 92]],
        ["mitochondrion", [200, 76]],
        ["cytoplasm", [175, 140]],
      ];
    }
    const x0 = 262;
    const names = NAMES[lang] ?? NAMES.fr;
    const rows = parts.length;
    parts.forEach(([key, pt], i) => {
      const y = 28 + (i * 150) / Math.max(1, rows - 1);
      body += line(pt, [x0, y], 'stroke-width="1"') + `<circle cx="${pt[0]}" cy="${pt[1]}" r="1.8" fill="${color}" stroke="none"/>`;
      if (mode === "names") body += text(x0 + 6, y + 5, names[key] ?? key, { size: 13, fill: color });
      else if (mode === "lines") body += text(x0 + 6, y + 5, `${i + 1}  ……………………`, { size: 13, fill: color });
      else body += text(x0 + 6, y + 5, String(i + 1), { size: 14, fill: color, bold: true });
    });
    const width = mode === "numbers" ? x0 + 26 : x0 + (lang === "ar" ? 150 : 130);
    return svg(width, 200, body, color);
  },
};
