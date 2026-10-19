import type { Feature, Section } from "@/app/_features/core/types";
import { inspectorTextbox } from "@/app/_features/inspectors/inspector-textbox";
import type { BlockType } from "@/app/_lib/types";
import { designSection } from "./design";
import { homeSection } from "./home";
import { insertSection } from "./insert";
import { layoutSection } from "./layout";

// The left navigation, in display order (each section sorts itself by `order`).
export const sections: Section[] = [homeSection, insertSection, designSection, layoutSection];

// Inspectors with no row in the left panel: each opens by itself in the right panel when a block of a
// type it `edits` is selected (like Word's tab for a selected shape), and shows only while one is.
export const blockInspectors: Feature[] = [inspectorTextbox];

// Every feature of every section (for search, libraries and the right-panel inspector).
export const sectionFeatures = (): Feature[] => sections.flatMap((s) => s.options.flatMap((o) => o.features));

export const findSectionFeature = (id: string | null) => (id ? [...sectionFeatures(), ...blockInspectors].find((f) => f.id === id) : undefined);

// The inspector that opens when a block of `type` is selected, if it has one.
export const blockInspectorFor = (type: BlockType | undefined) => (type ? blockInspectors.find((f) => f.edits?.includes(type)) : undefined);
