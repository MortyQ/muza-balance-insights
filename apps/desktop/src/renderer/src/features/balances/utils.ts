import type { BalanceLine } from '@contract/api.ts';

/** The newest «YYYY-MM-DD HH:mm» among the lines, or null for none. */
export function latestUpdate(lines: ReadonlyArray<BalanceLine>): string | null {
  return lines.map((l) => l.updatedAt).sort().at(-1) ?? null;
}
