import type { ConnectionView, PersonView, TokenStatus } from '@contract/api.ts';
import { COLOR_KEYS, type ColorKey } from '@contract/colors.ts';

/** One line about a connection's token, for its row. */
export function tokenLine(s: Readonly<TokenStatus>): string {
  if (!s.present) return s.needsReentry ? 'Сохранённый токен больше не читается — введи его заново.' : 'Нет токена';
  return s.stored === 'secure' ? 'Токен в системном хранилище ключей' : 'Токен только в памяти до закрытия приложения';
}

export type TokenBadge = { tone: 'success' | 'warning'; text: string };

/** The short badge of a connection's token in settings. */
export function tokenBadge(s: Readonly<TokenStatus>): TokenBadge {
  if (!s.present) return { tone: 'warning', text: s.needsReentry ? 'Введи токен заново' : 'Нужен токен' };
  return s.stored === 'secure' ? { tone: 'success', text: 'Токен сохранён' } : { tone: 'warning', text: 'Токен до закрытия' };
}

/** What has been imported for a connection. */
export function coverageLine(c: Readonly<ConnectionView>): string {
  if (c.coveredFrom === null || c.coveredTo === null) return 'Ещё не загружено';
  const d = (iso: string) => iso.split('-').reverse().join('.');
  return `Счетов: ${c.accounts} · загружено с ${d(c.coveredFrom)} по ${d(c.coveredTo)}`;
}

/** The CSS colour of a palette key in the current theme; no colour → the strong border grey. */
export function colorVar(color: ColorKey | null): string {
  return color === null ? 'var(--border-strong)' : `var(--series-${color})`;
}

/**
 * Who holds each colour among people or among connections, for «занят: …» — except the row being edited (its own colour
 * stays selectable).
 */
export function colorHolders(
  people: ReadonlyArray<Readonly<PersonView>>,
  kind: 'people' | 'connections',
  exceptId?: number,
): Map<ColorKey, string> {
  const held = new Map<ColorKey, string>();
  for (const p of people) {
    if (kind === 'people') {
      if (p.color !== null && p.id !== exceptId) held.set(p.color, p.label);
      continue;
    }
    for (const c of p.connections) if (c.color !== null && c.id !== exceptId) held.set(c.color, `${p.label} · ${c.bank}`);
  }
  return held;
}

/** The colour a new person or connection gets unless one is picked; null = all taken. */
export function firstFreeColor(taken: ReadonlyMap<ColorKey, string>): ColorKey | null {
  return COLOR_KEYS.find((k) => !taken.has(k)) ?? null;
}
