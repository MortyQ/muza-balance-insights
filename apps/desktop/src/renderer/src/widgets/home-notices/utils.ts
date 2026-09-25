import type { TokenStatus } from '@contract/api.ts';
import type { ImportProgress } from '@contract/progress.ts';

/** Why there is no token, when the home screen is shown without one. */
export function noTokenText(status: Readonly<TokenStatus> | null, phase: ImportProgress['phase']): string {
  if (phase === 'needs-token') return 'Есть незавершённый импорт. Подключи банк, чтобы продолжить.';
  if (status?.needsReentry) return 'Сохранённый токен больше не читается. Подключи банк заново, чтобы загружать новые операции.';
  return 'Банк не подключён: новые операции не загружаются. Уже загруженное на месте.';
}
