import type { ConnectionView } from '@contract/api.ts';
import type { ImportProgress } from '@contract/progress.ts';
import { t } from '@/shared/lib';

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
  if (missing.some((c) => c.token.needsReentry)) return t('home.notices.unreadable', { names });
  if (missing.length === total) return t('home.notices.noTokenAll');
  return t('home.notices.noTokenSome', { names });
}
