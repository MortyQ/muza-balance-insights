// Pure helpers of the category and income screens in main (DataService.categoryOverview / incomeOverview): the bank's
// text made fit for the screen, and what the screen counts from the lines (where, who; «When» the screen counts itself).
import type { CategoryLineView, CategoryOverview, IncomeAmounts, IncomeLineView, IncomeOverview, IncomeSourceId, SpendingAmounts } from '../shared/api.ts';

/** A masked card number (6 digits, stars, 4 digits) anywhere in the text. */
const CARD_PAN = /\d{6}\*+(\d{4})/g;
const HIDDEN = '•••';

/**
 * The bank's description as the screen shows it: a card number cut to its last 4 digits, the user's jar titles hidden
 * (as on the balance cards: a jar is named by its currency only), spaces trimmed.
 */
export function merchantText(description: string, jarTitles: Iterable<string>): string {
  let d = description.trim();
  for (const title of jarTitles) if (title) d = d.split(title).join(HIDDEN);
  return d.replace(CARD_PAN, '•• $1');
}

/** Merchants are told apart case- and space-insensitively. */
export const merchantKey = (s: string): string => s.toLocaleLowerCase('uk').replace(/\s+/g, ' ').trim();

/** A line that is spending (a purchase or a commission), not a refund. */
export const isSpending = (l: Pick<CategoryLineView, 'amount'>): boolean => l.amount < 0;

/** The middle value; for an even count the mean of the two middle ones, rounded to a kopeck. */
function middle(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

export type LineStats = Pick<CategoryOverview, 'merchants' | 'people'> &
  Pick<CategoryOverview['summary'], 'median' | 'activeDays' | 'largest' | 'cashback' | 'cashbackLines'>;

/**
 * What the screen counts from the lines, in hryvnia kopecks (a line without a rate counts nowhere): net = spending −
 * refunds, purchases = spending lines. `people` only when asked (the family view with more than one person), in the
 * given order.
 */
export function lineStats(lines: readonly CategoryLineView[], people: readonly number[] | null): LineStats {
  const byPerson = new Map<number, SpendingAmounts>((people ?? []).map((id) => [id, { net: 0, purchases: 0 }]));
  const merchants = new Map<string, SpendingAmounts & { spellings: Map<string, number> }>();
  const spent: number[] = [];
  const active = new Set<string>();
  let largest: { key: string; uah: number } | null = null;
  let cashback = 0;
  let cashbackLines = 0;

  for (const l of lines) {
    if (l.uah === null) continue;
    const net = -l.uah;
    const spend = isSpending(l);
    const p = byPerson.get(l.participantId);
    if (p) (p.net += net), (p.purchases += spend ? 1 : 0);
    const key = merchantKey(l.merchant);
    const m = merchants.get(key) ?? { net: 0, purchases: 0, spellings: new Map<string, number>() };
    m.net += net;
    m.purchases += spend ? 1 : 0;
    m.spellings.set(l.merchant, (m.spellings.get(l.merchant) ?? 0) + 1);
    merchants.set(key, m);
    if (spend) {
      spent.push(-l.uah);
      active.add(l.date);
      if (!largest || -l.uah > largest.uah) largest = { key: l.key, uah: -l.uah };
    }
    if (l.cashback > 0) (cashback += l.cashback), (cashbackLines += 1);
  }

  // The most frequent spelling names a merchant; a tie → the first seen (lines come newest first).
  const name = (spellings: Map<string, number>) => [...spellings].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  return {
    merchants: [...merchants.values()]
      .filter((m) => m.net > 0)
      .map((m) => ({ name: name(m.spellings), net: m.net, purchases: m.purchases }))
      .sort((a, b) => b.net - a.net || (a.name < b.name ? -1 : 1)),
    people: people ? people.map((participantId) => ({ participantId, ...byPerson.get(participantId)! })) : [],
    median: middle(spent),
    activeDays: active.size,
    largest: largest?.key ?? null,
    cashback,
    cashbackLines,
  };
}

/**
 * The 12 months of «Last 12 months», oldest first: up to the current month while the picked one is among its last 12
 * (the picked month and what came after it, to today), else up to the picked month.
 */
export function monthsWindow(month: string, thisMonth: string): string[] {
  const window = last12Months(thisMonth);
  return window.includes(month) ? window : last12Months(month);
}

/** The 12 months ending with `month`, oldest first. */
export function last12Months(month: string): string[] {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 12 + i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  });
}

export type IncomeStats = Pick<IncomeOverview, 'people' | 'sources' | 'senders'> &
  Pick<IncomeOverview['summary'], 'median' | 'activeDays' | 'largest'>;

/**
 * What the income screen counts from its lines, in hryvnia kopecks (a line without a rate counts nowhere). Senders
 * are told apart as merchants are; `people` only when asked (the family view), in the given order.
 */
export function incomeStats(lines: readonly IncomeLineView[], people: readonly number[] | null): IncomeStats {
  const byPerson = new Map<number, IncomeAmounts>((people ?? []).map((id) => [id, { total: 0, lines: 0 }]));
  const bySource = new Map<IncomeSourceId, IncomeAmounts>();
  const senders = new Map<string, IncomeAmounts & { spellings: Map<string, number> }>();
  const values: number[] = [];
  const active = new Set<string>();
  let largest: { key: string; uah: number } | null = null;

  const add = (a: IncomeAmounts, uah: number) => ((a.total += uah), (a.lines += 1));
  for (const l of lines) {
    if (l.uah === null) continue;
    const p = byPerson.get(l.participantId);
    if (p) add(p, l.uah);
    const s = bySource.get(l.source) ?? { total: 0, lines: 0 };
    add(s, l.uah);
    bySource.set(l.source, s);
    const key = merchantKey(l.sender);
    const m = senders.get(key) ?? { total: 0, lines: 0, spellings: new Map<string, number>() };
    add(m, l.uah);
    m.spellings.set(l.sender, (m.spellings.get(l.sender) ?? 0) + 1);
    senders.set(key, m);
    values.push(l.uah);
    active.add(l.date);
    if (!largest || l.uah > largest.uah) largest = { key: l.key, uah: l.uah };
  }

  const name = (spellings: Map<string, number>) => [...spellings].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  return {
    people: people ? people.map((participantId) => ({ participantId, ...byPerson.get(participantId)! })) : [],
    sources: [...bySource].map(([source, a]) => ({ source, ...a })).sort((a, b) => b.total - a.total || (a.source < b.source ? -1 : 1)),
    senders: [...senders.values()]
      .map((m) => ({ name: name(m.spellings), total: m.total, lines: m.lines }))
      .sort((a, b) => b.total - a.total || (a.name < b.name ? -1 : 1)),
    median: middle(values),
    activeDays: active.size,
    largest: largest?.key ?? null,
  };
}
