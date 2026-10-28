// Which tabs the math keyboard shows: the Math keys or the Physics keys.

import type { Subject } from "@/app/_lib/subjects";
import type { KeyboardTab } from "./keys";
import { mathTabs } from "./mathLayout";
import { physicsTabs } from "./physicsLayout";

export type KeyboardLayout = "math" | "physics";
export const KEYBOARD_LAYOUTS: readonly KeyboardLayout[] = ["math", "physics"];

// The layout a keyboard opens with when nobody has chosen one: Physics has its own (vectors, units, constants…);
// every other subject uses the math tabs. The teacher can switch by hand from the keyboard itself.
export const layoutFor = (subject: Subject): KeyboardLayout => (subject === "Physics" ? "physics" : "math");

export const keyboardTabsOf = (layout: KeyboardLayout): KeyboardTab[] => (layout === "physics" ? physicsTabs : mathTabs);

export const keyboardTabsFor = (subject: Subject): KeyboardTab[] => keyboardTabsOf(layoutFor(subject));
