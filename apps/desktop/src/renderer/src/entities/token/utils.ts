import type { TokenStatus } from '@contract/api.ts';

/** One line about the connection, for the settings row. */
export function tokenLine(s: Readonly<TokenStatus> | null): string {
  if (!s) return '…';
  if (!s.present) return s.needsReentry ? 'Сохранённый токен больше не читается — подключи заново.' : 'Не подключён';
  return s.stored === 'secure' ? 'Подключён · токен в системном хранилище ключей' : 'Подключён · токен только в памяти до закрытия приложения';
}
