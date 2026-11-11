// The figures of the Sciences pack (libraryPack.ts, category "sciences"): drawn from settings, editable on the page.
import type { FigureDef } from "../types";
import { CELL_FIGURES } from "./cell";
import { ENZYME_FIGURES } from "./enzymes";
import { GROWTH_FIGURES } from "./growth";
import { IMMUNITY_FIGURES } from "./immunity";
import { MATTER_FIGURES } from "./matter";
import { MUTATION_FIGURES } from "./mutations";
import { NERVOUS_FIGURES } from "./nervous";
import { PHOTOSYNTHESIS_FIGURES } from "./photosynthesis";
import { RESPIRATION_FIGURES } from "./respiration";
import { STRUCTURE_FIGURES } from "./structure";
import { SYNTHESIS_FIGURES } from "./synthesis";

export const SCIENCE_FIGURES: FigureDef[] = [
  ...MATTER_FIGURES,
  ...GROWTH_FIGURES,
  ...CELL_FIGURES,
  ...NERVOUS_FIGURES,
  ...MUTATION_FIGURES,
  ...SYNTHESIS_FIGURES,
  ...STRUCTURE_FIGURES,
  ...ENZYME_FIGURES,
  ...IMMUNITY_FIGURES,
  ...PHOTOSYNTHESIS_FIGURES,
  ...RESPIRATION_FIGURES,
];
