# ARCHITECTURE.md — Feature Composition System for Examor

> **Directive for AI coding agents (Claude Code).**
> Read this file end-to-end before changing code. This is the source of truth for how the app is structured. If you must break a rule here, say so explicitly in your response.

---

## 1. Intent

Examor must be **feature-modular**. Every visible thing in the UI — a toolbox tile, a top-bar button, a toggle, a menu item, a panel, an overlay — is a **self-contained object** with a stable identity and a small contract. Nothing is hardcoded into a monolithic layout.

The hierarchy is always:

```
Feature  →  Group  →  Bar  →  App
(leaf)     (list)    (list)   (list)
```

- **Feature** — the atomic unit. One file, one exported object. Examples: `titreDeSectionTool`, `qcmTool`, `exportPdfAction`, `langSwitch`.
- **Group** — an ordered list of features with a shared label. Examples: `questionsGroup`, `insertGroup`, `fileGroup`.
- **Bar** — an ordered list of groups placed at a UI position (top / left / right / bottom / overlay). Examples: `topBar`, `outilsGenerauxBar`, `rightPanelBar`.
- **App** — an ordered list of bars. The only file that knows the whole picture.

**Rule zero:** a feature never imports another feature. A group imports features. A bar imports groups (and rarely raw features for one-offs). The app imports bars. Nothing imports the app.

This gives us: adding a feature = one new file + one line in a group. Adding a bar = one new file + one line in the app. Scaling to hundreds of features stays linear.

---

## 2. Contracts (the only types that matter)

Create `app/_features/core/types.ts`. These types are the whole system. Do not add fields casually; extend only when a real feature demands it, and document the addition in this file.

```ts
import type { ReactNode } from 'react';
import type { ExamDoc, Block } from '@/app/_lib/types';

/** Runtime context handed to every feature. Never use globals. */
export type Ctx = {
  doc: ExamDoc;
  selection: string | null;
  activePageId: string;
  t: (key: string) => string;
  dir: 'ltr' | 'rtl';
  commit: (updater: (draft: ExamDoc) => void) => void;
  select: (blockId: string | null) => void;
  // Extend only when a feature genuinely cannot be written without it.
};

/** What kind of thing a feature is. Drives default rendering and dispatch. */
export type FeatureKind =
  | 'tool'        // creates a Block on the active page
  | 'action'      // runs a side effect (save, export, open dialog)
  | 'toggle'      // reflects / flips a boolean state
  | 'menu-item'   // lives inside a dropdown menu
  | 'field'       // an input bound to the current selection
  | 'panel'       // a whole sub-surface (rare; usually a Bar)
  | 'overlay';    // floating / modal surface (TemplatePicker, MathKeyboard…)

/** The atomic unit. One file exports exactly one of these. */
export type Feature<TConfig = unknown> = {
  id: string;                                   // "tool.qcm", "action.export-pdf"
  kind: FeatureKind;
  label: string | ((t: Ctx['t']) => string);
  icon?: ReactNode;
  order?: number;                               // sort key inside its group
  hotkey?: string;                              // "Ctrl+D" — informational
  defaultConfig?: TConfig;

  // Exactly one of these is the feature's "primary verb":
  create?: (ctx: Ctx, config?: TConfig) => Block;                 // kind: tool
  run?: (ctx: Ctx, config?: TConfig) => void | Promise<void>;     // action | menu-item | toggle
  render?: (p: { ctx: Ctx; config?: TConfig }) => ReactNode;      // toggle | field | panel | overlay

  // Optional metadata used by the inspector / registry:
  edits?: Block['type'][];                      // which block types this feature edits
  group?: string;                               // for search / categorisation
  tags?: string[];                              // for search
};

/** An ordered list of features with a label. */
export type Group = {
  id: string;
  label?: string | ((t: Ctx['t']) => string);
  order?: number;
  features: Feature[];
};

/** Where a bar lives on screen. */
export type BarPosition = 'top' | 'left' | 'right' | 'bottom' | 'overlay';

/** An ordered list of groups (plus optional one-off features) at a position. */
export type Bar = {
  id: string;
  position: BarPosition;
  order?: number;
  groups: Group[];
  features?: Feature[];                         // escape hatch, use sparingly
};
```

**Invariants** (a violation is a bug):

1. Every `Feature.id` is globally unique. Use the `kind.scope.name` pattern.
2. Every `Feature` has exactly one of `create` / `run` / `render`.
3. `create` is only valid on `kind: 'tool'`.
4. `render` is required for `field`, `panel`, `overlay`, and `toggle`.
5. `Feature` objects are frozen (`Object.freeze` at module scope is fine).
6. A `Feature` never imports another `Feature`. Only `Group` and `Bar` compose.
7. `Ctx` is passed down through props. Never read from a global store inside a feature.

---

## 3. Folder layout

```
app/
├── _features/
│   ├── core/
│   │   ├── types.ts             # the contracts above
│   │   ├── registry.ts          # optional: id → Feature map (see §7)
│   │   ├── BarRenderer.tsx      # renders a Bar
│   │   ├── GroupRenderer.tsx    # renders a Group
│   │   └── FeatureRenderer.tsx  # renders a Feature by kind
│   ├── tools/                   # one file per block-creating feature
│   ├── actions/                 # one file per top-bar / panel action
│   ├── fields/                  # one file per inspector field
│   ├── overlays/                # one file per modal / floating surface
│   ├── groups/                  # one file per group (imports features)
│   ├── bars/                    # one file per bar  (imports groups)
│   └── app.ts                   # the app layout (imports bars)
├── _components/                 # only the thin shell (Editor.tsx) remains
└── _lib/                        # unchanged: behavior, data model, helpers
```

`_lib/` keeps **behavior**. `_features/` keeps **composition**. A feature may import from `_lib/`. `_lib/` never imports from `_features/`.

---

## 4. Rendering pipeline

Three small generic renderers. They must not know the name of any specific feature.

**`FeatureRenderer.tsx`** — dispatch by kind:
- `tool` → button; on click, call `ctx.commit(draft => draft.pages.find(p => p.id === ctx.activePageId)!.blocks.push(feature.create(ctx)))`.
- `action` / `menu-item` → button / menu row; on click, `await feature.run(ctx)`.
- `toggle` → render via `feature.render({ ctx })`; the feature owns its own visual state.
- `field` → render via `feature.render({ ctx })`.
- `panel` / `overlay` → render via `feature.render({ ctx })` inside the correct wrapper.

The renderer is allowed to look at `kind`, `icon`, `label`, `hotkey`, `order` — nothing else.

**`GroupRenderer.tsx`** — sorts `group.features` by `order ?? 0`, renders the optional label, then maps features through `FeatureRenderer`. Layout is chosen by the group's parent bar, not by the group itself.

**`BarRenderer.tsx`** — sorts `bar.groups` by `order ?? 0`, renders them in a container whose class depends on `bar.position`. The container is the *only* place that knows about top/left/right/bottom/overlay geometry.

**`Editor.tsx`** — the composition root of the *shell*. It must:
1. Build `Ctx` from `useExam` (or an equivalent hook).
2. Import `appLayout` from `_features/app.ts`.
3. Render bars grouped by position, using `BarRenderer`.
4. Contain **no feature-specific JSX**. If you find yourself writing `<button onClick={...}>Exporter</button>` here, you are breaking the architecture.

---

## 5. Authoring a feature (the only pattern allowed)

Every new capability follows this recipe:

1. Create `app/_features/<kind>/<name>.tsx`.
2. Export a single `const someFeature: Feature = { … }`.
3. Add it to the appropriate group file in `app/_features/groups/`.
4. If no suitable group exists, create one and add it to a bar in `app/_features/bars/`.

**Example — a `tool`:**

```tsx
// app/_features/tools/section-title.tsx
import { Type } from 'lucide-react';
import { createBlock } from '@/app/_lib/blocks';
import type { Feature } from '../core/types';

export const sectionTitleTool: Feature = {
  id: 'tool.section-title',
  kind: 'tool',
  order: 10,
  label: (t) => t('tool.sectionTitle'),
  icon: <Type size={18} />,
  create: (ctx) => createBlock('header', { pageId: ctx.activePageId, variant: 'section-title' }),
};
```

**Example — an `action`:**

```tsx
// app/_features/actions/export-pdf.tsx
import { Download } from 'lucide-react';
import { exportPdf } from '@/app/_lib/pdf';
import type { Feature } from '../core/types';

export const exportPdfAction: Feature = {
  id: 'action.export-pdf',
  kind: 'action',
  order: 100,
  label: (t) => t('action.exportPdf'),
  icon: <Download size={16} />,
  run: async (ctx) => { await exportPdf(ctx.doc); },
};
```

**Example — a `field`:** exports `render` that returns the existing editor component wired to `ctx.selection`.

No feature file may be longer than ~150 lines. If it grows, it is two features.

---

## 6. Authoring groups, bars, app

**Group:**
```ts
// app/_features/groups/insert.ts
export const insertGroup: Group = {
  id: 'group.insert',
  order: 20,
  label: (t) => t('group.insert'),
  features: [sectionTitleTool, paragraphTool, equationTool, /* … */],
};
```

**Bar:**
```ts
// app/_features/bars/outils-generaux.ts
export const outilsGenerauxBar: Bar = {
  id: 'bar.outils-generaux',
  position: 'left',
  order: 10,
  groups: [questionsGroup, insertGroup],
};
```

**App:**
```ts
// app/_features/app.ts
export const appLayout: Bar[] = [
  topBar,
  outilsGenerauxBar,
  canvasBar,
  rightPanelBar,
  ...overlayBars,
];
```

That's the whole wiring. No context providers, no plugin loader, no config file. Just objects referencing objects.

---

## 7. Scaling path (do not implement now, but do not block it)

The system above scales to hundreds of features with zero runtime cost. When the app needs to grow further, add these in order — each is additive, none requires rewriting existing features:

1. **Registry** — `core/registry.ts` with `register(feature) / get(id)`. Bars may then reference features by `id` instead of direct import. Use only if you need cross-cutting lookup (search, command palette, hotkey dispatch).
2. **Lazy features** — a `Feature` may carry `load?: () => Promise<Feature>` instead of `create/run/render`. `FeatureRenderer` resolves it via `React.lazy` / dynamic import. Useful for heavy overlays (MathKeyboard, ExportPreview).
3. **Capability flags** — `feature.requires?: Array<'math' | 'graph' | 'image'>`. The bar renderer hides features whose capabilities are unavailable. Enables feature-parity between browser and Tauri builds.
4. **Remote / user plugins** — only if the product demands it. Requires the registry plus a sandbox. Do not implement speculatively.

The type contract in §2 is designed so all four can be added without touching existing feature files.

---

## 8. Migration strategy (mandatory order)

Migrate in this order, keeping the app runnable at every step:

1. Add `_features/core/types.ts` and the three renderers. No existing file changes.
2. Convert **one tool** (start with `sectionTitleTool`). Verify it renders through the new pipeline.
3. Convert the **left panel** to `outilsGenerauxBar` with the two groups. Delete the old hardcoded left-panel JSX.
4. Convert the **top bar** to `topBar`. Delete `TopBar.tsx`.
5. Convert the **right panel**, then the **canvas rail**, then the **overlays**.
6. Reduce `Editor.tsx` to the shell described in §4.
7. Move any leftover per-feature logic out of `_components/` into `_lib/` (behavior) or `_features/` (composition). Delete `_components/*` except `Editor.tsx`.

At no point should the app fail to build.

---

## 9. What "dynamic for bigger scale" means here

- Adding a feature touches **one new file + one array entry**. Never more.
- Adding a bar touches **one new file + one array entry**.
- Reordering features is a `order` number change; reordering bars is an `order` number change.
- i18n is automatic: every label is either a string or `(t) => string`.
- RTL is automatic: bars inherit `ctx.dir`; features do not care.
- The renderer never special-cases a feature by id. If it does, that feature belongs in a group with a distinct `kind`.
- Feature files are pure data + tiny closures. No cross-imports. No side effects at import time (except `Object.freeze`).

---

## 10. Acceptance criteria

A correct implementation satisfies **all** of these:

- [ ] `app/_features/core/types.ts` exists and matches §2 (allowing documented extensions).
- [ ] Every UI element in the current app (top bar, left panel, right panel, canvas rail, overlays) is produced by a `Feature` object.
- [ ] Every feature lives in its own file under `_features/{tools,actions,fields,overlays}/`.
- [ ] Every bar is defined in `_features/bars/` and listed in `_features/app.ts`.
- [ ] `Editor.tsx` contains no feature-specific JSX — only `Ctx` construction and `BarRenderer` calls.
- [ ] No feature file imports another feature file (verified by a grep for cross-file imports inside `_features/tools`, `_features/actions`, etc.).
- [ ] Adding a hypothetical new tool requires editing exactly two files: the new tool file and one group file. Demonstrate this in a comment or test.
- [ ] `npm run build` passes.
- [ ] The app looks and behaves identically to the pre-refactor screenshot.

---

## 11. When to break a rule

Only these three exceptions are allowed, and each must be justified in a code comment:

1. A `Bar` may include `features:` directly (not wrapped in a group) for a one-off feature with no siblings — e.g. the app logo in the top bar.
2. A `Feature` may import a shared **presentational** component from `_components/` (never another feature) during migration. This exception expires once migration is complete.
3. `render` may return a component that internally renders other UI, provided that UI is not itself registered as a feature. If it is, it must be extracted.

Anything else is an architecture regression.

---

## 12. Glossary

- **Feature** — atomic UI object with an id and a verb (`create` / `run` / `render`).
- **Group** — ordered list of features with a shared label.
- **Bar** — ordered list of groups (or one-off features) placed at a `BarPosition`.
- **App** — the single `Bar[]` list.
- **Ctx** — runtime context passed to every feature; no globals.
- **Leaf** — any feature with no children (all `tools` and most `actions`).
- **Composition root** — `_features/app.ts`; the only file that knows the whole layout.
- **Shell** — `Editor.tsx`; builds `Ctx`, renders bars. No domain knowledge.

---

## 13. Implementation notes (what the code actually does)

This section records where the migrated code departs from §2–§6. Each item is deliberate.

**Corrections to the examples above**

- `ExamDoc` has a top-level `blocks` array and `pages` array. There is no `pages[].blocks`.
- `commit` takes an updater that returns the next doc (`(d) => ExamDoc`), not a draft.
- `createBlock(type, lang, pageId, preset)` takes four arguments.
- The PDF helper is `stageToPdf` / `imagesToPdf` (in `_lib/pdf.ts`). There is no `exportPdf`.
- Icons come from `app/_components/icons.tsx`. `lucide-react` is not a dependency.

**Contract changes**

- `Ctx` has `doc`, `selection`, `activePageId`, `t` (with `{vars}` support), `dir`, and `shell`. `lang`, `commit`, and `select` were dropped; features use `shell` commands instead.
- `Ctx.shell` (type `Shell`, `core/types.ts`) is the shell's command surface. It is rebuilt each render in `Editor.tsx`. Features call it; they never read state.
- Toolbox tiles are `kind: "tool"` features that use `run` (which calls `shell.runTool`), not `create`. Placement and undo live in the shell.
- `Feature` gains `tone`, `dragPayload` (a draggable tool's action), `separatorBefore`, `heading` (a small section title above a menu item), and `checked`.
- `Group` gains `when` (visibility), `menu` and `header` (draws the group as a dropdown), `menuAlignEnd`, and `className`.
- `Bar` gains `className`. Geometry lives on the bar, not in the renderer.
- `Bar` gains `collapse` (`BarCollapse`: width, labels, hotkey, `strip` features). `BarRenderer` wraps such a bar in `CollapsibleBar`, which slides it to a 32px strip with the shared edge tab (`_components/PanelToggle.tsx`). The shell dispatches `collapse.hotkey` generically. `Shell` gains `showBar`.
- `BarCollapse` gains `minWidth` / `maxWidth`. With both, `CollapsibleBar` adds a drag handle on the inner edge (`role="separator"`, arrow keys work too, double-click resets). Dragging far below the minimum closes the bar. The width is kept in `Shell.barWidths` (saved in the browser) and set with `Shell.setBarWidth`.
- `Shell` gains `saveToLibrary(block)`: keeps a copy of a block as a user asset of kind `"block"` ("My blocks" in the library).
- `Feature.tags` is used by the left-panel search (a tool also matches by its tags).
- `Bar` gains `dragRegion`: the bar gets `data-tauri-drag-region="deep"`, so its empty areas move the desktop window (the window has no native frame, see `tauri.conf.json`). The window buttons are a feature (`panels/window-controls.tsx`) in `group-window.ts`, shown only in the desktop app.
- `BarRenderer` draws one-off `features` first, then `groups` in `order`.
- Inspector-driven options (INSPECTOR-OPTIONS.md): `Feature` gains `target` (`'canvas'` default, `'left-panel'`, `'inspector'`) and `renderInspector`. An inspector feature has `renderInspector` as its only verb (no `create` / `run` / `render`; this extends invariant 2). Its left-panel row (`leftPanel/FeatureRow.tsx`) calls `ctx.openInspector(id)` and leaves the left panel where it is.
- `Ctx` gains `activeInspectorId`, `openInspector` and `closeInspector` (state in `Editor.tsx`). Opening one also switches the right panel to the Properties tab and reopens it if it was closed. Selecting or inserting a block closes it (the block's properties take over).
- The right panel draws the open inspector through `group-active-inspector.ts` (`panels/active-inspector.tsx`: title, close button, `renderInspector`). `group-properties.ts` hides while one is open. The feature is found by id with `findSectionFeature` (`sections/index.ts`), so the right panel never imports it directly. A new inspector option is one feature file + one entry in its section's option.
- Margins (MARGINS.md, MARGINS-DRAG.md): the margins stay on each `Page` (`Page.margins`, already read by the canvas, block placement and onboarding); there is no `ExamDoc.margins`. The unsaved draft lives in the shell, not in a React context (features read nothing from globals): `Shell.marginEdit` (`{ draft, dragging }`, null while the Margins panel is closed), `openMarginEdit`, `draftMargins` (saved after 500 ms) and `setMargins` (every page, one undo step). The panel (`inspectors/margins/`) and the canvas handles (`ExamCanvas.tsx`, `MarginHandles`) both edit that draft, so each shows the other's changes live. A drag is saved on release; the guides follow it without gliding. `Ctx` has no `commit`, so all saving goes through the shell.
- Page format (INSPECTOR-PAGE-FORMAT.md): `Page.format` (`{ size, orientation, customWidth?, customHeight? }`, missing = A4 portrait; custom sizes are stored portrait in mm). `_lib/pageFormats.ts` turns it into page pixels (`getPageDimensions`, `pageSize(page)`, `A4`); `_lib/a4.ts` keeps only the margin defaults. Page geometry on the canvas comes from `pageBoxes(pages)` in `_lib/pageStack.ts`: each page has a `{ top, left, width, height }` box, pages are stacked and centered on the widest one, and block positions stay relative to their page (the canvas, drop, inline editor and answer bar add the box's `left`/`top`). Fit-to-page follows the page in view. The PDF gets one page per exam page with its own size (`imagesToPdf(images, pages)`). Saving goes through `Shell.setPageFormat(pageId, format, key?)`. The inspector is `inspector.layout.page-format` (`inspectors/page-format/`), listed in Page layout above Margins.
- Header and footer (INSPECTOR-HEADER-FOOTER.md): the settings are `ExamDoc.globalHeader/globalFooter` and `Page.header/footer` (`HeaderFooterConfig { enabled, templateId, data }`; a page's own wins over the document's). There is no separate header renderer: templates are the existing library (`onboarding/headerFooterLibrary.ts`, now with `fields` and `countsPages`), and `_lib/pageChrome.ts` builds ordinary blocks tagged `meta.role` from the settings. That's why the canvas and the PDF (a picture of the canvas) need no changes. `syncChrome` rebuilds the blocks of the pages whose settings changed (moving the body when the header height changes), plus page-count footers when pages are added or removed. Older files only have the onboarding rule `meta.chrome`; `withChromeConfig` reads it as settings ("first page" or a list of pages = no document header + the page's own), and the setup window writes settings the same way (`chromeFromRule`) and reads them back (`chromeRuleOf`). Saving goes through `Shell.setChrome(kind, config, pageId?, key?)` and `Shell.resetPageChrome(pageId)`. Text typed on a header block directly on the page is replaced the next time that page's header settings change.
- Exam header merged into Header and footer: the exam header has no editor of its own any more. Selecting a header block (or inserting one) opens `inspector.layout.header-footer` (`Editor.tsx`, `HEADER_FOOTER_INSPECTOR`), which has everything the old header properties had: the style gallery, color, every text, font, "Graded out of" with the questions' total, plus "Save to my library". Style, color, font and full mark live in `HeaderFooterConfig.data` (`accent`, `fontFamily`, `outOf`, `autoOutOf`). Exam headers that are plain blocks (templates, older files, "My blocks") become their page's header settings when the page shows none (`adoptHeaders`, run on load, `replaceDoc` and insert). An extra one on a page that already has a header can take its place (`adoptHeader`). Any `updateBlock` on a page header's fields / style / accent / font goes to its settings (`headerEdit`), so the block and the settings never disagree. Rebuilt header/footer blocks keep their id and height on the page. The old `tool-insert-header` and `panels/header-gallery` (no longer listed anywhere) were removed.
- Header/footer edited on the canvas (INSPECTOR-HEADER-FOOTER-CANVAS.md): headers and footers were already Konva blocks, so there is no `HeaderFooterNode`, no `renderDecorations` / positioned-field template model, and no `activeElementId`. Instead:
  - `canvas/blocks/headerParts.tsx` opens up what `HeaderView` draws for a style and recognises which header fields each text line shows (`fieldOf`: one field, several joined by " · " / " — ", or after a "Label : "). That gives the places to type (`headerRegions`, used by `editRegions` as the `header` edit field) and applies the chosen alignments (`HeaderBlock.aligns`) through `HeaderNode`.
  - `OneLine` draws styled text, so the inline editor's format bar (size, bold, italic, color, font) works on header texts.
  - Header/footer text blocks carry `meta.field` (the settings key they show). Automatic footers (page numbers, rule) have none and can't be typed; their look is `data.style`.
  - Every change made on the page goes to the settings via `chromeEdit` (in `updateBlock`), so a document-wide header changes on every page. Texts left at the template's default are not saved.
  - `workspace/ChromeBar.tsx` floats under a selected header/footer: all pages / this page (`chromeScope`), size, bold, italic, alignment (`editChromeData`) and a button for the panel.
  - Deleting a header/footer (`deleteChrome`) removes the page's own, or turns the document's off.
  - The Algerian header is a 24th style (`algerian`, in `MoreHeaderViews`), with `republic` and `directorate` fields and its own default texts (`header.algerian`).
- Home → Formatting and the text box (INSPECTOR-HOME-FORMATTING.md):
  - There is no `block.style` object and no `ctx.commit`. Whole-block formatting lives in the existing `Block.font` (`BlockFont`, now also `bold`, `italic`, `underline`, `lineHeight` as a multiple of the normal spacing), applied by `blockFonts` / `textSpec` / `textboxSpec`. Alignment is `align` on text and text box blocks (`ParagraphAlign`, with `justify`, drawn by `RichText`). Single words stay styled in the text itself (richText.ts, format bar on the page).
  - The inspector (`inspector.home.formatting`, `inspectors/home/`) saves through `shell.updateBlock`. Its feature has `followsSelection: true`: `Editor.select` keeps such an inspector open when blocks are selected (headers/footers still open Header and footer).
  - Home → Font (INSPECTOR-FONT.md): the font list is `app/_features/libraries/fonts.ts` (`fontLibrary`, `FONT_CATEGORIES`). `_lib/fonts.ts` builds `FONT_CHOICES` from it, so the font menus, the format bar and Home → Font all offer the same fonts. `value` is the font name stored in `BlockFont.family` (drawn with fallbacks by `fontStack`), not a CSS stack. Fonts are the computer's (offline app): missing ones are greyed out. The inspector (`inspector.home.font`, `followsSelection`) saves through `shell.updateBlock`, so a header/footer gets the font in its settings. Home has one option, "Text": Font, then Formatting.
  - The text box is the `textbox` block type: `text` (not `content`, so the "text" edit field and inline editor work as for paragraphs), `align`, `valign`, `font`. Its size is `layout.width/height`, with all eight handles (the box grows if its text needs more room). Insert → Content → Text box (`tool.insert.textbox`).
- Drawn text box and its ribbon (TOOL-TEXTBOX-WORD-RIBBON.md):
  - The directive's `TextboxStyle` maps onto the existing model, not a new `style` object: font family / size / bold / italic / underline / color / line spacing are `BlockFont` (plus `strike`, drawn by `RichText` for every block type), `align` / `valign` stay on the block, and the box gains `background` (the "highlight": the box's fill, printed) and `padding` (inner margin, default `TEXTBOX_PAD`). New boxes use the exam's font instead of a hard-coded "Segoe UI".
  - There is no `ctx.activeTool`: draw mode is the existing canvas tool (`CanvasTool` in `workspace/ToolRail.tsx`, now `"select" | "text" | "textbox"`), exposed as `Shell.canvasTool` / `setCanvasTool`. The left-panel tool toggles it (`checked` shows its row pressed, see `FeatureRow`), the tool rail under the page has a third button, `B` is its shortcut; Escape, the select arrow, another tool, or drawing a box goes back to "select". Escape that stops drawing does not move the left panel back.
  - `ExamCanvas` (`drawBox` / `onDrawBox`): crosshair, blocks ignore the mouse and the selection loses its handles; a drag on a page draws a dashed box (kept inside that page, followed outside the canvas); less than 40 × 20 page px is a click and draws nothing. `Editor.drawTextbox` inserts it through `runTool` with `DropPoint.corner` (now exactly the top-left corner; the T tool's 10px nudge moved to `createText`), so it is selected, its text is ready to type and its ribbon opens.
  - One click anywhere inside a text box types in it (`EditRegion.hit` / `direct`); a 5px band along its edge drags it.
  - The ribbon is `inspector.textbox` (`inspectors/textbox/`). It has no left-panel row: `sections/index.ts` lists it in `blockInspectors`, `findSectionFeature` finds it and `blockInspectorFor(type)` picks it from `Feature.edits`. `Editor.inspectorFor` opens a block's own inspector before keeping a `followsSelection` one (headers / footers still come first). `hasActiveInspector` shows an `edits` inspector only while such a block is selected, so deselecting or deleting the box gives the panel back to the exam settings.
  - Home → Formatting and the ribbon share their controls (`inspectors/format/FormatControls.tsx`): font, size box (type, pick, grow / shrink), B / I / U / S, color buttons with swatches, alignment, line spacing, place in the box.
  - `wrapRich`'s cache key now includes underline and strikethrough (toggling them on a whole block could show the old lines).
- Rich text in text boxes (EXAMOR-TEXTBOX-RICHTEXT.md), hybrid version (chosen over the directive's Option A):
  - Konva already draws mixed formatting (one Konva text per styled piece, `RichText`), so the canvas keeps drawing text boxes as vector text: no html-to-image cache, sharp at every zoom and in the PDF (which is a picture of the canvas, so `pdf.ts` needed no change). Tiptap is only the editor while typing.
  - Data: `TextboxBlock.content` is the Tiptap document; `text` is kept as the same text in styled runs (labels, hints, older versions, the Properties text field, which rebuilds `content` with `docFromRich`). Older files have no `content`: `textboxDoc(b)` makes it from `text`. No `boxStyle` / `direction`: the box keeps `padding`, `valign`, `background`, plus `border`; direction comes from the exam's language like every block.
  - `_lib/textboxDoc.ts`: Tiptap JSON ⇄ runs (`docParagraphs`, `docFromRich`, `richFromDoc`), and whole-box formatting (`clearFormat`, `highlightAll`). Runs gained `x` (strikethrough) and `h=` (highlight); `RichText` draws a highlight behind its words. `layoutTextbox` lays out each paragraph with its own alignment.
  - `_lib/textboxEditor.ts`: the Tiptap v3 extensions (StarterKit without lists / headings / code / links, TextStyle, Color, FontFamily, FontSize, Highlight, TextAlign; there is no `@tiptap/extension-line-height` package, line spacing stays the box's), the selection's format and the commands.
  - `workspace/TextboxEditor.tsx`: the editor over the box (inside the zoomed layer), with the box's padding, place of the text (flexbox), fill, border and font, and the floating format bar. It closes on Escape or a click outside it and outside `[data-text-format]` (the formatting panels); a click on the box's resize handle keeps it open (`ExamCanvas.onHandleDown`), and it follows the box while resized (`onResizing`). Undo inside it is Tiptap's; the app's history gets one step per burst of typing.
  - No `ctx.commit` / `ctx.setActiveEditor`: the editor is `Shell.textEditor`. The ribbon's font controls talk to a `FormatTarget` (`inspectors/format/formatTarget.ts`): the selected words while a text box is being typed in, else the whole block (for a text box, the same format is then cleared from its words, like formatting a selected shape in Word). Bold / italic / … that the whole box has are moved onto its words when a part loses them (`toggleStyle`).
  - Fonts are not loaded from Google Fonts: the app is offline and uses the computer's fonts (see Home → Font).
  - Paragraph indent (EXAMOR-TEXTBOX-INDENT.md): `_lib/tiptap-indent.ts` adds an `indent` level (0–10, 24px each) to paragraphs, `indent` / `outdent` commands and Word's Ctrl+M / Ctrl+Shift+M. It is drawn as `margin-inline-start` (not `margin-left`), so it starts from the right in Arabic; `layoutTextbox` gives each paragraph its own `x` / `width` the same way. The ribbon's buttons sit after the alignment buttons (`FormatTarget.indent` / `shiftIndent`): the selection's paragraphs while typing, every paragraph of the box otherwise (`indentAll`).
  - Known limit: in an Arabic exam, Latin words styled differently on one line are drawn in right-to-left piece order on the canvas (the canvas has no bidi reordering; this was already so for every block).

- Molecule Studio (the molecule tool; chemistry is in `app/_molecule/`, plain TypeScript with no React, so it is unit-tested with Vitest):
  - There is no `molecule` block type. A molecule is an `image` block that carries `ImageBlock.molecule` (`MoleculeBlockData`: the graph with coordinates, the edits, the options), the same way a library figure carries `figure`. `src` is the drawing (SVG), so the canvas, the PDF (a picture of the canvas), resizing, undo and "My blocks" work unchanged. This was the only change to `_lib/types.ts`.
  - `ToolAction` gains `{ kind: "molecule" }` (open the Studio). A tool tile needs a `dragPayload`, so the tile (`tool.chemistry.molecule`, listed in the Physics and Sciences toolboxes) uses it; `Editor.runTool` opens the Studio for it.
  - `Shell` gains `molecule: { open, blockId }`, `openMolecule(blockId?)` and `closeMolecule()` (state in `Editor.tsx`, like `history`). Double-clicking a block that has `molecule` opens the Studio on it (`startEdit`); while it is open the page shortcuts are off.
  - The Studio is the overlay `overlay.molecule` (`_features/overlays/overlay-molecule.tsx`) drawing `_components/molecule/MoleculeStudio.tsx`. Insert goes through `runTool({ kind: "block", type: "image", preset })` and Update through `updateBlock`, so each is one undo step.
  - Studio layout (`_components/molecule/`): header search; left `MoleculeBrowser` (Results | Browse by family, data in `_molecule/families.ts`); centre `RepresentationBar` (short names + one-line caption), `CanvasBar` (Select menu, undo/redo, Isomers, zoom, shortcuts), `EditCanvas` with a floating `SelectionToolbar` (Hide / Blank / Show / Text / Remove, placed under the drawing); right `InspectorTabs` with `tabs/DisplayTab`, `ExamTab` (hide parts + student/answer previews), `GeometryTab` (VSEPR / Cram centres), `EditTab` (element, bond order, add/remove, warnings); `Welcome` is the empty state; `InsertBar` has one primary action (Insert in the exam / Insert both versions / Update) and a split menu (this drawing / student only / answer only / both). Shared widgets are in `ui.tsx`; fixed-layout representations (`skeletal`, `cram`) are listed in `layoutRules.ts`. Tabs other than Display need an atom-level drawing and are disabled otherwise; hiding parts switches to the Exam tab. Test ids: `edit-canvas`, `selection-toolbar`, `selection-count`, `warnings`, `vsepr-text`, `preview-student`, `preview-answer`, `insert-primary`, `insert-summary`, `isomer-gallery`.
  - RDKit.js (BSD-3) is loaded lazily from `public/rdkit/` (copied by `scripts/copy-rdkit.mjs` before `dev` and `build`), never from the network. The engine sits behind `ChemEngine` (`app/_molecule/engine/`), so another library can replace it.
  - Interface strings are in `app/_molecule/strings.ts`, merged into `FR` / `AR` at the end of `uiStrings.ts`. Molecule names are in `app/_molecule/data/molecules.json`; Arabic names stay empty until a reviewed list exists. `npm run check:molecules` validates that file; `npm test` runs the unit tests.

- Molecule Studio, edit layer (Phase 2):
  - `ToolAction` gains `{ kind: "blocks"; items }`: several blocks inserted one under the other (`Editor.runTool` places each under the previous one, because the document is only updated after the call). "Insert both" uses it for the student version and the answer key.
  - A molecule's drawing has two layers. `graph` is the chemistry; `edits` is what the student version hides, blanks or relabels. The answer key (`exerciseMode: "answer"`) ignores every visibility edit, so both versions always come from the same data. Structural edits (`app/_molecule/edit/ops.ts`) change the graph, never refuse, and report unusual valences as warnings; ids are never reused (the graph keeps `nextAtom` / `nextBond`).
  - Renderers take `(block, ctx?)`. `ctx.ghost` is the editor view: always the student version's changes, drawn faded, so hidden things can still be selected. Every drawn element carries `data-atom-id` / `data-bond-id` / `data-lp-id` (`atomId:index`), which is how the Studio maps a click back to the model (`EditCanvas.tsx`).
  - The Studio's undo history (`edit/history.ts`, `useMoleculeEditor.ts`) holds only `graph` + `edits`; the representation, the options and the insert mode are not edits. A drag is one step (same key within 0.9 s). Only the final Insert / Update reaches the exam's own history.
  - VSEPR (`geometry/vsepr.ts`) is pure templating in ar / fr / en; the Arabic element and geometry names and sentences are still to be checked by a chemistry teacher.

- Molecule Studio, Cram (Phase 3):
  - `render/cramLayout.ts` is the pure layout: fixed templates around each Cram centre (tetrahedral = two in-plane bonds 109.5° apart + one wedge + one hash; pyramidal = one in-plane + wedge + hash; everything else planar, no wedges), the main chain as the in-plane anchor to the east, and a planar fan for the other atoms. Of four flipped variants the first one without overlaps is kept. The centres are `MoleculeBlockData.geometryCenters`; missing = the first tetrahedral / pyramidal atom (`defaultCramCenters`), `[]` = everything flat. Rings and several pieces give an explicit message, never a wrong drawing.
  - A Cram drawing has its own layout: `buildScene` takes `{ positions, stereo }` and does not apply the position edits (moves made on the structural drawing must not disturb it), so the Studio does not let atoms be dragged there. Wedge and hash bonds are drawn by `bondsSvg` (narrow end at the centre), so hiding, blanking, stubs and ghost view work unchanged: the student version of a Cram drawing is the same overlay as for the others.
  - `RenderOptions.cramLonePairs` draws the lone pairs of a Cram drawing (the NH₃ pair) with the Lewis code.

- Molecule Studio, isomers (Phase 4):
  - Constitutional isomers are precomputed at build time and shipped as data: `scripts/gen-isomers.mts` runs MAYGEN (Java, MIT; a dev tool, not vendored, not shipped) for `isomers/formulas.ts` (every carbon formula of the database plus the school families: C1–C6 with at most 2 O, 1 N, 2 Cl and three heteroatoms, C7–C8 as C/H/O) and writes `app/_molecule/data/isomers/<formula>.json` plus a generated `index.ts` of lazy loaders (one chunk per formula). Formulas with more than 30,000 structures get no table. Run it with `npm run gen:isomers -- --jar <MAYGEN-1.8.jar>`.
  - All the rules are pure TypeScript on the molecule graph (`app/_molecule/isomers/`): `groups.ts` (functional groups, rings, branching), `school.ts` (the school filter: 3- and 4-membered rings, peroxides, enols, gem-diols, cumulated double bonds), `rank.ts` (simplest first; molecules of the database always first), `build.ts` (canonical, de-duplicated, classified, capped at 40 school + 20 other per formula, names only from the database), `describe.ts` (carbon skeleton SMILES and the chain / position / function relation between two isomers). Because they work on any graph, the gallery also classifies an edited molecule.
  - `npm run check:molecules` validates every table against the current rules (`isomers/validate.ts`), so tables made with older rules are caught. `resolve()` adds the first 12 school isomers of a formula's table after the database molecules (`source: "isomer-table"`).
  - The gallery (`_components/molecule/IsomerGallery.tsx`) opens from the Studio's "Isomers" button, filters by group, shape and relation to the current molecule, and loads the chosen isomer into the Studio.

- Molecule Studio, skeletal formula (Phase 5): `render/skeletal.ts` draws the line-angle formula from `buildScene(..., { skeletal: true, positions })`: bare carbon vertices (`Placed.implicit`, still a click target), labels that carry their hydrogens (`Placed.textAt/left/right`), a double bond in a ring with an inner line (`Scene.ringCenter`). It uses `MolAtom.sx/sy`, a depiction the engine makes without the hydrogens (set in `rdkitEngine.explicitH`); older documents fall back to `x, y`. Like Cram it has a fixed layout of its own (`FIXED_LAYOUT` in the Studio): no dragging, no layout or hydrogen options.
- Next.js is 16.4.2 (patched from 16.4.0, whose build step now fails on two server-side advisories this static app does not use). The Studio was verified in the real Tauri window (debug build driven through WebView2's remote-debugging port).

- Molecule Studio, drawing lab (MOLECULE-STUDIO-PART-1.md; the engine for the free-drawing editor). It sits next to the generating Studio above and does not replace it: its own tile ("Draw a molecule", `tool.chemistry.molecule-lab`, in the Physics and Sciences toolboxes), its own overlay (`overlay.molecule-lab`) and its own folder, `_components/molecule-studio/` (the directive's path; the generator stays in `_components/molecule/`).
  - Data and pure logic are in `_lib/chemistry/` (no React, unit-tested): `periodicTable.ts` (the 118 elements, `COMMON_ELEMENTS`, `tableCell` = position in the 18-column table with the f-block in rows 9–10, `textColor` = darkens pale CPK colours so they stay readable on white), `types.ts` (`MoleculeGraph` = `AtomNode[]` + `BondEdge[]`, element = symbol key, **separate from `_molecule/model.ts`**), `bondGeometry.ts` (trimming, double / triple offsets, wedge, hash), `viewport.ts` (zoom around the cursor, fit), `samples.ts` (acetic acid and caffeine, hard-coded), `strings.ts` (FR / AR, merged into `uiStrings.ts` like the other Studio's).
  - `ElementData` gains `nameEn` beyond the directive. Names are French and English only; Arabic element names are not invented, the Arabic UI shows the English name. `valence: 0` means "no hydrogens auto-filled" and is shown as "—": only the non-metals and metalloids that form covalent hydrides have one (B, C, N, O, F, Si, P, S, Cl, Ge, As, Se, Br, Sb, Te, I; the SMILES "organic subset" plus the next ones down); every metal and noble gas has 0, so a Na or a Ca drawn for a salt does not become NaH or CaH2 (Part 3 corrected the alkali, alkaline-earth and p-block metals, which Part 1 had given 1–4).
  - `ToolAction` gains `{ kind: "molecule-lab" }`; `Shell` gains `moleculeLab`, `openMoleculeLab`, `closeMoleculeLab` (state in `Editor.tsx`, page shortcuts off while it is open).
  - The canvas is a Konva `Stage` with the graph paper as a CSS background that follows the view (so it is endless and costs nothing). The view is `null` until the teacher moves it (then the drawing is fitted), so a new drawing only needs a new React `key`. Wheel = zoom around the cursor; middle button = pan (window listeners until release).
  - Part 1: the atom's `hidden` / the bond's `hidden` are drawn faded (the editor view of the student version). Undo / Redo / Insert are drawn disabled ("Coming soon"); the right panel only shows the atom and bond counts.
  - Part 2 (MOLECULE-STUDIO-PART-2.md), interactive atoms. `useMoleculeStudio` (`_components/molecule-studio/`) holds the Studio's own state: graph, tool (`select` | `atom` | `erase`), active element, selected atom. It is local on purpose: the overlay gives the Studio only `onClose`, so nothing reaches the exam's undo history. The edits are pure functions in `_lib/chemistry/graphOps.ts` (`makeAtom`, `addAtom`, `moveAtom`, `removeAtom` = the atom and its bonds, `atomNear`).
  - Mouse → drawing: `getPointerPosition()` is in screen pixels, so a click is turned into drawing units with `toWorld(view, …)` and then snapped with `snapToGrid` (`GRID` = 20, the same spacing as the graph paper), at any zoom and pan. A click within 10 units of an atom places nothing.
  - Atoms are listening Konva groups with a transparent 16-unit hit circle (the glyph alone is too small a target); bonds are not listening and are recomputed from the atoms' coordinates on every render, so they follow a dragged atom. An atom's click stops the event (`cancelBubble`) so the paper behind does not also place an atom. Only the left button clicks or drags an atom (Konva also drags with the middle button: `onDragStart` stops it and the middle button pans instead).
  - The view no longer follows the drawing: it is fitted once on the drawing as opened (`opened`) and then only moves when the teacher moves it ("Fit" refits on the current drawing), otherwise placing or dragging an atom would move the whole canvas.
  - `StudioToolbar` replaced the Part 1 palette: Select / Eraser, the common elements (highlighted only while the atom tool has that element), "All elements" (picking one also switches to the atom tool). A faded ghost atom previews the snapped place of the next click. Delete / Backspace remove the selected atom; Esc clears the selection first, then closes.
  - Part 3 (MOLECULE-STUDIO-PART-3.md), bonds and auto-valence.
    - `valence.ts` (pure): `getSnappedAngle` (30°), `pointAt`, `bondOrder`, `freeDirections` (the free angles around an atom: each new bond goes in the gap that leaves the widest angle, so CH3 at a chain end is a cross and the two H of a zigzag CH2 sit outside the bend) and `recalculateHydrogens`. (Charges: see Part 3 → step 3 below.)
    - **Hydrogens are atoms, and the engine owns some of them.** `AtomNode.auto` (an extension of the directive's type) marks the H the engine made. `recalculateHydrogens` removes the `auto` ones and remakes them from the valence and the current geometry after *every* edit (`useMoleculeStudio.edit`), so they follow a moved atom, give way to a new bond and vanish with their atom. H atoms without the flag (a sample's, or placed with the H brush) are never touched and count as bonds. The directive says to remove all explicit hydrogens; that would have wiped the acetic acid sample and any H the teacher placed. Ids are stable (`<atom>~h0`…), so a selection survives an edit. Grabbing an automatic H (`grabAtom` → `claimAtom`) makes it the teacher's: it stays where it is dropped.
    - Samples go through the engine when loaded: acetic acid is unchanged (its hydrogens are drawn), caffeine arrives as C8H10N4O2 (24 atoms, 25 bonds).
    - Deleting an atom (`removeAtomAndHydrogens`) also deletes the H that were bonded to it and to nothing else; the neighbours then complete themselves (erase the methyl of acetic acid and the carboxyl carbon gets an H: formic acid).
    - Bond tool: press on an atom, drag, release. `planBond` (graphOps.ts, pure) decides: still on the source atom → nothing (a click); on another atom → bond to it; else a new carbon one bond length away (50, not the directive's ~60, so every bond has the same length as the hydrogens and the samples) at the mouse direction snapped to 30°, or a bond to the atom already standing there. The preview is the real bond drawing, dashed, with a ghost carbon or a ring on the target. Release outside the area, Esc (capture-phase listener that marks the event handled, so the Studio does not close too) and the middle button all drop it. Two atoms are never bonded twice: bonding a bonded pair with another type retypes the bond.
    - Bonds are clickable only while a tool that uses them is active (select: single → double → triple → single; eraser: delete; bond tool: take the active type); with the atom tool a click on a bond places an atom there. Their hit target is a transparent 14-wide line under the atoms.
    - Not in Part 3: undo / redo, charges, wedge / hash and ring tools, insert into the page.
  - Part 4 (MOLECULE-STUDIO-PART-4.md), rings, groups, texts and arrows.
    - `MoleculeGraph.annotations` (texts and arrows, `CanvasAnnotation`) is **required**, not optional: every function that rebuilds a graph had returned `{ atoms, bonds }` and would have dropped them silently; making the field required made the compiler list each one (all now spread the graph). `StudioTool` and `RingSpec` moved to `_lib/chemistry/types.ts` (the hint strings need the tool names). Texts and arrows are edited without touching the hydrogens.
    - `geometry.ts` — `generateRing`: the corners are on a circle of `L / (2·sin(π/n))`, not of radius L as the directive's code had it (that is right for a hexagon only: a pentagon made with radius L has sides of 47, not 40). Benzene's alternating double bonds only fit an even ring, so an odd "aromatic" ring stays single-bonded. Also `drawingBounds` (atoms, texts and arrows: "Fit" includes them).
    - **Bug fixed in `valence.freeDirections` (Part 3)**: the gap to put the next bond in was chosen by size ÷ (bonds in it + 1), which ties exactly for a ring carbon (half of the outside = the inside) and rounding of the corners then put a hydrogen inside the ring. It is now size ÷ (bonds + 2) (the angle left once the bond is in). Two bonds between two other bonds are also kept at most 60° apart (they were 80°, which put the hydrogens of carbons two apart 22 units from each other along a chain; now 37, and cyclohexane is perfectly regular).
    - Rings are one-shot: after a ring (or a text, or an arrow) the tool goes back to Select. Atoms, bonds and groups stay in hand. The directive's `activeRing` could be null; here it always holds a ring and the tool says whether it is in hand.
    - **Groups need a tool of their own** (`template`), not "atom tool with O": a group is several atoms and must know where it attaches. `fragments.ts`: a group is a tiny graph in bond lengths, root atom at the origin and the molecule to its left; only heavy atoms are listed, the hydrogens (the H of -OH, of -CHO…) come from the valence engine. `attachFragment` — on an atom: the free direction (`freeAngle`: east for a lone atom, a 120° bend away from a single neighbour on the side with more room, so chains zigzag, the middle of the widest gap for two or more, i.e. straight out of a ring); on a hydrogen (drawn or automatic): it replaces that hydrogen, in its exact direction; mirrored if that leaves more room. A click within 30 units of an atom counts as on it; on bare paper the group stands alone (`placeFragment`). `-OH -COOH -NH2 -CHO -CH3`.
    - Moving a ring: rings are not objects, so **Shift + drag** moves the whole molecule an atom belongs to (`connectedAtomIds` + `translateAtoms`, delta from the last position seen: it commutes with the engine's remaking of the hydrogens).
    - Texts and arrows (`AnnotationLayer`, `AnnotationEditor`): a text is anchored at its top-left corner, an arrow at its tail and points right, `width` long (the end handle drags along the arrow only; minimum 40). They are typed plainly and drawn by `chemText.ts`: digits after a letter or bracket are subscripts (H2SO4 → H₂SO₄), `+` / `-` after an atom and not before a letter or digit is a charge (Fe2+ → Fe²⁺, SO42- → SO₄²⁻; so "H2+" reads H²⁺). The pieces are laid out one after the other with the width measured on a canvas, so no Unicode sub/superscript glyphs are needed. The field (an HTML input at the zoom of the drawing) opens at once on a new text or arrow; Enter or leaving keeps it, Esc gives up (a new empty text is dropped; Esc marks the key as handled so the Studio does not close), double-click edits.
    - What is clickable depends on the tool, so that the paper under it stays usable: bonds only for Select / Eraser / Bond; atoms not for Ring / Text / Arrow; texts for Select / Eraser (and Text, for texts); arrows for Select / Eraser. (Before, a ring, a text or a group could not be placed on top of a bond.)
  - Insert, reopen and undo (after Part 4). The drawing lab is no longer a dead end.
    - **A drawing is an image block that carries its graph** (`ImageBlock.drawing: MoleculeGraph`, the third field of that kind after `figure` and `molecule`; `src` is its picture). The two molecule models stay separate (`_molecule/model.ts` for the generator, `_lib/chemistry/types.ts` for hand drawings): converting between them is a later decision. `Shell.moleculeLab` is now `{ open, blockId }` (like `molecule`); `Editor.startEdit` reopens a block that has `drawing` on double-click; the overlay inserts through `runTool({ kind: "block", type: "image", preset })` and updates through `updateBlock`, so Insert and Update are each one step of the exam's own history. Replacing the picture of a drawing or molecule block (inspector) now drops `drawing` / `molecule`: it is no longer that drawing.
    - `svg.ts` (`renderDrawingSvg`, pure): the picture with the same bond geometry as the canvas, **black and white** (exams are printed; `colour: true` is there for later), sub/superscripts as `tspan`s with cumulative `dy`, the size in the first `width="…" height="…"` (what `library.svgSize` reads), a margin of 18. Hidden atoms and bonds are drawn like the others (the answer key); a student version needs a UI to hide parts first. `drawingBounds` now includes the whole label of an arrow.
    - The Studio **opens on a blank page** (it used to open on acetic acid). "Start from" (blank / the test molecules) is only enabled while nothing has been drawn and is not shown when editing a block. Insert is off for an empty drawing; the button says Update when editing.
    - `history.ts` (pure): the whole graph is kept after each step (100 at most). A **gesture** is one step however many edits it makes: dragging an atom (also a Shift-drag of a molecule, a text or an arrow, and the end of an arrow), and placing a text or an arrow and typing it. `beginGesture` takes the snapshot, `endGesture` drops it if the drawing ended as it began (a text placed and given up leaves no step), and the redo steps a gesture sets aside are given back in that case. Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z and the header buttons; not while typing in a field (it has its own undo). Hydrogens are remade as part of each edit, so one undo restores atoms and hydrogens together.
    - Closing (X, or Esc on the drawing with nothing selected) a drawing that has changed since it was opened asks "Discard this drawing?" (`DiscardDialog`; Esc = keep drawing). A clean one closes at once.
  - Step 3: selection, Properties panel, charges.
    - **Charges in the valence engine** (`valence.effectiveValence`): groups 15–17 add the charge to their valence (NH4+ 4 bonds, H3O+ 3, OH− 1, Cl− 0), group 14 loses one for either sign (CH3+, CH3−), boron gains one when negative (BH4−), metals stay at 0 (no NaH from Na+). Charge is edited in the panel (−4…+4) and the hydrogens follow.
    - **Selection is a set** (`_lib/chemistry/selection.ts`, pure): atoms, bonds and texts / arrows by id, any mix; `prune` forgets what was deleted. Replaced the single `selectedAtomId` / `selectedAnnotationId`. Click selects one, Shift+click toggles, a frame dragged on the bare paper selects what is inside (atoms and texts by position, bonds between two taken atoms; Shift adds), Ctrl+A selects all, Esc clears. The click that ends a frame is ignored (`justBanded`). A bond is still cycled by a plain click (Part 3's rule) and now also selected; Shift+click selects it without changing it. Dragging one atom of a selection of several moves the whole selection (atoms and texts, by the difference since the last position seen, like Shift+drag of a molecule); dragging an unselected one selects only it. A group move does not claim automatic hydrogens (they are remade next to their atoms anyway).
    - **Properties panel** (`PropertiesPanel.tsx`, replacing the placeholder): nothing selected → the molecules of the drawing with formula and molar mass (`formula.ts`: bonded groups, Hill order with carbon; without carbon as school books write it: metals first, then groups 13–15, H, groups 16–17 with O last, H first in acids, OH− not HO−; NH3, H2O, HCl, H2SO4, NaOH); atoms selected → element (the common ones, "Other" opens the periodic table for the selection) and charge; bonds → single / double / triple / wedge / hashed and "reverse direction" (the narrow end of a wedge is the first atom); one text or arrow → its text, an arrow's length (typing in the panel is one undo step: a gesture). Changing an automatic hydrogen's element makes it the teacher's (replace H by Cl). The atom tool on an existing atom now gives it the element in hand.
    - Copy / cut / paste (Ctrl+C / X / V, Studio-local): automatic hydrogens are not copied (they are remade), bonds only between two copied atoms, new ids, each paste 40 units further than the last, the paste is selected.
    - A ghost atom or ring is only drawn while the atom or ring tool is in hand: its position used to outlive the tool and a faded "C" appeared in the middle of a ring just placed (a Part 4 bug).
    - **Hydrogen modes** (`MoleculeGraph.hydrogens`: `"auto" | "manual" | "labels"`, switch at the top of `StudioToolbar`). The auto-valence engine used to run after every edit with no way off; now every edit ends with `applyHydrogenMode` (valence.ts), which only remakes hydrogens in `auto`. **`manual` is the default of a new drawing**: nothing is added, every bond (C–H too) is drawn by hand; the "Add the missing hydrogens" button runs the engine once and the hydrogens it makes are ordinary atoms. In `labels` nothing is added either and the missing hydrogens are written next to the atom (`hydrogenLabel.ts`: CH3, OH, and H3C when the only bond goes right); the canvas, the exam picture (`svg.ts`), the bounds and the formula all use the same counts (`implicitHydrogens`). Changing mode is an undo step: auto → manual keeps the hydrogens as ordinary atoms, auto → labels drops them (the labels say the same), → auto adds them at once. A drawing without the field (made before the modes) is `auto` if it carries engine hydrogens, else `manual` (`hydrogenModeOf`). More bonds than the usual valence is only a warning (an amber "!" on the atom and a line in the panel, `overValenced`); metals and the period-3+ elements of groups 15–17 (S, P, Cl…) are never flagged. `recalculateHydrogens` itself is unchanged.
    - **Masking and the two views** (MOLECULE-STUDIO-PART-6.md; `_lib/chemistry/masking.ts`). `AtomNode.hidden` / `BondEdge.hidden` were already there; they are now set from the right panel ("Mask the atom / the bond", on everything selected) with an optional replacement: `AtomNode.mask` (absent = `?`, `""` = an empty dashed box) and `BondEdge.mask` (absent = a dashed grey line, `""` = nothing). The header has **Teacher view / Student view** (`studioView` in `useMoleculeStudio`, not an edit, not in the undo). Teacher: a masked atom is at 50 % with a red dashed ring, a masked bond has a red dashed halo. Student: `atomInStudentView` / `bondInStudentView` decide what is drawn; the canvas is read-only (it can still be scrolled and zoomed) and the side panels are off. **A bond to a masked atom is still drawn** (only bonds masked on their own go; the directive's "hide all connected bonds" would leave a floating `?`), and the automatic hydrogens of a masked atom go with it (`isOmittedHydrogen`). `renderDrawingSvg(graph, { student: true })` makes the student picture; **Insert / Update put on the page the view that is on screen** (`drawingPreset(graph, view)`), and the block always carries the whole graph, so reopening it shows the masks.
    - **Representations are the generator's renderers, not canvas filters.** The tab bar (Drawing | Molecular | Semi-developed | Developed | Skeletal | Lewis | Cram) turns the drawing into a molfile (`_lib/chemistry/molfile.ts`), reads it with the engine and draws it with `_molecule/render` (`useRepresentation`). The directive of Part 6 asked for filters in `MoleculeRenderer` instead; that was not done because its "semi-développée" rule (hide every bond between two C / H atoms) would hide the C–C backbone, and the engine already draws the correct topological, semi-developed, Lewis and Cram forms. The masks reach the tabs through the engine's own student version: `mapToEngine` matches the drawing's atoms to the engine's (heavy atoms in order, then the hydrogens of each heavy atom in order; no match = no mask, never a wrong one) and `engineEdits` turns them into `edits` (a masked atom is a `shown` atom with a `label`, loses its lone pairs and the hydrogens the engine added to it; a masked bond is `blank` (dashed) or `hidden`). Teacher view = the answer key drawn with `ghost: true`. The molecular and semi-developed formulas are text built from the whole molecule and do not use these edits, so a mask does not change them.
    - **The library of bonds, lone pairs, and tolerance.** `BondType` has 14 types in three groups (`bondNames.tsx`): covalent (single, double, triple, quadruple, aromatic = a line and a dashed one, partial = dashed), stereo (wedge, dash, open wedge, bold, wavy) and not covalent (dative = arrow from the donor, ionic = dotted, hydrogen = thin dashed). `bondDrawing` gives plain `lines` / `polygon` as before and a `parts` list for the styled ones (`BondPart`); the canvas, `svg.ts` and the toolbar glyph all draw from it. `bondOrder` (valence.ts): quadruple 4, aromatic 1.5, the not covalent ones 0 (so they never take a hydrogen's place and never raise the valence warning); a hydrogen bond does not join two atoms into one molecule (`moleculesOf`). **In the representation tabs** (`_lib/chemistry/representation.ts`, called by `useRepresentation`): the engine only gets the covalent bonds (`molfile.ts`: quadruple → 3, aromatic → type 4), then `engineGraph.ts` puts back what it cannot know: `MolBond.style` for the styled bonds, `MolBond.stereo` (and a swap so the narrow end is at the atom the bond started from), `MoleculeBlockData.overlayBonds` for the not covalent ones (drawn by `structural.ts#overlayBondsSvg`, not part of the graph), and the lone pairs. A drawing in several pieces, or one the engine rejected, keeps its own layout (`layout: "auto"`), with the hydrogens the engine adds placed round their atoms (`placeHydrogens`: the engine leaves them all at the origin).
    - **Lone pairs** (`_lib/chemistry/lonePairs.ts`): `MoleculeGraph.lonePairs` = off (default) / dots / lines (toolbar section, like the hydrogen mode); `AtomNode.pairs` = the teacher's count, else `autoLonePairs` = (valence electrons − charge − the larger of its bonds and its usual valence) ÷ 2, so a bare O has two and OH⁻ three; the "Lone pair" tool adds one per click (Shift: one less) and the panel has a stepper, "Automatic" and "Hide them from the students" (`pairsHidden`, also hidden for a masked atom). Marks go in the free sectors between the bonds (the same `lonePairAngles` as the Lewis tab) and away from a hydrogen label. The structural and skeletal tabs write them too (`options.showLonePairs`); Lewis always does.
    - **Lone pairs put by hand** (Part 7, adapted): the directive stored extra `lewisMarks` per atom; that would have duplicated the count above (a water oxygen would show its two automatic pairs plus the marks). Instead `AtomNode.pairDirs` holds the directions (degrees, relative to the atom, so they move with it) of the pairs the teacher placed; each is one of the atom's pairs (`lonePairCounts` = the larger of the count and `pairDirs.length`) and the others spread over what is left. With the Lone pair tool a click beside an atom (the hit zone is 26 units, not the symbol's 16) puts a pair towards the mouse, snapped to 45° and moved to the nearest free 15° step when a bond, a label's hydrogens or another pair (`PAIR_GAP` 30°) is in the way (`pairClick` is shared by the click and the blue preview); a click on a pair (within `PAIR_REACH` 22°) takes it away, as does the Eraser on a pair (an atom click still deletes the atom), Shift+click takes the nearest, a click on the symbol adds one placed automatically. In Select a pair is dragged round its atom (15° steps, never onto a bond); picking one up first pins the atom's other pairs (`pinPairs`) so they do not jump. "Automatic" and "Write them all automatically" forget what was placed. All of it is `editNotes` edits (undoable, a drag is one step). Not forwarded to the engine: the school layouts re-lay-out the molecule, so the Developed/Skeletal/Lewis tabs place the pairs themselves (only the drawing tab and the inserted drawing use the hand-placed directions). One style (dots or bars) for the whole drawing, not per mark. **Single electrons** (`_lib/chemistry/electrons.ts`): `AtomNode.dots` = directions of one-dot electrons put by hand with the Single electron tool (same snapping, clearance, click-to-remove and preview as pairs, no drag). They are not lone pairs (no effect on the pair count) and are written whatever the lone pair mode is; they count in the octet warning, make pairs move out of their way, and are in the picture (hidden in the student view with the atom's pairs). Not forwarded to the engine tabs.
    - **Mistakes are allowed.** `issues.ts` lists what looks wrong (too many bonds for the element, more than eight electrons round a period-2 atom, two atoms on top of each other); the canvas puts a small "!" on the atom (the reasons in a tooltip on hover) and the panel lists them (click selects the atom). Nothing is blocked, in the drawing or in the page: a sketch the engine cannot read is drawn as it is in the tabs, with a "!" note over it. Not covered: a mask in the molecular and semi-developed tabs (text built from the whole molecule; the Studio says so).
    - Not done: hiding parts for a student version (the `hidden` flags have no control yet), display modes (semi-structural / skeletal), Cram-style stereo drawing tools beyond the wedge / hash types, committing the browser tests.
  - Not done: **"Clean up"** (the optional bonus in the directive) is deferred; it is a layout problem of its own and could use RDKit's 2D coordinates through the existing `ChemEngine`.

**Known gaps**

- `Editor.tsx` still owns all state and actions. It contains no feature JSX, but it is larger than a thin shell.
- The canvas tool rail (`workspace/ToolRail.tsx`), `ZoomBar`, `PageStrip`, and `AnswerBar` are still rendered inside `Workspace.tsx`. They are not yet features.
- The `Inspector`, `LibraryPanel`, `ExportPreview`, `VersionHistory`, `TemplatePicker`, and `ExportRenderer` components are unchanged. Features wrap them. (`MathKeyboard` became `FloatingKeyboard`: see "Math keyboard" at the end.)
- The "No tools found" message from the old toolbox was not carried over.
- Visual parity with the pre-refactor app is not verified. The build, type-check and lint pass; no screenshot comparison has been done.

---

**End of directive.**

## Graph Studio (graph paper)

A third Studio, laid out like the Molecule Studio (top bar, 280 px left panel, canvas, 300 px right panel). The tile "Graph paper" (`tool-graph-studio.tsx`, in the Math, Physics and Sciences groups) runs `{ kind: "graph-studio" }`; `Shell.graphStudio` / `openGraphStudio` / `closeGraphStudio` and `overlay-graph-studio.tsx` follow the molecule lab's pattern: Insert makes an image block whose `src` is the picture and whose `graphStudio` field carries the `GraphConfig`; double-click reopens the Studio on it, Update puts it back (one step of the exam's undo each).

- `app/_lib/graph/` is pure (no React): `types.ts` (`GraphConfig` = limits, size in px, labels, major/minor steps, grid on/colour, `showNumbers`), `grid.ts`, `svg.ts`, `history.ts`, `presets.ts`, `strings.ts` (FR/AR, merged in `uiStrings.ts`).
- `grid.ts#buildScene(config)` is the one source of geometry, in pixels of the paper: fine and main grid segments (a fine line on a main line is skipped), the two axes with arrow polygons (past the paper's edge by `AXIS_OVERSHOOT`), ticks, and every text. The Konva canvas (`GraphCanvas.tsx`, one `Shape` per kind of segment) and the page picture (`svg.ts#renderGraphSvg`) both draw it, so they cannot differ. `graphToPxX/Y` are the directive's mappings (y inverted), with their inverses. Steps are integer multiples of the step (`multiples`), never repeated additions, so 0.1 does not drift.
- The axes cross at (0, 0), or stay on the nearest edge when 0 is off the paper. The 0 of the x axis is written left of the y axis, and the y axis does not repeat it.
- Bad input: `fatalIssue` (min >= max, a step <= 0, a paper outside 200-1400 px) makes `updateConfig` refuse the change and return the reason, which the field shows (`NumberField` keeps the typed text while focused, so "-" or "0." can be typed on the way); the paper on screen is always drawable. A grid finer than `MAX_LINES_PER_AXIS` or a fine step above the main one is only reported (the too-fine lines are left out).
- Undo/redo is the Studio's own (`history.ts`): edits of the same field within 800 ms are one step (typing a label is not one step per key).
- Deviations from the directive: a `showNumbers` field was added (the numbers along the axes and the tick marks), the left panel holds starting sheets (millimetre paper, position-time, speed-time, pH-volume, centred axes) instead of empty placeholders, and Insert/Update work already. The directive's single `majorGridStep` was one step for both axes; a step for each axis was added later (see Physics sheets, part 5).

### Curves (Graph Studio, part 2)

- `GraphConfig.functions` = `GraphFunction[]` (type, colour, thickness, `params`); a block saved before this has none, so `normalizeGraphConfig` fills it in when the Studio opens one.
- `mathUtils.ts` (pure): `FUNCTION_SPECS` (name, formula, the parameters and how they are written), `evaluateFunction` (the directive's five: linear, quadratic, exponential, logarithmic, sigmoid; τ = 0 is undefined, not a step), `defaultParams` / `newFunction` (starting values worked out from the paper it is put on, so a new curve always shows: a decay that starts near the top left, a parabola opening downwards, a sigmoid across the middle; the next colour of `CURVE_COLORS`), and `sampleCurve`.
- `sampleCurve` differs from the directive's `generateCurvePoints` on purpose: that one drops the points outside the window and joins the rest, which draws a straight line across the paper when a curve leaves and comes back, and stops short of the edge. Here one sample per pixel is cut where the function is undefined and clipped exactly at the top and bottom of the paper (Liang–Barsky), giving several polylines; `status` says "undefined" or "outside" when there is nothing to see (the inspector shows a "!" note). `grid.ts#buildScene` puts them in `scene.curves`, so the canvas and the page picture draw the same curves (under the axes).
- Canvas: each curve is a Konva `Line` with a wide invisible hit area; a click selects it (indigo halo), a click on the paper deselects. Selection is Studio state, not part of the config; a curve that undo removes is simply no longer selected. Esc deselects before it closes; Delete removes the selected curve.
- Right panel: the "Curves" list (clicking a curve on the paper or in the list selects it) and, for the selected one, its formula, a field per parameter, colour, thickness and delete; the paper settings stay below instead of being replaced (they would be unreachable while a curve is selected). Edits go through `changeFunctions` on the latest list; an edit of one parameter is merged with the previous one of the same parameter within 800 ms (history.ts), and `same()` compares curves by content so setting a value to itself is not a step.
- Not done: the optional "Data points" tool of the directive.

### Annotations (Graph Studio, part 3)

- `GraphConfig.annotations` = `GraphAnnotation[]` (text, asymptote, tangent, triangle, marker; positions in graph units, so they stay put when the axes change). The directive's type was loose (a tangent "needs a `curveId`", a triangle uses `x1`), so the fields are: tangent = `curveId` + `x`; triangle = `x` to `x2` on `curveId` (its y values are the curve's) or free (`x, y` to `x2, y2`); marker = `(x, y)` or `x` on a curve; asymptote = `value` + `orientation` (vertical added) + optional label. Blocks saved before this have none (`normalizeGraphConfig`).
- `annotations.ts` (pure): `newAnnotation` (from a click), `resolveAnnotation` (-> lines, dots and texts in pixels of the paper, plus a `status`: ok / outside / undefined / no-curve), `handlesOf` + `moveHandle` (what dragging a handle changes: a point on a curve slides along it, only its x changes), `detachCurve` (a deleted curve takes its tangents with it; triangles and markers stay, their y values frozen), `nearestCurve`, readouts. `grid.ts#buildScene` puts the result in `scene.annotations`, so the canvas and the page picture draw the same thing (lines over the curves and axes, texts last).
- Deviations from the directive, on purpose: the tools are "in hand" (click a tool, then click the paper or a curve: the position comes from the click, snapped to the fine grid unless Snap is off, a text exactly where clicked) instead of dropping a fixed default; the tangent is the whole line across the paper cut at the edges (not 2 units each side, which is useless when the axes are scaled differently) with its point of contact marked; the slope is exact (`mathUtils#getSlopeAt`, the derivative of each function) instead of a numeric delta; the triangle's labels are the letters, or the values when asked ("Write the values of Δx and Δy").
- Interaction: a selected annotation shows round handles to drag; a text is dragged by itself; clicking an annotation (or a curve, or its row in the list) selects it, a click on the paper lets go; Esc puts the tool down, then lets go, then closes; Delete removes what is selected. Selection is one thing at a time (a curve or an annotation). The inspector (right panel, under the curves) has the fields of each type, a curve choice for tangents, triangles and markers, Δx / Δy and the slope readouts, colour, and dashed.
- Every edit goes through `change()` in `useGraphStudio` on the latest configuration, with one history key per annotation and kind of edit, so a drag or a typed field is one undo step.

### Measured points, masking and insertion (Graph Studio, part 4)

- **Data series** are a `GraphFunction` with `type: "data"` (`points`, `showPoints`, `lineStyle: "none" | "straight"`), as in the directive, so they share the curve list, selection, colour, thickness, undo and masking. `FUNCTION_TYPES` (the palette) leaves "data" out and `isMathFunction` tells them apart: only a curve with a formula can carry a tangent, a triangle or a point on a curve (`nearestCurve`, `newAnnotation` and the curve dropdowns skip a series). `sampleCurve` of a series joins its points in the order of x, cut at the paper's edge like any curve; `dataDots` gives the points that are on the paper; the scene carries them as `curve.dots` and the picture draws them white with a coloured border.
- **Putting points:** the "Add points" tool (`tool === "points"`, which stays in hand, unlike the annotation tools) adds a point at the click (snapped to the fine grid if Snap is on) to the selected series, or starts a new series when none is selected; "New series" makes an empty one and arms the tool. Shift+click a point removes it; a point of the selected series can be dragged. The inspector has a table (one x / y row per point, live), "Add a row", and a paste box for values from a spreadsheet (`parseDataText`: tab, semicolon, space or comma separated, decimal commas, headers skipped and counted). A smooth line through the points was added later (see Physics sheets, part 5).
- **Masking** copies the Molecule Studio: `hidden` on a curve or annotation ("Hide from the students" in the inspector, an eye-off icon in the lists), a Teacher view / Student view toggle in the top bar (with the count of masked things). `buildScene(config, { student })` leaves masked things out for the student and flags them `hidden` for the teacher, whose canvas draws them at 40 % and dashed; the Student view is only looked at (nothing is selected, the panels are locked, the canvas does not answer clicks). A tangent on a masked curve stays unless it is masked too: the teacher decides.
- **Insertion** was already how the Studio worked, and was kept instead of the directive's new `type: "graph"` block: `graph` is already the block of the function-plot tool, and an image block carrying its `GraphConfig` (`graphStudio`) is moved, resized, deleted, copied, exported and reopened (double-click) like every other picture with no new canvas node. Insert / Update use the view on the screen: the teacher's picture is the answer key (masked things drawn like the rest), the student's has them left out; the block still carries everything, so reopening shows it all. The shared rendering the directive asks for (`GraphRenderer`) is `buildScene`, drawn by both the Konva canvas and `renderGraphSvg`.

### Physics sheets (Graph Studio, part 5)

The Studio was extended so it can make the figures of an exam (titration curves, kinetics, RC / RL / RLC voltages and currents, damped oscillations, speed-time graphs, linearised lines) on millimetre paper, with the scale printed the way the exam sheets print it. Every new `GraphConfig` / `GraphFunction` / `GraphAnnotation` field is optional, so a paper saved before opens and is drawn exactly as it was (checked against the previous renderer on random papers: identical pictures; the only visible change is a text typed with `_` or `^`, now typeset).

- **A scale on each axis.** `xMajorStep`, `yMajorStep`, `xMinorStep`, `yMinorStep` (missing = the shared `majorGridStep` / `minorGridStep`, through `types.ts#axisSteps`). `configIssues`, the grid, the ticks, the snapping of clicks and drags (`Snap`: one step or one per axis) and the default size of a new triangle / line all use the step of their own axis. A preset (`presetChanges`) is for both axes and clears the per-axis steps.
- **Numbers.** `xNumbers` / `yNumbers`: `"all"` (missing), `"scale"` (only the origin and the first main line, which is the value of one main square: "1 cm ↔ 5 mL") or `"none"`; `showNumbers: false` still turns every number off. `decimalComma` writes 1,96. `labelBold` / `labelItalic` / `labelSize` (axis titles) and `numberBold` / `numberSize`.
- **Grid.** `midGrid` adds the 5 mm line (`scene.mid`, in the picture at `MID_WIDTH`, which takes the place of the fine line under it). `grid.ts#fitPaper(config, cellCm, maxWidth)` sizes the paper so a main square is `cellCm` cm (`CM_PX` = 96 DPI), scaled down to the limits or to the page, so the printed scale is the real one. `PAPER_MARGIN` moved to `types.ts` (annotations need it) and is re-exported by `grid.ts`.
- **Text.** `richLabel.ts` reads `_` and `^` (a run of letters or a number for a subscript, a letter or a signed number for a power, braces for anything longer, `\_` for a literal underscore) into `TextRun`s. `text` stays what was typed and `runs` is set only when there are scripts. The picture lays them out with `tspan` and `dy`; the canvas draws them with `RichText.tsx` (a Konva `Shape` using the 2D context, since Konva's `Text` has one baseline). `frame` (`"box"` / `"circle"`) puts a white box or a circled disc behind a text (the ① of a curve's name); its geometry is in the scene from an estimate of the text's width, so the canvas and the picture draw the same frame.
- **Curves** (`mathUtils.ts`). `oscillation` (A·e^(−(x−x₀)/τ)·cos(2π(x−x₀)/T + φ) + y₀ from x₀ on; τ = 0 does not fade; φ in degrees), `titration` (the charge balance of an acid by a strong base, or a base by a strong acid, solved for the pH by bisection: it reproduces the figures of an exam, e.g. 0.07 mol/L, 20 mL: pH 1.15 / 7.00 / 12.4 for a strong acid, 2.37 / 8.05 / 12.4 for a weak one of pKa 3.55; `ParamSpec.options` makes `kind` a choice) and `formula` (the parser of `graphMath.ts`, now accepting `t` as well as `x`, scientific notation and `u(t) =`; each text is compiled once, `compileExpression`). `from` / `to` limit the range a curve is drawn on (`evaluateFunction` has no value outside it, and the sampler adds a sample exactly at each end), which makes a line over a measured range or one piece of a curve (a capacitor's charge, then its discharge in a coil). `dash` is `"dashed"` / `"dotted"`. A data series can join its points with `lineStyle: "smooth"` (`monotoneCurve`, Fritsch–Carlson: through every point, never overshooting). `solveForX` finds where a curve has a given y.
- **Annotations** (`annotations.ts`). `axisMark`: a tick and a free text (a, t₁, E, −12,25; the value when empty) on an axis, with an optional dashed guide to its curve (for a mark on the y axis the first place the curve has that value) or to `guideTo`; a text too long for the margin goes inside the paper. `curveLabel`: the name of a curve ((1), A, ①), free to drag, in the colour of its curve, removed with it (`detachCurve`) and left out of the student's paper when its curve is masked. `line`: two ends, optionally carried to the edges of the paper, with an arrowhead. A tangent has `side` (`"right"` / `"left"` of its point of contact; missing = the whole line, as before).
- **Sheets.** `presets.ts#GRAPH_TEMPLATES`: 15 whole physics sheets (weak acid titration, strong and weak acid, pH − pKa, reactant amount, two experiments with measured points, reaction progress, logarithm against time, RC charge, RL with three resistances, RLC damped, LC undamped, RC charge then RLC discharge, speed with a limit, projectile, line through the origin), listed in the left panel by `Chemistry` / `Electricity` / `Mechanics`. `instantiateTemplate` gives each a fresh set of ids and sizes it with `fitPaper`; applying one replaces the paper in one undo step (`useGraphStudio#applyTemplate`).
- **Easy to miss.** `history.ts#same` compares the keys of both papers: with an optional setting it used to compare only the keys the present paper had, so the first time one was set it was treated as "no change". Silent but real; there is a test. The interface strings of the new fields are in `graph/strings.ts` (FR and AR); the words the app already has (`Text`, `Circle`, `None`…) are not redefined there, because the dictionary is merged app-wide (a word can differ from the one the chemistry studio gives it: the app's `Bold` is "Épaisse", so the title style says `Bold text`).
- **Tests.** `physics-paper.test.ts` (steps, numbers, medium lines, paper size, scripts, undo, the old paper), `physics-curves.test.ts` (parser, formulas, ranges, oscillation, titration against the closed forms, smooth lines), `physics-annotations.test.ts` (marks, names, lines, tangent sides, every template).

## Circuit Studio (circuits, part 1)

A fourth Studio laid out like the others (top bar, 280 px left panel, canvas, 300 px right panel). The tile "Draw a circuit" (`tool-circuit-studio.tsx`, Physics and Sciences groups; the older "Circuit" tile puts a library figure) runs `{ kind: "circuit-studio" }`; `Shell.circuitStudio`, `overlay-circuit-studio.tsx` and `ImageBlock.circuitStudio` follow the graph and molecule labs: Insert makes an image block whose `src` is the picture (cropped to what is drawn) and whose `circuitStudio` field carries the `CircuitConfig`; double-click reopens it, Update puts it back. `app/_lib/studioHistory.ts` is a new generic undo/redo (same merging of quick edits as the graph's) used by this Studio.

- `app/_lib/circuit/` is pure: `types.ts` (the directive's model, plus `closed` for a switch), `geometry.ts` (grid 20, terminals, orthogonal paths), `ops.ts` (every edit as a function config -> config), `symbols.ts` (the symbols and where the texts go), `scene.ts` / `svg.ts` (the one scene both the Konva canvas and the page picture draw), `strings.ts`.
- **A component is centred on a grid point, and its two terminals are two cells from the middle** (on the grid too, so wires meet them exactly); the directive's 40 px box with a top-left origin would have rotated about a corner and left the terminals off the grid. Symbols are drawn along the axis and then turned, with exact quarter-turn vectors (no float noise); texts stay upright. Nine components: the directive's seven plus ammeter and voltmeter. The French resistor is a rectangle.
- **A wire is connected to a terminal when one of its ends is on it**: nothing is stored, so a wire dropped on a terminal is connected and a moved or turned component carries the ends on its terminals along (`moveEndpoint`: the neighbouring corner slides along the next segment, so the wire stays orthogonal; a one-segment wire that goes out of line gets a corner, the leg at the moved end keeping its direction). Moving a wire by hand detaches it (and it connects to whatever its ends are on afterwards). `junctionPoints` finds where wires are connected (an end on another wire, or three ends meeting, a terminal counting as one) and the scene draws a dot there.
- **Wire tool:** click to start (snapping to a terminal within 14 px, else to the grid), click at each corner, click a terminal or another wire (or double-click, Enter, Esc) to end. Each leg is an L-shape (`routeNext`): it turns away from the previous segment, the first one leaves a terminal the way the terminal points, Shift takes the other way round; a dashed preview shows what a click would add. The directive's always-horizontal-first is only the default for a free start.
- **Placing:** a component tool stays in hand with a ghost on the grid (a circuit has several); R turns the next one (or the selected one), Esc stops. Arrows move the selection by a cell; Delete removes it; dragging snaps to the grid.
- Not done in this part: moving the corners of a wire, labels placed by hand, copy and paste, masking for the student view.

### Labels, values and terminals (Circuit Studio, part 2)

Most of what the directive describes was already there from part 1 (the inspector, the texts on the canvas, the terminals, the 15 px snap, the terminals shown with the wire tool); this part adds what was missing and some conveniences:

- **Show the value** (`CircuitComponent.showValue`, optional so older circuits keep their values: absent = shown) and **Label position** (`labelSide`: automatic, above, below, left, right). `symbols.ts#labelsOf` places both texts (label first, the value nearest the symbol on top); a component that stands has its sides closer in and its top and bottom beyond the terminals. The texts stay upright whatever the rotation (the directive's rotated group would turn them upside down at 180°); they move with the component and their place follows its turn.
- **Units by button** (`UNITS`, `withUnit`): a keyboard has no Ω or μ, so the Value field has chips for the unit of the component (Ω kΩ MΩ, pF nF μF mF, μH mH H, V, mA A…) that replace the unit and keep the number. **Number the labels** (`ops#numberLabels`): R, R, R become R1, R2, R3 in the order they were put; a kind with one component keeps its letter and a label the teacher wrote is left alone.
- Terminals are drawn red with the wire tool (the one a click would go to is filled and larger); `TERMINAL_REACH` is 15 px.

## Text editing and the Home ribbon

The right panel's **Home → Formatting** (and the ribbon of a selected text box) is a Word-style ribbon: Clipboard, Font, Paragraph and Editing groups that format the selected words, the paragraphs, or the whole selected block. It is built on four layers, bottom to top.

**1. Model (all new fields are optional, so older files draw exactly as before; checked 900/900 against `git HEAD` with random legacy blocks).**
- `richText.ts`: `RunStyle` gains `sub` / `sup` (never both; `patchStyle` removes the other), `ul` (a double, dotted, dashed or wavy underline; written `u=double`, so a reader that does not know the kind still draws an underline) and `fx` (a `shadow`, `outline` or `glow`; written `fx=shadow`). `EFFECT_CSS` is the one source of what an effect looks like in the editors; the canvas draws the same with Konva. Helpers `sliceRich`, `insertRich`, `replaceRich`, `splitParagraphs` / `joinParagraphs`, `mapChars`, `replaceMatches`. Offsets are UTF-16 units, like DOM selections.
- `paragraphFormat.ts` (`ParagraphFormat`: align, indent level, list, direction, line height, space before/after, shading, borders) and `lists.ts` (14 list kinds, `listMarkers` numbers per level, `markerText`). A **text box** keeps these on each paragraph of its Tiptap document (`tiptap-paragraph.ts`, global paragraph attributes + a decoration that draws the markers); a **text block** keeps them in itself (`TextParagraphFormat`: `indent`, `list`, `dir`, `shading`, `border`, `borderColor`); `TextboxBlock.dir` is the default direction of its paragraphs.
- `textboxDoc.ts` converts document ⇄ paragraphs of runs (`docParagraphs`, `docFromParagraphs`, `styleDoc`, `mapDocChars`, `setParagraphs`, `sortDocParagraphs`). `blockText.ts` is the same for a whole block (script, highlight, case, sort, clear) and returns patches.

**2. Layout and canvas.** `blockLayout.layoutText` / `layoutTextbox` handle indent, list markers (a marker is one more `RichLine`, so it is drawn like any text), per-paragraph direction and line height, space before/after, shading and border boxes; `measure.runFont` / `pieceTop` give scripts their size (`SCRIPT_SCALE` 0.7) and raise or drop (`SUP_RISE`, `SUB_DROP`), and carry `underlineStyle` / `effect` into `TextFont`. `ContentViews` draws the boxes, markers and rich lines; `shared.tsx#PieceDraw` draws each piece: Konva's own text decoration for a single underline or a strikethrough, `StyledUnderline` (lines of our own, placed where Konva places its underline) for the other kinds, and `effectProps` (shadow, glow, outline) for the effects.

**3. Editors.**
- Text box: Tiptap, `textboxEditor.ts` (extensions, `selectionFormat`, commands, and every document change written as `(state) => Transaction | null`, so it is tested without a browser: case, clear, sort, paragraph attributes, paste). StarterKit's underline is replaced by `tiptap-effects.ts#StyledUnderline` (same name, keys and commands, plus a `style` attribute) and `TextEffect` is a mark of its own (one at a time). Typing habits: Tab / Shift+Tab, Enter and Backspace in lists, `AutoLists` ("- ", "1. ", "a. "), Shift+F3 (cycle case), Ctrl+Space (clear), Ctrl+, / Ctrl+. (sub/superscript; Word's Ctrl+= is the app's zoom), Ctrl+Shift+> / < (the next usual size, `fontSizes.ts`; by the character the key gives, so it is the same on every keyboard).
- Everything else (paragraph, question, option, cell…): `RichEditable` (contentEditable over the styled string). Its `RichHandle` is **one stable object** (a Proxy made in `useImperativeHandle`, forwarding to the handle of the latest render), so other code can tell which editor it is.
- `richSession.ts` is a small external store (`useSyncExternalStore`): the plain-text editor being typed in, its selection style, `hasSelection`. `InlineEditor` publishes it **from event handlers**. Do not lift it into shell state from a passive effect: that re-rendered the whole `Editor` twice per key and tripped React's "Maximum update depth" after ~25 keys.

**4. The ribbon (`app/_features/inspectors/format/`).**
- `formatTarget.ts`: one `FormatTarget` (character controls, `para: ParagraphTarget` with `can.*` flags for what a block cannot have, `clip`, `capture` / `paint`, `insertText`) and three engines behind it: `tiptapTarget` (text box being typed in), `richTarget` (words selected in a `RichEditable`), `blockTarget` (the whole block). `useFormatTarget` picks one. With only a cursor in a plain-text field the target is the block, but the clipboard and the symbols still act on the text.
- `ribbonUi.tsx`: buttons keep the editor's focus (`onMouseDown preventDefault`), `MenuButton` / `Popover` (drawn in a portal, flips over the button, follows its content's size, Esc closes only the popover); everything is marked `data-text-format`, so clicking in it does not end the typing (`InlineEditor` / `TextboxEditor` check it).
- Groups: `ClipboardGroup`, `FontGroup` (family, size, B / I / U▾ / S, sub / sup, case, clear, highlight, color, text effects), `ParagraphGroup`, `EditingGroup`, assembled by `TextRibbon`; `FormattingInspector` and `TextboxInspector` are built on it. `FormatControls.tsx` only keeps the vertical alignment of a text box.
- **Clipboard** (`clipboardHtml.ts`, `richClipboard.ts`, `blockClipboard.ts`, `useBlockClipboard.ts`): the app copies HTML with the paragraphs themselves in a `data-examor-clip` attribute (so a copy inside the app is lossless even through the async Clipboard API, which hides custom types); other programs' HTML (Word lists with `mso-list`, Google Docs' `font-weight:normal` wrapper, tables, entities) is read by a small tokenizer with no DOM. By default it keeps emphasis and lists and takes the exam's font, size and colors (Merge formatting); Paste ▾ offers Keep source formatting / Merge / Keep text only. With a block selected and no text being typed, Ctrl+C / X / V and the buttons copy the block (kept in the app and in `localStorage`, the system clipboard carries its text and id); other text is pasted as a new paragraph block. The page-level listeners run in the **capture phase**: ProseMirror re-renders the target while it handles a paste, which makes `isContentEditable` false by the time the event bubbles.
- **Format painter** (`painter.ts`): its listeners belong to the store, not to a ribbon; the ribbon only reports its latest target. Paragraph formatting comes along when copied from a cursor or a block, like Word.
- **Find and replace** (`findReplace.ts` pure, `FindReplaceInspector`): every text field of every block (`textFields`, no layout), match case / whole words, results grouped by block, one undo step for Replace all (`useExam.updateBlocks`); Ctrl+F / Ctrl+H. **Symbols** (`symbols.ts`, `SymbolPicker`): groups, recently used (browser storage), inserted through `FormatTarget.insertText`. **Show formatting marks** (`formattingMarks.ts`): a view setting, ¶ and ↵ drawn by CSS in the text box editor only.
- Strings: `app/_lib/ribbon/strings.ts` (FR/AR, merged at the end of `uiStrings.ts`); `format/__tests__/strings.test.ts` checks every `t("…")`, every `label: "…"` and the symbol group names.

**Tests.** `_lib/__tests__`: `rich-text`, `lists`, `text-layout`, `textbox-editor`, `block-text`, `clipboard`, `find-replace`. The browser flows (formatting words and blocks in both editors, clipboard and paste modes, painter, find and replace, symbols, typing habits, Arabic and French) were driven with puppeteer against `next dev` and read back from the autosave in `localStorage["examBuilder.doc"]`; those scripts are not committed. Hints for writing more: pace keystrokes in a text box (ProseMirror reads the DOM selection asynchronously), scope selectors to `[data-text-format]` (the floating `FormatBar` has the same buttons), and know that one Escape ends the typing, a second deselects the block, and an open popover takes the first.

**Not done.** A left-to-right / right-to-left per *word* (direction is per paragraph); small caps and an underline color; the effects other than shadow, outline and glow of Word's "Text effects" (reflection, 3-D, ligatures).

## Shapes (Insert → Shapes, and every Studio)

A PowerPoint-style gallery of 131 shapes (Lines, Rectangles, Basic shapes, Block arrows, Equation shapes, Flowchart, Stars and banners, Callouts, and a "Recently used" row) that can be drawn on the page and in the Circuit, Graph and drawing (molecule) Studios.

- **Pure model (`app/_lib/shapes/`, no React, unit-tested in `_lib/__tests__/shapes.test.ts`).** `types.ts`: `ShapeStyle` (the shape key, fill, outline, dash, the values of the yellow handles `adj`, flips, text and its look; every field optional) and `ShapeItem` (`ShapeStyle` + `id`, the box `x y w h`, `rotation`). `catalog/` has one file per category; each `ShapeDef` is `parts(w, h, adj, strokeWidth)` → a list of `{ d, paint }` (SVG path data; `paint` is `fill`, `light`/`dark` for the faces of a cube, `line` for an inner edge, `solid` for an arrow head), an optional `adjust` (where the yellow handles are and what dragging one sets: `catalog/adjust.ts`), `line` (a line runs from one corner of the box to the opposite one; flips make the other diagonals, so a line is two points), `textInset` and the usual `size`. `geometry.ts` resolves a style (default: no fill, a dark 2 px outline), gives the painted parts, dashes, the room for text, `localToWorld`/`worldToLocal` (flip, then turn round the centre), the handles and how far the drawing reaches (`shapeBounds`: a callout's pointer goes out of its box). `items.ts` has the list operations (add, update — same list back when nothing changes —, remove, reorder, duplicate), `boxFromDrag` (Shift = square / 45° line, Alt = from the centre, a click = the usual size) and `moveLineEnd`. `text.ts` breaks the text of a shape into lines (`layoutShapeText`, measured and drawn in the shape's `fontFamily`, Arial when it has none: `Measure` takes the family); `svg.ts` writes the SVG. Konva and the SVG read the same parts, colors and text lines, so the Studio's canvas and the picture on the page cannot differ. An unknown shape key (a file from a later version) is drawn as a rectangle.
- **Konva (`app/_components/shapes/`).** `ShapeGraphic` draws one shape in its own box. `StudioShapes` is the layer a Studio puts in its Konva layer: the shapes, the Transformer (resize and turn; Konva flips become `flipX/flipY`), a handle at each end of a line, and the yellow handles; edits go out as `onChange(id, patch, key)` (`key` names what changed so the Studio's history can merge a drag into one step) and `onGrab/onRelease` (the molecule Studio's undo works by gestures). `ShapeDrawSurface` is the transparent sheet of the Shapes tool (drag to draw, with a live preview). `ShapeGallery` (+ `ShapesMenuButton`, a popover for the Studios' toolbars, + `recentShapes.ts`, an external store in localStorage), `ShapeProperties` (fill, outline, line style, text, flips, order, position and size). One of each is used everywhere.
- **Studios.** The shapes are an optional `shapes?: ShapeItem[]` of each Studio's own document (`CircuitConfig`, `GraphConfig`, `MoleculeGraph`), so old documents are unchanged. Each Studio's state hook has the same few functions (`pickShape`, `selectShape`, `drawShape`, `changeShape`, `orderShape`, `duplicateShapeOf`, `nudgeShape`) and selects a shape like any of its other things (the Circuit and Graph selections gained a `"shape"` kind; the molecule hook keeps `shapeId` beside `picked` and clears one when the other is set; its `changeShape` merges edits with the same key within `COALESCE_MS`). The picture on the page draws them last (`shapesSvg` in `circuit/svg.ts`, `graph/svg.ts`, `chemistry/svg.ts`) and the crop includes them (`circuit/scene.ts#contentBounds`, `chemistry/geometry.ts#drawingBounds`, the Graph picture grows past its margin only when a shape goes out). The Shapes tool is `tool: "shape"` in the Circuit and drawing Studios and `shapeTool` in the Graph Studio; one shape is drawn and the Select tool comes back, like PowerPoint.
- **Page.** A new block type `shape` (`ShapeBlock extends BlockBase, ShapeStyle`): its box is the block's layout, so it moves, snaps, copies, duplicates and exports like any block; a line's height can be 0. Insert → Shapes (`inspector.insert.shapes`) opens the gallery in the right panel; choosing a shape sets `Shell.shapeToDraw` and `canvasTool: "shape"` (`Shell.drawShape`), and the page's draw tool (the text box's, `ExamCanvas.drawBox`) draws it (`drawShape: "box" | "line"` lets a click make a default-size shape and a line be level; `DrawnBox.flipX/flipY` for a line dragged leftwards or upwards). The drawn block is selected and `inspector.shape` (`blockInspectors`, `edits: ["shape"]`) opens by itself. `canvas/blocks/ShapeView.tsx` draws it; `blockHeight` is the layout's.
- **Strings.** `_lib/shapes/strings.ts` (FR + AR, merged in `uiStrings.ts`). The key of a shape is its English name; words the app already translates with another meaning got keys of their own ("Shape outline", "Bold text", "Cross shape"). `shapes.test.ts` checks every shape and category has both translations; the Studios' string tests know this table.
- **Verified.** 987 unit tests, eslint and tsc clean, and headless-Edge flows: the gallery (8 categories, recent row), drawing by drag and by click, Shift-level lines, flipped lines, fill/outline/dash/text, undo, Preview; in each Studio: gallery → draw → style → move → more shapes → undo/redo → Insert (the picture carries the shapes, text and fill) → reopen with the shapes back.
- **Not done.** Typing the text of a shape directly on the canvas (it is typed in the properties panel), freeform and scribble lines, the curved and circular block arrows, grouping, snapping to other objects, and rotating a shape on the page (the page has flips and its own handles; the Studios rotate).

## Table Studio (spreadsheet tables, and the table panel)

Insert → **Table Studio** opens a full-screen spreadsheet that makes an ordinary `table` block; the plain **Table** tile and every table already in a document are the same block, and the right panel edits all of them with the same grid. Nothing is a picture: a table made in the Studio is changed later from Properties, with the same tools.

- **Model.** `TableBlock extends BlockBase, TableExtras` (`_lib/types.ts`, `_lib/table/model.ts`). `cells: string[][]` is the text as typed (a formula as a formula; styled words keep their `⁅…⁆` markers); everything else is optional: `calc` (a cell starting with `=` is a formula), `merges` (`{r, c, rs, cs}`, the top-left cell holds the text), `cellStyles` (by `"r,c"`: bold, italic, size, color, fill, align, valign, number format `fmt`, and the edges `bT bR bB bL`), `borders` (grid, box, rows, columns, none), `borderColor`, `banded`, `headerFill`, `headerColor`, `firstCol`, `flip` (the columns in the other order, A B C D… becomes …D C B A; the text keeps the exam's direction: `tableMirrored(table, examRtl)`, `TableLayout.mirror`, the grid's `dir`, the page's column handles all follow it), `shapes`. A table with none of them is **plain** (`isPlainTable`) and is laid out and drawn by the code that always drew tables; only an extended one takes the new path. Every edge of the grid belongs to one cell (the one left of or above it; the first column and row own their outer edges), so a style change never has two owners to agree. The Borders menu works on the selection as a whole (its outline: Top draws the line above its first row) or, with "Each cell separately", on every selected cell alone (the top of every cell, a box round each); a side that is drawn is taken off by the same button, so one line of one cell can go (`ops.ts#setBorders(.., { each, show })`, `isBorderOn`).
- **Pure module `app/_lib/table/` (no React, `__tests__/table.test.ts`, `table-layout.test.ts`).** `refs.ts` (A1 names, ranges, limits 40 × 16), `format.ts` (read `12,5`, `1 200`, `50 %`; write with decimals, %, unit, thousands, decimal comma), `formula.ts` (tokenizer, parser, evaluator: `+ - * / ^ & %`, comparisons, ~30 functions with French names, `;` or `,` between arguments, `2,5` is 2.5 when a `;` is used, `-2^2` is −4, errors are values, circles are `#CIRC!`; `shiftFormula` for copies and `adjustFormula` for inserted or deleted rows and columns), `ops.ts` (resize, set, clear, paste, insert/delete rows and columns, merge/unmerge, styles, borders, sort, fill series; each returns a patch or null), `display.ts` (what a cell shows; the page and the grid both read it), `model.ts#cellLook` (header, banding and first column put together with the cell's own look: the page and the grid both read it), `clipboard.ts` (tab-separated text in and out), `strings.ts` (FR + AR).
- **Page.** `blockLayout.layoutTable` returns `cellBoxes` (a merged cell once) for every table; a plain one is laid out as before (one box per cell), an extended one by `layoutTableExt` (merged widths, rows that grow for merged text, per-cell fonts and fills, the lines to draw). `TableView` draws an extended table as fills, text and one stroke for all the lines; `editRegions` types in the cell boxes, so double-click edits the raw text (a formula as a formula) of a merged cell where it is drawn.
- **UI (`app/_components/table/`).** `TableGrid` is the spreadsheet: column letters and row numbers (click to select, drag the lines to size), a formula bar, selection with mouse and arrows, typing starts a cell (Enter or F2 edits, Tab/Enter move on, Escape cancels), `RichEditable` in the cell so subscripts and colors work, copy and paste (inside the app the cells keep their formulas, shifted, and looks; from Excel the tab-separated text is read), a fill handle that continues a series, a click on a cell while a formula ends with an operator writes its name, a right-click menu, `data-table-grid` (the Editor and the block clipboard leave its keys alone, except undo and redo in the panel). `TableFormatBar` (bold, italic, size, colors, alignment, borders, merge, number format, rows and columns, sort) uses the ribbon's primitives, which never take the focus from the grid. `tableActions.ts` turns the buttons into patches. `TableSettings` (size, header, first column, banding, lines, formulas) and `TablePanel` (the right panel: a button back to the Studio, format bar, compact grid, settings; each change is one block update, so the exam's undo works) are shared by the Studio and the panel. **No cell selected is a state** (`Sel | null`): the grid shows no active cell, merging, rows, columns, sorting and clearing are off, and **all the formatting** (the font, bold, italic, size, colors, alignment, lines, number format) goes to the whole table (`makeActions`: `target` is the selection or the whole table, `common(key)` is what the buttons show: the look every target cell shares); with all the table selected it is the same. With some cells selected a font goes to each cell (`cellStyles[...].font`); choosing it for the whole table sets `font.family` of the block and takes every cell's own font off (`tableActions.ts#setFont`). Escape lets go of the selection. The bar keeps the grid's focus by cancelling `mousedown` on its buttons, **except on `input`, `select`, `textarea` and `label`**: cancelling the press on the font `<select>` stops its list from opening with a real click; after a font is chosen the bar gives the focus back to the grid (`backToGrid`).
- **Studio (`app/_components/table-studio/`, `overlay-table-studio.tsx`, `tool-table-studio.tsx`).** `useTableStudio` keeps the table and its width in `studioHistory` (keys merge typing and drags into one step); the preview (at the top of the right side) is the page's own `TableView`; Insert puts a table block on the page (one step of the exam's undo). The Properties panel of a table has **Open in Table Studio**: the Studio opens on that block (`Shell.openTableStudio(blockId, shape?)`, `tablePreset.ts` copies the block in and `tablePatch` puts it back), and Insert becomes Update. `ToolAction { kind: "table-studio" }`, `Shell.tableStudio { open, blockId, shape }`.
- **Shapes over a table.** `TableExtras.shapes` (`ShapeItem`s in px of the table's own box). The Shapes button (right of Sort Z to A, in the Studio's bar and in the panel's) opens the shared gallery; in the Studio the main area then becomes the table as the page draws it (`TableShapesCanvas`: the page's `TableView` without its shapes, `StudioShapes` and `ShapeDrawSurface` over it, "Back to the cells" returns) and the right side shows the shape's properties; in the panel the button opens the Studio on the shapes with that shape ready to draw. `TableView` draws the shapes after the table, and `blockLayout.tableHeight` makes the block as high as the lowest shape.
- **Verified.** 1059 unit tests; tsc and eslint clean; headless-Edge flows: typing and Tab/Enter, a starting table with formulas recalculating, formula bar, Shift-click range, bold, merge, fill handle series, paste of tab-separated text (the table grows), undo/redo, right-click delete row, preview, Insert, then in the right panel typing, Ctrl+Z, italic, border style; a plain table grown into a spreadsheet from the panel; Preview; an Arabic exam (columns right to left in the grid).
- **Not done.** Student-fill cells (blank for students, answer in the correction), "plot this table" in the Graph Studio, selecting a cell by clicking it on the page (the panel's grid selects), formulas across tables, conditional formatting, per-cell borders in other colors.

## Math keyboard (floating, subject-aware)

The keyboard that types into the equation field (Properties → Equation) is `overlay.math-keyboard` plus a top-bar toggle. It replaces the old `MathKeyboard` and `_lib/mathKeys.ts`.

- **Layouts (`app/_lib/keyboard/`)** are pure data, no React. `keys.ts` (`KeyButton { latex, title, label?, wide? }`, `KeyboardTab { id, label, buttons }`, `keyLabel`), `sharedTabs.ts` (Basics, Greek letters), `mathLayout.ts` (`mathTabs`: Basics, Trigonometry, Functions & limits, Sets & logic, Geometry, Greek letters, Ready formulas), `physicsLayout.ts` (`physicsTabs`: Basics, Vectors, Greek letters, Units, Constants, Mechanics, Electricity, Waves & atoms, Chemistry) and `layouts.ts` (`keyboardTabsFor(subject)`: Physics gets `physicsTabs`, every other subject gets `mathTabs`). A layout for another subject is one file and one line in `layouts.ts`. Physics keeps the Basics tab (a physics paper still needs fractions and roots), and the reaction-arrow, equilibrium and ion keys moved to its Chemistry tab. Tab names are English keys translated through `t()`, like every label; key tooltips go through `t()` too and fall back to English until they are translated.
- **The cursor is placed by placeholders, not by a `cursorOffset`.** A key's `latex` uses MathLive's `#?` (a box to fill), `#0` (the selection) and `#@` (the thing before the cursor), and the keyboard inserts with `selectionMode: "placeholder"`, so the cursor ends in the first box (the numerator of a fraction, the inside of a root). Moving back N characters with `executeCommand('moveBackward')` was rejected: that command does not exist in MathLive 0.111, and MathLive moves by its own atoms, not by characters of the LaTeX.
- **The active field.** `activeMathfield.ts` is still the bridge between the equation field in the right panel and the keyboard on the canvas. It gained `subscribeActiveMathfield` / `hasActiveMathfield` (for `useSyncExternalStore`), so the keyboard can say that no field is open (the Properties panel shows another tab) instead of ignoring the clicks. This is the one place a component reads a module store instead of `Ctx`; the features only read `ctx.shell`.
- **When it shows** (`_components/math-keyboard/keyboardState.ts`): while an equation is selected and the teacher has not closed it (`shell.mathKeyboard`, remembered in the browser). Three controls flip that choice through the same `toggleKeyboard`: the × on the keyboard, the button on the canvas (`KeyboardLauncher`, above the tool bar and the zoom bar) and the keyboard button in the top bar (`toggle.math-keyboard`, in `panelsGroup`; the top bar has no View menu, this is where the panels are shown and hidden). With no equation selected they say what is needed (a toast). The keyboard and its button are z-40, under the full-screen dialogs (z-50), so the onboarding window covers them.
- **Moving it.** The grip at the start of the tab row drags it, kept inside the window and under the top bar; a double-click puts it back. The place is kept while the app runs, not in the file. It slides up with `.keyboard-rise` (it moves with `translate`, so it does not fight the `transform` of the drag; off under `prefers-reduced-motion`). The tabs wrap onto a second row instead of scrolling, because a tab scrolled out of sight is not found.
- **Tests.** `_lib/__tests__/keyboard-layouts.test.ts` checks the layouts (unique ids, no repeated key, subject → layout) and that **every key's LaTeX is valid in MathLive** (`mathlive/ssr`, no `ML__error`) and **is drawn by MathJax without a red unknown command**, so a typo in a layout fails the test run. The browser flow (open from the canvas and from the top bar, insert, cursor in the numerator, Physics tabs, drag and clamp, the field-closed hint, French and Arabic) was run against `next dev`.
