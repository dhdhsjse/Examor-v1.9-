import { bool, clamp, ink, label, line, num, str, svg, type Pt } from "./svg";
import type { FigureDef } from "./types";

type Part = "switch" | "lamp" | "resistor" | "motor" | "ammeter";

const SLOT = 78; // room for one component on the top wire

// A series circuit: a battery on the left, the components on the top wire.
export const circuitFigure: FigureDef = {
  id: "circuit",
  name: "Electric circuit",
  params: [
    { key: "lamps", label: "Lamps", kind: "number", min: 0, max: 3 },
    {
      key: "switch",
      label: "Switch",
      kind: "select",
      options: [
        { value: "none", label: "None" },
        { value: "open", label: "Open" },
        { value: "closed", label: "Closed" },
      ],
    },
    { key: "resistor", label: "Resistor", kind: "bool", row: "parts" },
    { key: "motor", label: "Motor", kind: "bool", row: "parts" },
    { key: "ammeter", label: "Ammeter", kind: "bool", row: "meters" },
    { key: "voltmeter", label: "Voltmeter (on the first part)", kind: "bool", row: "meters" },
    { key: "names", label: "Write the names (L1, K, R…)", kind: "bool" },
  ],
  defaults: () => ({ lamps: 1, switch: "open", resistor: false, motor: false, ammeter: false, voltmeter: false, names: false }),
  build: (p) => {
    const color = ink(p);
    const parts: Part[] = [];
    const sw = str(p, "switch", "open");
    if (sw !== "none") parts.push("switch");
    for (let i = 0; i < Math.round(clamp(num(p, "lamps", 1), 0, 3)); i++) parts.push("lamp");
    if (bool(p, "resistor")) parts.push("resistor");
    if (bool(p, "motor")) parts.push("motor");
    if (bool(p, "ammeter")) parts.push("ammeter");
    const names = bool(p, "names");

    const L = 40;
    const R = L + Math.max(2, parts.length) * SLOT + 30;
    const T = 40;
    const B = bool(p, "voltmeter") ? 190 : 160;
    const W = R + 30;
    let body = "";
    let lampN = 0;
    // Top wire with a gap for each component.
    let x = L;
    const centers: number[] = parts.map((_, i) => L + 30 + SLOT * i + SLOT / 2);
    parts.forEach((part, i) => {
      const cx = centers[i];
      const half = part === "switch" ? 20 : part === "resistor" ? 20 : 14;
      body += line([x, T], [cx - half, T]);
      x = cx + half;
      const c: Pt = [cx, T];
      if (part === "lamp") {
        lampN++;
        body += `<circle cx="${cx}" cy="${T}" r="14" fill="#fff"/>` + line([cx - 10, T - 10], [cx + 10, T + 10]) + line([cx + 10, T - 10], [cx - 10, T + 10]);
        if (names) body += label([cx, T - 26], `L${lampN}`, color, 13, { bold: true });
      } else if (part === "switch") {
        body += `<circle cx="${cx - 20}" cy="${T}" r="2.6" fill="${color}" stroke="none"/><circle cx="${cx + 20}" cy="${T}" r="2.6" fill="${color}" stroke="none"/>`;
        body += sw === "closed" ? line([cx - 20, T], [cx + 20, T]) : line([cx - 20, T], [cx + 16, T - 18]);
        if (names) body += label([cx, T - 26], "K", color, 13, { bold: true });
      } else if (part === "resistor") {
        body += `<rect x="${cx - 20}" y="${T - 8}" width="40" height="16" fill="#fff"/>`;
        if (names) body += label([cx, T - 22], "R", color, 13, { bold: true });
      } else {
        const letter = part === "motor" ? "M" : "A";
        body += `<circle cx="${cx}" cy="${T}" r="14" fill="#fff"/>` + label(c, letter, color, 14, { bold: true });
      }
    });
    body += line([x, T], [R, T]) + line([R, T], [R, B]) + line([R, B], [L, B]);
    // Battery on the left side: long thin plate (+) and short thick plate (−).
    const my = (T + B) / 2;
    body += line([L, T], [L, my - 8]) + line([L, my + 8], [L, B]);
    body += line([L - 16, my - 8], [L + 16, my - 8], 'stroke-width="2"') + line([L - 8, my + 8], [L + 8, my + 8], 'stroke-width="5"');
    body += label([L + 26, my - 12], "+", color, 15, { bold: true }) + label([L + 26, my + 16], "−", color, 15, { bold: true });
    if (names) body += label([L - 26, my + 4], "G", color, 13, { bold: true });
    // Voltmeter in parallel on the first component.
    if (bool(p, "voltmeter") && parts.length) {
      const cx = centers[0];
      const vy = T + 62;
      body += line([cx - 30, T], [cx - 30, vy]) + line([cx - 30, vy], [cx - 13, vy]) + line([cx + 13, vy], [cx + 30, vy]) + line([cx + 30, vy], [cx + 30, T]);
      body += `<circle cx="${cx - 30}" cy="${T}" r="2.4" fill="${color}" stroke="none"/><circle cx="${cx + 30}" cy="${T}" r="2.4" fill="${color}" stroke="none"/>`;
      body += `<circle cx="${cx}" cy="${vy}" r="13" fill="#fff"/>` + label([cx, vy], "V", color, 14, { bold: true });
    }
    return svg(W, B + 24, body, color);
  },
};
