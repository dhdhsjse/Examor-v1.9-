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

**Known gaps**

- `Editor.tsx` still owns all state and actions. It contains no feature JSX, but it is larger than a thin shell.
- The canvas tool rail (`workspace/ToolRail.tsx`), `ZoomBar`, `PageStrip`, and `AnswerBar` are still rendered inside `Workspace.tsx`. They are not yet features.
- The `Inspector`, `LibraryPanel`, `ExportPreview`, `VersionHistory`, `TemplatePicker`, `MathKeyboard`, and `ExportRenderer` components are unchanged. Features wrap them.
- The "No tools found" message from the old toolbox was not carried over.
- Visual parity with the pre-refactor app is not verified. The build, type-check and lint pass; no screenshot comparison has been done.

---

**End of directive.**
