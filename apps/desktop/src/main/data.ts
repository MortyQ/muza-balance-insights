// Read side of the screen in main: the same core aggregates as the MCP tools (spendingSummary, balancesAt), mapped
// to the narrow view types of src/shared/api.ts. Only categories, amounts, dates and account name parts leave main —
// never names, descriptions, card numbers or IBANs. The import worker writes the same file; WAL lets both work.
import { ENABLED_ACCOUNT_IDS_SQL } from '@mono/core/accounts';
import { CATEGORY } from '@mono/core/categories';
import { ensureDefaultConnection } from '@mono/core/connections';
import { migrate, type Db } from '@mono/core/db';
import { listConnections, listParticipants } from '@mono/core/participants';
import type { ProviderId } from '@mono/core/providers/types';
import { kyivStartOfDay, toKyivDate, toKyivDateTime } from '@mono/core/format';
import { exchangeRates, toUah } from '@mono/core/fx';
import { balancesAt, firstDataDate, type BalancesAt } from '@mono/core/status';
import { incomeSummary, spendingSummary, type IncomeSummary, type SpendingSummary } from '@mono/core/summaries';
import { accountNames } from '../shared/account-name.ts';
import { labelPending } from './people.ts';
import { comparePeriod, foldByCategory, monthBounds, rankedCategories } from './spending.ts';
import { isoWeekday, shiftDate, sumAmounts, sumDays, usualDay, USUAL_WINDOW, weekDays } from './now.ts';
import type { CategoryId } from '../shared/categories.ts';
import type {
  CardTotal,
  DataStatus,
  FlowView,
  FxPart,
  MonthOverview,
  MonthOverviewQuery,
  NowOverview,
  NowOverviewQuery,
  OverviewAccount,
  SpendingAmounts,
  SpendingCategoryView,
  SpendingFx,
  SpendingOverview,
  SpendingOverviewQuery,
  SpendingPersonPart,
} from '../shared/api.ts';

/** The core's category word → its CATEGORY key, the id the renderer translates. */
const CATEGORY_ID: ReadonlyMap<string, CategoryId> = new Map(Object.entries(CATEGORY).map(([id, word]) => [word, id as CategoryId]));

/** Hryvnia — the currency the total card shows; other currencies are never summed with it. */
const UAH = 980;

/** The currencies the spending block can add «≈» lines in. */
const FX_CURRENCIES = [840, 978] as const;

/** `'2026-12'` → `'2027-01-01'`: the first day after the given month, UTC calendar arithmetic. */
function nextMonthStart(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

/** sync_state rows of imported, enabled accounts. */
const IMPORTED_ENABLED = `WHERE newest_synced_time IS NOT NULL AND account_id IN (${ENABLED_ACCOUNT_IDS_SQL})`;

export type DataServiceDeps = {
  open: () => Promise<Db>;
  /** After close: the files are deleted next (releaseClosedFiles — Windows holds them until collected). */
  release: () => Promise<unknown>;
  nowSec: () => number;
};

export class DataService {
  private db: Promise<Db> | null = null;

  constructor(private readonly d: DataServiceDeps) {}

  private conn(): Promise<Db> {
    if (this.db) return this.db;
    const opening = this.d.open().then(async (db) => {
      try {
        await migrate(db, this.d.nowSec());
      } catch (err) {
        db.close();
        throw err;
      }
      return db;
    });
    this.db = opening;
    // A failed open is not cached: the next call tries again.
    opening.catch(() => {
      if (this.db === opening) this.db = null;
    });
    return opening;
  }

  /** The migrated connection, for the other services of main (people.ts, integrations.ts). */
  database(): Promise<Db> {
    return this.conn();
  }

  /**
   * Balances at the end of `q.month` (or now, for the current month), plus income and spending of that month — the
   * same core aggregates as spendingSummary, no scope filter. Without `participantId` — the whole family, plus each
   * person's own view of transfers; with it — that person's accounts.
   */
  async monthOverview(q: MonthOverviewQuery): Promise<MonthOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const { from, to } = monthBounds(q.month);
    const endSec = kyivStartOfDay(nextMonthStart(q.month));
    const current = endSec > now;
    const status = await this.status();
    const first = status.dataFrom;
    const period = { from, to };
    // The month's rates are the family's (a market fact, not a person's): one lookup for every card.
    const rates = await exchangeRates(db, period);
    // Every currency folded into hryvnia; a currency without a rate stays out of the sums, listed in fx.
    const flowOf = (inc: IncomeSummary, sp: SpendingSummary): FlowView & { fx: FxPart[] } => {
      const currencies = [...new Set([...inc.totals.map((t) => t.currency), ...sp.totals.map((t) => t.currency)])].sort((a, b) => a - b);
      let income = 0;
      let spending = 0;
      const fx: FxPart[] = [];
      for (const c of currencies) {
        const i = inc.totals.find((t) => t.currency === c)?.total ?? 0;
        const s = sp.totals.find((t) => t.currency === c)?.net ?? 0;
        const iu = toUah(i, c, rates);
        const su = toUah(s, c, rates);
        if (iu !== null && su !== null) (income += iu), (spending += su);
        const r = rates.get(c);
        if (c !== UAH && (i !== 0 || s !== 0)) fx.push({ currency: c, income: i, spending: s, rate: r?.rate ?? null, nearest: r?.nearest ?? false });
      }
      return { income, spending, fx };
    };

    const cardTotal = async (participantId?: number): Promise<{ total: CardTotal; balances: BalancesAt }> => {
      const f = participantId === undefined ? {} : { participantId };
      const balances = await balancesAt(db, { endSec, ...f });
      const income = await incomeSummary(db, { ...period, groupBy: 'scope', ...f }, now);
      const spending = await spendingSummary(db, { ...period, groupBy: 'category', ...f }, now);
      return {
        balances,
        total: {
          ownFunds: balances.totals.find((t) => t.currency === UAH)?.own_funds ?? 0,
          others: balances.totals.filter((t) => t.currency !== UAH).map((t) => ({ currency: t.currency, ownFunds: t.own_funds })),
          missing: balances.missing,
          accounts: balances.accounts.length,
          ...flowOf(income, spending),
        },
      };
    };

    const head = await cardTotal(q.participantId);
    const coverageFrom = first !== null && first > from ? first : from;
    const coverageTo = status.dataUntil !== null && status.dataUntil.slice(0, 10) < to ? status.dataUntil.slice(0, 10) : to;
    // The month may have no covered day at all (before any data, or the account starts later): clamp so from ≤ to.
    const coverage = { from: coverageFrom, to: coverageTo < coverageFrom ? coverageFrom : coverageTo };
    const base = { month: q.month, balanceAt: current ? ('now' as const) : to, coverage, total: head.total };
    if (q.participantId === undefined) {
      const people: MonthOverview['people'] = [];
      for (const p of await listParticipants(db)) {
        people.push({ participantId: p.id, label: p.label, labelPending: labelPending(p), color: p.color, total: (await cardTotal(p.id)).total });
      }
      return { ...base, people, accounts: [] };
    }
    const f = { participantId: q.participantId };
    const inc = await incomeSummary(db, { ...period, groupBy: 'account', ...f }, now);
    const sp = await spendingSummary(db, { ...period, groupBy: 'account', ...f }, now);
    const types = new Map((await db.execute('SELECT id, type FROM accounts')).rows.map((r) => [String(r.id), r.type === null ? null : String(r.type)]));
    const names = accountNames(head.balances.accounts.map((a) => ({ id: a.id, kind: a.kind, type: types.get(a.id) ?? null, currency: a.currency })));
    const accounts: OverviewAccount[] = head.balances.accounts.map((a) => ({
      id: a.id,
      name: names.get(a.id) ?? { kind: a.kind, type: null, currency: a.currency, tag: null },
      kind: a.kind,
      currency: a.currency,
      creditLimit: a.credit_limit,
      ownFunds: a.own_funds,
      income: inc.groups.find((g) => g.key === a.id)?.total ?? 0,
      spending: sp.groups.find((g) => g.key === a.id)?.net ?? 0,
    }));
    return { ...base, people: [], accounts };
  }

  /**
   * The spending block: the month's categories in hryvnia (account currencies folded by the user's own exchanges),
   * spending lines, the compared period, and — for the whole family — each participant's part of every category.
   */
  async spendingOverview(q: SpendingOverviewQuery): Promise<SpendingOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const period = monthBounds(q.month);
    const status = await this.status();
    const summary = (p: { from: string; to: string }, participantId?: number) =>
      spendingSummary(db, { ...p, groupBy: 'category', scope: q.scope, ...(participantId !== undefined ? { participantId } : {}) }, now);

    const head = await summary(period, q.participantId);
    const compare = comparePeriod(q.month, head.period, status.dataFrom);
    const rates = await exchangeRates(db, period);
    // The previous period is folded by its own rates.
    const before = compare ? { period: compare, rates: await exchangeRates(db, compare) } : null;
    const cur = foldByCategory(head, rates);
    const prev = before ? foldByCategory(await summary(before.period, q.participantId), before.rates).byCategory : null;

    const zero: SpendingAmounts = { net: 0, purchases: 0 };
    const sum = (m: ReadonlyMap<string, SpendingAmounts>, keys: Iterable<string> = m.keys()): SpendingAmounts => {
      let net = 0;
      let purchases = 0;
      for (const k of keys) {
        const a = m.get(k);
        if (a) (net += a.net), (purchases += a.purchases);
      }
      return { net, purchases };
    };

    const participants = await listParticipants(db);
    const parts: Array<{ id: number; cur: Map<string, SpendingAmounts>; prev: Map<string, SpendingAmounts> | null }> = [];
    // The split only means something with more than one person: the only one's part would be the whole.
    if (q.participantId === undefined && participants.length > 1) {
      for (const p of participants) {
        parts.push({
          id: p.id,
          cur: foldByCategory(await summary(period, p.id), rates).byCategory,
          prev: before ? foldByCategory(await summary(before.period, p.id), before.rates).byCategory : null,
        });
      }
    }

    const categories: SpendingCategoryView[] = rankedCategories(cur.byCategory).map(([category, a]) => ({
      category,
      categoryId: CATEGORY_ID.get(category) ?? null,
      ...a,
      prev: prev ? (prev.get(category) ?? zero) : null,
      people: parts.map((p) => ({
        participantId: p.id,
        ...(p.cur.get(category) ?? zero),
        prev: p.prev ? (p.prev.get(category) ?? zero) : null,
      })),
    }));

    // A person's total is their sum over the family's categories: the people add up to the family's total.
    const people: SpendingPersonPart[] = parts.map((p) => ({
      participantId: p.id,
      ...sum(p.cur, cur.byCategory.keys()),
      prev: p.prev && prev ? sum(p.prev, prev.keys()) : null,
    }));

    const total = sum(cur.byCategory);
    const fx: SpendingFx[] = FX_CURRENCIES.map((c) => ({
      currency: c,
      rate: rates.get(c)?.rate ?? null,
      prevRate: before?.rates.get(c)?.rate ?? null,
      nearest: rates.get(c)?.nearest ?? false,
    }));
    const familyTotal =
      q.participantId !== undefined && participants.length > 1 ? sum(foldByCategory(await summary(period), rates).byCategory).net : null;

    const { from, to, days, incomplete, dataUntil, coveredDays, pendingHolds } = head.period;
    return {
      month: q.month,
      period: { from, to, days, incomplete, dataUntil, coveredDays, pendingHolds },
      compare,
      total: { ...total, prev: prev ? sum(prev) : null },
      people,
      categories,
      fx,
      leftOut: [...cur.leftOut].sort(([a], [b]) => a - b).map(([currency, net]) => ({ currency, net })),
      familyTotal,
    };
  }

  /**
   * The «Now» strip: today and this calendar week (Kyiv, from Monday) of the personal scope, folded into hryvnia by
   * this month's own exchange rates — the same core aggregate as the spending block. Main's clock decides «today».
   */
  async nowOverview(q: NowOverviewQuery): Promise<NowOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const today = toKyivDate(now);
    const weekday = isoWeekday(today);
    const monday = shiftDate(today, 1 - weekday);
    const windowFrom = shiftDate(today, -USUAL_WINDOW);
    const month = monthBounds(today.slice(0, 7));
    const { dataFrom } = await this.status();
    const summary = (p: { from: string; to: string }, groupBy: 'day' | 'category') =>
      spendingSummary(db, { ...p, groupBy, scope: 'personal', ...(q.participantId !== undefined ? { participantId: q.participantId } : {}) }, now);

    const rates = await exchangeRates(db, month);
    const daily = await summary({ from: windowFrom, to: today }, 'day');
    const week = await summary({ from: monday, to: today }, 'category');
    // foldByCategory folds by the group key — here the Kyiv day.
    const byDay = foldByCategory(daily, rates).byCategory;
    const weekByCategory = foldByCategory(week, rates).byCategory;
    const monthRanked = rankedCategories(foldByCategory(await summary(month, 'category'), rates).byCategory);

    // The usual day reads only the days the data covers: from its first date to the last fully synced day.
    const lastCovered = daily.period.coveredDays > 0 ? shiftDate(windowFrom, daily.period.coveredDays - 1) : null;
    const yesterday = shiftDate(today, -1);
    const usualFrom = dataFrom === null ? null : dataFrom > windowFrom ? dataFrom : windowFrom;
    const usualTo = lastCovered === null ? null : lastCovered < yesterday ? lastCovered : yesterday;
    const prevFrom = shiftDate(monday, -7);
    const top = rankedCategories(weekByCategory)[0];
    const rank = top ? monthRanked.findIndex(([k]) => k === top[0]) : -1;

    return {
      date: today,
      weekday,
      dataUntil: daily.period.dataUntil,
      today: byDay.get(today) ?? { net: 0, purchases: 0 },
      usualDay: usualFrom !== null && usualTo !== null ? usualDay(byDay, usualFrom, usualTo) : null,
      week: {
        from: monday,
        days: weekDays(byDay, monday, today),
        total: sumAmounts(weekByCategory.values()),
        prev: dataFrom !== null && dataFrom <= prevFrom ? sumDays(byDay, prevFrom, shiftDate(today, -7)).net : null,
        top: top ? { category: top[0], categoryId: CATEGORY_ID.get(top[0]) ?? null, ...top[1], rank: rank >= 0 ? rank : null } : null,
        pendingHolds: week.period.pendingHolds,
      },
      fx: FX_CURRENCIES.map((c) => ({ currency: c, rate: rates.get(c)?.rate ?? null, prevRate: null, nearest: rates.get(c)?.nearest ?? false })),
    };
  }

  /** Enabled accounts only (a disabled one is in no statistic): `dataUntil` agrees with `dataFrom`. */
  async status(): Promise<DataStatus> {
    const db = await this.conn();
    const rs = await db.execute(
      `SELECT COUNT(*) AS n, MIN(newest_synced_time) AS newest, MAX(last_sync_at) AS last FROM sync_state ${IMPORTED_ENABLED}`,
    );
    const r = rs.rows[0];
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    const newest = num(r?.newest);
    const last = num(r?.last);
    return {
      hasData: Number(r?.n ?? 0) > 0,
      dataUntil: newest === null ? null : toKyivDateTime(newest),
      dataFrom: await firstDataDate(db),
      lastSyncAt: last === null ? null : toKyivDateTime(last),
    };
  }

  /** Epoch seconds of the latest sync of any enabled account; null — nothing imported yet (the «Автосинхронизация» gap). */
  async lastSyncSec(): Promise<number | null> {
    const rs = await (await this.conn()).execute(`SELECT MAX(last_sync_at) AS last FROM sync_state ${IMPORTED_ENABLED}`);
    const last = rs.rows[0]?.last;
    return last === null || last === undefined ? null : Number(last);
  }

  /** Every connection (the import takes them all). */
  async connections(): Promise<Array<{ connectionId: number; provider: ProviderId }>> {
    return (await listConnections(await this.conn())).map((c) => ({ connectionId: c.id, provider: c.provider }));
  }

  /** The only Monobank connection (created with «Я» if there is none): the owner of an older version's token.bin. */
  async legacyConnection(): Promise<number> {
    return ensureDefaultConnection(await this.conn(), 'monobank', this.d.nowSec());
  }

  /** Closes the connection (before the files are deleted). The next call opens a fresh database. */
  async close(): Promise<void> {
    const db = this.db;
    this.db = null;
    if (db) {
      try {
        (await db).close();
      } catch {
        // Never opened: nothing to close.
      }
    }
    // Also when nothing was open here: the database may have been opened and closed elsewhere (DbAccess checks).
    await this.d.release();
  }
}
