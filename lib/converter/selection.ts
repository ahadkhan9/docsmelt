/**
 * Queue multi-select — pure selection state helpers (unit-tested).
 */

export const toggleChecked = (checked: ReadonlySet<string>, id: string): Set<string> => {
  const next = new Set(checked);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/** Contiguous range between anchor and target in the given row order. */
export function rangeSelect(
  ids: string[],
  anchorId: string,
  targetId: string,
): Set<string> {
  const from = ids.indexOf(anchorId);
  const to = ids.indexOf(targetId);
  if (from < 0 || to < 0) return new Set([targetId]);
  const [start, end] = from <= to ? [from, to] : [to, from];
  return new Set(ids.slice(start, end + 1));
}

/** The ids that exist and are checked. */
export const checkedOf = (checked: ReadonlySet<string>, ids: string[]): string[] =>
  ids.filter((id) => checked.has(id));
