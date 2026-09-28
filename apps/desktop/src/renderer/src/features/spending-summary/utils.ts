import type { SpendingCurrency, SpendingLine, SpendingView } from '@contract/api.ts';
import { formatMoney, shortDate, t } from '@/shared/lib';
import type { TableColumn, TableFooterCell } from '@/shared/ui';

/** Why the numbers may be partial or empty; null when the month is complete. */
export function periodNote(p: Readonly<SpendingView['period']>): string | null {
  if (p.dataUntil === null) return t('home.spending.noData');
  if (p.dataUntil < p.from) return t('home.spending.notYet', { date: shortDate(p.dataUntil) });
  if (!p.incomplete) return null;
  return t('home.spending.partial', { date: shortDate(p.dataUntil) });
}

/** Bar length: share of the largest net in that currency (refund-only categories draw no bar). */
export function share(net: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, (net / max) * 100)) : 0;
}

/** A category the core no longer has comes as its bare word: shown capitalised. */
export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('uk') + s.slice(1);
}

export function categoryName(line: Readonly<SpendingLine>): string {
  return line.categoryId ? t(`home.spending.category.${line.categoryId}`) : capitalize(line.category);
}

const refundsText = (amount: number, currency: number) => (amount ? formatMoney(amount, currency) : '—');

/** Columns of one currency's table; `share` is drawn by the feature (a bar), the rest is text. */
export function spendingColumns(currency: number): TableColumn<SpendingLine>[] {
  return [
    { key: 'category', label: t('home.spending.column.category'), value: (r) => categoryName(r) },
    { key: 'share', label: t('home.spending.column.share'), hideLabel: true, width: '34%' },
    { key: 'gross', label: t('home.spending.column.gross'), align: 'end', tone: 'secondary', value: (r) => formatMoney(r.gross, currency) },
    { key: 'refunds', label: t('home.spending.column.refunds'), align: 'end', tone: 'secondary', value: (r) => refundsText(r.refunds, currency) },
    { key: 'net', label: t('home.spending.column.net'), align: 'end', strong: true, value: (r) => formatMoney(r.net, currency) },
  ];
}

export function spendingFooter(c: Readonly<SpendingCurrency>): TableFooterCell[] {
  return [
    { text: t('home.spending.total'), colspan: 2 },
    { text: formatMoney(c.total.gross, c.currency), align: 'end' },
    { text: refundsText(c.total.refunds, c.currency), align: 'end' },
    { text: formatMoney(c.total.net, c.currency), align: 'end' },
  ];
}
