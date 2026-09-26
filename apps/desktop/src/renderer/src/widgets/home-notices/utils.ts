import type { ConnectionView } from '@contract/api.ts';
import type { ImportProgress } from '@contract/progress.ts';

/**
 * Why some connections cannot import, when home is shown with them. `missing`: connections without a token, of `total`;
 * `labelOf`: «Имя · Monobank».
 */
export function noTokenText(
  missing: ReadonlyArray<ConnectionView>,
  total: number,
  phase: ImportProgress['phase'],
  labelOf: (connectionId: number) => string,
): string {
  const names = missing.map((c) => labelOf(c.id)).join(', ');
  if (phase === 'needs-token') return 'Есть незавершённый импорт. Введи токен в «Люди и подключения», чтобы продолжить.';
  if (missing.some((c) => c.token.needsReentry)) return `Сохранённый токен больше не читается (${names}). Введи его заново, чтобы загружать новые операции.`;
  if (missing.length === total) return 'Нет токена: новые операции не загружаются. Уже загруженное на месте.';
  return `Нет токена: ${names}. Их новые операции не загружаются.`;
}
