import { HEADER_STYLE_OPTIONS, HeaderSketch } from "@/app/_components/HeaderSketch";
import type { Feature } from "@/app/_features/core/types";

// Every exam header style as a small picture. A click restyles the header of the page in view
// (or of the first page), or adds a header when there is none.
export const headerGalleryPanel: Feature = {
  id: "panel.header-gallery",
  kind: "panel",
  label: "Header styles",
  render: ({ ctx }) => {
    const { doc, shell, t } = ctx;
    const headers = doc.blocks.filter((b) => b.type === "header");
    const current = headers.find((b) => b.layout.pageId === ctx.activePageId) ?? headers[0];
    return (
      <div className="flex flex-col gap-1.5 px-1">
        <p className="px-1 text-[11px] leading-snug text-faint">{current ? t("Click a style to change the exam header.") : t("Click a style to add an exam header.")}</p>
        <div className="grid grid-cols-2 gap-1.5">
          {HEADER_STYLE_OPTIONS.map((o) => {
            const on = current?.type === "header" && current.style === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={on}
                onClick={() => (current ? shell.updateBlock(current.id, { style: o.value }, "style") : shell.runTool({ kind: "block", type: "header", preset: { style: o.value } }))}
                className={`flex flex-col gap-1 rounded-md border p-1.5 text-[10px] transition-colors ${
                  on ? "border-indigo-500 bg-indigo-50/60 font-semibold text-indigo-700" : "border-line text-muted hover:border-indigo-300 hover:text-ink"
                }`}
              >
                <span className="pointer-events-none flex h-8 items-center justify-center overflow-hidden rounded bg-white px-1">
                  <HeaderSketch style={o.value} accent={current?.type === "header" ? current.accent : undefined} />
                </span>
                {t(o.label)}
              </button>
            );
          })}
        </div>
      </div>
    );
  },
};
