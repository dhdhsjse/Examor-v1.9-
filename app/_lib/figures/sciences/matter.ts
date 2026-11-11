// Using matter and finding where it comes from: the ExAO set-up (probes in a bioreactor, measured by computer).
import { bool, str } from "../svg";
import type { FigureDef } from "../types";
import { labeledFigure } from "./labeled";

function exao(light: boolean, co2: boolean, c: string) {
  let s = "";
  // bioreactor: chamber, suspension, lid
  s += `<path d="M120 90V196Q120 204 128 204H196Q204 204 204 196V90" fill="#ffffff" stroke-width="2"/><path d="M114 90H210" stroke-width="3"/>`;
  s += `<path d="M120 112q10 -5 21 0t21 0t21 0t21 0" stroke-width="1.2"/>`;
  for (const [x, y] of [
    [132, 130], [150, 150], [170, 128], [188, 146], [140, 172], [176, 176], [160, 186], [190, 166], [130, 154], [156, 168],
  ])
    s += `<circle cx="${x}" cy="${y}" r="2.6" stroke-width="1"/>`;
  s += `<rect x="146" y="192" width="30" height="7" rx="3.5" fill="${c}" stroke="none"/>`;
  // probes and syringe through the lid
  s += `<rect x="132" y="40" width="12" height="122" rx="4" fill="#ffffff" stroke-width="1.6"/><rect x="134" y="152" width="8" height="12" fill="${c}" stroke="none"/>`;
  if (co2) s += `<rect x="182" y="40" width="12" height="104" rx="4" fill="#ffffff" stroke-width="1.6"/><rect x="184" y="134" width="8" height="12" fill="${c}" stroke="none"/>`;
  s += `<rect x="156" y="30" width="12" height="46" fill="#ffffff" stroke-width="1.4"/><path d="M162 76V126M152 30H172M162 30V18M154 18H170" stroke-width="1.4"/>`;
  // magnetic stirrer
  s += `<rect x="96" y="208" width="132" height="30" rx="4" fill="#ffffff" stroke-width="1.8"/><circle cx="206" cy="223" r="7" stroke-width="1.4"/><path d="M206 218v5" stroke-width="1.4"/>`;
  // light
  if (light) {
    s += `<path d="M52 128Q30 128 30 150Q30 168 46 174V184H62V174Q78 168 78 150Q78 128 56 128Z" fill="#ffffff" stroke-width="1.8"/><path d="M46 188H62" stroke-width="2"/>`;
    s += `<path d="M86 136L108 130M88 152H110M86 168L108 174" stroke-width="1.4" stroke-dasharray="3 3"/>`;
  }
  // cables to the interface and the computer
  s += `<path d="M138 40Q138 14 210 18Q246 20 258 44" stroke-width="1.4"/>`;
  if (co2) s += `<path d="M188 40Q190 28 230 30Q250 32 264 44" stroke-width="1.4"/>`;
  s += `<rect x="248" y="44" width="56" height="34" rx="4" fill="#ffffff" stroke-width="1.8"/><circle cx="262" cy="61" r="3" fill="${c}" stroke="none"/><circle cx="276" cy="61" r="3" fill="${c}" stroke="none"/>`;
  s += `<path d="M300 78Q310 100 316 112" stroke-width="1.4"/>`;
  s += `<rect x="280" y="112" width="100" height="74" rx="4" fill="#ffffff" stroke-width="1.8"/><rect x="288" y="120" width="84" height="56" stroke-width="1"/>`;
  s += `<path d="M296 128V170H366M298 140Q320 140 330 152T364 166" stroke-width="1.4"/><path d="M318 186L312 204H348L342 186M300 206H360" stroke-width="1.8"/>`;
  return s;
}

export const exaoFigure = labeledFigure({
  id: "sci-exao",
  name: "ExAO set-up (bioreactor)",
  params: [
    { key: "light", label: "Light source", kind: "bool" },
    {
      key: "probes",
      label: "Probes",
      kind: "select",
      options: [
        { value: "o2", label: "O₂" },
        { value: "both", label: "O₂ and CO₂" },
      ],
    },
  ],
  defaults: { light: true, probes: "o2" },
  w: 390,
  h: 244,
  draw: (p, c) => exao(bool(p, "light"), str(p, "probes") === "both", c),
  parts: (p) => [
    ...(bool(p, "light") ? [{ key: "lamp", at: [40, 160] as [number, number], side: "l" as const, fr: "Source lumineuse", ar: "مصدر ضوئي" }] : []),
    { key: "o2", at: [132, 70], side: "l", fr: "Sonde à O₂", ar: "مسبار الأكسجين" },
    { key: "syringe", at: [156, 50], side: "t", fr: "Seringue d'injection", ar: "محقنة" },
    ...(str(p, "probes") === "both" ? [{ key: "co2", at: [194, 70] as [number, number], side: "t" as const, fr: "Sonde à CO₂", ar: "مسبار CO₂" }] : []),
    { key: "chamber", at: [120, 100], side: "l", fr: "Enceinte (bioréacteur)", ar: "المفاعل الحيوي" },
    { key: "suspension", at: [130, 154], side: "l", fr: "Suspension (cellules, organites)", ar: "المعلق (خلايا، عضيات)" },
    { key: "bar", at: [146, 196], side: "l", fr: "Barreau aimanté", ar: "قضيب مغناطيسي" },
    { key: "stirrer", at: [120, 230], side: "l", fr: "Agitateur magnétique", ar: "محرك مغناطيسي" },
    { key: "interface", at: [304, 56], side: "r", fr: "Interface", ar: "الواجهة البينية" },
    { key: "computer", at: [380, 150], side: "r", fr: "Ordinateur", ar: "الحاسوب" },
  ],
});

export const MATTER_FIGURES: FigureDef[] = [exaoFigure];
