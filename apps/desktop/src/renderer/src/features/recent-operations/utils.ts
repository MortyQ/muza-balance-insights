import type { RecentOperations, Scope } from '@contract/api.ts';
import { CATEGORY_ICON, categoryName } from '@/entities/category';
import type { MoneyFormat } from '@/entities/currency-display';
import { categoryLink } from '@/shared/config';
import { formatMoney, shortDate } from '@/shared/lib';
import type { RecentRowView } from './types.ts';

/** The answer's lines as rows: a spending amount without its minus, a refund with «+»; the category screen per row. */
export function recentRows(v: RecentOperations, fmt: MoneyFormat, scope: Scope): RecentRowView[] {
  return v.lines.map((l) => {
    const category = categoryName({ category: l.category, categoryId: l.categoryId });
    const money = l.uah === null ? formatMoney(Math.abs(l.amount), l.currency) : fmt.money(Math.abs(l.uah));
    return {
      key: l.key,
      icon: CATEGORY_ICON[l.categoryId ?? 'rest'],
      name: l.merchant || category,
      caption: `${category} · ${shortDate(`${l.date} ${l.time}`)}`,
      amount: l.refund ? `+${money}` : money,
      also: l.uah === null ? [] : fmt.alsoFor(l.uah, [{ amount: l.amount, currency: l.currency }]),
      refund: l.refund,
      pending: l.pending,
      to: l.categoryId ? categoryLink(l.categoryId, scope) : null,
    };
  });
}
