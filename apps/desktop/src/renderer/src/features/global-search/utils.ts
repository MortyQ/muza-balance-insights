import type { ProviderId, RatesView, SearchOverview, SearchOverviewQuery } from '@contract/api.ts';
import type { CategoryId } from '@contract/categories.ts';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { categoryLink, ROUTE } from '@/shared/config';
import { dayMonthName, formatMoney, monthOf, t, type ParsedSearch } from '@/shared/lib';
import { CATEGORIES_MAX, GROUPS, SEARCHABLE_CATEGORIES } from './constants.ts';
import type { SearchGroupView, SearchItemView } from './types.ts';

const UAH = 980;

/**
 * The amount typed in the main currency as a range of hryvnia kopecks, ±1 of it (spec: «250» → 249–251), by today's
 * rate of the main currency; without that rate the screen shows hryvnia, so the amount is hryvnia too.
 */
export function amountRange(amount: number, rates: RatesView | null, main: number): { min: number; max: number } {
  const rate = main === UAH ? 1 : (rates?.list.find((r) => r.currency === main)?.rate ?? 1);
  return { min: Math.max(0, Math.round((amount - 1) * 100 * rate)), max: Math.round((amount + 1) * 100 * rate) };
}

/** What to ask main for the parsed input in the view; null — nothing to search for. */
export function searchQueryOf(
  p: Readonly<ParsedSearch>,
  rates: RatesView | null,
  main: number,
  view: { participantId: number | null; providers?: ProviderId[] },
): SearchOverviewQuery | null {
  if (p.text === '' && p.amount === null && p.from === null) return null;
  return {
    query: p.text,
    ...(p.from !== null && p.to !== null ? { from: p.from, to: p.to } : {}),
    ...(p.amount !== null ? { amount: amountRange(p.amount, rates, main) } : {}),
    ...(view.participantId !== null ? { participantId: view.participantId } : {}),
    ...(view.providers ? { providers: view.providers } : {}),
  };
}

/** The categories whose name in the interface language contains the text. */
export function categoryHits(text: string): CategoryId[] {
  const needle = text.toLocaleLowerCase().trim();
  if (needle === '') return [];
  return SEARCHABLE_CATEGORIES.filter((id) => categoryName({ category: id, categoryId: id }).toLocaleLowerCase().includes(needle)).slice(0, CATEGORIES_MAX);
}

/** «5 Oct – 11 Oct · 250 ₴ ± 1»: what the input was taken as; '' — plain text. */
export function understoodText(p: Readonly<ParsedSearch>, fmt: MoneyFormat, thisYear: number): string {
  const parts: string[] = [];
  if (p.from !== null && p.to !== null) {
    const from = dayMonthName(p.from, thisYear);
    parts.push(p.from === p.to ? from : t('search.range', { from, to: dayMonthName(p.to, thisYear) }));
  }
  if (p.amount !== null) parts.push(t('search.amount', { amount: formatMoney(Math.round(p.amount * 100), fmt.currency) }));
  return parts.join(' · ');
}

const money = (uah: number | null, amount: number, currency: number, fmt: MoneyFormat) =>
  uah === null ? formatMoney(Math.abs(amount), currency) : fmt.money(Math.abs(uah));

/** The answer and the categories found by name as the listed groups; an empty group is left out. */
export function searchGroups(v: Readonly<SearchOverview> | null, categories: ReadonlyArray<CategoryId>, fmt: MoneyFormat, thisYear: number): SearchGroupView[] {
  const items: Record<SearchGroupView['id'], SearchItemView[]> = { transactions: [], payees: [], categories: [], recurring: [] };
  for (const l of v?.transactions ?? []) {
    if (!l.categoryId) continue;
    const category = categoryName(l);
    const m = money(l.uah, l.amount, l.currency, fmt);
    items.transactions.push({
      id: `transactions:${l.key}`,
      group: 'transactions',
      icon: CATEGORY_ICON[l.categoryId],
      title: l.merchant || category,
      caption: `${category} · ${dayMonthName(l.date, thisYear)}, ${l.time}`,
      amount: l.refund ? `+${m}` : m,
      also: l.uah === null ? [] : fmt.alsoFor(l.uah, [{ amount: l.amount, currency: l.currency }]),
      incoming: l.refund,
      // The list opens searched by the transaction's text: it is among the lines shown.
      to: categoryLink(l.categoryId, l.scope, undefined, { q: l.merchant }),
      month: monthOf(l.date),
    });
  }
  for (const p of v?.payees ?? []) {
    if (!p.categoryId) continue;
    items.payees.push({
      id: `payees:${p.key}`,
      group: 'payees',
      icon: CATEGORY_ICON[p.categoryId],
      title: p.name,
      caption: `${categoryName(p)} · ${t('search.lines', p.lines)}`,
      amount: p.net > 0 ? fmt.money(p.net) : '',
      also: [],
      incoming: false,
      to: categoryLink(p.categoryId, p.scope, undefined, { merchant: p.key }),
      month: monthOf(`${p.month}-01`),
    });
  }
  for (const id of categories) {
    items.categories.push({
      id: `categories:${id}`,
      group: 'categories',
      icon: CATEGORY_ICON[id],
      title: categoryName({ category: id, categoryId: id }),
      caption: '',
      amount: '',
      also: [],
      incoming: false,
      to: categoryLink(id, 'personal'),
      month: null,
    });
  }
  for (const r of v?.recurring ?? []) {
    const category = categoryName(r);
    items.recurring.push({
      id: `recurring:${r.key}`,
      group: 'recurring',
      icon: CATEGORY_ICON[r.categoryId ?? 'other'],
      title: r.name || category,
      caption: `${category} · ${t(r.active ? 'search.active' : 'search.ended')}`,
      amount: money(r.uah, r.amount, r.currency, fmt),
      also: [],
      incoming: false,
      to: { name: ROUTE.recurring },
      month: null,
    });
  }
  return GROUPS.filter((g) => items[g.id].length > 0).map((g) => ({ id: g.id, title: t(g.title), items: items[g.id] }));
}
