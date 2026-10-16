import type { BuildType } from "../onboardingTypes";

export const buildTypes: { id: BuildType; nameKey: string; recommended?: boolean }[] = [
  { id: "header-footer", nameKey: "Header and footer", recommended: true },
  { id: "header-only", nameKey: "Header only" },
  { id: "footer-only", nameKey: "Footer only" },
  { id: "none", nameKey: "None" },
];

export const wantsHeader = (b: BuildType) => b === "header-footer" || b === "header-only";
export const wantsFooter = (b: BuildType) => b === "header-footer" || b === "footer-only";
