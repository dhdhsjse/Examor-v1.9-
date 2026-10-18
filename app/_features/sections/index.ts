import type { Feature, Section } from "@/app/_features/core/types";
import { designSection } from "./design";
import { insertSection } from "./insert";
import { layoutSection } from "./layout";

// The left navigation, in display order (each section sorts itself by `order`).
export const sections: Section[] = [insertSection, designSection, layoutSection];

// Every feature of every section (for search, libraries and the right-panel inspector).
export const sectionFeatures = (): Feature[] => sections.flatMap((s) => s.options.flatMap((o) => o.features));

export const findSectionFeature = (id: string | null) => (id ? sectionFeatures().find((f) => f.id === id) : undefined);
