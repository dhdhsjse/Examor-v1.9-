# Free table

Insert → **Free table** brings up the table tools, starting on Select. With the Pen, drag a rectangle on any page to create the table, then draw horizontal or vertical dividers inside it. A divider extends across each cell it touches and snaps to nearby grid lines. The preview shows the resulting cut before release.

Selecting an editable table takes the same tools in hand, also starting on Select. Tools that came this way go again when the table is no longer selected (a click on the paper).

While the tools are in hand, their bar (in its own colors) pops up in the place of the floating tool bar, centered at the bottom of the worksheet. Its Close button puts them down and brings the floating tool bar back; so does Escape. After Close, the table stays selected and the same bar appears next to it:

- **Select:** the page works as with the usual Select tool (select and move blocks, type in cells) and the bar stays. V is its shortcut.

- **Pen:** drag on the paper to draw a table, or inside a table to draw a horizontal or vertical divider.
- **Erase:** preview the borders to remove, then release to apply the whole gesture in one undo step. Adjacent cells merge when they form a rectangle; other erased borders are hidden. Hidden borders remain dotted while drawing and can be drawn back.
- **Select cells:** drag a range, Shift-click to extend, or use the arrow keys. Enter or double-click opens the existing worksheet cell editor. Delete clears cells. Copy, cut and paste share the properties grid and Table Studio clipboard, including formulas and formatting.
- **Bucket:** click a cell to color it, or drag over several cells, in one undo step. Its arrow chooses the color, or None to take the fill off. With cells selected, the bucket colors them at once.
- **Merge:** uses Table Studio's rules: the first cell retains its content, and the underlying rows and columns remain available to Split.
- **Split:** choose rows and columns for each selected cell. A merged cell defaults to its existing grid divisions. Impossible splits are disabled; no partial changes are applied.
- **Escape during a drawing or eraser gesture** cancels that gesture.

**Text style** in the table's right Properties panel (font, size, color) goes to the selected cells, picked in the panel's grid or on the page; with no cell selected, to the whole table.

**Open in Table Studio** is in the table's right Properties panel: edit the same table, then Update it in place.

Tables use the existing `TableBlock` model, properties, layout, save format and PDF renderer. No raster conversion or separate table format is involved. Cells remain rectangular; arbitrary polygonal cells are outside the existing table model. Tables with overlaid shapes/images follow the existing fixed-table rule and are edited in Studio.

The toolbar stays at screen size and within the worksheet viewport when scrolling or zooming. French and Arabic interface strings are included, and hit testing follows Arabic and reversed column order.

Implementation: `_lib/table/draw.ts` contains pure geometry and operations; `workspace/TableDrawLayer.tsx` owns gestures; `TableDrawBar.tsx` and `TableDrawDock.tsx` contain the tools and their placement. `tableSelStore.ts` shares selection with the properties grid, and `tableClipboard.ts` shares cell copy/paste with Studio.

Regression coverage is in `_lib/__tests__/table-draw.test.ts` and `table-strings.test.ts`, alongside the existing table layout, formula, fixed-table and action tests.
