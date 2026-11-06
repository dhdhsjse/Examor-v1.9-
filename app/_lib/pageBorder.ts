import type { PageBorder } from "@/app/_lib/types";

// Page borders (Page layout → Page borders): the designs, drawn as SVG paths in page pixels. The canvas (Konva `Path`) and the
// small previews of the panel (SVG) draw the same list, so the page, the PDF and the preview cannot differ.
// Everything is worked out from the thickness `t` of the line, so the thickness also sets the size of a motif (stars, beads, waves…).

export const BORDER_STYLES = [
  "single",
  "double",
  "triple",
  "thick-thin",
  "dashed",
  "dotted",
  "shadow",
  "rounded",
  "wavy",
  "certificate",
  "fans",
  "deco",
  "guilloche",
  "islamic",
  "diamonds",
  "chain",
  "pearls",
  "scallops",
  "zigzag",
  "checker",
  "stars",
] as const;
export type BorderStyle = (typeof BORDER_STYLES)[number];

/** The designs by family, in the order of the panel. `name` is the English text (the key of the translations) */
export const BORDER_GROUPS: { name: string; styles: { id: BorderStyle; name: string }[] }[] = [
  {
    name: "Lines",
    styles: [
      { id: "single", name: "Single line" },
      { id: "double", name: "Double line" },
      { id: "triple", name: "Triple line" },
      { id: "thick-thin", name: "Thick and thin" },
      { id: "dashed", name: "Dashed" },
      { id: "dotted", name: "Dotted" },
      { id: "shadow", name: "Shadow" },
      { id: "rounded", name: "Rounded" },
      { id: "wavy", name: "Wavy" },
    ],
  },
  {
    name: "Formal",
    styles: [
      { id: "certificate", name: "Certificate" },
      { id: "fans", name: "Corner fans" },
      { id: "deco", name: "Art deco" },
      { id: "guilloche", name: "Guilloche" },
      { id: "islamic", name: "Islamic" },
      { id: "diamonds", name: "Diamonds" },
      { id: "chain", name: "Chain" },
    ],
  },
  {
    name: "Decorative",
    styles: [
      { id: "pearls", name: "Pearls" },
      { id: "scallops", name: "Scallops" },
      { id: "zigzag", name: "Zigzag" },
      { id: "checker", name: "Checkered" },
      { id: "stars", name: "Stars" },
    ],
  },
];

export const DEFAULT_BORDER: PageBorder = { style: "double", color: "#1f2937", width: 2, inset: 24 };
export const MIN_BORDER_WIDTH = 1;
export const MAX_BORDER_WIDTH = 6;
export const MIN_BORDER_INSET = 6;
export const MAX_BORDER_INSET = 60;

/** One stroke or fill of a design. `w`: stroke width in thicknesses; `dash`: in thicknesses; `o`: opacity; `paper`: filled with the paper's white (hides what is under) */
export interface BorderPath {
  d: string;
  w: number;
  fill?: "ink" | "paper";
  dash?: [number, number];
  round?: boolean;
  o?: number;
}

/** How far a design reaches inward from its line (px), for a line of thickness `t`: what a header or a footer has to stay clear of */
const DEPTH: Record<BorderStyle, (t: number) => number> = {
  single: (t) => t,
  double: (t) => 3 * t,
  triple: (t) => 4 * t,
  "thick-thin": (t) => 4 * t,
  dashed: (t) => t,
  dotted: (t) => 1.3 * t,
  shadow: (t) => t,
  rounded: (t) => 3.3 * t,
  wavy: (t) => 1.5 * t + 1.5,
  certificate: (t) => 3.3 * t,
  fans: (t) => 2.5 * t,
  deco: (t) => 2.5 * t,
  guilloche: (t) => 7.1 * t + 4,
  islamic: (t) => 12.3 * t + 8,
  diamonds: (t) => 5.1 * t + 3,
  chain: (t) => 4.8 * t + 4,
  pearls: (t) => 4.3 * t + 4,
  scallops: (t) => 5.25 * t + 4,
  zigzag: (t) => 4.35 * t + 2,
  checker: (t) => 3.3 * t + 3,
  stars: (t) => 12.3 * t + 8,
};
const BORDER_GAP = 8;

/** The distance from the edge of the paper to the inside of the border and a small gap (0 = no border): headers and footers are kept inside it */
export function borderReach(border: PageBorder | undefined): number {
  if (!border || !isBorderStyle(border.style)) return 0;
  return Math.ceil(border.inset + DEPTH[border.style](Math.max(0.5, border.width)) + BORDER_GAP);
}

export const isBorderStyle = (s: string): s is BorderStyle => (BORDER_STYLES as readonly string[]).includes(s);

type Cmd = ["M", number, number] | ["L", number, number] | ["A", number, number, number, number] | ["Z"];
interface Geo {
  t: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const f = (n: number) => String(Math.round(n * 100) / 100);

// A side is drawn in its own frame: u along it (clockwise from its first corner), v inward. Side 0 is the top, 1 the right, 2 the bottom, 3 the left;
// a turn keeps the sense of the arcs, so a design written for the top is right on the four sides.
const place = (g: Geo, k: number, u: number, v: number): [number, number] => (k === 0 ? [g.x0 + u, g.y0 + v] : k === 1 ? [g.x1 - v, g.y0 + u] : k === 2 ? [g.x1 - u, g.y1 - v] : [g.x0 + v, g.y1 - u]);
const length = (g: Geo, k: number) => (k % 2 === 0 ? g.x1 - g.x0 : g.y1 - g.y0);

const toD = (g: Geo, k: number, cmds: Cmd[]) =>
  cmds
    .map((c) => {
      if (c[0] === "Z") return "Z";
      if (c[0] === "A") {
        const [x, y] = place(g, k, c[3], c[4]);
        return `A${f(c[1])} ${f(c[1])} 0 0 ${c[2]} ${f(x)} ${f(y)}`;
      }
      const [x, y] = place(g, k, c[1], c[2]);
      return `${c[0]}${f(x)} ${f(y)}`;
    })
    .join("");

/** What `build` draws on each of the four sides, as one path (`build(length of the side, side)`) */
const sides = (g: Geo, build: (len: number, k: number) => Cmd[]) => [0, 1, 2, 3].map((k) => toD(g, k, build(length(g, k), k))).join("");

const rect = (g: Geo, o: number) => `M${f(g.x0 + o)} ${f(g.y0 + o)}H${f(g.x1 - o)}V${f(g.y1 - o)}H${f(g.x0 + o)}Z`;

const roundRect = (g: Geo, o: number, r: number) => {
  const [a, b, c, d] = [g.x0 + o, g.y0 + o, g.x1 - o, g.y1 - o];
  return `M${f(a + r)} ${f(b)}H${f(c - r)}A${f(r)} ${f(r)} 0 0 1 ${f(c)} ${f(b + r)}V${f(d - r)}A${f(r)} ${f(r)} 0 0 1 ${f(c - r)} ${f(d)}H${f(a + r)}A${f(r)} ${f(r)} 0 0 1 ${f(a)} ${f(d - r)}V${f(b + r)}A${f(r)} ${f(r)} 0 0 1 ${f(a + r)} ${f(b)}Z`;
};

// The corners cut by a quarter circle that bends into the page (the frame of a diploma)
const scoopRect = (g: Geo, o: number, r: number) => {
  const [a, b, c, d] = [g.x0 + o, g.y0 + o, g.x1 - o, g.y1 - o];
  return `M${f(a + r)} ${f(b)}H${f(c - r)}A${f(r)} ${f(r)} 0 0 0 ${f(c)} ${f(b + r)}V${f(d - r)}A${f(r)} ${f(r)} 0 0 0 ${f(c - r)} ${f(d)}H${f(a + r)}A${f(r)} ${f(r)} 0 0 0 ${f(a)} ${f(d - r)}V${f(b + r)}A${f(r)} ${f(r)} 0 0 0 ${f(a + r)} ${f(b)}Z`;
};

const circle = (cx: number, cy: number, r: number) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const polygon = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${f(x)} ${f(y)}`).join("L")}Z`;
const diamond = (cx: number, cy: number, r: number) => polygon([[cx - r, cy], [cx, cy - r], [cx + r, cy], [cx, cy + r]]);
// A star with `n` points (`inner` = the inner radius as a part of the outer one), one point turned toward the outside of the page
const star = (cx: number, cy: number, r: number, n: number, inner: number): [number, number][] =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = (Math.PI * i) / n - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  });
// Two squares, one turned by 45°: the eight-pointed star of a geometric border
const khatam = (cx: number, cy: number, r: number) => polygon(star(cx, cy, r, 4, 1).filter((_, i) => i % 2 === 0)) + polygon(star(cx, cy, r, 4, 1).filter((_, i) => i % 2 === 0).map(([x, y]) => rotate(cx, cy, x, y, Math.PI / 4)));
const rotate = (cx: number, cy: number, x: number, y: number, a: number): [number, number] => [cx + (x - cx) * Math.cos(a) - (y - cy) * Math.sin(a), cy + (x - cx) * Math.sin(a) + (y - cy) * Math.cos(a)];

/** `n` things along a side from `from` to `to` (u): the first at `from`, the last one step short of `to` */
const spread = (from: number, to: number, step: number) => {
  const n = Math.max(1, Math.round((to - from) / step));
  return { n, at: (i: number) => from + (i * (to - from)) / n };
};

const wave = (from: number, to: number, v: number, a: number, step: number, phase = 0): Cmd[] => {
  const { n } = spread(from, to, step);
  const cmds: Cmd[] = [];
  const samples = Math.max(8, Math.round((to - from) / 2));
  for (let i = 0; i <= samples; i++) {
    const s = i / samples;
    cmds.push([i ? "L" : "M", from + s * (to - from), v + a * Math.sin(2 * Math.PI * (n * s + phase))]);
  }
  return cmds;
};

/** The strokes and fills of a border design on a page of `width` × `height` px */
export function borderPaths(border: PageBorder, width: number, height: number): BorderPath[] {
  const t = Math.max(0.5, border.width);
  const g: Geo = { t, x0: border.inset, y0: border.inset, x1: width - border.inset, y1: height - border.inset };
  const style = border.style;
  if (!isBorderStyle(style) || g.x1 - g.x0 < 12 * t || g.y1 - g.y0 < 12 * t) return [];
  const line = (o: number, w: number, extra: Partial<BorderPath> = {}): BorderPath => ({ d: rect(g, o * t), w, ...extra });

  switch (style) {
    case "single":
      return [line(0, 1)];
    case "double":
      return [line(0, 0.8), line(2.6, 0.8)];
    case "triple":
      return [line(0, 0.5), line(1.8, 1.4), line(3.6, 0.5)];
    case "thick-thin":
      return [line(0, 2), line(3, 0.6)];
    case "dashed":
      return [line(0, 1, { dash: [5, 3] })];
    case "dotted":
      return [line(0, 1.3, { dash: [0.01, 2.4], round: true })];
    case "shadow": {
      const s = 2.2 * t;
      return [{ d: `M${f(g.x0 + s)} ${f(g.y1 + s)}H${f(g.x1 + s)}V${f(g.y0 + s)}`, w: 1.8, o: 0.3 }, line(0, 1)];
    }
    case "rounded": {
      const r = 14 + 4 * t;
      return [{ d: roundRect(g, 0, r), w: 0.9 }, { d: roundRect(g, 2.8 * t, r - 2.8 * t), w: 0.5 }];
    }
    case "wavy": {
      const a = 1.1 * t + 1.5;
      return [{ d: sides(g, (len) => wave(0, len, 0, a, 6 * t + 12)), w: 0.8, round: true }];
    }
    case "certificate": {
      const r = 14 + 2.5 * t;
      const dot = (k: number) => {
        const [x, y] = place(g, k, 0, 0);
        return circle(x, y, r * 0.3);
      };
      return [{ d: scoopRect(g, 0, r), w: 1.6 }, { d: scoopRect(g, 3 * t, r), w: 0.5 }, { d: [0, 1, 2, 3].map(dot).join(""), w: 0, fill: "ink" }];
    }
    case "fans": {
      const base = Math.max(8, 4 * t);
      const arcs = () => [1, 2, 3].flatMap((i): Cmd[] => [["M", base * i, 0], ["A", base * i, 1, 0, base * i]]);
      return [line(0, 1.2), line(2.2, 0.5), { d: sides(g, () => arcs()), w: 0.6 }];
    }
    case "deco": {
      const brackets = (): Cmd[] =>
        [1, 2, 3].flatMap((i): Cmd[] => {
          const d = (2 + 2.2 * i) * t;
          const arm = d + (11 - 3 * i) * t;
          return [["M", arm, d], ["L", d, d], ["L", d, arm]];
        });
      return [line(0, 1.4), line(2, 0.5), { d: sides(g, brackets), w: 0.7 }];
    }
    case "guilloche": {
      const a = 2.4 * t + 2;
      const c = 2 * a + 2 * t; // the band, and the square of a corner
      const waves = sides(g, (len) => [0, 1, 2].flatMap((j) => wave(c, len - c, c / 2, a, 9 * t + 14, j / 3)));
      const corner = (k: number) => {
        const [x, y] = place(g, k, 0, 0);
        const [x2, y2] = place(g, k, c, c);
        return `M${f(x)} ${f(y)}H${f(x2)}V${f(y2)}H${f(x)}Z`;
      };
      const [cx, cy] = [(k: number) => place(g, k, c / 2, c / 2)[0], (k: number) => place(g, k, c / 2, c / 2)[1]];
      return [
        line(0, 0.6),
        line(c / t, 0.6),
        { d: waves, w: 0.4, round: true },
        { d: [0, 1, 2, 3].map(corner).join(""), w: 0.6, fill: "paper" },
        { d: [0, 1, 2, 3].map((k) => circle(cx(k), cy(k), c * 0.22)).join(""), w: 0, fill: "ink" },
      ];
    }
    case "islamic":
    case "stars": {
      const b = 6 * t + 4; // half the band
      const R = b * 0.78;
      const motif = (cx: number, cy: number, big: boolean) => (style === "islamic" ? khatam(cx, cy, big ? R * 1.15 : R) : polygon(star(cx, cy, big ? R * 1.2 : R, 5, 0.42)));
      let d = "";
      for (let k = 0; k < 4; k++) {
        const { n, at } = spread(b, length(g, k) - b, b * 2.3);
        for (let i = 0; i < n; i++) {
          const [x, y] = place(g, k, at(i), b);
          d += motif(x, y, i === 0);
        }
      }
      return [line(0, 0.6), line((2 * b) / t, 0.6), { d, w: style === "islamic" ? 0.55 : 0.4, fill: style === "stars" ? "ink" : undefined }];
    }
    case "diamonds": {
      const b = 2.4 * t + 1.5;
      const r = b * 0.8;
      let d = "";
      let dots = "";
      for (let k = 0; k < 4; k++) {
        const { n, at } = spread(b * 3, length(g, k) - b * 3, r * 2);
        for (let i = 0; i <= n; i++) {
          const [x, y] = place(g, k, at(i), b);
          d += diamond(x, y, r);
        }
        const [x, y] = place(g, k, b, b);
        dots += diamond(x, y, r * 1.15);
      }
      return [line(0, 0.6), line((2 * b) / t, 0.6), { d, w: 0.6 }, { d: dots, w: 0, fill: "ink" }];
    }
    case "chain": {
      const r = 2.4 * t + 2;
      let d = "";
      for (let k = 0; k < 4; k++) {
        const { n, at } = spread(r, length(g, k) - r, r * 1.35);
        for (let i = 0; i < n; i++) {
          const [x, y] = place(g, k, at(i), r);
          d += circle(x, y, r);
        }
      }
      return [{ d, w: 0.5 }];
    }
    case "pearls": {
      const b = 2 * t + 2;
      const r = b * 0.42;
      let d = "";
      for (let k = 0; k < 4; k++) {
        const { n, at } = spread(b, length(g, k) - b, r * 2.9);
        for (let i = 0; i < n; i++) {
          const [x, y] = place(g, k, at(i), b);
          d += circle(x, y, i === 0 ? r * 1.7 : r);
        }
      }
      return [line(0, 0.5), line((2 * b) / t, 0.5), { d, w: 0, fill: "ink" }];
    }
    case "scallops": {
      const p = 7 * t + 8;
      const arcs = (len: number): Cmd[] => {
        const { n, at } = spread(0, len, p);
        const cmds: Cmd[] = [["M", 0, 0]];
        for (let i = 1; i <= n; i++) cmds.push(["A", (at(i) - at(i - 1)) / 2, 0, at(i), 0]);
        return cmds;
      };
      return [{ d: sides(g, arcs), w: 0.9 }, line(p / 2 / t + 1.5, 0.45)];
    }
    case "zigzag": {
      const h = 2.6 * t + 2;
      const zig = (len: number): Cmd[] => {
        const { n, at } = spread(0, len, 5 * t + 8);
        const cmds: Cmd[] = [["M", 0, 0]];
        for (let i = 0; i < n; i++) cmds.push(["L", (at(i) + at(i + 1)) / 2, h], ["L", at(i + 1), 0]);
        return cmds;
      };
      return [{ d: sides(g, zig), w: 0.9 }, line(h / t + 1.5, 0.45)];
    }
    case "checker": {
      const s = 3 * t + 3;
      let d = "";
      for (let k = 0; k < 4; k++) {
        const { n, at } = spread(s, length(g, k) - s, s);
        for (let i = 0; i < n; i++) {
          if (i % 2 === 0) continue;
          const [x, y] = place(g, k, at(i), 0);
          const [x2, y2] = place(g, k, at(i + 1), s);
          d += `M${f(x)} ${f(y)}H${f(x2)}V${f(y2)}H${f(x)}Z`;
        }
        const [x, y] = place(g, k, 0, 0);
        const [x2, y2] = place(g, k, s, s);
        d += `M${f(x)} ${f(y)}H${f(x2)}V${f(y2)}H${f(x)}Z`;
      }
      return [line(0, 0.6), line(s / t, 0.6), { d, w: 0, fill: "ink" }];
    }
  }
}
