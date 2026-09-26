import type { ConnectionView, TokenStatus } from '@contract/api.ts';

/** One line about a connection's token, for its row. */
export function tokenLine(s: Readonly<TokenStatus>): string {
  if (!s.present) return s.needsReentry ? 'Сохранённый токен больше не читается — введи его заново.' : 'Нет токена';
  return s.stored === 'secure' ? 'Токен в системном хранилище ключей' : 'Токен только в памяти до закрытия приложения';
}

/** What has been imported for a connection. */
export function coverageLine(c: Readonly<ConnectionView>): string {
  if (c.coveredFrom === null || c.coveredTo === null) return 'Ещё не загружено';
  const d = (iso: string) => iso.split('-').reverse().join('.');
  return `Счетов: ${c.accounts} · загружено с ${d(c.coveredFrom)} по ${d(c.coveredTo)}`;
}
