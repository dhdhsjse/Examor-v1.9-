// A short fingerprint of what a block of the exam was when the correction sheet took its copy of it (or its answer). The sheet keeps it
// (`BlockSource.sig`) and later compares it with the block as it is now: a different one means the exam changed since. Not a security hash.
import type { Block } from "../types";

/** The text of a value with its keys in a fixed order, so the same content always gives the same text */
export function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v) ?? "null";
}

/** FNV-1a of a text, in base 36 */
export function fingerprint(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** What a block says: everything but its id, its place and its links (so moving it, or copying it, changes nothing) */
export function contentOf(b: Block): string {
  const rest: Record<string, unknown> = { ...b };
  delete rest.id;
  delete rest.layout;
  delete rest.meta;
  return stable(rest);
}

// (a block is never changed in place: a changed one is a new object, so each is worked out once — a picture's data is long, and the report is made again
// at every key typed)
const known = new WeakMap<object, string>();

/** The fingerprint of a block's content */
export function blockSig(b: Block): string {
  let sig = known.get(b);
  if (sig === undefined) {
    sig = fingerprint(contentOf(b));
    known.set(b, sig);
  }
  return sig;
}
