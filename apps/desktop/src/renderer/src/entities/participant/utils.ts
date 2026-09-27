import type { ConnectionView, PersonView, TokenStatus } from '@contract/api.ts';
import { COLOR_KEYS, type ColorKey } from '@contract/colors.ts';
import type { SegmentOption } from '@/shared/ui';
import { FAMILY } from './constants.ts';

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

/**
 * Every account of every connection is turned off in «Счета»: nothing to import or count. A connection with no accounts
 * yet (not imported) does not count as off — its first import brings them.
 */
export function allAccountsOff(connections: ReadonlyArray<Readonly<ConnectionView>>): boolean {
  return connections.length > 0 && connections.every((c) => c.accounts > 0 && c.enabledAccounts === 0);
}

/** The CSS colour of a palette key in the current theme; no colour → the strong border grey. */
export function colorVar(color: ColorKey | null): string {
  return color === null ? 'var(--border-strong)' : `var(--series-${color})`;
}

/**
 * Who holds each colour among people, for «занят: …» — except the person being edited (their own colour stays
 * selectable). Connections have no colour.
 */
export function colorHolders(people: ReadonlyArray<Readonly<PersonView>>, exceptId?: number): Map<ColorKey, string> {
  const held = new Map<ColorKey, string>();
  for (const p of people) if (p.color !== null && p.id !== exceptId) held.set(p.color, p.label);
  return held;
}

/** The colour a new person gets unless one is picked; null = all taken. */
export function firstFreeColor(taken: ReadonlyMap<ColorKey, string>): ColorKey | null {
  return COLOR_KEYS.find((k) => !taken.has(k)) ?? null;
}

/**
 * The people filter: each person's colour next to the name, and everyone's on «Вся семья» — charts and tables coloured
 * by person read against this header.
 */
export function filterOptions(people: ReadonlyArray<Readonly<PersonView>>): SegmentOption<number>[] {
  return [
    { label: 'Вся семья', value: FAMILY, colors: people.map((p) => colorVar(p.color)) },
    ...people.map((p) => ({ label: p.label, value: p.id, colors: [colorVar(p.color)] })),
  ];
}
