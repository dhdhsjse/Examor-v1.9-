// The figures of the Physics pack (libraryPack.ts, category "physics"): drawn from settings, editable on the page.
import type { FigureDef } from "../types";
import { CHEMISTRY_FIGURES } from "./chemistry";
import { CIRCUIT_FIGURES } from "./circuits";
import { MECHANICS_FIGURES } from "./mechanics";
import { NUCLEAR_FIGURES } from "./nuclear";
import { OPTICS_FIGURES } from "./optics";
import { ENERGY_FIGURES } from "./energy";
import { MATTER_FIGURES } from "./matter";
import { MEASURE_FIGURES } from "./measures";
import { MOTION_FIGURES } from "./motion";

export const PHYSICS_FIGURES: FigureDef[] = [...MEASURE_FIGURES, ...MATTER_FIGURES, ...MOTION_FIGURES, ...ENERGY_FIGURES, ...CHEMISTRY_FIGURES, ...CIRCUIT_FIGURES, ...OPTICS_FIGURES, ...NUCLEAR_FIGURES, ...MECHANICS_FIGURES];
