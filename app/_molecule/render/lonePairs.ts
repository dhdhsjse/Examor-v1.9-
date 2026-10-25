// Where the lone pairs of an atom go: in the free angular sectors between its bonds, spread evenly.

// Directions (degrees, screen angles: atan2(dy, dx) with y down) of `n` lone pairs around an atom whose
// bonds point at `bondAngles`. Each pair goes in the biggest free sector; pairs in one sector are evenly spaced:
//   O of C=O, one bond  -> two pairs at ±120° from the bond      HCl: three pairs 90° apart
//   O of H–O–H, two bonds at 180° -> one pair in each free sector (above and below)
export function lonePairAngles(bondAngles: number[], n: number): number[] {
  if (n <= 0) return [];
  const norm = (a: number) => ((a % 360) + 360) % 360;
  if (!bondAngles.length) return Array.from({ length: n }, (_, i) => norm(270 + (i * 360) / n));
  const sorted = bondAngles.map(norm).sort((a, b) => a - b);
  const sectors = sorted.map((start, i) => {
    const next = i === sorted.length - 1 ? sorted[0] + 360 : sorted[i + 1];
    return { start, size: next - start, count: 0 };
  });
  for (let k = 0; k < n; k++) {
    let best = 0;
    sectors.forEach((s, i) => {
      if (s.size / (s.count + 1) > sectors[best].size / (sectors[best].count + 1) + 1e-9) best = i;
    });
    sectors[best].count++;
  }
  const out: number[] = [];
  for (const s of sectors) for (let j = 1; j <= s.count; j++) out.push(norm(s.start + (s.size * j) / (s.count + 1)));
  return out;
}
