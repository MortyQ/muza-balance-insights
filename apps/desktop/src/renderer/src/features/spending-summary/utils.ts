import type { SpendingView } from '@contract/api.ts';
import { shortDate } from '@/shared/lib';

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
