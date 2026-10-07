import type { ConnectionView } from '@contract/api.ts';
import { importFloor } from '@contract/import-range.ts';
import type { ImportProgress } from '@contract/progress.ts';
import { monthOf, t, type YearMonth } from '@/shared/lib';

/**
 * Why some connections cannot import, when home is shown with them. `missing`: connections without a token, of `total`;
 * `labelOf`: «Name · Monobank».
 */
export function noTokenText(
  missing: ReadonlyArray<ConnectionView>,
  total: number,
  phase: ImportProgress['phase'],
  labelOf: (connectionId: number) => string,
): string {
  const names = missing.map((c) => labelOf(c.id)).join(', ');
  if (phase === 'needs-token') return t('home.import.needsToken');
  if (missing.some((c) => c.token?.needsReentry)) return t('home.notices.unreadable', { names });
  if (missing.length === total) return t('home.notices.noTokenAll');
  return t('home.notices.noTokenSome', { names });
}

/**
 * The month picked on home is before the first data (`dataFrom`, a local date): where to download it from — the month's
 * first day, or the oldest date the import allows on `today`. null when the month has data or nothing is known yet.
 */
export function emptyMonth(month: YearMonth, dataFrom: string | null, today: string): { from: string; dataFrom: string } | null {
  if (!dataFrom || month >= monthOf(dataFrom)) return null;
  const floor = importFloor(today);
  const first = `${month}-01`;
  return { from: first < floor ? floor : first, dataFrom };
}
