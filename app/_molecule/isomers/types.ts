// Isomer tables: precomputed at build time by scripts/gen-isomers.mts (MAYGEN, Java, dev machine only) and shipped
// as data. Nothing here needs Java or the network at run time.

export type GroupId =
  | "carboxylic-acid"
  | "ester"
  | "amide"
  | "aldehyde"
  | "ketone"
  | "alcohol"
  | "phenol"
  | "ether"
  | "amine"
  | "halide"
  | "alkene"
  | "alkyne"
  | "nitrile"
  | "aromatic"
  | "alkane"
  | "cycloalkane"
  | "other";

// In the order a teacher thinks of them (also the order of the filter chips).
export const GROUP_ORDER: GroupId[] = ["alkane", "alkene", "alkyne", "cycloalkane", "aromatic", "alcohol", "phenol", "ether", "aldehyde", "ketone", "carboxylic-acid", "ester", "amide", "amine", "nitrile", "halide", "other"];

// English keys, translated with the Studio's dictionaries (app/_molecule/strings.ts).
export const GROUP_LABEL: Record<GroupId, string> = {
  "carboxylic-acid": "Carboxylic acid",
  ester: "Ester",
  amide: "Amide",
  aldehyde: "Aldehyde",
  ketone: "Ketone",
  alcohol: "Alcohol",
  phenol: "Phenol",
  ether: "Ether",
  amine: "Amine",
  halide: "Halogen derivative",
  alkene: "Alkene",
  alkyne: "Alkyne",
  nitrile: "Nitrile",
  aromatic: "Aromatic ring",
  alkane: "Alkane",
  cycloalkane: "Cycloalkane",
  other: "Other",
};

// Why a structure is not shown by the school filter.
export type SchoolIssue = "small-ring" | "peroxide" | "cumulated" | "enol" | "gem-diol";

export interface IsomerInfo {
  groups: GroupId[]; // functional groups and families present
  ring: boolean;
  branched: boolean; // an acyclic carbon chain with a branch point
  skeleton: string; // canonical SMILES of the carbon skeleton (carbons only, single bonds): same skeleton = position isomers
}

export interface IsomerEntry extends IsomerInfo {
  smiles: string; // canonical (the same canonicalisation as the engine)
  school: boolean; // passes the school filter
  issues?: SchoolIssue[]; // why not, when it does not
  name?: { ar?: string; fr?: string; en?: string }; // from the local database only: names are never generated
}

export interface IsomerFile {
  formula: string; // Hill
  total: number; // how many structures MAYGEN found
  schoolTotal: number; // how many of them pass the school filter
  entries: IsomerEntry[]; // school ones first (known molecules, then simplest first), then the others; both lists are capped
}

// How an isomer relates to the molecule being looked at.
export type Relation = "same" | "chain" | "position" | "function";

export const ISSUE_LABEL: Record<SchoolIssue, string> = {
  "small-ring": "a three- or four-membered ring",
  peroxide: "a peroxide (O–O)",
  cumulated: "cumulated double bonds",
  enol: "an enol (C=C–OH)",
  "gem-diol": "two OH on one carbon",
};

export const RELATION_LABEL: Record<Exclude<Relation, "same">, string> = {
  chain: "Chain isomer",
  position: "Position isomer",
  function: "Function isomer",
};
