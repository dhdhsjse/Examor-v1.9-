import type { ReactNode } from 'react';
import type Konva from 'konva';
import type { Block, ExamDoc, ExamMeta, ViewMode } from '@/app/_lib/types';
import type { ToolAction } from '@/app/_lib/tools';
import type { Subject } from '@/app/_lib/subjects';
import type { T, UiLang } from '@/app/_lib/uiLang';
import type { BlockPatch, SaveState } from '@/app/_lib/useExam';
import type { Asset, AssetKind } from '@/app/_lib/library';
import type { Template } from '@/app/_lib/templates';
import type { Version } from '@/app/_lib/versions';
import type { Tone } from '@/app/_components/ToolTile';

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
  updateBlock: (id: string, patch: BlockPatch, field: string) => void;
  onLatex: (block: Block, latex: string) => void;
  deleteBlock: (id: string) => void;
  duplicateBlock: (id: string) => void;
  // files
  newExam: () => void;
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
  restore: (version: Version) => void;
  exportJob: { doc: ExamDoc; mode: ViewMode; resolve: (stage: Konva.Stage) => void } | null;
  toast: string | null;
  // bars the user has hidden (ids of bars with `collapsible: true`)
  hiddenBars: string[];
  toggleBar: (id: string) => void;
};

// Passed to every feature. Replaces globals.
export type Ctx = {
  doc: ExamDoc;
  selection: string | null;
  activePageId: string;
  t: T;
  dir: 'ltr' | 'rtl';
  shell: Shell;
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
  separatorBefore?: boolean; // menu item: line above it
  checked?: (ctx: Ctx) => boolean; // menu item: shows a check mark
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

export type BarPosition = 'top' | 'left' | 'right' | 'bottom' | 'overlay';

// An ordered list of groups (plus one-off features) at a position.
// Extension: `className` carries the bar's geometry (see ARCHITECTURE.md §13).
export type Bar = {
  id: string;
  position: BarPosition;
  order?: number;
  groups: Group[];
  features?: Feature[];
  className?: string;
  collapsible?: boolean; // the user can hide it (see Shell.hiddenBars)
};
