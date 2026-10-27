// Which tabs the math keyboard shows for the exam's subject.

import type { Subject } from "@/app/_lib/subjects";
import type { KeyboardTab } from "./keys";
import { mathTabs } from "./mathLayout";
import { physicsTabs } from "./physicsLayout";

// Physics has its own (vectors, units, constants…); every other subject uses the math tabs.
export function keyboardTabsFor(subject: Subject): KeyboardTab[] {
  return subject === "Physics" ? physicsTabs : mathTabs;
}
