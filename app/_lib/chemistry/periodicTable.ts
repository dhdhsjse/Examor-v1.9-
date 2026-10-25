// The periodic table: the 118 elements, as data for the drawing Studio (symbol, names, mass, colour, valence).
// Plain TypeScript, no React. Colours are the usual Jmol/CPK ones. Names are French (the app's chemistry
// language) and English; Arabic element names are NOT here on purpose: they wait for a reviewed list.

export type ElementData = {
  symbol: string;
  /** French name. */
  name: string;
  nameEn: string;
  atomicNumber: number;
  atomicMass: number;
  /** Standard CPK colour for the atom text. */
  color: string;
  /**
   * Default valence for auto-filling hydrogens (C=4, O=2, H=1). Only the non-metals and metalloids that form
   * covalent hydrides have one; 0 = no hydrogens are added (metals, noble gases): a Na or a Ca drawn for a salt
   * must not become NaH or CaH2.
   */
  valence: number;
};

// [atomic number, symbol, French name, English name, atomic mass, colour, valence]
// Masses are the standard values rounded to the usual 3 decimals; for elements without a stable isotope
// the mass number of the longest-lived isotope is given.
type Row = [number, string, string, string, number, string, number];

// Jmol colours leave the last elements without one: they share this pink.
const UNKNOWN = "#FF1493";

const ROWS: Row[] = [
  [1, "H", "Hydrogène", "Hydrogen", 1.008, "#333333", 1],
  [2, "He", "Hélium", "Helium", 4.003, "#D9FFFF", 0],
  [3, "Li", "Lithium", "Lithium", 6.94, "#CC80FF", 0],
  [4, "Be", "Béryllium", "Beryllium", 9.012, "#C2FF00", 0],
  [5, "B", "Bore", "Boron", 10.81, "#FFB5B5", 3],
  [6, "C", "Carbone", "Carbon", 12.011, "#333333", 4],
  [7, "N", "Azote", "Nitrogen", 14.007, "#3050F8", 3],
  [8, "O", "Oxygène", "Oxygen", 15.999, "#FF0D0D", 2],
  [9, "F", "Fluor", "Fluorine", 18.998, "#90E050", 1],
  [10, "Ne", "Néon", "Neon", 20.18, "#B3E3F5", 0],
  [11, "Na", "Sodium", "Sodium", 22.99, "#AB5CF2", 0],
  [12, "Mg", "Magnésium", "Magnesium", 24.305, "#8AFF00", 0],
  [13, "Al", "Aluminium", "Aluminium", 26.982, "#BFA6A6", 0],
  [14, "Si", "Silicium", "Silicon", 28.085, "#F0C8A0", 4],
  [15, "P", "Phosphore", "Phosphorus", 30.974, "#FF8000", 3],
  [16, "S", "Soufre", "Sulfur", 32.065, "#FFFF30", 2],
  [17, "Cl", "Chlore", "Chlorine", 35.453, "#1FF01F", 1],
  [18, "Ar", "Argon", "Argon", 39.948, "#80D1E3", 0],
  [19, "K", "Potassium", "Potassium", 39.098, "#8F40D4", 0],
  [20, "Ca", "Calcium", "Calcium", 40.078, "#3DFF00", 0],
  [21, "Sc", "Scandium", "Scandium", 44.956, "#E6E6E6", 0],
  [22, "Ti", "Titane", "Titanium", 47.867, "#BFC2C7", 0],
  [23, "V", "Vanadium", "Vanadium", 50.942, "#A6A6AB", 0],
  [24, "Cr", "Chrome", "Chromium", 51.996, "#8A99C7", 0],
  [25, "Mn", "Manganèse", "Manganese", 54.938, "#9C7AC7", 0],
  [26, "Fe", "Fer", "Iron", 55.845, "#E06633", 0],
  [27, "Co", "Cobalt", "Cobalt", 58.933, "#F090A0", 0],
  [28, "Ni", "Nickel", "Nickel", 58.693, "#50D050", 0],
  [29, "Cu", "Cuivre", "Copper", 63.546, "#C88033", 0],
  [30, "Zn", "Zinc", "Zinc", 65.38, "#7D80B0", 0],
  [31, "Ga", "Gallium", "Gallium", 69.723, "#C28F8F", 0],
  [32, "Ge", "Germanium", "Germanium", 72.63, "#668F8F", 4],
  [33, "As", "Arsenic", "Arsenic", 74.922, "#BD80E3", 3],
  [34, "Se", "Sélénium", "Selenium", 78.971, "#FFA100", 2],
  [35, "Br", "Brome", "Bromine", 79.904, "#A62929", 1],
  [36, "Kr", "Krypton", "Krypton", 83.798, "#5CB8D1", 0],
  [37, "Rb", "Rubidium", "Rubidium", 85.468, "#702EB0", 0],
  [38, "Sr", "Strontium", "Strontium", 87.62, "#00FF00", 0],
  [39, "Y", "Yttrium", "Yttrium", 88.906, "#94FFFF", 0],
  [40, "Zr", "Zirconium", "Zirconium", 91.224, "#94E0E0", 0],
  [41, "Nb", "Niobium", "Niobium", 92.906, "#73C2C9", 0],
  [42, "Mo", "Molybdène", "Molybdenum", 95.95, "#54B5B5", 0],
  [43, "Tc", "Technétium", "Technetium", 98, "#3B9E9E", 0],
  [44, "Ru", "Ruthénium", "Ruthenium", 101.07, "#248F8F", 0],
  [45, "Rh", "Rhodium", "Rhodium", 102.906, "#0A7D8C", 0],
  [46, "Pd", "Palladium", "Palladium", 106.42, "#006985", 0],
  [47, "Ag", "Argent", "Silver", 107.868, "#C0C0C0", 0],
  [48, "Cd", "Cadmium", "Cadmium", 112.414, "#FFD98F", 0],
  [49, "In", "Indium", "Indium", 114.818, "#A67573", 0],
  [50, "Sn", "Étain", "Tin", 118.71, "#668080", 0],
  [51, "Sb", "Antimoine", "Antimony", 121.76, "#9E63B5", 3],
  [52, "Te", "Tellure", "Tellurium", 127.6, "#D47A00", 2],
  [53, "I", "Iode", "Iodine", 126.904, "#940094", 1],
  [54, "Xe", "Xénon", "Xenon", 131.293, "#429EB0", 0],
  [55, "Cs", "Césium", "Caesium", 132.905, "#57178F", 0],
  [56, "Ba", "Baryum", "Barium", 137.327, "#00C900", 0],
  [57, "La", "Lanthane", "Lanthanum", 138.905, "#70D4FF", 0],
  [58, "Ce", "Cérium", "Cerium", 140.116, "#FFFFC7", 0],
  [59, "Pr", "Praséodyme", "Praseodymium", 140.908, "#D9FFC7", 0],
  [60, "Nd", "Néodyme", "Neodymium", 144.242, "#C7FFC7", 0],
  [61, "Pm", "Prométhium", "Promethium", 145, "#A3FFC7", 0],
  [62, "Sm", "Samarium", "Samarium", 150.36, "#8FFFC7", 0],
  [63, "Eu", "Europium", "Europium", 151.964, "#61FFC7", 0],
  [64, "Gd", "Gadolinium", "Gadolinium", 157.25, "#45FFC7", 0],
  [65, "Tb", "Terbium", "Terbium", 158.925, "#30FFC7", 0],
  [66, "Dy", "Dysprosium", "Dysprosium", 162.5, "#1FFFC7", 0],
  [67, "Ho", "Holmium", "Holmium", 164.93, "#00FF9C", 0],
  [68, "Er", "Erbium", "Erbium", 167.259, "#00E675", 0],
  [69, "Tm", "Thulium", "Thulium", 168.934, "#00D452", 0],
  [70, "Yb", "Ytterbium", "Ytterbium", 173.045, "#00BF38", 0],
  [71, "Lu", "Lutécium", "Lutetium", 174.967, "#00AB24", 0],
  [72, "Hf", "Hafnium", "Hafnium", 178.49, "#4DC2FF", 0],
  [73, "Ta", "Tantale", "Tantalum", 180.948, "#4DA6FF", 0],
  [74, "W", "Tungstène", "Tungsten", 183.84, "#2194D6", 0],
  [75, "Re", "Rhénium", "Rhenium", 186.207, "#267DAB", 0],
  [76, "Os", "Osmium", "Osmium", 190.23, "#266696", 0],
  [77, "Ir", "Iridium", "Iridium", 192.217, "#175487", 0],
  [78, "Pt", "Platine", "Platinum", 195.084, "#D0D0E0", 0],
  [79, "Au", "Or", "Gold", 196.967, "#FFD123", 0],
  [80, "Hg", "Mercure", "Mercury", 200.592, "#B8B8D0", 0],
  [81, "Tl", "Thallium", "Thallium", 204.38, "#A6544D", 0],
  [82, "Pb", "Plomb", "Lead", 207.2, "#575961", 0],
  [83, "Bi", "Bismuth", "Bismuth", 208.98, "#9E4FB5", 0],
  [84, "Po", "Polonium", "Polonium", 209, "#AB5C00", 0],
  [85, "At", "Astate", "Astatine", 210, "#754F45", 0],
  [86, "Rn", "Radon", "Radon", 222, "#428296", 0],
  [87, "Fr", "Francium", "Francium", 223, "#420066", 0],
  [88, "Ra", "Radium", "Radium", 226, "#007D00", 0],
  [89, "Ac", "Actinium", "Actinium", 227, "#70ABFA", 0],
  [90, "Th", "Thorium", "Thorium", 232.038, "#00BAFF", 0],
  [91, "Pa", "Protactinium", "Protactinium", 231.036, "#00A1FF", 0],
  [92, "U", "Uranium", "Uranium", 238.029, "#008FFF", 0],
  [93, "Np", "Neptunium", "Neptunium", 237, "#0080FF", 0],
  [94, "Pu", "Plutonium", "Plutonium", 244, "#006BFF", 0],
  [95, "Am", "Américium", "Americium", 243, "#545CF2", 0],
  [96, "Cm", "Curium", "Curium", 247, "#785CE3", 0],
  [97, "Bk", "Berkélium", "Berkelium", 247, "#8A4FE3", 0],
  [98, "Cf", "Californium", "Californium", 251, "#A136D4", 0],
  [99, "Es", "Einsteinium", "Einsteinium", 252, "#B31FD4", 0],
  [100, "Fm", "Fermium", "Fermium", 257, "#B31FBA", 0],
  [101, "Md", "Mendélévium", "Mendelevium", 258, "#B30DA6", 0],
  [102, "No", "Nobélium", "Nobelium", 259, "#BD0D87", 0],
  [103, "Lr", "Lawrencium", "Lawrencium", 266, "#C70066", 0],
  [104, "Rf", "Rutherfordium", "Rutherfordium", 267, "#CC0059", 0],
  [105, "Db", "Dubnium", "Dubnium", 268, "#D1004F", 0],
  [106, "Sg", "Seaborgium", "Seaborgium", 269, "#D90045", 0],
  [107, "Bh", "Bohrium", "Bohrium", 270, "#E00038", 0],
  [108, "Hs", "Hassium", "Hassium", 277, "#E6002E", 0],
  [109, "Mt", "Meitnérium", "Meitnerium", 278, "#EB0026", 0],
  [110, "Ds", "Darmstadtium", "Darmstadtium", 281, UNKNOWN, 0],
  [111, "Rg", "Roentgenium", "Roentgenium", 282, UNKNOWN, 0],
  [112, "Cn", "Copernicium", "Copernicium", 285, UNKNOWN, 0],
  [113, "Nh", "Nihonium", "Nihonium", 286, UNKNOWN, 0],
  [114, "Fl", "Flérovium", "Flerovium", 289, UNKNOWN, 0],
  [115, "Mc", "Moscovium", "Moscovium", 290, UNKNOWN, 0],
  [116, "Lv", "Livermorium", "Livermorium", 293, UNKNOWN, 0],
  [117, "Ts", "Tennesse", "Tennessine", 294, UNKNOWN, 0],
  [118, "Og", "Oganesson", "Oganesson", 294, UNKNOWN, 0],
];

export const PERIODIC_TABLE: Readonly<Record<string, ElementData>> = Object.freeze(
  Object.fromEntries(
    ROWS.map(([atomicNumber, symbol, name, nameEn, atomicMass, color, valence]) => [
      symbol,
      Object.freeze<ElementData>({ symbol, name, nameEn, atomicNumber, atomicMass, color, valence }),
    ]),
  ),
);

/** The elements in order of atomic number. */
export const ELEMENTS: readonly ElementData[] = Object.freeze(ROWS.map(([, symbol]) => PERIODIC_TABLE[symbol]));

/** The elements of the quick-access grid. */
export const COMMON_ELEMENTS: readonly string[] = ["C", "H", "O", "N", "S", "P", "Cl", "Br"];

/** The element of a symbol, or undefined for an unknown symbol (never throws). */
export const elementOf = (symbol: string): ElementData | undefined => PERIODIC_TABLE[symbol];

/** The element's name for a UI language: French in French, English otherwise (Arabic names wait for a reviewed list). */
export const elementName = (e: ElementData, lang: "en" | "fr" | "ar"): string => (lang === "fr" ? e.name : e.nameEn);

// Where an element sits in the usual 18-column table. Rows 1–7 are the periods; the lanthanides
// (57–71) and actinides (89–103) are drawn below the table, in rows 9 and 10 (row 8 is a gap).
export type TableCell = { row: number; col: number };

export function tableCell(z: number): TableCell {
  if (z === 1) return { row: 1, col: 1 };
  if (z === 2) return { row: 1, col: 18 };
  if (z <= 4) return { row: 2, col: z - 2 };
  if (z <= 10) return { row: 2, col: z + 8 };
  if (z <= 12) return { row: 3, col: z - 10 };
  if (z <= 18) return { row: 3, col: z };
  if (z <= 36) return { row: 4, col: z - 18 };
  if (z <= 54) return { row: 5, col: z - 36 };
  if (z <= 56) return { row: 6, col: z - 54 };
  if (z <= 71) return { row: 9, col: z - 54 }; // lanthanides: columns 3–17
  if (z <= 86) return { row: 6, col: z - 68 };
  if (z <= 88) return { row: 7, col: z - 86 };
  if (z <= 103) return { row: 10, col: z - 86 }; // actinides: columns 3–17
  return { row: 7, col: z - 100 };
}

// A very pale colour (He, Sc, Ce…) vanishes on white paper. Text is drawn with a darker version of it
// when its brightness is above this; the dictionary keeps the standard colour.
const MAX_BRIGHTNESS = 0.62;

/** The colour to draw an element's symbol with on white: its CPK colour, darkened if it would be hard to read. */
export function textColor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (brightness <= MAX_BRIGHTNESS) return hex;
  const k = MAX_BRIGHTNESS / brightness;
  const part = (v: number) => Math.round(v * k).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}
