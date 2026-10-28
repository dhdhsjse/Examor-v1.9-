import type { ReactNode } from 'react';
import type { Editor as TextEditor } from '@tiptap/core';
import type Konva from 'konva';
import type { Block, BlockType, ExamDoc, ExamMeta, HeaderFooterConfig, PageFormat, PageMargins, ViewMode } from '@/app/_lib/types';
import type { ChromeKind } from '@/app/_lib/pageChrome';
import type { BlockPreset } from '@/app/_lib/blocks';
import type { ToolAction } from '@/app/_lib/tools';
import type { Subject } from '@/app/_lib/subjects';
import type { T, UiLang } from '@/app/_lib/uiLang';
import type { BlockPatch, SaveState } from '@/app/_lib/useExam';
import type { ClipSource } from '@/app/_lib/richClipboard';
import type { Asset, AssetKind } from '@/app/_lib/library';
import type { Template } from '@/app/_lib/templates';
import type { Version } from '@/app/_lib/versions';
import type { Tone } from '@/app/_components/ToolTile';
import type { CanvasTool } from '@/app/_components/workspace/ToolRail';

export type RightTab = 'properties' | 'library';

// Everything the shell (app/_components/Editor.tsx) offers to features. Rebuilt on every render.
// Features call these; they never read state directly.
export type Shell = {
  // document
  title: string;
  setTitle: (title: string) => void;
  setMeta: (patch: Partial<ExamMeta>, key?: string) => void;
  selected: Block | undefined;
  numbers: Map<string, number>;
  stats: { questions: number; points: number; pages: number };
  saveState: SaveState;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  busy: boolean;
  runTool: (action: ToolAction) => void;
  // What a mouse drag on the page does (the tools of the bar under the page). "textbox" draws a text box
  // (Insert → Text box); Escape, the select arrow or drawing one goes back to "select".
  canvasTool: CanvasTool;
  setCanvasTool: (tool: CanvasTool) => void;
  // Insert → Shapes: the shape the next drag on the page draws (null when none was chosen), and the call that chooses one and puts the
  // Shapes tool in hand (`canvasTool` "shape").
  shapeToDraw: string | null;
  drawShape: (shape: string) => void;
  // The rich-text editor of the text box being typed in on the page (null otherwise): the right panel
  // formats the selected words through it.
  textEditor: TextEditor | null;
  updateBlock: (id: string, patch: BlockPatch, field: string) => void;
  updateBlocks: (changes: { id: string; patch: BlockPatch }[]) => void; // several blocks, one undo step
  // Select a block and show its page, without changing the panel on the right (Find and replace goes through the blocks).
  selectBlock: (id: string) => void;
  // The clipboard of whole blocks, for when no text is being typed in (Ctrl+C / X / V on the page, Home → Clipboard): the
  // selected block is copied (or cut); `pasteClip` pastes a block that was copied, else the text as a new paragraph (null: the clipboard
  // could not be read, so the block copied in the app is pasted).
  copyBlock: (cut: boolean) => void;
  pasteClip: (clip: ClipSource | null) => void;
  notify: (message: string) => void; // a message for a moment, at the bottom of the screen
  onLatex: (block: Block, latex: string) => void;
  deleteBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  // Page layout → Margins. While its panel is open (`marginEdit` not null) the canvas draws the margins
  // being edited on every page, shades the area outside them and shows handles to drag them.
  marginEdit: MarginEdit | null;
  openMarginEdit: (open: boolean) => void; // closing saves an unsaved draft
  draftMargins: (margins: PageMargins | null) => void; // unsaved change (null = drop it), saved after a short pause
  setMargins: (margins: PageMargins) => void; // save now, on every page (one undo step); blocks stay where they are
  // Page layout → Page format: paper size and orientation of ONE page. Changes with the same `key` are one
  // undo step (typing a custom size). Blocks stay where they are, even outside a page that got smaller.
  setPageFormat: (pageId: string, format: PageFormat, key?: string) => void;
  // Page layout → Header and footer: the document's (no `pageId`) or one page's own (`config` undefined =
  // back to the document's). The header/footer blocks of the pages it changes are rebuilt (pageChrome.ts).
  setChrome: (kind: ChromeKind, config: HeaderFooterConfig | undefined, pageId?: string, key?: string) => void;
  resetPageChrome: (pageId: string) => void; // the page shows the document's header and footer again
  adoptHeader: (blockId: string) => void; // an exam header block that is not a page header becomes its page's header
  // files
  newExam: () => void;
  // Replace the exam with a ready document (onboarding). `keepOld` saves the current one in the history first.
  applyDoc: (doc: ExamDoc, keepOld: boolean) => void;
  openExam: () => void;
  saveExam: () => void;
  showHistory: () => void;
  showPreview: () => void;
  // view
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;
  subject: Subject;
  setSubject: (subject: Subject) => void;
  uiLang: UiLang;
  setUiLang: (lang: UiLang) => void;
  query: string;
  setQuery: (query: string) => void;
  rightTab: RightTab;
  setRightTab: (tab: RightTab) => void;
  library: { kind: AssetKind | 'all'; n: number };
  userAssets: Asset[];
  importImage: (addToPage: boolean) => void;
  deleteUserAsset: (id: string) => void;
  replaceImage: (id: string) => void;
  mathKeyboard: boolean;
  toggleMathKeyboard: (open?: boolean) => void;
  // overlays
  picker: { open: boolean; mustPick: boolean };
  openPicker: () => void;
  closePicker: () => void;
  pickTemplate: (template: Template) => void;
  preview: boolean;
  closePreview: () => void;
  exportPdf: (which: ViewMode | 'both') => void;
  renderPages: (mode: ViewMode, pixelRatio: number, quality: number) => Promise<string[]>;
  history: boolean;
  closeHistory: () => void;
  // Molecule Studio: `blockId` = the molecule block being edited, null = a new molecule.
  molecule: { open: boolean; blockId: string | null };
  openMolecule: (blockId?: string) => void;
  closeMolecule: () => void;
  // The drawing Studio (molecule-studio/): `blockId` = the drawing block being edited, null = a new drawing.
  moleculeLab: { open: boolean; blockId: string | null };
  openMoleculeLab: (blockId?: string) => void;
  closeMoleculeLab: () => void;
  // The Graph Studio (graph-studio/): `blockId` = the graph block being edited, null = a new graph.
  graphStudio: { open: boolean; blockId: string | null };
  openGraphStudio: (blockId?: string) => void;
  closeGraphStudio: () => void;
  // The Table Studio (table-studio/): a spreadsheet that puts a table block on the page. `blockId` = the table block being edited, null = a
  // new table; `shape` = the Studio opens on the shapes with this one ready to draw.
  tableStudio: { open: boolean; blockId: string | null; shape?: string };
  openTableStudio: (blockId?: string, shape?: string) => void;
  closeTableStudio: () => void;
  // The Circuit Studio (circuit-studio/): `blockId` = the circuit block being edited, null = a new circuit.
  circuitStudio: { open: boolean; blockId: string | null };
  openCircuitStudio: (blockId?: string) => void;
  closeCircuitStudio: () => void;
  restore: (version: Version) => void;
  exportJob: { doc: ExamDoc; mode: ViewMode; resolve: (stage: Konva.Stage) => void } | null;
  toast: string | null;
  // side bars the user has closed (ids of bars with `collapse`), remembered in the browser
  hiddenBars: string[];
  toggleBar: (id: string) => void;
  showBar: (id: string) => void;
  // width the user dragged a resizable side bar to (missing = its default), remembered in the browser
  barWidths: Record<string, number>;
  setBarWidth: (id: string, width: number | null) => void; // null = back to the default width
  // keep a block in the user library ("My blocks") to reuse it in other exams
  saveToLibrary: (block: Block) => void;
};

// Margins being edited (see Shell.marginEdit). `draft` = not saved yet; `dragging` = a handle on the
// canvas is being dragged (the guides follow it without gliding).
export type MarginEdit = { draft: PageMargins | null; dragging: boolean };

// Passed to every feature. Replaces globals.
export type Ctx = {
  doc: ExamDoc;
  selection: string | null;
  activePageId: string;
  t: T;
  dir: 'ltr' | 'rtl';
  shell: Shell;
  // The feature drawn in the right panel instead of the block / exam properties (see Feature.target).
  activeInspectorId: string | null;
  openInspector: (featureId: string) => void;
  closeInspector: () => void;
};

export type FeatureKind = 'tool' | 'action' | 'toggle' | 'menu-item' | 'field' | 'panel' | 'overlay';

// The atomic unit. One file exports exactly one of these.
// Extensions beyond the original contract are listed in ARCHITECTURE.md §13.
export type Feature<TConfig = unknown> = {
  id: string;
  kind: FeatureKind;
  label: string | ((t: T) => string);
  icon?: ReactNode;
  order?: number;
  hotkey?: string;
  defaultConfig?: TConfig;

  create?: (ctx: Ctx, config?: TConfig) => Block;
  run?: (ctx: Ctx, config?: TConfig) => void | Promise<void>;
  render?: (p: { ctx: Ctx; config?: TConfig }) => ReactNode;

  edits?: Block['type'][];
  group?: string;
  tags?: string[];

  // extensions
  tone?: Tone; // color of a tool tile
  dragPayload?: ToolAction; // a tool tile that can also be dragged onto the page
  library?: Library; // click opens this library of templates instead of inserting the default block
  separatorBefore?: boolean; // menu item: line above it
  heading?: string; // menu item: small section title above it (English key, translated)
  checked?: (ctx: Ctx) => boolean; // menu item: shows a check mark
  // Where a click on the feature's left-panel row leads:
  // 'canvas' (default) runs it, 'left-panel' opens its `library`, 'inspector' opens `renderInspector`
  // in the right panel and leaves the left panel where it is. An inspector feature has no create / run.
  target?: 'canvas' | 'left-panel' | 'inspector';
  renderInspector?: (p: { ctx: Ctx }) => ReactNode; // required with target: 'inspector'
  followsSelection?: boolean; // inspector: stays open while blocks are selected (it works on the selection)
};

// An ordered list of features with a label.
// Extensions: `when` hides the group, `menu` draws it as a dropdown, `className` styles its list.
export type Group = {
  id: string;
  label?: string | ((t: T) => string);
  order?: number;
  features: Feature[];

  when?: (ctx: Ctx) => boolean;
  menu?: boolean;
  header?: (ctx: Ctx) => ReactNode; // the dropdown's trigger (menu groups)
  menuAlignEnd?: boolean;
  className?: string;
};

// A top-level section of the left navigation (Home, Insert, Design, Page layout). Plain data.
// It owns its options; it is not a Group, because a section is opened and navigated, a group is not.
export type Section = {
  id: string;
  order?: number;
  label: string | ((t: T) => string);
  icon?: ReactNode;
  options: Option[];
};

// A labelled group of features inside a Section.
export type Option = {
  id: string;
  order?: number;
  label?: string | ((t: T) => string);
  features: Feature[];
};

// The block a template creates. It goes through the same path as the tool's own tile.
// (Multi-block templates need a batch insert first; see LIBRARY.md.)
export type LibraryItem = { type: BlockType; preset?: BlockPreset };

// One named starting point a tool offers. `item` is pure: it only reads ctx.
export type LibraryTemplate = {
  id: string;
  label: string | ((t: T) => string);
  description?: string | ((t: T) => string);
  recommended?: boolean;
  item: (ctx: Ctx) => LibraryItem;
};

// The templates a tool offers, in the order they are shown.
export type Library = {
  id: string;
  templates: LibraryTemplate[];
};

export type BarPosition = 'top' | 'left' | 'right' | 'bottom' | 'overlay';

// A side bar the user can close. It slides down to a thin strip and the page area takes the room.
// Text fields are English keys (translated).
export type BarCollapse = {
  width: number; // px when open (the default, until the user resizes it)
  minWidth?: number; // with maxWidth: the user can drag the inner edge to resize the bar
  maxWidth?: number;
  label: string; // name of the panel, e.g. "Toolbox"
  hide: string; // toggle tooltip while open, e.g. "Hide toolbox"
  show: string; // toggle tooltip while closed
  hotkey?: string; // e.g. "Ctrl+[": handled by the shell, shown in the tooltips
  strip?: Feature[]; // drawn in the thin strip while closed (shortcuts that reopen the panel)
};

// An ordered list of groups (plus one-off features) at a position.
// Extensions (see ARCHITECTURE.md §13): `className` carries the bar's geometry, `collapse` lets the
// user close a side bar, `dragRegion` makes its empty areas move the desktop window.
export type Bar = {
  id: string;
  position: BarPosition;
  order?: number;
  groups: Group[];
  features?: Feature[];
  className?: string;
  collapse?: BarCollapse; // the user can close it (see Shell.hiddenBars)
  dragRegion?: boolean; // empty areas drag the window, double-click maximizes (desktop app)
};
