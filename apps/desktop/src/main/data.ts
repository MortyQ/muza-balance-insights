// Read side of the screen in main: the same core aggregates as the MCP tools (spendingSummary, balancesAt), mapped
// to the narrow view types of src/shared/api.ts. Only categories, amounts, dates and account name parts leave main —
// never names, card numbers or IBANs; descriptions only in the lines of categoryOverview and incomeOverview (the category
// and income screens). The import worker writes the same file; WAL lets both work.
import { ENABLED_ACCOUNT_IDS_SQL } from '@mono/core/accounts';
import { CATEGORY } from '@mono/core/categories';
import { categoryLines } from '@mono/core/category-lines';
import { incomeLines } from '@mono/core/income-lines';
import { findRecurring } from '@mono/core/recurring';
import { ensureDefaultConnection } from '@mono/core/connections';
import { RESYNC_OVERLAP_SEC } from '@mono/core/constants';
import { migrate, type Db } from '@mono/core/db';
import { listConnections, listParticipants } from '@mono/core/participants';
import type { ProviderId } from '@mono/core/providers/types';
import { startOfDayIn } from '@mono/core/format';
import { toUah, type FxRate } from '@mono/core/fx';
import { balancesAt, firstDataDate, type BalancesAt } from '@mono/core/status';
import { incomeSummary, spendingGrid, spendingSummary, type IncomeSummary, type SpendingSummary } from '@mono/core/summaries';
import { accountNames } from '../shared/account-name.ts';
import { localDate, localDateTime, systemTimeZone } from '../shared/dates.ts';
import { labelPending } from './people.ts';
import { comparePeriod, foldByCategory, monthBounds, rankedCategories } from './spending.ts';
import { incomeStats, lineStats, merchantText, monthsWindow } from './category.ts';
import { bucketState, daysOf, foldCells, foldIncome, monthsBetween, previousRange, runningTotals, usualCurve } from './analytics.ts';
import { addMonths } from '../shared/analytics.ts';
import { isoWeekday, shiftDate, sumAmounts, sumDays, usualDay, USUAL_WINDOW, weekDays } from './now.ts';
import { periodBounds, periodCompare } from './period.ts';
import type { CategoryId } from '../shared/categories.ts';
import type {
  AnalyticsCategory,
  AnalyticsOverview,
  AnalyticsQuery,
  CardTotal,
  CategoryLineView,
  CategoryOverview,
  CategoryOverviewQuery,
  IncomeAmounts,
  IncomeLineView,
  IncomeOverview,
  IncomeOverviewQuery,
  RecurringOverview,
  RecurringOverviewQuery,
  RecurringPaymentView,
  DataStatus,
  FlowView,
  FxPart,
  MonthOverview,
  MonthOverviewQuery,
  NowCategory,
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
/** The same day a calendar month on (YYYY-MM-DD), the last day of a shorter month: 31 Jan → 28 Feb. */
export function nextMonthDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10);
}

/** A stopped regular payment is still listed this long after its last payment. */
const ENDED_DAYS = 120;

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
    const startSec = startOfDayIn(from, tz);
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
      const atStart = new Map((await balancesAt(db, { endSec: startSec, ...f })).accounts.map((a) => [a.id, a.own_funds]));
      const income = await incomeSummary(db, { ...period, groupBy: 'scope', ...f }, now);
      const spending = await spendingSummary(db, { ...period, groupBy: 'category', ...f }, now);
      const others = balances.totals
        .filter((t) => t.currency !== UAH)
        .map((t) => ({ currency: t.currency, ownFunds: t.own_funds, rate: rates.get(t.currency)?.rate ?? null }));
      // A foreign part without a rate stays out of ownFunds (others says so with rate null).
      const folded = others.reduce((s, o) => s + (toUah(o.ownFunds, o.currency, rates) ?? 0), 0);
      // Jars with data at both ends and a known rate; a jar the month does not cover says nothing about it.
      const jars = balances.accounts.flatMap((a) => {
        const start = atStart.get(a.id);
        if (a.kind !== 'jar' || a.own_funds === null || start === null || start === undefined) return [];
        const uah = toUah(a.own_funds - start, a.currency, rates);
        return uah === null ? [] : [{ uah, foreign: a.currency !== UAH }];
      });
      const saved: CardTotal['saved'] =
        jars.length === 0 ? null : { amount: jars.reduce((s, j) => s + j.uah, 0), approx: jars.some((j) => j.foreign) };
      return {
        balances,
        total: {
          ownFunds: (balances.totals.find((t) => t.currency === UAH)?.own_funds ?? 0) + folded,
          others,
          saved,
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
  /** The category's 12 months around `month` (monthsWindow), folded by today's rates; null before the data starts. */
  private async categoryMonths(
    db: Db,
    month: string,
    thisMonth: string,
    category: string,
    filters: { tz: string; scope: CategoryOverviewQuery['scope']; participantId?: number },
    rates: Map<number, FxRate>,
    dataFrom: string | null,
    now: number,
  ): Promise<CategoryOverview['months']> {
    const months12 = monthsWindow(month, thisMonth);
    const history = await spendingSummary(db, { from: `${months12[0]}-01`, to: monthBounds(months12.at(-1)!).to, ...filters, groupBy: 'month', category }, now);
    const byMonth = new Map<string, number>();
    for (const g of history.groups) {
      const u = toUah(g.net, g.currency, rates);
      if (u !== null) byMonth.set(g.key, (byMonth.get(g.key) ?? 0) + u);
    }
    const firstMonth = dataFrom?.slice(0, 7) ?? null;
    return months12.map((m) => ({ month: m, net: firstMonth === null || m < firstMonth ? null : (byMonth.get(m) ?? 0) }));
  }

  async categoryOverview(q: CategoryOverviewQuery): Promise<CategoryOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const tz = systemTimeZone();
    const category = CATEGORY[q.category];
    const thisDay = localDate(now * 1000, tz);
    const period = periodBounds(q.period, thisDay);
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
    const compare = periodCompare(q.period, period, head.period, status.dataFrom);
    const prev = compare
      ? (foldByCategory(await spendingSummary(db, { ...compare, ...filters, groupBy: 'category', category }, now), rates).byCategory.get(category) ?? { net: 0, purchases: 0 })
      : null;

    const thisMonth = thisDay.slice(0, 7);
    const months = q.period.kind === 'month' ? await this.categoryMonths(db, q.period.month, thisMonth, category, filters, rates, status.dataFrom, now) : [];

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
      range: q.period,
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

  /** The income's 12 months around `month` (monthsWindow), folded by today's rates; null before the data starts. */
  private async incomeMonths(
    db: Db,
    month: string,
    thisMonth: string,
    filters: { tz: string; participantId?: number },
    rates: Map<number, FxRate>,
    dataFrom: string | null,
    now: number,
  ): Promise<IncomeOverview['months']> {
    const months12 = monthsWindow(month, thisMonth);
    const history = await incomeSummary(db, { from: `${months12[0]}-01`, to: monthBounds(months12.at(-1)!).to, ...filters, groupBy: 'month' }, now);
    const byMonth = new Map<string, number>();
    for (const g of history.groups) {
      const u = toUah(g.total, g.currency, rates);
      if (u !== null) byMonth.set(g.key, (byMonth.get(g.key) ?? 0) + u);
    }
    const firstMonth = dataFrom?.slice(0, 7) ?? null;
    return months12.map((m) => ({ month: m, total: firstMonth === null || m < firstMonth ? null : (byMonth.get(m) ?? 0) }));
  }

  /**
   * The regular payments screen: core findRecurring over the last 13 months (from the first day of the month a year
   * back), all scopes. The only text is each payment's description, through merchantText.
   */
  async recurringOverview(q: RecurringOverviewQuery): Promise<RecurringOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const tz = systemTimeZone();
    const today = localDate(now * 1000, tz);
    const since = `${addMonths(today.slice(0, 7), -12)}-01`;
    const rates = await this.d.rates();
    const fx = rateMap(rates);
    const found = await findRecurring(db, { from: since, to: today, tz, ...(q.participantId !== undefined ? { participantId: q.participantId } : {}) }, now);

    const accounts = (await db.execute('SELECT id, kind, type, currency_code, title FROM accounts')).rows;
    const names = accountNames(accounts.map((r) => ({ id: String(r.id), kind: String(r.kind), type: r.type === null ? null : String(r.type), currency: Number(r.currency_code) })));
    const jarTitles = accounts.filter((r) => r.kind === 'jar' && r.title).map((r) => String(r.title).trim());
    const day = (sec: number) => localDate(sec * 1000, tz);
    const view = (p: (typeof found)[number]): RecurringPaymentView => ({
      key: p.id,
      name: merchantText(p.description, jarTitles),
      category: p.category,
      categoryId: CATEGORY_ID.get(p.category) ?? null,
      participantId: p.participantId,
      account: names.get(p.accountId) ?? { kind: 'card', type: null, currency: p.currency, tag: null },
      uah: toUah(p.amount, p.currency, fx),
      currency: p.currency,
      amount: p.amount,
      operation: p.operationCurrency !== p.currency ? { currency: p.operationCurrency, amount: p.operationAmount } : null,
      payments: p.payments,
      first: day(p.first),
      last: day(p.last),
      next: nextMonthDay(day(p.last)),
    });
    const active = found.filter((p) => p.active).map(view).sort((a, b) => (b.uah ?? -1) - (a.uah ?? -1) || a.key.localeCompare(b.key));
    const ended = found
      .filter((p) => !p.active && now - p.last <= ENDED_DAYS * 86_400)
      .sort((a, b) => b.last - a.last || a.id.localeCompare(b.id))
      .map(view);
    return { since, active, ended, monthly: active.reduce((s, p) => s + (p.uah ?? 0), 0), rates };
  }

  /**
   * The income screen: one period's income (a day, a week, a month) of a person (or the family), all scopes, folded into
   * hryvnia by today's rates — the balances' «Income» figure (same core aggregate, same fold); its lines come from core
   * incomeLines (the same rows).
   */
  async incomeOverview(q: IncomeOverviewQuery): Promise<IncomeOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const tz = systemTimeZone();
    const thisDay = localDate(now * 1000, tz);
    const period = periodBounds(q.period, thisDay);
    const status = await this.status();
    const filters = { tz, ...(q.participantId !== undefined ? { participantId: q.participantId } : {}) };
    const today = await this.d.rates();
    const rates = rateMap(today);

    // Per currency → hryvnia; a currency without a rate stays out (leftOut).
    const fold = (totals: ReadonlyArray<{ currency: number; lines: number; total: number }>) => {
      const sum: IncomeAmounts = { total: 0, lines: 0 };
      const leftOut: Array<{ currency: number; total: number }> = [];
      for (const t of totals) {
        const u = toUah(t.total, t.currency, rates);
        if (u === null) leftOut.push({ currency: t.currency, total: t.total });
        else (sum.total += u), (sum.lines += t.lines);
      }
      return { sum, leftOut };
    };
    const head = await incomeSummary(db, { ...period, ...filters }, now);
    const { sum, leftOut } = fold(head.totals);
    const compare = periodCompare(q.period, period, head.period, status.dataFrom);
    const prev = compare ? fold((await incomeSummary(db, { ...compare, ...filters }, now)).totals).sum : null;
    const spent = await spendingSummary(db, { ...period, ...filters }, now);
    const spending = spent.totals.reduce((s, t) => s + (toUah(t.net, t.currency, rates) ?? 0), 0);

    const thisMonth = thisDay.slice(0, 7);
    const months = q.period.kind === 'month' ? await this.incomeMonths(db, q.period.month, thisMonth, filters, rates, status.dataFrom, now) : [];

    const accounts = (await db.execute('SELECT id, kind, type, currency_code, title FROM accounts')).rows;
    const names = accountNames(accounts.map((r) => ({ id: String(r.id), kind: String(r.kind), type: r.type === null ? null : String(r.type), currency: Number(r.currency_code) })));
    const jarTitles = accounts.filter((r) => r.kind === 'jar' && r.title).map((r) => String(r.title).trim());
    const raw = await incomeLines(db, { ...period, ...filters }, now);
    const lines: IncomeLineView[] = raw.lines.map((l) => {
      const [date, time] = localDateTime(l.time * 1000, tz).split(' ') as [string, string];
      return {
        key: l.id,
        date,
        time,
        weekday: isoWeekday(date),
        sender: merchantText(l.sender ?? l.description, jarTitles),
        comment: l.comment?.trim() || null,
        source: l.source,
        participantId: l.participantId,
        account: names.get(l.accountId) ?? { kind: 'card', type: null, currency: l.currency, tag: null },
        uah: toUah(l.amount, l.currency, rates),
        currency: l.currency,
        amount: l.amount,
        operation:
          l.operationAmount !== null && l.operationCurrency !== l.currency ? { currency: l.operationCurrency, amount: l.operationAmount } : null,
        hold: l.hold,
        pending: l.hold && l.time >= now - RESYNC_OVERLAP_SEC,
      };
    });

    const participants = await listParticipants(db);
    const family = q.participantId === undefined && participants.length > 1 ? participants.map((p) => p.id) : null;
    const stats = incomeStats(lines, family);
    const { from, to, days, incomplete, dataUntil, coveredDays, pendingHolds } = head.period;
    return {
      range: q.period,
      period: { from, to, days, incomplete, dataUntil, coveredDays, pendingHolds },
      compare,
      summary: {
        ...sum,
        prev,
        median: stats.median,
        perDay: coveredDays > 0 ? Math.round(sum.total / coveredDays) : null,
        activeDays: stats.activeDays,
        largest: stats.largest,
        spending,
      },
      months,
      thisMonth,
      people: stats.people,
      sources: stats.sources,
      senders: stats.senders,
      lines,
      rates: today,
      leftOut,
    };
  }

  /**
   * The analytics screen: income and spending of a month (per day) or a range of months (per month), all scopes — the
   * balances' fold — with the period before, per category, and for one month the usual month's running spending.
   */
  async analyticsOverview(q: AnalyticsQuery): Promise<AnalyticsOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const tz = systemTimeZone();
    const today = localDate(now * 1000, tz);
    if (q.to > today.slice(0, 7)) throw new Error('analytics: the range ends after this month');
    const { dataFrom } = await this.status();
    const filters = { tz, ...(q.participantId !== undefined ? { participantId: q.participantId } : {}) };
    const todayRates = await this.d.rates();
    const rates = rateMap(todayRates);
    const sum = (xs: Iterable<number>) => [...xs].reduce((s, x) => s + x, 0);

    const unit = q.from === q.to ? 'day' : 'month';
    const period = { from: monthBounds(q.from).from, to: monthBounds(q.to).to };
    const keys = unit === 'day' ? daysOf(q.from) : monthsBetween(q.from, q.to);
    const grid = await spendingGrid(db, { ...period, ...filters, unit }, now);
    const cur = foldCells(grid.cells, keys, rates);
    const inc = foldIncome((await incomeSummary(db, { ...period, ...filters, groupBy: unit }, now)).groups, keys, rates);

    let compare: AnalyticsOverview['compare'] = null;
    if (unit === 'day') compare = comparePeriod(q.from, grid.period, dataFrom);
    else {
      const p = previousRange(q.from, q.to);
      if (dataFrom !== null && dataFrom <= p.from) compare = { ...p, partial: false };
    }
    let prevBy: Map<string, SpendingAmounts> | null = null;
    let prevTotals: { income: number; spending: number } | null = null;
    if (compare) {
      prevBy = foldByCategory(await spendingSummary(db, { ...compare, ...filters, groupBy: 'category' }, now), rates).byCategory;
      const prevIncome = (await incomeSummary(db, { ...compare, ...filters }, now)).totals.map((t) => toUah(t.total, t.currency, rates) ?? 0);
      prevTotals = { income: sum(prevIncome), spending: sum([...prevBy.values()].map((a) => a.net)) };
    }

    const amounts = new Map([...cur.net].map(([k, row]) => [k, { net: sum(row), purchases: cur.purchases.get(k) ?? 0 }]));
    const ranked = rankedCategories(amounts).map(([k]) => k);
    const prevOnly = prevBy
      ? [...prevBy].filter(([k, a]) => a.net > 0 && !amounts.has(k)).sort(([, a], [, b]) => b.net - a.net).map(([k]) => k)
      : [];
    const categories: AnalyticsCategory[] = [...ranked, ...prevOnly].map((category) => {
      const net = cur.net.get(category) ?? keys.map(() => 0);
      return { category, categoryId: CATEGORY_ID.get(category) ?? null, net, total: sum(net), prev: prevBy ? (prevBy.get(category)?.net ?? 0) : null };
    });
    // Every category, a net-negative one too: the balances' «Spent».
    const spending = keys.map((_, i) => sum([...cur.net.values()].map((row) => row[i]!)));

    let usual: number[] | null = null;
    if (unit === 'day') {
      const before = [1, 2, 3].map((n) => addMonths(q.from, -n)).filter((m) => dataFrom !== null && dataFrom <= `${m}-01`);
      const curves: number[][] = [];
      for (const m of before) {
        const days = daysOf(m);
        const s = await spendingSummary(db, { ...monthBounds(m), ...filters, groupBy: 'day' }, now);
        const at = new Map(days.map((d, i) => [d, i]));
        const daily = days.map(() => 0);
        for (const g of s.groups) {
          const i = at.get(g.key);
          const u = toUah(g.net, g.currency, rates);
          if (i !== undefined && u !== null) daily[i]! += u;
        }
        curves.push(runningTotals(daily));
      }
      usual = usualCurve(curves, keys.length);
    }

    return {
      from: q.from,
      to: q.to,
      unit,
      buckets: keys.map((key) => ({ key, state: bucketState(key, unit, { today, dataFrom }) })),
      income: inc.values,
      spending,
      totals: { income: sum(inc.values), spending: sum(spending), prev: prevTotals },
      compare,
      usual,
      categories,
      rates: todayRates,
      leftOut: [...new Set([...cur.leftOut, ...inc.leftOut])].sort((a, b) => a - b),
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
    const todayByCategory = foldByCategory(await summary({ from: today, to: today }, 'category'), rates).byCategory;
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
    const hasPrev = dataFrom !== null && dataFrom <= prevFrom && prevTo !== null && prevTo >= prevFrom;
    const prevByCategory = hasPrev && prevTo !== null ? foldByCategory(await summary({ from: prevFrom, to: prevTo }, 'category'), rates).byCategory : null;
    const nowCategory = ([category, a]: [string, SpendingAmounts]): NowCategory => {
      const rank = monthRanked.findIndex(([k]) => k === category);
      return { category, categoryId: CATEGORY_ID.get(category) ?? null, ...a, rank: rank >= 0 ? rank : null };
    };
    const weekCategories = rankedCategories(weekByCategory).map(nowCategory);

    return {
      date: today,
      weekday,
      dataUntil: daily.period.dataUntil,
      today: byDay.get(today) ?? { net: 0, purchases: 0 },
      todayCategories: rankedCategories(todayByCategory).map(nowCategory),
      usualDay: usualFrom !== null && usualTo !== null ? usualDay(byDay, usualFrom, usualTo) : null,
      week: {
        from: monday,
        days: weekDays(byDay, monday, today),
        total: sumAmounts(weekByCategory.values()),
        prev: hasPrev && prevTo !== null ? sumDays(byDay, prevFrom, prevTo).net : null,
        top: weekCategories[0] ?? null,
        categories: weekCategories.map((c) => ({ ...c, prev: prevByCategory ? (prevByCategory.get(c.category)?.net ?? 0) : null })),
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
