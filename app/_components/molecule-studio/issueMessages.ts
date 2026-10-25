import type { Issue } from "@/app/_lib/chemistry/issues";

type Translate = (text: string, params?: Record<string, string | number>) => string;

// The words of a "!" (see issues.ts): what is odd about an atom, for the tooltip and the Properties panel.
// `t` is the interface's translator; the English texts are the keys of the dictionaries (chemistry/strings.ts).
export function issueMessage(issue: Issue, t: Translate): string {
  switch (issue.kind) {
    case "valence":
      return t("{element} has {bonds} bonds; its usual valence is {usual}", { element: issue.element, bonds: issue.bonds, usual: issue.usual });
    case "octet":
      return t("{element} has {electrons} electrons around it: more than its shell holds", { element: issue.element, electrons: issue.electrons });
    case "overlap":
      return t("Two atoms are on top of each other");
  }
}

/** The messages of each atom that has any (an overlap is told to both atoms). */
export function messagesByAtom(issues: readonly Issue[], t: Translate): Map<string, string[]> {
  const out = new Map<string, string[]>();
  const add = (id: string, text: string) => out.set(id, [...(out.get(id) ?? []), text]);
  for (const issue of issues) {
    const text = issueMessage(issue, t);
    add(issue.atomId, text);
    if (issue.kind === "overlap") add(issue.other, text);
  }
  return out;
}
