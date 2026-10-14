// Built-in diagrams, drawn as SVG so they stay sharp when printed.

const svg = (w: number, h: number, body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" fill="none" stroke="#111" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" font-family="Arial, sans-serif" font-size="15">${body}</svg>`;

const T = (x: number, y: number, s: string, extra = "") =>
  `<text x="${x}" y="${y}" fill="#111" stroke="none" ${extra}>${s}</text>`;

const ARROW = `<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#111" stroke="none"/></marker></defs>`;

// Grid + x/y axes centered in a square of `size`, `step` px per unit.
function axes(size: number, step: number, grid: boolean) {
  const c = size / 2;
  let s = ARROW;
  if (grid) {
    for (let v = step; v < size; v += step) {
      s += `<path d="M${v} 10V${size - 10}M10 ${v}H${size - 10}" stroke="#d4d4d8" stroke-width="1"/>`;
    }
  }
  s += `<path d="M8 ${c}H${size - 8}" marker-end="url(#a)"/><path d="M${c} ${size - 8}V8" marker-end="url(#a)"/>`;
  s += T(size - 18, c + 18, "x") + T(c + 8, 18, "y") + T(c - 16, c + 18, "O");
  s += `<path d="M${c + step} ${c - 4}v8M${c - 4} ${c - step}h8"/>` + T(c + step - 4, c + 20, "1", 'font-size="12"') + T(c - 18, c - step + 5, "1", 'font-size="12"');
  return s;
}

function parabola(size: number, step: number) {
  const c = size / 2;
  const pts: string[] = [];
  for (let x = -3.2; x <= 3.2; x += 0.1) {
    const y = 0.5 * x * x - 2;
    pts.push(`${(c + x * step).toFixed(1)},${(c - y * step).toFixed(1)}`);
  }
  return `<polyline points="${pts.join(" ")}" stroke="#4f46e5" stroke-width="2.5"/>`;
}

function numberLine() {
  let s = ARROW + `<path d="M15 35H350" marker-end="url(#a)"/>`;
  for (let i = 0; i <= 10; i++) {
    const x = 30 + i * 30;
    s += `<path d="M${x} 29v12"/>` + T(x - (i < 5 ? 8 : 4), 62, String(i - 5), 'font-size="13"');
  }
  return svg(365, 72, s);
}

function grid() {
  let s = "";
  for (let v = 0; v <= 300; v += 20) s += `<path d="M${v} 0V300M0 ${v}H300" stroke="#a1a1aa" stroke-width="1"/>`;
  return svg(300, 300, s);
}

function thermometer() {
  let s = `<rect x="40" y="20" width="20" height="190" rx="10"/><circle cx="50" cy="222" r="22" fill="#fff"/>`;
  s += `<rect x="46" y="110" width="8" height="105" fill="#ef4444" stroke="none"/><circle cx="50" cy="222" r="15" fill="#ef4444" stroke="none"/>`;
  for (let i = 0; i <= 10; i++) {
    const y = 200 - i * 17;
    s += `<path d="M62 ${y}h${i % 2 ? 6 : 12}" stroke-width="1.5"/>`;
    if (i % 2 === 0) s += T(78, y + 5, String(i * 10), 'font-size="12"');
  }
  return svg(110, 255, s);
}

export const DIAGRAMS = {
  triangle: svg(240, 190, `<polygon points="40,160 210,160 40,40"/><path d="M40 146h14v14" stroke-width="1.5"/>` + T(32, 32, "A") + T(22, 178, "B") + T(212, 178, "C")),
  circle: svg(220, 200, `<circle cx="110" cy="100" r="75"/><circle cx="110" cy="100" r="3" fill="#111"/><path d="M110 100H185"/>` + T(96, 96, "O") + T(142, 92, "r")),
  axes: svg(260, 260, axes(260, 20, true)),
  parabola: svg(260, 260, axes(260, 30, true) + parabola(260, 30)),
  numberLine: numberLine(),
  cube: svg(200, 200, `<path d="M40 70h90v90H40z M40 70l40-40h90l-40 40 M130 160l40-40V30"/><path d="M40 160l40-40h90 M80 120V30" stroke-dasharray="5 5" stroke-width="1.5"/>`),
  grid: grid(),
  circuit: svg(300, 200, `<path d="M40 40V92M40 108V160M40 40H136M164 40H260V160H170M130 160H40"/><path d="M26 92h28"/><path d="M32 108h16" stroke-width="4"/>` + T(58, 90, "+") + `<circle cx="150" cy="40" r="14" fill="#fff"/><path d="M140 30l20 20M160 30l-20 20"/><circle cx="130" cy="160" r="3" fill="#111"/><circle cx="170" cy="160" r="3" fill="#111"/><path d="M130 160l34-16"/>`),
  incline: svg(300, 200, ARROW + `<polygon points="20,180 280,180 280,60"/><rect x="130" y="92" width="40" height="28" transform="rotate(-24.8 150 120)" fill="#e0e7ff"/><path d="M150 104V164" marker-end="url(#a)" stroke="#dc2626"/><path d="M150 104L129 58" marker-end="url(#a)" stroke="#2563eb"/><path d="M62 180A42 42 0 0 0 58 163"/>` + T(156, 168, "P") + T(116, 58, "R") + T(66, 172, "α")),
  thermometer: thermometer(),
  lens: svg(320, 160, ARROW + `<path d="M10 80H310" stroke-width="1.5"/><path d="M160 22V138" marker-start="url(#a)" marker-end="url(#a)" stroke-width="2.5"/><circle cx="100" cy="80" r="3" fill="#111"/><circle cx="220" cy="80" r="3" fill="#111"/>` + T(94, 102, "F") + T(214, 102, "F'") + T(166, 100, "O")),
  cell: svg(320, 200, `<rect x="20" y="20" width="220" height="160" rx="24" stroke-width="3"/><rect x="30" y="30" width="200" height="140" rx="18" stroke-width="1.2"/><ellipse cx="145" cy="108" rx="62" ry="42" fill="#e0e7ff"/><circle cx="72" cy="70" r="22" fill="#e4e4e7"/><circle cx="76" cy="66" r="6" fill="#71717a" stroke="none"/><ellipse cx="200" cy="55" rx="12" ry="7" fill="#86efac"/><ellipse cx="60" cy="145" rx="12" ry="7" fill="#86efac"/><path d="M238 40H285M94 70H285M205 108H285M212 55l73 0" stroke-width="1"/>` + T(292, 45, "1") + T(292, 75, "2") + T(292, 113, "3") + T(292, 60, "4")),
  foodChain: svg(360, 90, ARROW + `<rect x="20" y="20" width="90" height="50" rx="8"/><rect x="135" y="20" width="90" height="50" rx="8"/><rect x="250" y="20" width="90" height="50" rx="8"/><path d="M112 45H133M227 45H248" marker-end="url(#a)"/>`),
  waterCycle: svg(320, 220, ARROW + `<circle cx="45" cy="40" r="18" fill="#fde68a"/><path d="M215 55a18 18 0 0 1 30-14a20 20 0 0 1 36 8a14 14 0 0 1-4 28H220a14 14 0 0 1-5-22z" fill="#f4f4f5"/><polygon points="230,170 270,110 310,170" fill="#e7e5e4"/><path d="M10 175q20-8 40 0t40 0t40 0t40 0t40 0V210H10z" fill="#dbeafe"/><path d="M100 165Q120 110 205 70" marker-end="url(#a)" stroke-dasharray="6 4"/><path d="M240 92v18M255 92v18M270 92v18" stroke="#2563eb" stroke-dasharray="4 4"/><path d="M250 172Q220 190 190 182" marker-end="url(#a)"/>` + T(120, 120, "1") + T(285, 100, "2") + T(215, 198, "3") + T(40, 200, "4")),
};
