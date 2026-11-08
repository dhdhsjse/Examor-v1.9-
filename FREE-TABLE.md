# Free table

Insert → **Free table** activates the worksheet pen. Drag a rectangle on any page to create the table, then draw horizontal or vertical dividers inside it. A divider extends across each cell it touches and snaps to nearby grid lines. The preview shows the resulting cut before release.

The floating table tools also appear when an ordinary editable table is selected:

- **Horizontal / vertical line:** click to divide one cell, or drag across several cells.
- **Erase:** preview the borders to remove, then release to apply the whole gesture in one undo step. Adjacent cells merge when they form a rectangle; other erased borders are hidden. Hidden borders remain dotted while drawing and can be drawn back.
- **Select cells:** drag a range, Shift-click to extend, or use the arrow keys. Enter or double-click opens the existing worksheet cell editor. Delete clears cells. Copy, cut and paste share the properties grid and Table Studio clipboard, including formulas and formatting.
- **Merge:** uses Table Studio's rules: the first cell retains its content, and the underlying rows and columns remain available to Split.
- **Split:** choose rows and columns for each selected cell. A merged cell defaults to its existing grid divisions. Impossible splits are disabled; no partial changes are applied.
- **Open in Table Studio:** edit the same table, then Update it in place.
- **Done / Escape:** put the drawing tools down. Escape during a drawing or eraser gesture cancels that gesture.

Tables use the existing `TableBlock` model, properties, layout, save format and PDF renderer. No raster conversion or separate table format is involved. Cells remain rectangular; arbitrary polygonal cells are outside the existing table model. Tables with overlaid shapes/images follow the existing fixed-table rule and are edited in Studio.

The toolbar stays at screen size and within the worksheet viewport when scrolling or zooming. French and Arabic interface strings are included, and hit testing follows Arabic and reversed column order.

Implementation: `_lib/table/draw.ts` contains pure geometry and operations; `workspace/TableDrawLayer.tsx` owns gestures; `TableDrawBar.tsx` and `TableDrawDock.tsx` contain the tools and their placement. `tableSelStore.ts` shares selection with the properties grid, and `tableClipboard.ts` shares cell copy/paste with Studio.

Regression coverage is in `_lib/__tests__/table-draw.test.ts` and `table-strings.test.ts`, alongside the existing table layout, formula, fixed-table and action tests.
