// Simple unique id for pages and blocks.
export function newId(): string {
  return crypto.randomUUID();
}
