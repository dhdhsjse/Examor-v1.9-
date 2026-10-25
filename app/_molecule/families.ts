// How a teacher thinks of the molecule database: by family (alkanes, alcohols, acids…), plus a short list of the
// molecules asked for most often. Used by the Studio's browser and its welcome screen.
import { DATABASE, type DbEntry } from "./resolve/database";

export interface Family {
  id: string;
  label: string; // English key, translated with the Studio's dictionaries
  tags: string[]; // the database tags that put a molecule in this family
}

export const FAMILIES: Family[] = [
  { id: "alkane", label: "Alkanes", tags: ["alkane"] },
  { id: "alkene", label: "Alkenes", tags: ["alkene"] },
  { id: "alkyne", label: "Alkynes", tags: ["alkyne"] },
  { id: "alcohol", label: "Alcohols", tags: ["alcohol"] },
  { id: "carbonyl", label: "Aldehydes and ketones", tags: ["aldehyde", "ketone"] },
  { id: "acid", label: "Carboxylic acids", tags: ["carboxylic-acid"] },
  { id: "ester", label: "Esters", tags: ["ester"] },
  { id: "nitrogen", label: "Amines and amides", tags: ["amine", "amide"] },
  { id: "halide", label: "Halogen derivatives", tags: ["halogenoalkane"] },
  { id: "aromatic", label: "Aromatic compounds", tags: ["aromatic"] },
  { id: "inorganic", label: "Inorganic molecules", tags: ["inorganic"] },
];

// The molecules a physics-chemistry class meets first.
export const POPULAR = ["ethanoic-acid", "ethanol", "water", "methane", "ammonia", "carbon-dioxide", "propanone", "benzene"];

export function moleculesOf(family: Family, db: DbEntry[] = DATABASE): DbEntry[] {
  return db.filter((e) => e.tags.some((t) => family.tags.includes(t)));
}

export function popularMolecules(db: DbEntry[] = DATABASE): DbEntry[] {
  return POPULAR.map((id) => db.find((e) => e.id === id)).filter((e): e is DbEntry => !!e);
}
