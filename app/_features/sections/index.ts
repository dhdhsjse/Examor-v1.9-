import type { Section } from "@/app/_features/core/types";
import { designSection } from "./design";
import { homeSection } from "./home";
import { insertSection } from "./insert";
import { layoutSection } from "./layout";

// The left navigation, in display order (each section sorts itself by `order`).
export const sections: Section[] = [homeSection, insertSection, designSection, layoutSection];
