// Read side of the screen in main: the same core aggregates as the MCP tools (spendingSummary, balancesAt), mapped
// to the narrow view types of src/shared/api.ts. Only categories, amounts, dates and account name parts leave main —
// never names, card numbers or IBANs; descriptions only in categoryOverview's lines (the category screen). The import worker writes the same file; WAL lets both work.
import { ENABLED_ACCOUNT_IDS_SQL } from '@mono/core/accounts';
import { CATEGORY } from '@mono/core/categories';
import { categoryLines } from '@mono/core/category-lines';
import { ensureDefaultConnection } from '@mono/core/connections';
import { RESYNC_OVERLAP_SEC } from '@mono/core/constants';
import { migrate, type Db } from '@mono/core/db';
import { listConnections, listParticipants } from '@mono/core/participants';
import type { ProviderId } from '@mono/core/providers/types';
import { startOfDayIn } from '@mono/core/format';
import { toUah, type FxRate } from '@mono/core/fx';
import { balancesAt, firstDataDate, type BalancesAt } from '@mono/core/status';
import { incomeSummary, spendingSummary, type IncomeSummary, type SpendingSummary } from '@mono/core/summaries';
import { accountNames } from '../shared/account-name.ts';
import { localDate, localDateTime, systemTimeZone } from '../shared/dates.ts';
import { labelPending } from './people.ts';
import { comparePeriod, foldByCategory, monthBounds, rankedCategories } from './spending.ts';
import { lineStats, merchantText, monthsWindow } from './category.ts';
import { isoWeekday, shiftDate, sumAmounts, sumDays, usualDay, USUAL_WINDOW, weekDays } from './now.ts';
import type { CategoryId } from '../shared/categories.ts';
import type {
  CardTotal,
  CategoryLineView,
  CategoryOverview,
  CategoryOverviewQuery,
  DataStatus,
  FlowView,
  FxPart,
  MonthOverview,
  MonthOverviewQuery,
  NowOverview,
  NowOverviewQuery,
  OverviewAccount,
  SpendingAmounts,
  RatesView,
  SpendingCategoryView,
  SpendingOverview,
  SpendingOverviewQuery,
  SpendingPersonPart,
} from '../shared/api.ts';

/** The core's category word → its CATEGORY key, the id the renderer translates. */
const CATEGORY_ID: ReadonlyMap<string, CategoryId> = new Map(Object.entries(CATEGORY).map(([id, word]) => [word, id as CategoryId]));

/** Hryvnia — the currency the total card shows; other currencies are never summed with it. */
const UAH = 980;

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
  /** Today's rates (RatesService.current); null — never fetched. */
  rates: () => Promise<RatesView | null>;
};

/** Today's rates as the core's fold expects them (one rate for every period). */
function rateMap(r: RatesView | null): Map<number, FxRate> {
  return new Map((r?.list ?? []).map((x) => [x.currency, { rate: x.rate, nearest: false }]));
}

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
    // The month's end as an instant in the user's zone: the balance, «current» and the sums follow the user's calendar.
    const tz = systemTimeZone();
    const endSec = startOfDayIn(nextMonthStart(q.month), tz);
    const current = endSec > now;
    const status = await this.status();
    const first = status.dataFrom;
    const period = { from, to, tz };
    // Today's rates are the family's (a market fact, not a person's): one snapshot for every card.
    const today = await this.d.rates();
    const rates = rateMap(today);
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
        if (c !== UAH && (i !== 0 || s !== 0)) fx.push({ currency: c, income: i, spending: s, rate: rates.get(c)?.rate ?? null });
      }
      return { income, spending, fx };
    };

    const cardTotal = async (participantId?: number): Promise<{ total: CardTotal; balances: BalancesAt }> => {
      const f = participantId === undefined ? {} : { participantId };
      const balances = await balancesAt(db, { endSec, ...f });
      const income = await incomeSummary(db, { ...period, groupBy: 'scope', ...f }, now);
      const spending = await spendingSummary(db, { ...period, groupBy: 'category', ...f }, now);
      const others = balances.totals
        .filter((t) => t.currency !== UAH)
        .map((t) => ({ currency: t.currency, ownFunds: t.own_funds, rate: rates.get(t.currency)?.rate ?? null }));
      // A foreign part without a rate stays out of ownFunds (others says so with rate null).
      const folded = others.reduce((s, o) => s + (toUah(o.ownFunds, o.currency, rates) ?? 0), 0);
      return {
        balances,
        total: {
          ownFunds: (balances.totals.find((t) => t.currency === UAH)?.own_funds ?? 0) + folded,
          others,
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
      return { ...base, people, accounts: [], rates: today };
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
    return { ...base, people: [], accounts, rates: today };
  }

  /**
   * The spending block: the month's categories in hryvnia (account currencies folded by today's rates),
   * spending lines, the compared period, and — for the whole family — each participant's part of every category.
   */
  async spendingOverview(q: SpendingOverviewQuery): Promise<SpendingOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const period = monthBounds(q.month);
    const status = await this.status();
    const tz = systemTimeZone();
    const summary = (p: { from: string; to: string }, participantId?: number) =>
      spendingSummary(db, { ...p, tz, groupBy: 'category', scope: q.scope, ...(participantId !== undefined ? { participantId } : {}) }, now);

    const head = await summary(period, q.participantId);
    const compare = comparePeriod(q.month, head.period, status.dataFrom);
    const today = await this.d.rates();
    const rates = rateMap(today);
    // The previous period is folded by the same rate: the change shows spending, not the exchange rate.
    const before = compare ? { period: compare, rates } : null;
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
      rates: today,
      leftOut: [...cur.leftOut].sort(([a], [b]) => a - b).map(([currency, net]) => ({ currency, net })),
      familyTotal,
    };
  }

  /**
   * The category screen: one category's month — its figure as the spending block counts it, the 12 months before,
   * and every line behind it with the bank's description and comment (the one answer that carries them).
   */
  async categoryOverview(q: CategoryOverviewQuery): Promise<CategoryOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const tz = systemTimeZone();
    const category = CATEGORY[q.category];
    const period = monthBounds(q.month);
    const status = await this.status();
    const filters = { tz, scope: q.scope, ...(q.participantId !== undefined ? { participantId: q.participantId } : {}) };
    const today = await this.d.rates();
    const rates = rateMap(today);

    // The figure, the share and the rank exactly as the spending block folds them.
    const head = await spendingSummary(db, { ...period, ...filters, groupBy: 'category' }, now);
    const folded = foldByCategory(head, rates);
    const ranked = rankedCategories(folded.byCategory);
    const mine = folded.byCategory.get(category) ?? { net: 0, purchases: 0 };
    const scopeNet = ranked.reduce((s, [, a]) => s + a.net, 0);
    const place = ranked.findIndex(([k]) => k === category);
    let gross = 0;
    let refunds = 0;
    const leftOut: Array<{ currency: number; net: number }> = [];
    for (const g of head.groups.filter((x) => x.key === category)) {
      const gu = toUah(g.gross, g.currency, rates);
      const ru = toUah(g.refunds, g.currency, rates);
      if (gu === null || ru === null) leftOut.push({ currency: g.currency, net: g.net });
      else (gross += gu), (refunds += ru);
    }
    const compare = comparePeriod(q.month, head.period, status.dataFrom);
    const prev = compare
      ? (foldByCategory(await spendingSummary(db, { ...compare, ...filters, groupBy: 'category', category }, now), rates).byCategory.get(category) ?? { net: 0, purchases: 0 })
      : null;

    const thisMonth = localDate(now * 1000, tz).slice(0, 7);
    const months12 = monthsWindow(q.month, thisMonth);
    const history = await spendingSummary(db, { from: `${months12[0]}-01`, to: monthBounds(months12.at(-1)!).to, ...filters, groupBy: 'month', category }, now);
    const byMonth = new Map<string, number>();
    for (const g of history.groups) {
      const u = toUah(g.net, g.currency, rates);
      if (u !== null) byMonth.set(g.key, (byMonth.get(g.key) ?? 0) + u);
    }
    const firstMonth = status.dataFrom?.slice(0, 7) ?? null;
    const months = months12.map((month) => ({ month, net: firstMonth === null || month < firstMonth ? null : (byMonth.get(month) ?? 0) }));

    const accounts = (await db.execute('SELECT id, kind, type, currency_code, title FROM accounts')).rows;
    const names = accountNames(accounts.map((r) => ({ id: String(r.id), kind: String(r.kind), type: r.type === null ? null : String(r.type), currency: Number(r.currency_code) })));
    const jarTitles = accounts.filter((r) => r.kind === 'jar' && r.title).map((r) => String(r.title).trim());
    const raw = await categoryLines(db, { ...period, ...filters, category }, now);
    const lines: CategoryLineView[] = raw.lines.map((l) => {
      const [date, time] = localDateTime(l.time * 1000, tz).split(' ') as [string, string];
      return {
        key: l.kind === 'body' ? l.id : `${l.id}:fee`,
        date,
        time,
        weekday: isoWeekday(date),
        merchant: merchantText(l.description, jarTitles),
        comment: l.comment?.trim() || null,
        participantId: l.participantId,
        account: names.get(l.accountId) ?? { kind: 'card', type: null, currency: l.currency, tag: null },
        uah: toUah(l.amount, l.currency, rates),
        currency: l.currency,
        amount: l.amount,
        operation:
          l.operationCurrency !== null && l.operationAmount !== null && l.operationCurrency !== l.currency
            ? { currency: l.operationCurrency, amount: l.operationAmount }
            : null,
        commission: l.kind === 'commission',
        hold: l.hold,
        pending: l.hold && l.time >= now - RESYNC_OVERLAP_SEC,
        refund: l.amount > 0,
        refunded: l.refundPair && l.amount < 0,
        cashback: l.cashback > 0 ? (toUah(l.cashback, l.currency, rates) ?? 0) : 0,
      };
    });

    const participants = await listParticipants(db);
    const family = q.participantId === undefined && participants.length > 1 ? participants.map((p) => p.id) : null;
    const stats = lineStats(lines, family);
    const { from, to, days, incomplete, dataUntil, coveredDays, pendingHolds } = head.period;
    return {
      month: q.month,
      category,
      categoryId: q.category,
      period: { from, to, days, incomplete, dataUntil, coveredDays, pendingHolds },
      compare,
      summary: {
        ...mine,
        gross,
        refunds,
        prev,
        median: stats.median,
        perDay: coveredDays > 0 ? Math.round(mine.net / coveredDays) : null,
        activeDays: stats.activeDays,
        largest: stats.largest,
        cashback: stats.cashback,
        cashbackLines: stats.cashbackLines,
        share: place >= 0 && scopeNet > 0 ? mine.net / scopeNet : null,
        rank: place >= 0 ? place + 1 : null,
      },
      months,
      thisMonth,
      people: stats.people,
      merchants: stats.merchants,
      lines,
      rates: today,
      leftOut,
    };
  }

  /**
   * The «Now» strip: today and this calendar week (from Monday) of the personal scope, folded into hryvnia by today's
   * rates — the same core aggregate as the spending block. Main's clock in the system time zone decides «today».
   */
  async nowOverview(q: NowOverviewQuery): Promise<NowOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const tz = systemTimeZone();
    const today = localDate(now * 1000, tz);
    const weekday = isoWeekday(today);
    const monday = shiftDate(today, 1 - weekday);
    const windowFrom = shiftDate(today, -USUAL_WINDOW);
    const month = monthBounds(today.slice(0, 7));
    const { dataFrom } = await this.status();
    const summary = (p: { from: string; to: string }, groupBy: 'day' | 'category') =>
      spendingSummary(db, { ...p, tz, groupBy, scope: 'personal', ...(q.participantId !== undefined ? { participantId: q.participantId } : {}) }, now);

    const todayRates = await this.d.rates();
    const rates = rateMap(todayRates);
    const daily = await summary({ from: windowFrom, to: today }, 'day');
    const week = await summary({ from: monday, to: today }, 'category');
    // foldByCategory folds by the group key — here the day of the system time zone.
    const byDay = foldByCategory(daily, rates).byCategory;
    const weekByCategory = foldByCategory(week, rates).byCategory;
    const monthRanked = rankedCategories(foldByCategory(await summary(month, 'category'), rates).byCategory);

    // The usual day reads only the days the data covers: from its first date to the last fully synced day.
    const lastCovered = daily.period.coveredDays > 0 ? shiftDate(windowFrom, daily.period.coveredDays - 1) : null;
    const yesterday = shiftDate(today, -1);
    const usualFrom = dataFrom === null ? null : dataFrom > windowFrom ? dataFrom : windowFrom;
    const usualTo = lastCovered === null ? null : lastCovered < yesterday ? lastCovered : yesterday;
    // Last week is clipped to the same weekdays the data reaches: today is never fully covered, so the cap is
    // dataUntil (capped at today), not the last fully covered day — a fresh sync must not drop a comparison day.
    const reach = daily.period.dataUntil === null ? null : daily.period.dataUntil < today ? daily.period.dataUntil : today;
    const prevFrom = shiftDate(monday, -7);
    const prevTo = reach === null ? null : shiftDate(reach, -7);
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
        prev: dataFrom !== null && dataFrom <= prevFrom && prevTo !== null && prevTo >= prevFrom ? sumDays(byDay, prevFrom, prevTo).net : null,
        top: top ? { category: top[0], categoryId: CATEGORY_ID.get(top[0]) ?? null, ...top[1], rank: rank >= 0 ? rank : null } : null,
        pendingHolds: week.period.pendingHolds,
      },
      rates: todayRates,
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
      dataUntil: newest === null ? null : localDateTime(newest * 1000),
      dataFrom: await firstDataDate(db, systemTimeZone()),
      lastSyncAt: last === null ? null : localDateTime(last * 1000),
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
