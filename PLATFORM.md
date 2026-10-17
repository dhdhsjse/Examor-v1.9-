# Exam Builder: platform structure

Exam Builder (product name "Examor") is a visual editor for making printable A4 exam papers. It runs in two ways:

- **In a browser** through Next.js (`npm run dev`, then http://localhost:3000).
- **As a desktop app** through Tauri 2, which wraps the same web front end in a native window.

Everything runs on the client. There is no server-side API, database or login. Work is saved in the browser's `localStorage`, and files are exported as PDF or as exam files.

## Technology stack

| Layer | Technology | Role |
|---|---|---|
| UI framework | Next.js 16 (App Router), React 19 | Routing and rendering |
| Canvas | Konva / react-konva | Draws the A4 pages and blocks |
| Math | MathLive (input), MathJax (rendering) | Equations and the math keyboard |
| PDF export | jsPDF | Builds PDF files from rendered pages |
| Styling | Tailwind CSS 4 | Styles |
| Desktop shell | Tauri 2 (Rust, `src-tauri/`) | Native window, file dialogs, file system access |
| Language | TypeScript | Whole front end |

## Repository layout

```
.
├── app/                     Next.js App Router (front end)
│   ├── layout.tsx           Root HTML shell (lang="fr", full-height body)
│   ├── page.tsx             Home route; renders <ClientApp />
│   ├── globals.css          Global styles
│   ├── _components/         UI components (see below)
│   └── _lib/                Logic, data model, helpers (see below)
├── public/mathlive/fonts/   KaTeX font files for equation rendering
├── src-tauri/               Tauri desktop shell (Rust)
│   ├── src/lib.rs           Builder: fs + dialog plugins, debug-only log plugin
│   ├── src/main.rs          Binary entry point
│   ├── tauri.conf.json      Window (1400x900, maximized, no native frame), dev/build commands, icons
│   ├── capabilities/        Tauri permission grants
│   └── icons/               App icons for each platform
├── package.json             Scripts: dev, build, start, lint, tauri
├── next.config.ts           Next.js configuration
├── eslint.config.mjs        Lint rules
├── tsconfig.json            TypeScript configuration (path alias "@/")
└── AGENTS.md                Notes for AI coding agents (Next.js version rules)
```

## Startup flow

1. `app/layout.tsx` renders the HTML shell.
2. `app/page.tsx` renders `ClientApp`.
3. `ClientApp` loads `Editor` with `dynamic(..., { ssr: false })`. The editor needs the browser (canvas, `localStorage`, files), so it is never pre-rendered on the server.
4. `Editor` reloads the last autosaved exam. If there is none, it opens the template picker.

## Main screen layout

The `Editor` component (`app/_components/Editor.tsx`) is the main screen. It has five regions:

| Region | Component | Purpose |
|---|---|---|
| Top bar | `bar-top.ts` | First row of the window (no native title bar): file menu (incl. app language), exam name, subject, export, window buttons |
| Left panel | `LeftPanel.tsx`, `ToolTile.tsx`, `toolGroups.tsx` | Toolbox: add questions, text, equations, images, tables, graphs, headers |
| Center | `workspace/` | A4 pages with zoom, page strip and answer bar |
| Right panel | `RightPanel.tsx` | Properties (inspector) and the library |
| Overlays | `TemplatePicker`, `ExportPreview`, `VersionHistory`, `MathKeyboard` | Modal or floating tools |

The layout is mirrored right to left when the UI language is Arabic.

## Components (`app/_components/`)

- **`workspace/`**: the editing surface.
  - `Workspace.tsx` lays out the pages and handles selection and drag.
  - `InlineEditor.tsx` edits text directly on the page.
  - `PageStrip.tsx` shows page thumbnails.
  - `ToolRail.tsx` is the canvas tool selector.
  - `ZoomBar.tsx` controls zoom.
  - `AnswerBar.tsx` toggles the answer key view.
- **`canvas/`**: drawing of blocks on the Konva stage.
  - `ExamCanvas.tsx` is the Konva stage for the pages.
  - `BlockNode.tsx` renders one block and its interaction.
  - `ExportRenderer.tsx` draws pages off-screen for export.
  - `blocks/` has one view per block family: `QuestionViews`, `ContentViews`, `GraphView`, `HeaderView`, `TableHandles`, and `shared`.
- **`inspector/`**: the properties panel for the selected block.
  - `Inspector.tsx` picks the editor for the selected block.
  - `QuestionEditors.tsx`, `ContentEditors.tsx`, and `ContentEditorSwitch.tsx` hold per-type editors.
  - `EquationEditor.tsx` and `GraphEditor.tsx` are specialized editors.
  - `fields.tsx` holds shared form fields.
- **`library/`**: `LibraryPanel.tsx`, the built-in and user-made assets (images, shapes).
- **`templates/`**: `TemplatePicker.tsx`, the starting templates.
- **`export/`**: `ExportPreview.tsx`, the preview before export.
- **`history/`**: `VersionHistory.tsx`, the saved versions.
- **`math/`**: `MathKeyboard.tsx`, the on-screen math keyboard.
- **Shared UI**: `icons.tsx`, `ToolTile.tsx`, `toolGroups.tsx`.

## Logic and data (`app/_lib/`)

| Module | Responsibility |
|---|---|
| `types.ts` | The data model: `ExamDoc`, `Page`, `Block` and its subtypes |
| `useExam.ts` | Central state hook. Holds the document, selection and active page; undo/redo (`commit`) and autosave |
| `blocks.ts` | Creating blocks, measuring heights, pushing overlapping blocks down, numbering questions |
| `blockLayout.ts` | Height calculation for each block |
| `tools.ts` | Maps toolbox actions to blocks (`assetToBlock`, `ToolAction`) |
| `templates.ts`, `templateExamples.ts` | Empty starting layouts and complete example exams (see below) |
| `a4.ts` | A4 page constants: 794 x 1123 px, 48 px margin |
| `storage.ts` | `localStorage` autosave and user library; file save/open (Tauri dialog or browser download) |
| `versions.ts` | Version snapshots for the history |
| `pdf.ts` | PDF generation with jsPDF |
| `images.ts` | Image import and preloading |
| `library.ts` | Built-in library items (figures, tables, ready blocks) and SVG URLs |
| `figures/` | Library figures drawn from settings (triangle, solids, circuit, lens, cell…), one file each; `index.ts` is the list |
| `shuffle.ts` | Repeatable mixed-up orders (matching, ordering, word boxes) |
| `math.ts`, `mathKeys.ts`, `activeMathfield.ts` | Equation rendering and the active math input |
| `editRegions.ts` | Editable text regions on the page |
| `graphMath.ts` | Graph calculations |
| `snapping.ts`, `measure.ts`, `pageStack.ts`, `useZoom.ts` | Snapping, text measurement, page stacking, zoom |
| `subjects.ts` | Subjects and school cycles |
| `i18n.ts`, `uiLang.tsx`, `uiStrings.ts` | Interface translations (English, French, Arabic) |
| `fontCheck.ts` | Checks that required fonts are loaded |
| `id.ts` | ID generation |

## Data model

The whole exam is one `ExamDoc` (version 1). It is autosaved to `localStorage` under the key `examBuilder.doc`. It contains pages, blocks and metadata.

Blocks are split into two families.

**Questions** carry points and an answer:

- `mcq`: multiple choice, with `options` and a `correct` index. `multi` + `corrects` allow several correct answers (square boxes); `columns` puts 1–4 options per row.
- `truefalse`: a list of statements, each with a true/false answer. `justify` adds a line under each statement to correct the false ones (`fix` is the correction printed on the key).
- `blank`: fill in the blank. Answers go in `[brackets]` inside `content`. `wordBank` prints the answers (plus `distractors`) mixed up in a box.
- `open`: open question, with `lines`, a model `answer`, and optional `parts` (1a, 1b, ...). `context` is a statement printed under the question; `answerStyle` is dotted, lines, grid, box or none.
- `match`: two columns to link. `pairs` holds the matches; `order` is the printed (mixed-up) order of the right column. The key draws the links.
- `order`: items to put back in order (`items` = right order, `order` = printed order). `style` "list" (a box for each rank) or "sentence" (mixed-up words, a line to write the sentence).
- `classify`: words to sort into `groups` (2–4 categories), printed in a box (unless `hideBank`) above a table the key fills in.

**Content** blocks have no answer:

- `text`
- `equation`
- `image` (with `figure`: a library figure redrawn from its settings in Properties)
- `table`
- `graph`
- `header` (11 styles; `accent` recolors the colored ones; `fields.authority` is the ministry line of the official style)

Every block has an `id` and a `layout` (page ID, `x`, `y`, `width`, `height`, in page pixels). Questions are numbered automatically from their order.

## Templates

Starting templates (`templates.ts`), shown in two tabs of the template picker:

- Empty layouts: `classic-fr`, `official-fr`, `modern-fr`, `split-fr`, `minimal-fr`, `compact-fr`, `primary-fr`, `qcm-fr`, `blank-fr` (French); `classic-ar`, `official-ar`, `devoir-ar` (Arabic, right to left).
- Ready examples (`templateExamples.ts`): complete exams with real questions and figures — geometry, primary-school French, SVT, physics (French), Arabic language and Arabic math. Long examples continue on new pages.

The setup wizard (page layout) also offers every header style and several footers (`onboarding/headerFooterLibrary.ts`).

## Library

The library (right panel) holds figures, tables, imported images and saved blocks:

- Figures (`figures/`) are drawn from settings. Added to the page they stay editable: the triangle's three angles (always 180° in total), corner names and side lengths; the solids' size and hidden edges; the circuit's lamps, switch and meters; the lens's focal length and object; and so on.
- "My blocks": any block can be kept with the bookmark button in Properties and reused in other exams.

## Desktop shell (Tauri)

- `src-tauri/src/lib.rs` registers two plugins: `tauri-plugin-fs` for reading and writing files, and `tauri-plugin-dialog` for the "Save as" and "Open" windows. A log plugin is enabled in debug builds only.
- `storage.ts` checks for `__TAURI_INTERNALS__`. When it is present, file actions use the native dialogs; otherwise they use the browser's download and file input.
- The dev build points at `http://localhost:3000` (`devUrl`), so `npm run dev` must run before the desktop window can show the app. The production build reads static output from `../out`.
- Build commands: `npm run tauri dev` for the desktop app in development, `npm run tauri build` for an installer.

## Data flow summary

```
User action (toolbox, canvas, inspector, keyboard)
  -> useExam.commit(update)           pushes an undo step, merges typing edits
  -> ExamDoc updated
  -> autosave to localStorage         (examBuilder.doc)
  -> canvas and inspector re-render
Export
  -> ExportRenderer draws pages  -> pdf.ts (jsPDF)  -> storage.saveFile
```

## Scripts

| Command | Effect |
|---|---|
| `npm run dev` | Next.js dev server on http://localhost:3000 |
| `npm run build` | Production build |
| `npm run start` | Serves the production build |
| `npm run lint` | ESLint |
| `npm run tauri` | Tauri CLI (`dev`, `build`) |
