// "General" = only the tools every subject shares.
export const SUBJECTS = ["General", "Math", "Physics", "Sciences", "Arabic", "French"] as const;
export type Subject = (typeof SUBJECTS)[number];
export type SchoolSubject = Exclude<Subject, "General">;

// School cycles and their years (Moroccan system).
export const CYCLES = {
  primaire: { label: "Primaire", years: ["1AP", "2AP", "3AP", "4AP", "5AP", "6AP"] },
  college: { label: "Collège", years: ["1AC", "2AC", "3AC"] },
  lycee: { label: "Lycée", years: ["TC", "1BAC", "2BAC"] },
} as const;
export type Cycle = keyof typeof CYCLES;
export const ALL_CYCLES = Object.keys(CYCLES) as Cycle[];
