import type { ConnectionView, PersonView, TokenStatus } from '@contract/api.ts';
import { COLOR_KEYS, type ColorKey } from '@contract/colors.ts';
import { syncedWhen, t } from '@/shared/lib';
import type { SegmentOption } from '@/shared/ui';
import { FAMILY } from './constants.ts';

/** One line about a connection's token, for its row. */
export function tokenLine(s: Readonly<TokenStatus>): string {
  if (!s.present) return s.needsReentry ? t('entities.token.unreadable') : t('entities.token.none');
  return s.stored === 'secure' ? t('entities.token.secure') : t('entities.token.memory');
}

export type TokenBadge = { tone: 'success' | 'warning'; text: string };

/** The short badge of a connection's token in settings. */
export function tokenBadge(s: Readonly<TokenStatus>): TokenBadge {
  if (!s.present) return { tone: 'warning', text: s.needsReentry ? t('entities.token.badgeReenter') : t('entities.token.badgeNeeded') };
  return s.stored === 'secure'
    ? { tone: 'success', text: t('entities.token.badgeSaved') }
    : { tone: 'warning', text: t('entities.token.badgeUntilClose') };
}

/** What has been imported for a connection; with some accounts off — how many count, of all. */
export function coverageLine(c: Readonly<ConnectionView>): string {
  if (c.accounts > 0 && c.enabledAccounts === 0) return t('entities.coverage.allOff');
  if (c.coveredFrom === null || c.coveredTo === null) return t('entities.coverage.notYet');
  const d = (iso: string) => iso.split('-').reverse().join('.');
  const count =
    c.enabledAccounts === c.accounts ? `${c.accounts}` : t('entities.coverage.partOf', { enabled: c.enabledAccounts, total: c.accounts });
  return t('entities.coverage.line', { count, from: d(c.coveredFrom), to: d(c.coveredTo) });
}

/**
 * Every account of every connection is turned off in «Accounts»: nothing to import or count. A connection with no accounts
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
 * Who holds each colour among people, for «taken by …» — except the person being edited (their own colour stays
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

/** The latest sync of any of a person's connections (local «YYYY-MM-DD HH:mm» sorts as text); null = never. */
export function lastSyncOf(p: Readonly<PersonView>): string | null {
  let last: string | null = null;
  for (const c of p.connections) if (c.lastSyncAt !== null && (last === null || c.lastSyncAt > last)) last = c.lastSyncAt;
  return last;
}

/** What the people filter says about syncing, per person. */
export type FilterSync = {
  /** Connections that did not update in the last import → why, already worded by the caller. */
  failed: Readonly<Record<number, string>>;
  now: Date;
  /** «Name · Monobank» of a connection (the store's `labelOf`). */
  labelOf: (connectionId: number) => string;
};

// The segment tooltip renders HTML (VSegmentedControl); names come from the user and the bank.
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function syncHints(p: Readonly<PersonView>, sync: Readonly<FilterSync>): Pick<SegmentOption<number>, 'tooltip' | 'alert'> {
  const last = lastSyncOf(p);
  const failed = p.connections.flatMap((c) => {
    const why = sync.failed[c.id];
    return why === undefined ? [] : [`${sync.labelOf(c.id)}: ${why}`];
  });
  const lines = [...(last === null ? [] : [t('entities.participant.updated', { when: syncedWhen(last, sync.now) })]), ...failed];
  return {
    ...(lines.length > 0 ? { tooltip: lines.map(escapeHtml).join('<br>') } : {}),
    ...(failed.length > 0 ? { alert: t('entities.participant.syncFailed') } : {}),
  };
}

/**
 * The people filter: each person's colour next to the name, and everyone's on «Whole family» — charts and tables coloured
 * by person read against this header. With `sync`: a person's tooltip says when they were last updated and which of their
 * connections did not update; such a person gets a warning dot.
 */
export function filterOptions(people: ReadonlyArray<Readonly<PersonView>>, sync?: Readonly<FilterSync>): SegmentOption<number>[] {
  return [
    { label: t('entities.participant.family'), value: FAMILY, colors: people.map((p) => colorVar(p.color)) },
    ...people.map((p) => ({ label: p.label, value: p.id, colors: [colorVar(p.color)], ...(sync ? syncHints(p, sync) : {}) })),
  ];
}
