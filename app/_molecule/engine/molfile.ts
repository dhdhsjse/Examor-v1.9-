// V2000 molfile <-> MolGraph. RDKit writes y upwards in 1.5-unit bonds; the model is y down in bond lengths.
import { withLonePairs } from "../chem";
import type { MolAtom, MolBond, MolGraph } from "../model";

const STD_BOND = 1.5;
const CHARGE_CODE: Record<number, number> = { 1: 3, 2: 2, 3: 1, 5: -1, 6: -2, 7: -3 };

export function parseMolfile(text: string): MolGraph {
  const lines = text.split(/\r?\n/);
  const counts = lines[3] ?? "";
  const nAtoms = parseInt(counts.slice(0, 3), 10);
  const nBonds = parseInt(counts.slice(3, 6), 10);
  if (!Number.isFinite(nAtoms) || !Number.isFinite(nBonds)) throw new Error("Not a V2000 molfile");

  const atoms: MolAtom[] = [];
  const raw: { x: number; y: number }[] = [];
  for (let i = 0; i < nAtoms; i++) {
    const l = lines[4 + i] ?? "";
    raw.push({ x: parseFloat(l.slice(0, 10)), y: parseFloat(l.slice(10, 20)) });
    atoms.push({
      id: `a${i + 1}`,
      element: l.slice(31, 34).trim(),
      charge: CHARGE_CODE[parseInt(l.slice(36, 39), 10)] ?? 0,
      x: 0,
      y: 0,
      lonePairs: 0,
    });
  }
  // Bond length of this file (RDKit uses 1.5; other tools differ): scale by the median bond length.
  const bonds: MolBond[] = [];
  for (let i = 0; i < nBonds; i++) {
    const l = lines[4 + nAtoms + i] ?? "";
    const a = parseInt(l.slice(0, 3), 10);
    const b = parseInt(l.slice(3, 6), 10);
    const type = parseInt(l.slice(6, 9), 10);
    const stereo = parseInt(l.slice(9, 12), 10);
    bonds.push({
      id: `b${i + 1}`,
      a: `a${a}`,
      b: `a${b}`,
      order: type === 3 ? 3 : type === 2 ? 2 : 1,
      stereo: stereo === 1 ? "wedge" : stereo === 6 ? "dash" : "none",
    });
  }
  for (const l of lines.slice(4 + nAtoms + nBonds)) {
    if (l.startsWith("M  CHG")) {
      const n = parseInt(l.slice(6, 9), 10);
      for (let k = 0; k < n; k++) {
        const idx = parseInt(l.slice(9 + k * 8, 13 + k * 8), 10);
        const val = parseInt(l.slice(13 + k * 8, 17 + k * 8), 10);
        if (atoms[idx - 1]) atoms[idx - 1].charge = val;
      }
    } else if (l.startsWith("M  ISO")) {
      const n = parseInt(l.slice(6, 9), 10);
      for (let k = 0; k < n; k++) {
        const idx = parseInt(l.slice(9 + k * 8, 13 + k * 8), 10);
        const val = parseInt(l.slice(13 + k * 8, 17 + k * 8), 10);
        if (atoms[idx - 1]) atoms[idx - 1].isotope = val;
      }
    }
  }
  const lens = bonds
    .map((b) => {
      const p = raw[parseInt(b.a.slice(1), 10) - 1];
      const q = raw[parseInt(b.b.slice(1), 10) - 1];
      return Math.hypot(p.x - q.x, p.y - q.y);
    })
    .filter((n) => n > 0)
    .sort((m, n) => m - n);
  const unit = lens.length ? lens[Math.floor(lens.length / 2)] : STD_BOND;
  atoms.forEach((a, i) => {
    a.x = Math.round((raw[i].x / unit) * 1000) / 1000;
    a.y = Math.round((-raw[i].y / unit) * 1000) / 1000;
  });
  return withLonePairs({ atoms, bonds });
}

const pad = (n: number | string, w: number) => String(n).padStart(w, " ");

export function writeMolfile(g: MolGraph): string {
  const index = new Map(g.atoms.map((a, i) => [a.id, i + 1]));
  const out = ["", "  Examor", "", `${pad(g.atoms.length, 3)}${pad(g.bonds.length, 3)}  0  0  0  0  0  0  0  0999 V2000`];
  for (const a of g.atoms) {
    out.push(`${(a.x * STD_BOND).toFixed(4).padStart(10)}${(-a.y * STD_BOND).toFixed(4).padStart(10)}${"0.0000".padStart(10)} ${a.element.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`);
  }
  for (const b of g.bonds) {
    // Double bonds are written "either" (3): the 2D layout must not decide cis/trans (Z/E is a later feature).
    const stereo = b.stereo === "wedge" ? 1 : b.stereo === "dash" ? 6 : b.order === 2 ? 3 : 0;
    out.push(`${pad(index.get(b.a) ?? 0, 3)}${pad(index.get(b.b) ?? 0, 3)}${pad(b.order, 3)}${pad(stereo, 3)}`);
  }
  const charged = g.atoms.filter((a) => a.charge !== 0);
  for (let i = 0; i < charged.length; i += 8) {
    const part = charged.slice(i, i + 8);
    out.push(`M  CHG${pad(part.length, 3)}${part.map((a) => `${pad(index.get(a.id) ?? 0, 4)}${pad(a.charge, 4)}`).join("")}`);
  }
  out.push("M  END");
  return out.join("\n");
}
