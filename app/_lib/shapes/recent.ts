// The shapes used lately (the first row of the gallery): the newest first, each once, a few of them.
export const RECENT_LIMIT = 12;

export function pushRecent(list: readonly string[], id: string, limit = RECENT_LIMIT): string[] {
  return [id, ...list.filter((s) => s !== id)].slice(0, limit);
}
