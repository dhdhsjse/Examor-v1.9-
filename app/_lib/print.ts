import type { Sheet } from "./printLayout";

const ROOT_ID = "examor-print-root";

// The sheets of paper as a part of the app's own page that only printing shows: each page a vector SVG (see stagePageSvgs) in its place
// on its sheet, each sheet of its own size (a named @page each). In the app's page, so the text has the app's fonts. Gone with `unmount`.
async function mount(svgs: string[], sheets: Sheet[]): Promise<() => void> {
  document.getElementById(ROOT_ID)?.remove();
  const sizes = [...new Set(sheets.map((s) => `${s.width}x${s.height}`))];
  const name = (s: Sheet) => `examor-sheet-${sizes.indexOf(`${s.width}x${s.height}`)}`;
  const mm = (v: number) => `${Math.round(v * 1000) / 1000}mm`;
  const css = [
    `@page { margin: 0; size: ${sheets[0]?.width ?? 210}mm ${sheets[0]?.height ?? 297}mm; }`,
    ...sizes.map((key, i) => {
      const [w, h] = key.split("x");
      return `@page examor-sheet-${i} { margin: 0; size: ${w}mm ${h}mm; } #${ROOT_ID} .examor-sheet-${i} { page: examor-sheet-${i}; }`;
    }),
    `@media screen { #${ROOT_ID} { position: fixed; left: -100000px; top: 0; } }`,
    `@media print {
      html, body { margin: 0 !important; padding: 0 !important; height: auto !important; min-height: 0 !important; overflow: visible !important; background: #fff !important; }
      body > :not(#${ROOT_ID}) { display: none !important; }
    }`,
    `#${ROOT_ID} { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }`,
    `#${ROOT_ID} .sheet { position: relative; overflow: hidden; break-after: page; }`,
    `#${ROOT_ID} .sheet:last-child { break-after: auto; }`,
    `#${ROOT_ID} .slot { position: absolute; }`,
    `#${ROOT_ID} .slot > svg { display: block; width: 100%; height: 100%; }`,
  ].join("\n");
  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.setAttribute("aria-hidden", "true");
  root.innerHTML =
    `<style>${css}</style>` +
    sheets
      .map(
        (s) =>
          // (a hair shorter than the paper: else rounding can push an empty page after each sheet)
          `<div class="sheet ${name(s)}" style="width:${mm(s.width)};height:${mm(s.height - 0.3)}">` +
          s.slots.map((p) => (svgs[p.page] ? `<div class="slot" style="left:${mm(p.x)};top:${mm(p.y)};width:${mm(p.width)};height:${mm(p.height)}">${svgs[p.page]}</div>` : "")).join("") +
          "</div>",
      )
      .join("");
  document.body.appendChild(root);
  // the pictures in the pages, and the fonts, ready before printing
  const hrefs = [...root.querySelectorAll("image")].map((i) => i.getAttribute("href") ?? "").filter(Boolean);
  await Promise.all([
    ...[...new Set(hrefs)].map((src) => {
      const img = new Image();
      img.src = src;
      return img.decode().catch(() => undefined);
    }),
    document.fonts.ready,
  ]);
  return () => root.remove();
}

// The sheets straight to the printer: the system's print window (printer, copies, pages, colour are chosen there). `title`: the name
// the print window gives a copy saved as a PDF.
export async function printSheets(svgs: string[], sheets: Sheet[], title: string): Promise<void> {
  const unmount = await mount(svgs, sheets);
  const before = document.title;
  document.title = title;
  const done = () => {
    document.title = before;
    unmount();
  };
  window.addEventListener("afterprint", () => setTimeout(done, 0), { once: true });
  window.print();
}

// The sheets as a PDF file at `path` (desktop app): written by the app's own browser engine (see src-tauri: export_pdf), vector, with
// the fonts' letters in it.
export async function pdfSheets(svgs: string[], sheets: Sheet[], path: string): Promise<void> {
  const unmount = await mount(svgs, sheets);
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const first = sheets[0] ?? { width: 210, height: 297 };
    await invoke("export_pdf", { path, width: first.width / 25.4, height: first.height / 25.4 });
  } finally {
    unmount();
  }
}
