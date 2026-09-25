import type { SpendingCurrency, SpendingLine, SpendingView } from '@contract/api.ts';
import { formatMoney, shortDate } from '@/shared/lib';
import type { TableColumn, TableFooterCell } from '@/shared/ui';

/** Why the numbers may be partial or empty; null when the month is complete. */
export function periodNote(p: Readonly<SpendingView['period']>): string | null {
  if (p.dataUntil === null) return 'Данных пока нет: загрузи выписку в разделе «Импорт».';
  if (p.dataUntil < p.from) return `Данные загружены только до ${shortDate(p.dataUntil)}: за этот месяц их ещё нет.`;
  if (!p.incomplete) return null;
  return `Месяц неполный: данные до ${shortDate(p.dataUntil)}, цифры ещё вырастут.`;
}

/** Bar length: share of the largest net in that currency (refund-only categories draw no bar). */
export function share(net: number, max: number): number {
  return max > 0 ? Math.max(0, Math.min(100, (net / max) * 100)) : 0;
}

/** Categories come lowercase from the core («продукты»); the table shows them capitalised. */
export function capitalize(s: string): string {
  return s.charAt(0).toLocaleUpperCase('uk') + s.slice(1);
}

const refundsText = (amount: number, currency: number) => (amount ? formatMoney(amount, currency) : '—');

/** Columns of one currency's table; `share` is drawn by the feature (a bar), the rest is text. */
export function spendingColumns(currency: number): TableColumn<SpendingLine>[] {
  return [
    { key: 'category', label: 'Категория', value: (r) => capitalize(r.category) },
    { key: 'share', label: 'Доля', hideLabel: true, width: '34%' },
    { key: 'gross', label: 'Брутто', align: 'end', tone: 'secondary', value: (r) => formatMoney(r.gross, currency) },
    { key: 'refunds', label: 'Возвраты', align: 'end', tone: 'secondary', value: (r) => refundsText(r.refunds, currency) },
    { key: 'net', label: 'Нетто', align: 'end', strong: true, value: (r) => formatMoney(r.net, currency) },
  ];
}

export function spendingFooter(c: Readonly<SpendingCurrency>): TableFooterCell[] {
  return [
    { text: 'Итого', colspan: 2 },
    { text: formatMoney(c.total.gross, c.currency), align: 'end' },
    { text: refundsText(c.total.refunds, c.currency), align: 'end' },
    { text: formatMoney(c.total.net, c.currency), align: 'end' },
  ];
}
