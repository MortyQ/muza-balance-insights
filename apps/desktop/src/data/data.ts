// Read side of the screen in the data process: the same core aggregates as the MCP tools (spendingSummary, balancesAt),
// mapped to the narrow view types of src/shared/api.ts. Only categories, amounts, dates and account name parts leave —
// never names, card numbers or IBANs; descriptions only in the lines of categoryOverview and incomeOverview (the category
// and income screens) and the payees of insightsOverview (the Insights screen). The import worker writes the same
// file; WAL lets both work.
import { ENABLED_ACCOUNT_IDS_SQL, LIVE_ACCOUNT_IDS_SQL } from '@mono/core/people/accounts';
import { CATEGORY } from '@mono/core/derive/categories';
import { categorySources, setOperationCategory, setPayeeCategory } from '@mono/core/commands/categories';
import { categoryLines, latestLines, linesOfCategories } from '@mono/core/read/category-lines';
import { incomeLines } from '@mono/core/read/income-lines';
import { findRecurring, setRecurringMark, type RecurringPayment } from '@mono/core/read/recurring';
import { addReserve, deleteReserve, listReserves, updateReserve, type ReserveInput } from '@mono/core/read/reserves';
import { categoryKinds, kindMap, resetCategoryKinds, setCategoryKind, type KindChoice } from '@mono/core/read/category-kinds';
import {
  budgetSplit,
  byKind,
  countStanding,
  debtShare,
  fixedShare,
  guideStanding,
  incomeStanding,
  limitsStanding,
  monthShares,
  paceStanding,
  reserveMonths,
  spendingStanding,
} from '@mono/core/read/budget';
import { leftForecast, shareTrend, usualOf as usualShare, versusUsual } from '@mono/core/read/health';
import { addGoal, deleteGoal, listGoals, updateGoal, type Goal, type GoalInput } from '@mono/core/read/goals';
import { budgetView, figures, limitView, periodPosition, suggestions, type OwnerSums, type Sums } from './limits.ts';
import { savingProgress } from '@mono/core/read/savings-goals';
import { allowance, type AllowanceSeries } from './allowance.ts';
import { ensureDefaultConnection } from '@mono/core/people/connections';
import { RESYNC_OVERLAP_SEC } from '@mono/core/shared/constants';
import { migrate, type Db } from '@mono/core/storage/db';
import { refreshCrossing } from '@mono/core/derive/derived';
import { listConnections, listParticipants } from '@mono/core/people/participants';
import { getSettings, setSetting } from '@mono/core/people/settings';
import type { ProviderId } from '@mono/core/providers/types';
import { startOfDayIn } from '@mono/core/shared/format';
import { toUah, type FxRate } from '@mono/core/read/fx';
import { balancesAt, balancesOf, firstDataDate, type BalancesAt } from '@mono/core/read/status';
import { incomeSummary } from '@mono/core/read/income';
import { detectInsights, insightSeverity, mainDriver, newPayees, oneOffs, payeeUsual, savingsRate } from '@mono/core/read/insights';
import { periodInfo } from '@mono/core/read/filters';
import { cashWithdrawn, spendingGrid, spendingSummary, type SpendingCell } from '@mono/core/read/spending';
import { accountNames } from '../shared/account-name.ts';
import { localDate, localDateTime, systemTimeZone } from '../shared/dates.ts';
import { labelPending } from './people.ts';
import { bankParts, cellGroups, comparePeriod, foldByCategory, monthBounds, rankedCategories } from './spending.ts';
import { usualMonths, usualOf } from './usual.ts';
import { incomeStats, lineStats, merchantKey, merchantText, monthsWindow } from './category.ts';
import { payeeMonths } from './explain.ts';
import { INSIGHT_MAX } from '../shared/insights.ts';
import { bankSeries, bucketState, daysOf, foldCells, foldIncome, mergeCells, monthsBetween, previousRange, runningTotals, usualCurve } from './analytics.ts';
import { addMonths } from '../shared/analytics.ts';
import { isoWeekday, median, shiftDate, sumAmounts, sumDays, usualDay, USUAL_WINDOW, weekDays } from './now.ts';
import { periodBounds, periodCompare } from './period.ts';
import type { CategoryId, KindCategoryId } from '../shared/categories.ts';
import type {
  AllowanceOverview,
  BudgetStructureView,
  ChartReferences,
  HealthReferences,
  HealthStanding,
  MonthSharesView,
  ShareKey,
  Standing,
  GoalJarView,
  GoalPayload,
  LimitAheadView,
  LimitFiguresView,
  LimitOverView,
  SavingGoalView,
  LimitsOverview,
  LimitsOverviewQuery,
  CategoryKindQuery,
  CategoryKindView,
  AllowanceQuery,
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
  RecurringMarkQuery,
  OperationCategoryQuery,
  OperationCategoryResult,
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
  RecentOperations,
  SpendingOverview,
  SpendingOverviewQuery,
  InsightDriver,
  InsightCardView,
  InsightsOverview,
  SpendingExplain,
  SpendingInsights,
  SpendingUsual,
  SpendingPersonPart,
} from '../shared/api.ts';

/** The core's category word → its CATEGORY key, the id the renderer translates. */
/** The same day a calendar month on (YYYY-MM-DD), the last day of a shorter month: 31 Jan → 28 Feb. */
export function nextMonthDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(d, last))).toISOString().slice(0, 10);
}

/** How many operations home's «Recent operations» lists. */
const RECENT_LINES = 6;

/** A stopped regular payment is still listed this long after its last payment. */
const ENDED_DAYS = 120;

/** Limits by what needs attention first. */
const STATE_ORDER = { exceeded: 0, attention: 1, ok: 2 } as const;

const CATEGORY_ID: ReadonlyMap<string, CategoryId> = new Map(Object.entries(CATEGORY).map(([id, word]) => [word, id as CategoryId]));

/** «What's unusual» (core `detectInsights`) over the shown month's categories against the usual one. */
function insightsOf(usual: SpendingUsual, categories: ReadonlyArray<{ category: string; net: number }>): SpendingInsights | null {
  const found = detectInsights({
    months: usual.months,
    running: usual.running,
    now: new Map(categories.map((c) => [c.category, c.net])),
    usual: new Map(usual.categories.map((c) => [c.category, c.net])),
    income: usual.income,
  });
  if (!found) return null;
  return { ...found, insights: found.insights.map((i) => ({ ...i, categoryId: i.category === null ? null : (CATEGORY_ID.get(i.category) ?? null) })) };
}

/**
 * The usual (spendingUsual) with what it was made of: the months (newest first), each month's net spending and — a
 * month that is over — each month's income, hryvnia kopecks in the same order.
 */
type UsualFound = { usual: SpendingUsual; months: string[]; spent: number[]; income: number[] | null; byCategory: Array<Map<string, number>> };

/** A month's five income shares (core read/budget.ts); null without income. */
function fiveShares(income: number, byCategory: ReadonlyMap<string, number>, kinds: ReadonlyMap<string, KindChoice>): Record<ShareKey, number> | null {
  const t = byKind(byCategory, kinds);
  const split = budgetSplit(income, t);
  if (!split) return null;
  return { left: split.left, essential: split.essential, wants: split.wants, fixed: fixedShare(income, t) ?? 0, debt: debtShare(income, byCategory) ?? 0 };
}

const SHARE_KEYS: ReadonlyArray<ShareKey> = ['left', 'essential', 'wants', 'fixed', 'debt'];

/**
 * «Financial health» beyond the guides (spec desktop-insights-health): the chart's usual and trend, the shown month
 * against the usual months, the running month's forecast, the cushion and spending items.
 */
function healthReferences(a: {
  history: ReadonlyArray<MonthSharesView>;
  usualMonths: ReadonlyArray<{ income: number; byCategory: ReadonlyMap<string, number> }>;
  kinds: ReadonlyMap<string, KindChoice>;
  budget: BudgetStructureView;
  period: { days: number; coveredDays: number; incomplete: boolean };
  spent: number;
  usual: SpendingUsual;
  curNet: ReadonlyMap<string, number>;
  high: number;
}): HealthReferences {
  const chartOf = (metric: 'left' | 'wants'): ChartReferences | null => {
    const values = a.history.map((h) => h[metric]);
    const u = usualShare(values);
    return u ? { usual: u.usual, unusual: u.unusual, trend: shareTrend(values, metric === 'left') } : null;
  };
  const usualShares = a.usualMonths.flatMap((m) => {
    const f = fiveShares(m.income, m.byCategory, a.kinds);
    return f ? [f] : [];
  });
  const m = a.budget.month;
  const now = m ? fiveShares(m.income, a.curNet, a.kinds) : null;
  const versus = Object.fromEntries(
    SHARE_KEYS.map((k) => {
      const u = usualShare(usualShares.map((x) => x[k]));
      return [k, now && u ? { usual: u.usual, direction: versusUsual(now[k], u.usual, k === 'left') } : null];
    }),
  ) as HealthReferences['versus'];
  const forecast = a.period.incomplete
    ? leftForecast({
        day: a.period.coveredDays,
        days: a.period.days,
        spent: (({ essential, wants }) => ({ essential, wants }))(byKind(a.curNet, a.kinds)),
        usual: a.usualMonths.map((x) => {
          const t = byKind(x.byCategory, a.kinds);
          return { income: x.income, essential: t.essential, wants: t.wants };
        }),
      })
    : null;
  const known = a.history.flatMap((h) => (h.left === null ? [] : [h.left]));
  const n = known.filter((x) => x < 0).length;
  const usualIncome = a.usual.income?.usual ?? 0;
  const incomeNow = a.usual.income?.now ?? null;
  const spendingRef = (): HealthReferences['spending'] => {
    if (a.usual.total <= 0) return null;
    if (!a.period.incomplete) return { kind: 'month', now: a.spent, usual: a.usual.total, standing: spendingStanding(a.spent, a.usual.total)! };
    const spentShare = Math.round((a.spent / a.usual.total) * 100);
    const passed = a.period.days > 0 ? Math.round((a.period.coveredDays / a.period.days) * 100) : 0;
    return { kind: 'pace', spent: spentShare, passed, standing: paceStanding(spentShare, passed) };
  };
  const incomeStand = incomeNow !== null ? incomeStanding(incomeNow, usualIncome) : null;
  return {
    chart: { left: chartOf('left'), wants: chartOf('wants') },
    versus,
    forecast: forecast ? { ...forecast, standing: guideStanding('left', forecast.value) } : null,
    redMonths: known.length > 0 ? { n, of: known.length, standing: countStanding(n) } : null,
    income: incomeNow !== null && incomeStand ? { now: incomeNow, usual: usualIncome, standing: incomeStand } : null,
    spending: spendingRef(),
    strong: { n: a.high, standing: countStanding(a.high) },
  };
}

/** The «Financial health» checklist against its guides (spec core-budget-metrics «Standing against a guide»). */
function healthStanding(b: BudgetStructureView, limits: Standing | null): HealthStanding {
  const m = b.month;
  return {
    left: m ? guideStanding('left', m.split.left) : null,
    essential: m ? guideStanding('essential', m.split.essential) : null,
    wants: m ? guideStanding('wants', m.split.wants) : null,
    fixed: m ? guideStanding('fixed', m.fixedShare) : null,
    debt: m ? guideStanding('debt', m.debtShare) : null,
    reserve: b.reserve ? guideStanding('reserve', b.reserve.months) : null,
    limits,
  };
}

/** Hryvnia — the currency the total card shows; other currencies are never summed with it. */
const UAH = 980;

/** `'2026-12'` → `'2027-01-01'`: the first day after the given month, UTC calendar arithmetic. */
function nextMonthStart(month: string): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

/** sync_state rows of imported, enabled accounts. */
/** Accounts with their bank, for account names and jar titles. */
const ACCOUNT_NAME_SQL = 'SELECT a.id, c.provider, a.kind, a.type, a.currency_code, a.title FROM accounts a JOIN connections c ON c.id = a.connection_id';

function accountRow(r: Readonly<Record<string, unknown>>): { id: string; provider: string; kind: string; type: string | null; currency: number } {
  return { id: String(r.id), provider: String(r.provider), kind: String(r.kind), type: r.type === null ? null : String(r.type), currency: Number(r.currency_code) };
}

const IMPORTED_ENABLED = `WHERE newest_synced_time IS NOT NULL AND account_id IN (${ENABLED_ACCOUNT_IDS_SQL})`;

export type DataServiceDeps = {
  open: () => Promise<Db>;
  /** After close: the files are deleted next (releaseClosedFiles — Windows holds them until collected). */
  release: () => Promise<unknown>;
  nowSec: () => number;
  /** Today's rates (RatesService.current); null — never fetched. */
  rates: () => Promise<RatesView | null>;
  /** Diagnostics: one line, no data. */
  log?: (line: string) => void;
};

/** Today's rates as the core's fold expects them (one rate for every period). */
/** A reserve counts for the family (no person) always, for a person only when it is theirs (a common one never). */
function reserveFor(r: { participantId: number | null }, participantId: number | undefined): boolean {
  return participantId === undefined || r.participantId === participantId;
}

/** The core filters of a screen's view: whose and which banks (spec core-bank-view), each only when asked for. */
type ViewFilters = { participantId?: number; providers?: ProviderId[] };

function viewOf(q: ViewFilters): ViewFilters {
  return { ...(q.participantId !== undefined ? { participantId: q.participantId } : {}), ...banksOf(q) };
}

/** Only the banks of a view: the family's per-person queries keep them (each person within the same banks). */
function banksOf(q: ViewFilters): Pick<ViewFilters, 'providers'> {
  return q.providers !== undefined ? { providers: q.providers } : {};
}

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
        await migrate(db, this.d.nowSec(), (r) =>
          this.d.log?.(`[db] compaction ${r.ok ? 'done' : `failed: ${r.error instanceof Error ? r.error.name : 'error'}`}`),
        );
        await refreshCrossing(db);
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

  /** The migrated connection, for the other modules of the data process (host.ts). */
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
    const flowOf = (
      inc: ReadonlyArray<{ currency: number; total: number }>,
      sp: ReadonlyArray<{ currency: number; net: number }>,
    ): FlowView & { fx: FxPart[] } => {
      const currencies = [...new Set([...inc.map((t) => t.currency), ...sp.map((t) => t.currency)])].sort((a, b) => a - b);
      let income = 0;
      let spending = 0;
      const fx: FxPart[] = [];
      for (const c of currencies) {
        const i = inc.find((t) => t.currency === c)?.total ?? 0;
        const s = sp.find((t) => t.currency === c)?.net ?? 0;
        const iu = toUah(i, c, rates);
        const su = toUah(s, c, rates);
        if (iu !== null && su !== null) (income += iu), (spending += su);
        if (c !== UAH && (i !== 0 || s !== 0)) fx.push({ currency: c, income: i, spending: s, rate: rates.get(c)?.rate ?? null });
      }
      return { income, spending, fx };
    };

    // A card from the balances at the month's end, own funds at its start (by account) and the month's flow.
    const cardTotal = (balances: BalancesAt, atStart: ReadonlyMap<string, number | null>, flow: FlowView & { fx: FxPart[] }): CardTotal => {
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
        ownFunds: (balances.totals.find((t) => t.currency === UAH)?.own_funds ?? 0) + folded,
        others,
        saved,
        missing: balances.missing,
        accounts: balances.accounts.length,
        ...flow,
      };
    };

    // The view's own queries; the family's people come from the same balances and from one grouped query each below.
    const f = viewOf(q);
    const balances = await balancesAt(db, { endSec, ...f });
    const atStart = new Map((await balancesAt(db, { endSec: startSec, ...f })).accounts.map((a) => [a.id, a.own_funds]));
    const income = await incomeSummary(db, { ...period, groupBy: 'scope', ...f }, now);
    const spending = await spendingSummary(db, { ...period, groupBy: 'category', ...f }, now);
    const head = { balances, total: cardTotal(balances, atStart, flowOf(income.totals, spending.totals)) };
    const coverageFrom = first !== null && first > from ? first : from;
    // A bank view reaches as far as its own banks do (core periodInfo); every bank — the status's date, as before.
    const until = q.providers === undefined ? status.dataUntil : spending.period.dataUntil;
    const coverageTo = until !== null && until.slice(0, 10) < to ? until.slice(0, 10) : to;
    // The month may have no covered day at all (before any data, or the account starts later): clamp so from ≤ to.
    const coverage = { from: coverageFrom, to: coverageTo < coverageFrom ? coverageFrom : coverageTo };
    // Only today's balance has reserves set against it: the active ones with a rate of the view; null — none.
    const reserves = current ? await this.reservesOn(db, localDate(now * 1000, tz), rates) : [];
    const reservedFor = (participantId?: number) => {
      const sum = reserves.reduce((s, r) => s + (r.active && reserveFor(r, participantId) ? (r.uah ?? 0) : 0), 0);
      return sum > 0 ? sum : null;
    };
    const base = { month: q.month, balanceAt: current ? ('now' as const) : to, coverage, total: head.total, reserved: reservedFor(q.participantId) };
    if (q.participantId === undefined) {
      // Each person's card as their own view counts it: their accounts' balances, and income and spending grouped by
      // participant (each group has the person's view of family transfers) — one query each, whatever the number of people.
      const owners = new Map(
        (await db.execute('SELECT a.id, c.participant_id FROM accounts a JOIN connections c ON c.id = a.connection_id')).rows.map((r) => [
          String(r.id),
          Number(r.participant_id),
        ]),
      );
      const incomeBy = await incomeSummary(db, { ...period, groupBy: 'participant', ...banksOf(q) }, now);
      const spendingBy = await spendingSummary(db, { ...period, groupBy: 'participant', ...banksOf(q) }, now);
      const people: MonthOverview['people'] = (await listParticipants(db)).map((p) => {
        const key = String(p.id);
        const own = balancesOf(balances.accounts.filter((a) => owners.get(a.id) === p.id));
        return {
          participantId: p.id,
          label: p.label,
          labelPending: labelPending(p),
          color: p.color,
          total: cardTotal(own, atStart, flowOf(incomeBy.groups.filter((g) => g.key === key), spendingBy.groups.filter((g) => g.key === key))),
          reserved: reservedFor(p.id),
        };
      });
      return { ...base, people, accounts: [], rates: today };
    }
    const inc = await incomeSummary(db, { ...period, groupBy: 'account', ...f }, now);
    const sp = await spendingSummary(db, { ...period, groupBy: 'account', ...f }, now);
    const stored = new Map((await db.execute(ACCOUNT_NAME_SQL)).rows.map((r) => [String(r.id), accountRow(r)]));
    const names = accountNames(
      head.balances.accounts.map((a) => ({ id: a.id, provider: stored.get(a.id)?.provider ?? '', kind: a.kind, type: stored.get(a.id)?.type ?? null, currency: a.currency })),
    );
    const accounts: OverviewAccount[] = head.balances.accounts.map((a) => ({
      id: a.id,
      name: names.get(a.id) ?? { provider: '', kind: a.kind, type: null, currency: a.currency, tag: null },
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
      spendingSummary(db, { ...p, tz, groupBy: 'category', scope: q.scope, ...banksOf(q), ...(participantId !== undefined ? { participantId } : {}) }, now);

    const head = await summary(period, q.participantId);
    // The bars' split by bank: one grid over the month, split by bank (spec desktop-spending-split).
    const byBank = await spendingGrid(db, { ...period, tz, scope: q.scope, ...viewOf(q), unit: 'month', byProvider: true }, now);
    const compare = comparePeriod(q.month, head.period, status.dataFrom);
    const today = await this.d.rates();
    const rates = rateMap(today);
    // The previous period is folded by the same rate: the change shows spending, not the exchange rate.
    const before = compare ? { period: compare, rates } : null;
    const cur = foldByCategory(head, rates);
    const banks = bankParts(byBank.cells, rates);
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
      banks: banks.get(category) ?? [],
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
    const found = await this.spendingUsual(db, q, head.period, status.dataFrom, rates, now);
    const usual = found?.usual ?? null;
    // «What's unusual» counts the month without pending holds, as the Insights screen does.
    const settled =
      usual && pendingHolds > 0
        ? rankedCategories(foldByCategory(await spendingSummary(db, { ...period, tz, groupBy: 'category', scope: q.scope, holds: 'final', ...viewOf(q) }, now), rates).byCategory).map(
            ([category, a]) => ({ category, net: a.net }),
          )
        : categories;
    const insights = usual ? insightsOf(usual, settled) : null;
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
      usual,
      insights,
      explain: found ? await this.explain(db, q, found, insights, total.net, pendingHolds, rates, now) : null,
    };
  }

  /**
   * Home's «Insights» block: the main driver of each of the first INSIGHT_MAX unusual categories (one read of their
   * lines over the usual months and the shown one), a finished month's savings rate, and what the usual is over.
   */
  private async explain(
    db: Db,
    q: SpendingOverviewQuery,
    found: UsualFound,
    insights: SpendingInsights | null,
    spent: number,
    pendingHolds: number,
    rates: Map<number, FxRate>,
    now: number,
  ): Promise<SpendingExplain> {
    const { usual, months, spent: monthSpent, income } = found;
    const tz = systemTimeZone();
    const filters = { tz, scope: q.scope, ...viewOf(q) };
    const span = { from: monthBounds(months.at(-1)!).from, to: monthBounds(q.month).to };
    const unusual = (insights?.insights ?? []).slice(0, INSIGHT_MAX).filter((i) => i.category !== null);
    const drivers: InsightDriver[] = [];
    if (unusual.length > 0) {
      const jarTitles = await this.jarTitles(db);
      const raw = await linesOfCategories(db, { ...span, ...filters, categories: unusual.map((i) => i.category!) }, now);
      for (const i of unusual) {
        const lines = raw.lines
          .filter((l) => l.category === i.category)
          .map((l) => ({ month: localDate(l.time * 1000, tz).slice(0, 7), merchant: merchantText(l.description, jarTitles), uah: toUah(l.amount, l.currency, rates) }));
        const d = mainDriver(i.now - i.usual, payeeMonths(lines, q.month, months));
        if (d) drivers.push({ category: i.category!, categoryId: i.categoryId, name: d.name, direction: i.direction, amount: d.amount, share: d.share });
      }
    }
    const savings =
      usual.income && income
        ? savingsRate({ income: usual.income.now, spent }, months.map((_, k) => ({ income: income[k]!, spent: monthSpent[k]! })))
        : null;
    return { drivers, savings, basis: { months: usual.months, from: months.at(-1)!, to: months[0]!, pendingHolds } };
  }

  /**
   * «Budget structure»: a finished month's income folded by kind (core read/budget.ts) — the income comes from the
   * usual's read when there is one, else one income query — and the reserve: today's own money of the view's cards and
   * jars (an account below zero counts as 0: credit money is not the user's) over the usual essential month.
   */
  private async budgetOf(
    db: Db,
    q: SpendingOverviewQuery,
    c: { cur: Map<string, { net: number }>; found: UsualFound | null; incomplete: boolean; kinds: Map<string, KindChoice>; rates: Map<number, FxRate>; now: number },
  ): Promise<BudgetStructureView> {
    const byCategory = new Map([...c.cur].map(([k, a]) => [k, a.net]));
    const totals = byKind(byCategory, c.kinds);
    let income: number | null = null;
    if (!c.incomplete) {
      if (c.found?.usual.income) income = c.found.usual.income.now;
      else {
        const filters = { tz: systemTimeZone(), scope: q.scope, ...viewOf(q) };
        const r = await incomeSummary(db, { ...monthBounds(q.month), ...filters, groupBy: 'month' }, c.now);
        income = r.groups.reduce((s, g) => s + (toUah(g.total, g.currency, c.rates) ?? 0), 0);
      }
    }
    const split = income !== null ? budgetSplit(income, totals) : null;
    const month =
      income !== null && split
        ? {
            income,
            ...totals,
            debt: byCategory.get(CATEGORY.installments) ?? 0,
            split,
            fixedShare: fixedShare(income, totals) ?? 0,
            debtShare: debtShare(income, byCategory) ?? 0,
          }
        : null;
    let reserve: BudgetStructureView['reserve'] = null;
    if (c.found) {
      const balances = await balancesAt(db, { endSec: c.now + 1, ...viewOf(q) });
      const money = balances.accounts.reduce((s, a) => s + (a.own_funds === null ? 0 : Math.max(0, toUah(a.own_funds, a.currency, c.rates) ?? 0)), 0);
      reserve = reserveMonths(money, c.found.byCategory.map((m) => byKind(m, c.kinds).essential));
    }
    const ids = (pick: (k: KindChoice) => boolean) =>
      [...c.kinds].flatMap(([category, k]) => {
        const id = CATEGORY_ID.get(category);
        return id && pick(k) ? [id] : [];
      });
    return {
      month,
      reserve,
      kinds: { essential: ids((k) => k.kind === 'essential'), wants: ids((k) => k.kind === 'wants'), savings: ids((k) => k.kind === 'savings'), fixed: ids((k) => k.fixed) },
    };
  }

  /**
   * The view's monthly limits in the feed (a person: theirs and the family's), each against its owner's «Personal»
   * spending of every bank, pending holds included; the budget's flexible part too. Over: spent above the amount. Ahead
   * (the current month only): not over yet, in attention for its pace or its forecast — the «Budget» screen's rule
   * (core limitState). Severity against the usual month, as the feed's.
   */
  private async limitSignalsOf(
    db: Db,
    q: SpendingOverviewQuery,
    kinds: Map<string, KindChoice>,
    usualTotal: number,
    rates: Map<number, FxRate>,
    now: number,
  ): Promise<{ limitsOver: LimitOverView[]; limitsAhead: LimitAheadView[]; monthlyLimits: number }> {
    const goals = (await listGoals(db)).filter(
      (g) => (g.type === 'limit' && g.period === 'month') || g.type === 'budget',
    ).filter((g) => q.participantId === undefined || g.participantId === null || g.participantId === q.participantId);
    if (goals.length === 0) return { limitsOver: [], limitsAhead: [], monthlyLimits: 0 };
    const tz = systemTimeZone();
    const today = localDate(now * 1000, tz);
    const current = q.month === today.slice(0, 7);
    const pos = periodPosition('month', today, q.month, current);
    const sumsOf = new Map<number | null, Sums>();
    for (const o of new Set(goals.map((g) => g.participantId))) {
      const head = await spendingSummary(db, { ...monthBounds(q.month), tz, scope: 'personal', ...(o !== null ? { participantId: o } : {}), groupBy: 'category' }, now);
      sumsOf.set(o, new Map([...foldByCategory(head, rates).byCategory].map(([k, v]) => [k, v.net])));
    }
    const limitsOver: LimitOverView[] = [];
    const limitsAhead: LimitAheadView[] = [];
    const add = (categoryId: KindCategoryId | null, f: LimitFiguresView) => {
      if (f.spent > f.amount) {
        const over = f.spent - f.amount;
        limitsOver.push({ categoryId, amount: f.amount, spent: f.spent, over, severity: insightSeverity(over, usualTotal) });
      } else if (current && f.forecast !== null && f.forecast > f.amount && (f.reason === 'pace' || f.reason === 'forecast')) {
        const over = f.forecast - f.amount;
        limitsAhead.push({ categoryId, amount: f.amount, spent: f.spent, forecast: f.forecast, over, perDay: f.perDay, severity: insightSeverity(over, usualTotal) });
      }
    };
    for (const g of goals) {
      const sums = sumsOf.get(g.participantId)!;
      if (g.type === 'limit') {
        const amount = toUah(g.amount, g.currency, rates);
        if (amount !== null) add(CATEGORY_ID.get(g.category) as KindCategoryId, figures(amount, sums.get(g.category) ?? 0, 'month', pos));
      } else if (g.type === 'budget') {
        const v = budgetView(g, (w) => CATEGORY_ID.get(w) as KindCategoryId, sums, kinds, pos, current, rates);
        if (v) add(null, v.flexible);
      }
    }
    return { limitsOver: limitsOver.sort((a, b) => b.over - a.over), limitsAhead: limitsAhead.sort((a, b) => b.over - a.over), monthlyLimits: goals.length };
  }

  private async jarTitles(db: Db): Promise<string[]> {
    const accounts = (await db.execute(ACCOUNT_NAME_SQL)).rows;
    return accounts.filter((r) => r.kind === 'jar' && r.title).map((r) => String(r.title).trim());
  }

  /**
   * The block's «usual» (data/usual.ts): whole months before the shown one, spending by category and income, folded by
   * today's rates. Income only for a month that is over.
   */
  private async spendingUsual(
    db: Db,
    q: SpendingOverviewQuery,
    period: { from: string; incomplete: boolean; dataUntil: string | null },
    dataFrom: string | null,
    rates: Map<number, FxRate>,
    now: number,
  ): Promise<UsualFound | null> {
    if (period.incomplete && (period.dataUntil === null || period.dataUntil < period.from)) return null;
    const months = usualMonths(q.month, dataFrom);
    if (months.length === 0) return null;
    const filters = { tz: systemTimeZone(), scope: q.scope, ...viewOf(q) };
    // The usual months run up to the shown one without a gap: one grid by month for their spending, and (a month that
    // is over) one income query by month up to the shown month's end. Each month folds as its own summary would.
    const from = monthBounds(months.at(-1)!).from;
    const grid = await spendingGrid(db, { from, to: monthBounds(months[0]!).to, ...filters, unit: 'month' }, now);
    const incomeBy = period.incomplete ? null : await incomeSummary(db, { from, to: monthBounds(q.month).to, ...filters, groupBy: 'month' }, now);
    const incomeOf = (m: string) => (incomeBy?.groups ?? []).filter((g) => g.key === m).reduce((s, g) => s + (toUah(g.total, g.currency, rates) ?? 0), 0);

    const spent = months.map((m) => {
      const byCategory = foldByCategory(cellGroups(grid.cells, (c) => c.bucket === m, (c) => c.category), rates).byCategory;
      return new Map([...byCategory].map(([c, a]) => [c, a.net]));
    });
    const income = period.incomplete ? [] : months.map(incomeOf);
    const u = usualOf(spent);
    if (!u) return null;
    const usual: SpendingUsual = {
      months: months.length,
      running: period.incomplete,
      total: u.total,
      categories: [...u.byCategory]
        .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
        .map(([category, net]) => ({ category, categoryId: CATEGORY_ID.get(category) ?? null, net })),
      income: period.incomplete ? null : { now: incomeOf(q.month), usual: median(income) },
    };
    const totals = spent.map((m) => [...m.values()].reduce((a, b) => a + b, 0));
    return { usual, months, spent: totals, income: period.incomplete ? null : income, byCategory: spent };
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
    filters: { tz: string; scope: CategoryOverviewQuery['scope'] } & ViewFilters,
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

  /**
   * The Insights screen (spec desktop-insights-page): every insight of the month with its weight, its months and its
   * driver, the month against the usual, new payees and one-offs. One read of the lines of every category spent in the
   * month or unusual, over the usual months and the shown one; payees named as on the category screen.
   */
  async insightsOverview(q: SpendingOverviewQuery): Promise<InsightsOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const tz = systemTimeZone();
    const status = await this.status();
    const today = await this.d.rates();
    const rates = rateMap(today);
    const filters = { tz, scope: q.scope, ...viewOf(q) };
    // The month without pending holds (spec desktop-insights-page): an insight does not come and go with them.
    const head = await spendingSummary(db, { ...monthBounds(q.month), ...filters, holds: 'final', groupBy: 'category' }, now);
    const cur = foldByCategory(head, rates).byCategory;
    const spent = [...cur.values()].reduce((s, a) => s + a.net, 0);
    const { from, to, days, coveredDays, incomplete, dataUntil, pendingHolds } = head.period;
    const base = {
      month: q.month,
      period: { from, to, days, coveredDays, incomplete, dataUntil, pendingHolds },
      spent,
      months: usualMonths(q.month, status.dataFrom).length,
      cashCounts: (await getSettings(db)).cash_is_spending,
      rates: today,
    };
    const found = await this.spendingUsual(db, q, head.period, status.dataFrom, rates, now);
    const kinds = await kindMap(db);
    const budget = await this.budgetOf(db, q, { cur, found, incomplete, kinds, rates, now });
    const { limitsOver, limitsAhead, monthlyLimits } = await this.limitSignalsOf(db, q, kinds, found?.usual.total ?? 0, rates, now);
    const standing = healthStanding(budget, monthlyLimits > 0 ? limitsStanding(limitsOver.length, limitsAhead.length) : null);
    if (!found) return { ...base, budget, limitsOver, limitsAhead, monthlyLimits, standing, health: null, history: [], usual: null, cards: [], newPayees: [], oneOffs: [] };

    const { usual, months } = found;
    const ranked = rankedCategories(cur).map(([category, a]) => ({ category, net: a.net }));
    const insights = insightsOf(usual, ranked)?.insights ?? [];
    const categories = [...new Set([...ranked.map((c) => c.category), ...insights.flatMap((i) => (i.category === null ? [] : [i.category]))])];
    const span = { from: monthBounds(months.at(-1)!).from, to: monthBounds(q.month).to };
    const jarTitles = await this.jarTitles(db);
    const lines = categories.length === 0 ? [] : (await linesOfCategories(db, { ...span, ...filters, categories }, now)).lines;
    const rows = lines.map((l) => {
      const date = localDate(l.time * 1000, tz);
      return { id: l.id, category: l.category, date, month: date.slice(0, 7), merchant: merchantText(l.description, jarTitles), uah: toUah(l.amount, l.currency, rates), refundPair: l.refundPair };
    });

    const oldestFirst = <T>(xs: ReadonlyArray<T>) => [...xs].reverse();
    const cards: InsightCardView[] = insights.map((i) => {
      const before =
        i.category === null
          ? months.map((m, k) => ({ month: m, value: found.income?.[k] ?? 0 }))
          : months.map((m, k) => ({ month: m, value: found.byCategory[k]!.get(i.category!) ?? 0 }));
      const driver = i.category === null ? null : mainDriver(i.now - i.usual, payeeMonths(rows.filter((r) => r.category === i.category), q.month, months));
      return { ...i, severity: insightSeverity(i.amount, usual.total), series: [...oldestFirst(before), { month: q.month, value: i.now }], driver };
    });

    // Payees across categories: a new payee's category is where most of its month's spending went.
    const payees = new Map(payeeMonths(rows, q.month, months).map((p) => [merchantKey(p.name), p]));
    const shown = rows.filter((r) => r.month === q.month && r.uah !== null);
    const categoryOf = (key: string): string => {
      const by = new Map<string, number>();
      for (const r of shown) if (r.merchant && merchantKey(r.merchant) === key) by.set(r.category, (by.get(r.category) ?? 0) - r.uah!);
      return [...by].sort(([a, x], [b, y]) => y - x || a.localeCompare(b))[0]?.[0] ?? '';
    };
    const fresh = newPayees([...payees.values()]).map((p) => {
      const category = categoryOf(merchantKey(p.name));
      return { name: p.name, category, categoryId: CATEGORY_ID.get(category) ?? null, amount: p.now, severity: insightSeverity(p.now, usual.total) };
    });
    const ops = shown
      .filter((r) => r.uah! < 0 && !r.refundPair)
      .map((r) => {
        const p = r.merchant ? payees.get(merchantKey(r.merchant)) : undefined;
        return { key: r.id, amount: -r.uah!, payeeUsual: p ? payeeUsual(p) : 0, row: r };
      });
    const big = oneOffs(ops, usual.total).map(({ key, amount, row }) => ({
      key,
      date: row.date,
      name: row.merchant,
      category: row.category,
      categoryId: CATEGORY_ID.get(row.category) ?? null,
      amount,
      severity: insightSeverity(amount, usual.total),
    }));

    const savings =
      usual.income && found.income
        ? savingsRate({ income: usual.income.now, spent }, months.map((_, k) => ({ income: found.income![k]!, spent: found.spent[k]! })))
        : null;
    // The chart's months (spec desktop-insights-health): the usual's, oldest first, then the shown one once finished.
    const shares = (month: string, income: number | null, byCategory: ReadonlyMap<string, number>) => {
      const m = income === null ? null : monthShares(income, byCategory, kinds);
      return {
        month,
        left: m?.left ?? null,
        wants: m?.wants ?? null,
        leftStanding: m ? guideStanding('left', m.left) : null,
        wantsStanding: m ? guideStanding('wants', m.wants) : null,
      };
    };
    // A running month's usual carries no income (its day decides it), so the chart reads the whole months' income once.
    const usualIncome: number[] =
      found.income ??
      (await incomeSummary(db, { from: monthBounds(months.at(-1)!).from, to: monthBounds(months[0]!).to, ...filters, groupBy: 'month' }, now).then((r) =>
        months.map((m) => r.groups.filter((g) => g.key === m).reduce((s, g) => s + (toUah(g.total, g.currency, rates) ?? 0), 0)),
      ));
    const curNet = new Map([...cur].map(([k, a]) => [k, a.net]));
    const history = oldestFirst(months.map((m, k) => shares(m, usualIncome[k]!, found.byCategory[k]!)));
    if (!incomplete) history.push(shares(q.month, budget.month?.income ?? null, curNet));
    const health = healthReferences({
      history,
      usualMonths: oldestFirst(months.map((_, k) => ({ income: usualIncome[k]!, byCategory: found.byCategory[k]! }))),
      kinds,
      budget,
      period: head.period,
      spent,
      usual,
      curNet,
      high: [...cards, ...limitsOver, ...limitsAhead, ...fresh, ...big].filter((x) => x.severity === 'high').length,
    });
    return {
      ...base,
      budget,
      limitsOver,
      limitsAhead,
      monthlyLimits,
      standing,
      health,
      history,
      usual: { months: usual.months, from: months.at(-1)!, to: months[0]!, total: usual.total, income: usual.income, savings },
      cards,
      newPayees: fresh,
      oneOffs: big,
    };
  }

  /** Home's «Recent operations»: the month's newest operations «Spending» counts, with the bank's description. */
  async recentOperations(q: SpendingOverviewQuery): Promise<RecentOperations> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const tz = systemTimeZone();
    const today = await this.d.rates();
    const rates = rateMap(today);
    const jarTitles = (await db.execute(ACCOUNT_NAME_SQL)).rows.filter((r) => r.kind === 'jar' && r.title).map((r) => String(r.title).trim());
    const raw = await latestLines(db, { ...monthBounds(q.month), tz, scope: q.scope, ...viewOf(q) }, RECENT_LINES, now);
    return {
      month: q.month,
      rates: today,
      lines: raw.lines.map((l) => {
        const [date, time] = localDateTime(l.time * 1000, tz).split(' ') as [string, string];
        return {
          key: l.id,
          date,
          time,
          merchant: merchantText(l.description, jarTitles),
          category: l.category,
          categoryId: CATEGORY_ID.get(l.category) ?? null,
          uah: toUah(l.amount, l.currency, rates),
          currency: l.currency,
          amount: l.amount,
          pending: l.hold && l.time >= now - RESYNC_OVERLAP_SEC,
          refund: l.amount > 0,
        };
      }),
    };
  }

  async categoryOverview(q: CategoryOverviewQuery): Promise<CategoryOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const tz = systemTimeZone();
    const category = CATEGORY[q.category];
    const thisDay = localDate(now * 1000, tz);
    const period = periodBounds(q.period, thisDay);
    const status = await this.status();
    const filters = { tz, scope: q.scope, ...viewOf(q) };
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

    const accounts = (await db.execute(ACCOUNT_NAME_SQL)).rows;
    const names = accountNames(accounts.map(accountRow));
    const jarTitles = accounts.filter((r) => r.kind === 'jar' && r.title).map((r) => String(r.title).trim());
    const raw = await categoryLines(db, { ...period, ...filters, category }, now);
    const choices = await categorySources(db, [...new Set(raw.lines.filter((l) => l.kind === 'body' && l.amount < 0).map((l) => l.id))]);
    const lines: CategoryLineView[] = raw.lines.map((l) => {
      const [date, time] = localDateTime(l.time * 1000, tz).split(' ') as [string, string];
      return {
        key: l.kind === 'body' ? l.id : l.kind === 'commission' ? `${l.id}:fee` : `${l.id}:transfer-fee`,
        date,
        time,
        weekday: isoWeekday(date),
        merchant: merchantText(l.description, jarTitles),
        comment: l.comment?.trim() || null,
        participantId: l.participantId,
        account: names.get(l.accountId) ?? { provider: '', kind: 'card', type: null, currency: l.currency, tag: null },
        uah: toUah(l.amount, l.currency, rates),
        currency: l.currency,
        amount: l.amount,
        operation:
          l.operationCurrency !== null && l.operationAmount !== null && l.operationCurrency !== l.currency
            ? { currency: l.operationCurrency, amount: l.operationAmount }
            : null,
        commission: l.kind !== 'body',
        hold: l.hold,
        pending: l.hold && l.time >= now - RESYNC_OVERLAP_SEC,
        refund: l.amount > 0,
        refunded: l.refundPair && l.amount < 0,
        cashback: l.cashback > 0 ? (toUah(l.cashback, l.currency, rates) ?? 0) : 0,
        choice: l.kind === 'body' ? (choices.get(l.id) ?? null) : null,
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
      banks: stats.banks,
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
    filters: { tz: string } & ViewFilters,
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
    const found = await findRecurring(db, { from: since, to: today, tz, ...viewOf(q) }, now);

    const accounts = (await db.execute(ACCOUNT_NAME_SQL)).rows;
    const names = accountNames(accounts.map(accountRow));
    const jarTitles = accounts.filter((r) => r.kind === 'jar' && r.title).map((r) => String(r.title).trim());
    const day = (sec: number) => localDate(sec * 1000, tz);
    const view = (p: (typeof found)[number]): RecurringPaymentView => ({
      key: p.id,
      name: merchantText(p.description, jarTitles),
      category: p.category,
      categoryId: CATEGORY_ID.get(p.category) ?? null,
      participantId: p.participantId,
      account: names.get(p.accountId) ?? { provider: '', kind: 'card', type: null, currency: p.currency, tag: null },
      uah: toUah(p.amount, p.currency, fx),
      currency: p.currency,
      amount: p.amount,
      operation: p.operationCurrency !== p.currency ? { currency: p.operationCurrency, amount: p.operationAmount } : null,
      payments: p.payments,
      mark: p.mark,
      first: day(p.first),
      last: day(p.last),
      next: nextMonthDay(day(p.last)),
    });
    const newest = (a: (typeof found)[number], b: (typeof found)[number]) => b.last - a.last || a.id.localeCompare(b.id);
    const shown = found.filter((p) => p.mark !== 'hidden');
    const active = shown.filter((p) => p.active).map(view).sort((a, b) => (b.uah ?? -1) - (a.uah ?? -1) || a.key.localeCompare(b.key));
    const ended = shown.filter((p) => !p.active && now - p.last <= ENDED_DAYS * 86_400).sort(newest).map(view);
    const hidden = found.filter((p) => p.mark === 'hidden').sort(newest).map(view);
    const total = (ps: RecurringPaymentView[]) => ps.reduce((s, p) => s + (p.uah ?? 0), 0);
    return { since, active, ended, hidden, monthly: total(active), mandatory: total(active.filter((p) => p.mark === 'mandatory')), rates };
  }

  /**
   * «Available per day» (allowance.ts): the cards' own money now (balancesAt now, no jars), the reserve, the regular
   * income and mandatory payments of the last 13 months (findRecurring, active only).
   */
  async allowanceOverview(q: AllowanceQuery): Promise<AllowanceOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const tz = systemTimeZone();
    const today = localDate(now * 1000, tz);
    const rates = await this.d.rates();
    const fx = rateMap(rates);
    const f = viewOf(q);

    const balances = await balancesAt(db, { endSec: now + 1, ...f });
    let money = 0;
    const leftOut: AllowanceOverview['leftOut'] = [];
    for (const a of balances.accounts) {
      if (a.kind === 'jar' || a.own_funds === null) continue;
      const u = toUah(a.own_funds, a.currency, fx);
      if (u === null) leftOut.push({ currency: a.currency, ownFunds: a.own_funds });
      else money += u;
    }

    const accounts = (await db.execute(`SELECT title FROM accounts WHERE kind = 'jar'`)).rows;
    const jarTitles = accounts.filter((r) => r.title).map((r) => String(r.title).trim());
    const period = { from: `${addMonths(today.slice(0, 7), -12)}-01`, to: today, tz, ...f };
    const series = (p: RecurringPayment): AllowanceSeries => ({
      key: p.id,
      name: merchantText(p.description, jarTitles),
      participantId: p.participantId,
      uah: toUah(p.amount, p.currency, fx),
      next: nextMonthDay(localDate(p.last * 1000, tz)),
    });
    const income = (await findRecurring(db, { ...period, kind: 'income' }, now)).filter((p) => p.active).map(series);
    const mandatory = (await findRecurring(db, period, now)).filter((p) => p.active && p.mark === 'mandatory').map(series);
    const reserves = (await this.reservesOn(db, today, fx)).filter((r) => reserveFor(r, q.participantId));
    const reserve = reserves.reduce((s, r) => s + (r.active ? (r.uah ?? 0) : 0), 0);
    return { today, money, leftOut, reserves, ...allowance({ today, money, reserve, income, mandatory }), rates };
  }

  /** Every reserve as of `today`: a reserve counts through its last day; one without a rate is listed, not taken off. */
  private async reservesOn(db: Db, today: string, fx: Map<number, FxRate>): Promise<AllowanceOverview['reserves']> {
    return (await listReserves(db)).map((r) => ({ ...r, active: r.until === null || r.until >= today, uah: toUah(r.amount, r.currency, fx) }));
  }

  /** Reserves of «Available per day» (core reserves.ts). */
  async addReserve(r: ReserveInput): Promise<void> {
    await addReserve(await this.conn(), r, this.d.nowSec());
  }

  async updateReserve(id: number, r: ReserveInput): Promise<void> {
    await updateReserve(await this.conn(), id, r);
  }

  async deleteReserve(id: number): Promise<void> {
    await deleteReserve(await this.conn(), id);
  }

  /**
   * The «Budget» screen (data/limits.ts): the view's plans — a person's and the family's, the family view all — each
   * counted against its owner's «Personal» spending of every bank (one day grid per owner over this month and week, or
   * the past month), the past whole months of the view for suggestions and previews.
   */
  async limitsOverview(q: LimitsOverviewQuery): Promise<LimitsOverview> {
    const db = await this.conn();
    const now = this.d.nowSec();
    const tz = systemTimeZone();
    const today = localDate(now * 1000, tz);
    const thisMonth = today.slice(0, 7);
    const month = q.month > thisMonth ? thisMonth : q.month;
    const current = month === thisMonth;
    const ratesView = await this.d.rates();
    const rates = rateMap(ratesView);
    const kindRows = await categoryKinds(db);
    const kinds = new Map(kindRows.map((r) => [r.category, { kind: r.kind, fixed: r.fixed }]));
    const idOf = (word: string) => CATEGORY_ID.get(word) as KindCategoryId;
    const mine = (owner: number | null) => q.participantId === undefined || owner === null || owner === q.participantId;
    const goals = (await listGoals(db)).filter((g) => mine(g.participantId));

    const bounds = monthBounds(month);
    const monday = shiftDate(today, 1 - isoWeekday(today));
    const from = current ? (monday < bounds.from ? monday : bounds.from) : bounds.from;
    const to = current ? today : bounds.to;
    const sumsOf = async (owner: number | null): Promise<OwnerSums> => {
      const q = { from, to, tz, unit: 'day', scope: 'personal', ...(owner !== null ? { participantId: owner } : {}) } as const;
      const grid = await spendingGrid(db, { ...q, holds: 'all' }, now);
      const held = await spendingGrid(db, { ...q, holds: 'pending' }, now);
      const fold = (cells: readonly SpendingCell[], a: string, b: string) =>
        foldByCategory(cellGroups(cells, (c) => c.bucket >= a && c.bucket <= b, (c) => c.category), rates).byCategory;
      const net = (a: string, b: string): Sums => new Map([...fold(grid.cells, a, b)].map(([k, v]) => [k, v.net]));
      return {
        day: net(today, today),
        week: net(monday, today),
        month: net(bounds.from, to),
        pending: { day: fold(held.cells, today, today), week: fold(held.cells, monday, today), month: fold(held.cells, bounds.from, to) },
      };
    };
    const owners = [...new Set(goals.filter((g) => g.type !== 'saving').map((g) => g.participantId))];
    const sums = new Map<number | null, OwnerSums>();
    for (const o of owners) sums.set(o, await sumsOf(o));
    const pos = (p: 'day' | 'week' | 'month') => periodPosition(p, today, month, current);

    const limits = goals
      .flatMap((g) => (g.type === 'limit' && (current || g.period === 'month') ? [limitView(g, idOf, sums.get(g.participantId)!, pos, rates)] : []))
      .sort((a, b) => STATE_ORDER[a.figures?.state ?? 'ok'] - STATE_ORDER[b.figures?.state ?? 'ok'] || a.categoryId.localeCompare(b.categoryId));
    const budgets = goals.filter((g) => g.type === 'budget');
    const own = q.participantId === undefined ? null : q.participantId;
    const b = budgets.find((g) => g.participantId === own) ?? budgets.find((g) => g.participantId === null) ?? null;
    const budgetSums = b ? sums.get(b.participantId) : undefined;
    const budget = b && b.type === 'budget' && budgetSums ? budgetView(b, idOf, budgetSums.month, kinds, pos('month'), current, rates, budgetSums.pending.month) : null;

    const { dataFrom } = await this.status();
    const months = usualMonths(month, dataFrom);
    let past: Sums[] = [];
    if (months.length > 0) {
      const grid = await spendingGrid(
        db,
        { from: monthBounds(months.at(-1)!).from, to: monthBounds(months[0]!).to, tz, unit: 'month', scope: 'personal', ...(q.participantId !== undefined ? { participantId: q.participantId } : {}) },
        now,
      );
      past = months.map((m) => new Map([...foldByCategory(cellGroups(grid.cells, (c) => c.bucket === m, (c) => c.category), rates).byCategory].map(([k, v]) => [k, v.net])));
    }
    const limited = new Set(goals.flatMap((g) => (g.type === 'limit' && g.period === 'month' && g.participantId === own ? [g.category] : [])));
    const byCategory: LimitsOverview['past']['byCategory'] = {};
    for (const w of kinds.keys()) {
      const values = past.map((m) => m.get(w) ?? 0);
      if (values.some((v) => v !== 0)) byCategory[idOf(w)] = values;
    }
    const { savings, jars } = await this.savingsOf(db, goals, today, rates, now);
    return {
      month,
      today,
      current,
      budget,
      limits,
      savings,
      jars,
      suggestions: suggestions(past, kinds, limited, idOf),
      past: { months, byCategory, total: past.map((m) => [...m.entries()].filter(([w]) => kinds.has(w)).reduce((s, [, v]) => s + v, 0)) },
      kinds: kindRows.flatMap((r) => {
        const categoryId = CATEGORY_ID.get(r.category);
        return categoryId && categoryId !== 'family' && categoryId !== 'ownTransfers' && categoryId !== 'income' ? [{ categoryId, kind: r.kind, fixed: r.fixed, changed: r.changed }] : [];
      }),
      cashCounts: (await getSettings(db)).cash_is_spending,
      rates: ratesView,
    };
  }

  /**
   * Savings goals and the jars a goal can follow: a jar goal's progress is the jar's own money now (none when the jar is
   * gone); «cards and jars» is the owner's money now, an account below zero counted as 0 (credit money is not theirs).
   */
  private async savingsOf(
    db: Db,
    goals: ReadonlyArray<Goal>,
    today: string,
    rates: Map<number, FxRate>,
    now: number,
  ): Promise<{ savings: SavingGoalView[]; jars: GoalJarView[] }> {
    const jarRows = (
      await db.execute(
        `SELECT a.id, c.provider, a.kind, a.type, a.currency_code, a.goal, c.participant_id FROM accounts a JOIN connections c ON c.id = a.connection_id
         WHERE a.kind = 'jar' AND a.id IN (${ENABLED_ACCOUNT_IDS_SQL})`,
      )
    ).rows;
    const names = accountNames(jarRows.map(accountRow));
    const jars = jarRows.map((r) => ({
      id: String(r.id),
      name: names.get(String(r.id))!,
      currency: Number(r.currency_code),
      goal: r.goal === null ? null : Number(r.goal),
      owner: Number(r.participant_id),
    }));
    const saving = goals.filter((g): g is Extract<Goal, { type: 'saving' }> => g.type === 'saving');
    if (saving.length === 0) return { savings: [], jars };
    const own = (a: { own_funds: number | null; currency: number }) => (a.own_funds === null ? 0 : Math.max(0, toUah(a.own_funds, a.currency, rates) ?? 0));
    const all = await balancesAt(db, { endSec: now + 1 });
    const byId = new Map(all.accounts.map((a) => [a.id, a]));
    const ownerMoney = new Map<number | null, number>();
    for (const o of new Set(saving.filter((g) => g.source === 'own').map((g) => g.participantId))) {
      const b = o === null ? all : await balancesAt(db, { endSec: now + 1, participantId: o });
      ownerMoney.set(o, b.accounts.reduce((s, a) => s + own(a), 0));
    }
    const savings = saving.map((g): SavingGoalView => {
      const target = toUah(g.amount, g.currency, rates) ?? 0;
      const jar = g.source === 'jar' && g.accountId ? byId.get(g.accountId) : undefined;
      const money = g.source === 'own' ? (ownerMoney.get(g.participantId) ?? 0) : jar ? own(jar) : null;
      const p = savingProgress(target, money, g.until, today);
      return {
        id: g.id, name: g.name, owner: g.participantId, currency: g.currency, amountMinor: g.amount, until: g.until, source: g.source, accountId: g.accountId,
        target, progress: p.progress, percent: p.percent, left: p.left, perMonth: p.perMonth, months: p.months, overdue: p.overdue,
      };
    });
    return { savings, jars };
  }

  /** A plan from the screen: ids to the core's words. */
  async saveGoal(id: number | null, p: GoalPayload): Promise<void> {
    const g: GoalInput =
      p.type === 'limit'
        ? { type: 'limit', category: CATEGORY[p.categoryId], period: p.period, currency: p.currency, amount: p.amount, participantId: p.participantId }
        : p.type === 'budget'
          ? { type: 'budget', currency: p.currency, amount: p.amount, participantId: p.participantId, fixed: p.fixed.map((r) => ({ category: CATEGORY[r.categoryId], amount: r.amount })), countTaxes: p.countTaxes ?? true }
          : { ...p };
    const db = await this.conn();
    if (id === null) await addGoal(db, g, this.d.nowSec());
    else await updateGoal(db, id, g);
  }

  async deleteGoal(id: number): Promise<void> {
    await deleteGoal(await this.conn(), id);
  }

  /** The view's suggested limits added as monthly limits in hryvnia (the person's, or the family's). */
  async addSuggestedLimits(q: { participantId?: number }): Promise<void> {
    const v = await this.limitsOverview({ month: localDate(this.d.nowSec() * 1000, systemTimeZone()).slice(0, 7), ...q });
    const db = await this.conn();
    for (const s of v.suggestions) {
      await addGoal(db, { type: 'limit', category: CATEGORY[s.categoryId], period: 'month', currency: 980, amount: s.amount, participantId: q.participantId ?? null }, this.d.nowSec());
    }
  }

  /** Every category with a kind (core read/category-kinds), named by the renderer's id. */
  async categoryKinds(): Promise<CategoryKindView[]> {
    return (await categoryKinds(await this.conn())).flatMap((r) => {
      const categoryId = CATEGORY_ID.get(r.category);
      return categoryId && categoryId !== 'family' && categoryId !== 'ownTransfers' && categoryId !== 'income'
        ? [{ categoryId, kind: r.kind, fixed: r.fixed, changed: r.changed }]
        : [];
    });
  }

  async setCategoryKind(q: CategoryKindQuery): Promise<void> {
    await setCategoryKind(await this.conn(), CATEGORY[q.categoryId], { kind: q.kind, fixed: q.fixed }, this.d.nowSec());
  }

  /** Whether cash withdrawals count as spending (core people/settings.ts). */
  async cashCounts(): Promise<boolean> {
    return (await getSettings(await this.conn())).cash_is_spending;
  }

  async setCashCounts(on: boolean): Promise<void> {
    await setSetting(await this.conn(), 'cash_is_spending', on ? 'on' : 'off');
  }

  async resetCategoryKinds(categoryId: KindCategoryId | null): Promise<void> {
    await resetCategoryKinds(await this.conn(), categoryId === null ? null : CATEGORY[categoryId]);
  }

  /** The user's category of a debit, for it or its payee (core commands/categories); the key is the line's id. */
  async setOperationCategory(q: OperationCategoryQuery): Promise<OperationCategoryResult> {
    const category = q.category === null ? null : CATEGORY[q.category];
    const write = q.payee ? setPayeeCategory : setOperationCategory;
    return write(await this.conn(), q.key, category, this.d.nowSec());
  }

  /** A mark on a regular payment's payee, found by the payment `key` (core setRecurringMark). */
  async setRecurringMark(q: RecurringMarkQuery): Promise<void> {
    await setRecurringMark(await this.conn(), q.key, q.mark, this.d.nowSec());
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
    const filters = { tz, ...viewOf(q) };
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

    const accounts = (await db.execute(ACCOUNT_NAME_SQL)).rows;
    const names = accountNames(accounts.map(accountRow));
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
        account: names.get(l.accountId) ?? { provider: '', kind: 'card', type: null, currency: l.currency, tag: null },
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
      banks: stats.banks,
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
    const filters = { tz, ...viewOf(q) };
    const todayRates = await this.d.rates();
    const rates = rateMap(todayRates);
    const sum = (xs: Iterable<number>) => [...xs].reduce((s, x) => s + x, 0);

    const unit = q.from === q.to ? 'day' : 'month';
    const period = { from: monthBounds(q.from).from, to: monthBounds(q.to).to };
    const keys = unit === 'day' ? daysOf(q.from) : monthsBetween(q.from, q.to);
    // Split by bank for spendingByBank; every other figure folds the cells merged back, as without the split.
    const grid = await spendingGrid(db, { ...period, ...filters, unit, byProvider: true }, now);
    const cur = foldCells(mergeCells(grid.cells), keys, rates);
    const spendingByBank = bankSeries(grid.cells, keys, rates);
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
    // Cash withdrawals out of spending: the month block still shows what was withdrawn.
    const cash = (await getSettings(db)).cash_is_spending
      ? null
      : sum((await cashWithdrawn(db, { ...period, ...filters }, now)).map((c) => toUah(c.net, c.currency, rates) ?? 0));

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
      spendingByBank,
      totals: { income: sum(inc.values), spending: sum(spending), prev: prevTotals },
      compare,
      cashWithdrawn: cash,
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
    const prevFrom = shiftDate(monday, -7);
    const { dataFrom } = await this.status();

    const todayRates = await this.d.rates();
    const rates = rateMap(todayRates);
    // One grid by day × category over every span the strip shows (the usual day's window, this month, last week);
    // each span folds as its own summary would: per currency and key, then by today's rates.
    const spanFrom = [windowFrom, month.from, prevFrom].sort()[0]!;
    const grid = await spendingGrid(
      db,
      { from: spanFrom, to: month.to, tz, unit: 'day', scope: 'personal', ...viewOf(q) },
      now,
    );
    const fold = (from: string, to: string, keyOf: (c: SpendingCell) => string) =>
      foldByCategory(cellGroups(grid.cells, (c) => c.bucket >= from && c.bucket <= to, keyOf), rates).byCategory;
    const byCategory = (c: SpendingCell) => c.category;
    const daily = await periodInfo(db, { from: windowFrom, to: today, tz, ...banksOf(q) }, now);
    const week = await periodInfo(db, { from: monday, to: today, tz, ...banksOf(q) }, now);
    // Keyed by the day of the system time zone.
    const byDay = fold(windowFrom, today, (c) => c.bucket);
    const weekByCategory = fold(monday, today, byCategory);
    const todayByCategory = fold(today, today, byCategory);
    const monthRanked = rankedCategories(fold(month.from, month.to, byCategory));

    // The usual day reads only the days the data covers: from its first date to the last fully synced day.
    const lastCovered = daily.coveredDays > 0 ? shiftDate(windowFrom, daily.coveredDays - 1) : null;
    const yesterday = shiftDate(today, -1);
    const usualFrom = dataFrom === null ? null : dataFrom > windowFrom ? dataFrom : windowFrom;
    const usualTo = lastCovered === null ? null : lastCovered < yesterday ? lastCovered : yesterday;
    // Last week is clipped to the same weekdays the data reaches: today is never fully covered, so the cap is
    // dataUntil (capped at today), not the last fully covered day — a fresh sync must not drop a comparison day.
    const reach = daily.dataUntil === null ? null : daily.dataUntil < today ? daily.dataUntil : today;
    const prevTo = reach === null ? null : shiftDate(reach, -7);
    const hasPrev = dataFrom !== null && dataFrom <= prevFrom && prevTo !== null && prevTo >= prevFrom;
    const prevByCategory = hasPrev && prevTo !== null ? fold(prevFrom, prevTo, byCategory) : null;
    const nowCategory = ([category, a]: [string, SpendingAmounts]): NowCategory => {
      const rank = monthRanked.findIndex(([k]) => k === category);
      return { category, categoryId: CATEGORY_ID.get(category) ?? null, ...a, rank: rank >= 0 ? rank : null };
    };
    const weekCategories = rankedCategories(weekByCategory).map(nowCategory);

    return {
      date: today,
      weekday,
      dataUntil: daily.dataUntil,
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
        pendingHolds: week.pendingHolds,
      },
      rates: todayRates,
    };
  }

  /**
   * Enabled accounts only (a disabled one is in no statistic): `dataUntil` agrees with `dataFrom`. How far the data
   * reaches is the live accounts' (LIVE_ACCOUNT_IDS_SQL): a statement file never holds token connections back.
   */
  async status(): Promise<DataStatus> {
    const db = await this.conn();
    const rs = await db.execute(
      `SELECT COUNT(*) AS n, MAX(last_sync_at) AS last,
         (SELECT MIN(newest_synced_time) FROM sync_state WHERE account_id IN (${LIVE_ACCOUNT_IDS_SQL})) AS newest
       FROM sync_state ${IMPORTED_ENABLED}`,
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

  /** Every token connection (the import takes them all; a file connection is filled by uploads only). */
  async connections(): Promise<Array<{ connectionId: number; provider: ProviderId }>> {
    return (await listConnections(await this.conn())).filter((c) => c.method === 'token').map((c) => ({ connectionId: c.id, provider: c.provider }));
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
