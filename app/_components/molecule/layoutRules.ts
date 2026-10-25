import type { Representation } from "@/app/_molecule/model";

// Drawings made of atoms and bonds: the ones that can be edited atom by atom.
export const EDITABLE: Representation[] = ["structural", "skeletal", "lewis", "cram"];

// Drawings with a layout of their own: atoms cannot be dragged, and the layout option does not apply.
export const FIXED_LAYOUT: Representation[] = ["skeletal", "cram"];
