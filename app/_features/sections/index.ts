import type { Feature, Section } from "@/app/_features/core/types";
import { inspectorHomeFind } from "@/app/_features/inspectors/inspector-home-find";
import { inspectorShape } from "@/app/_features/inspectors/inspector-shape";
import { inspectorTextbox } from "@/app/_features/inspectors/inspector-textbox";
import type { BlockType } from "@/app/_lib/types";
import { insertSection } from "./insert";
import { layoutSection } from "./layout";

// The left navigation, in display order (each section sorts itself by `order`).
export const sections: Section[] = [insertSection, layoutSection];

// Inspectors with no row in the left panel (Find and replace opens with Ctrl+F and stays open while blocks are selected): each other one opens by itself in the right panel when a block of a
// type it `edits` is selected (like Word's tab for a selected shape), and shows only while one is.
export const blockInspectors: Feature[] = [inspectorTextbox, inspectorShape, inspectorHomeFind];

// Every feature of every section (for search, libraries and the right-panel inspector).
export const sectionFeatures = (): Feature[] => sections.flatMap((s) => s.options.flatMap((o) => o.features));

export const findSectionFeature = (id: string | null) => (id ? [...sectionFeatures(), ...blockInspectors].find((f) => f.id === id) : undefined);

// The inspector that opens when a block of `type` is selected, if it has one.
export const blockInspectorFor = (type: BlockType | undefined) => (type ? blockInspectors.find((f) => f.edits?.includes(type)) : undefined);
