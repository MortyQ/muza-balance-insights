// Rates of foreign currencies from the user's own exchanges: the hryvnia side of a pair_fx row holds both amounts.
import { ENABLED_ACCOUNT_IDS_SQL, crossesDisabledSql } from './accounts.ts';
import type { Db } from './db.ts';
import { kyivStartOfDay, parseLocalDate } from './format.ts';

const UAH = 980;

export type FxRate = { rate: number; nearest: boolean };

type Ex = { currency: number; time: number; date: string; uah: number; minor: number; sale: boolean };

/**
 * Hryvnia kopecks per minor unit of each currency for the month [from, to] (Kyiv local_date). Sales (hryvnia in) are
 * the source; purchases only for a currency that was never sold. The month's sales weighted by amount, else the one
 * nearest in time — distance in seconds to the month's Kyiv bounds, a tie → the earlier `time` —, nearest = true.
 * Enabled accounts only, and not an exchange with a disabled account (accounts.ts: that is no longer an own exchange).
 */
export async function exchangeRates(db: Db, q: { from: string; to: string }): Promise<Map<number, FxRate>> {
  const rs = await db.execute({
    sql: `SELECT t.currency_code AS currency, t.time, t.local_date, t.amount, t.operation_amount
          FROM transactions t JOIN accounts a ON a.id = t.account_id
          WHERE t.is_cancelled = 0 AND t.transfer_rule = 'pair_fx' AND a.currency_code = ?
            AND t.currency_code <> ? AND t.operation_amount <> 0 AND t.amount <> 0
            AND t.account_id IN (${ENABLED_ACCOUNT_IDS_SQL}) AND NOT ${crossesDisabledSql('t')}`,
    args: [UAH, UAH],
  });
  const byCurrency = new Map<number, Ex[]>();
  for (const r of rs.rows) {
    const e: Ex = {
      currency: Number(r.currency), time: Number(r.time), date: String(r.local_date),
      uah: Math.abs(Number(r.amount)), minor: Math.abs(Number(r.operation_amount)), sale: Number(r.amount) > 0,
    };
    let list = byCurrency.get(e.currency);
    if (!list) { list = []; byCurrency.set(e.currency, list); }
    list.push(e);
  }
  const out = new Map<number, FxRate>();
  for (const [currency, all] of byCurrency) {
    const sales = all.filter((e) => e.sale);
    const pool = sales.length > 0 ? sales : all;
    const inMonth = pool.filter((e) => e.date >= q.from && e.date <= q.to);
    if (inMonth.length > 0) {
      const uah = inMonth.reduce((s, e) => s + e.uah, 0);
      const minor = inMonth.reduce((s, e) => s + e.minor, 0);
      out.set(currency, { rate: uah / minor, nearest: false });
      continue;
    }
    // Distance in seconds to the month's Kyiv bounds: before it → from's start − time, after it → time − dayAfter(to)'s start.
    const gap = (e: Ex) => (e.date < q.from ? kyivStartOfDay(q.from) - e.time : e.time - kyivStartOfDay(dayAfter(q.to)));
    const best = [...pool].sort((x, y) => gap(x) - gap(y) || x.time - y.time)[0];
    if (best) out.set(currency, { rate: best.uah / best.minor, nearest: true });
  }
  return out;
}

function dayAfter(date: string): string {
  const p = parseLocalDate(date)!;
  return new Date(Date.UTC(p.y, p.m - 1, p.d + 1)).toISOString().slice(0, 10);
}

/** Minor units of `currency` in hryvnia kopecks; hryvnia as is; null — no rate. */
export function toUah(minor: number, currency: number, rates: ReadonlyMap<number, FxRate>): number | null {
  if (currency === UAH) return minor;
  const r = rates.get(currency);
  return r ? Math.round(minor * r.rate) : null;
}
