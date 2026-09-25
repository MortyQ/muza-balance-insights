// MCP tools over src/summaries.ts and src/status.ts. Every answer is JSON:
// amounts in major units (hryvnias, dollars…) next to their currency code, a period block with `incomplete`,
// and `notes` with diagnostics the model should mention. No counterparty names, descriptions, card numbers,
// IBANs or jar titles — accounts are an id plus a "type/CUR" label.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { CATEGORY } from '@mono/core/categories';
import type { Db } from '../db.ts';
import { currencyAlpha, currencyNumeric, toMajor } from '@mono/core/currency';
import { log } from '../log.ts';
import type { Clock, MonoClient } from '@mono/core/providers/monobank/client';
import { SCOPES } from '@mono/core/scope';
import { getBalances, getSyncStatus } from '@mono/core/status';
import {
  INCOME_GROUP_BY,
  SPENDING_GROUP_BY,
  SummaryError,
  comparePeriods,
  incomeSummary,
  spendingSummary,
  type OperationAmounts,
  type PeriodInfo,
} from '@mono/core/summaries';
import { SEARCH_DEFAULT_LIMIT, SEARCH_MAX_LIMIT, searchTransactions } from '@mono/core/search';
import { syncRecent } from '@mono/core/sync';

export type ToolDeps = {
  db: Db;
  clock: Clock;
  /** Created on first sync_recent call (needs the token); must be in 'fail' rate-limit mode — never block. */
  getApi: () => MonoClient;
  /** Rebuilds the anonymized analysis copy after new data arrives; errors are logged, not returned. */
  refreshCopy?: (db: Db) => Promise<unknown>;
};

/** Errors whose message is safe and useful for the model (bad input, missing token, …). */
export class ToolInputError extends Error {
  override name = 'ToolInputError';
}

/** Minor units → major units of that currency (by its ISO exponent). */
const money = (minor: number, code: number) => toMajor(minor, code);
const moneyOrNull = (minor: number | null, code: number) => (minor === null ? null : money(minor, code));
const cur = (code: number) => currencyAlpha(code);

function operationBlock(o: OperationAmounts | undefined) {
  return o ? { operation: { currency: cur(o.currency), gross: money(o.gross, o.currency), refunds: money(o.refunds, o.currency), net: money(o.net, o.currency) } } : {};
}

/** «ALL» / «eur» / «8» → ISO numeric; unknown → a tool error the model can fix. */
function parseOperationCurrency(code: string | undefined): number | undefined {
  if (code === undefined) return undefined;
  const n = currencyNumeric(code);
  if (n === null) throw new ToolInputError(`Неизвестный код валюты «${code}». Нужен буквенный код ISO 4217: ALL, EUR, USD, PLN…`);
  return n;
}

// ---------- shared input pieces ----------

const DATE = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате YYYY-MM-DD')
  .describe('Календарная дата по Киеву, YYYY-MM-DD. Граница включительно.');

const SPENDING_CATEGORIES = Object.values(CATEGORY).filter((c) => c !== CATEGORY.income && c !== CATEGORY.ownTransfers) as [string, ...string[]];

const FILTERS = {
  scope: z.enum(SCOPES).optional().describe('personal — личные траты, business — ФОП (счёт ФОП, налоги). Без фильтра — всё.'),
  account_id: z.string().min(1).optional().describe('id счёта из get_balances. Без фильтра — все счета.'),
};

const DATES_NOTE =
  'Даты: YYYY-MM-DD, календарные дни по Киеву, обе границы включительно (месяц = 2026-08-01…2026-08-31). ' +
  'Если пользователь говорит «в этом месяце» / «на прошлой неделе» — посчитай даты сам; сегодняшняя дата есть в get_sync_status.';

const MONEY_NOTE =
  'Суммы — в основных единицах (гривны, доллары) рядом с кодом валюты; разные валюты никогда не складываются.';

const OPERATION_CURRENCY = z
  .string()
  .regex(/^[A-Za-z]{3}$/, 'Буквенный код ISO 4217, например ALL')
  .optional()
  .describe('Валюта операции (в чём платили), буквенный код ISO 4217: ALL, EUR, USD, PLN… Не валюта счёта.');

const TRIP_NOTE =
  'Для вопросов о поездках и странах («сколько я потратил в Албании») используй operation_currency (ALL, EUR…) и даты поездки; ' +
  'страну API не отдаёт. Покупки в гривне в те же даты (например, бронирования) этим фильтром не попадут — их ищи ' +
  'через search_transactions по датам или тексту и называй отдельно.';

// ---------- notes ----------

function periodBlock(p: PeriodInfo) {
  return {
    from: p.from,
    to: p.to,
    days: p.days,
    incomplete: p.incomplete,
    data_until: p.dataUntil,
    covered_days: p.coveredDays,
    pending_holds: p.pendingHolds,
  };
}

function periodNotes(p: PeriodInfo, label = 'Период'): string[] {
  const notes: string[] = [];
  if (p.dataUntil === null) {
    notes.push('Данных нет: синхронизация ещё не выполнялась (пользователь запускает pnpm --filter @mono/mcp sync в терминале).');
  } else if (p.incomplete) {
    notes.push(
      `${label} ${p.from}…${p.to} неполный: данные синхронизированы по ${p.dataUntil}, полностью покрыто ${p.coveredDays} из ${p.days} дн. ` +
        'Итоги ещё вырастут — для сравнения используй средние в день.',
    );
  }
  if (p.pendingHolds > 0) notes.push(`${label}: ${p.pendingHolds} незавершённых холдов за последние 3 дня — их суммы могут измениться.`);
  return notes;
}

async function staleNote(db: Db, nowMs: number): Promise<string[]> {
  const rs = await db.execute('SELECT MAX(last_sync_at) AS last FROM sync_state');
  const last = rs.rows[0]?.last;
  if (last === null || last === undefined) return [];
  const hours = Math.floor((nowMs / 1000 - Number(last)) / 3600);
  return hours >= 24 ? [`Последняя синхронизация ${hours} ч назад — чтобы учесть свежие операции, вызови sync_recent.`] : [];
}

function currencyNote(currencies: Iterable<number>): string[] {
  return new Set(currencies).size > 1 ? ['Есть операции в нескольких валютах счетов: итоги по каждой валюте отдельно, не складывай их.'] : [];
}

const SPENDING_RULES =
  'Траты = списания без внутренних переводов между своими счетами и без поступлений; возвраты вычтены (net = gross − refunds); ' +
  'комиссии банка — отдельная категория «комиссии банка».';

// ---------- server ----------

function ok(payload: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}

function fail(message: string): CallToolResult {
  return { isError: true, content: [{ type: 'text', text: message }] };
}

/** Runs a tool body; input errors go back to the model, anything else is logged and reported generically. */
async function run(name: string, body: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return ok(await body());
  } catch (err) {
    if (err instanceof SummaryError || err instanceof ToolInputError) return fail(err.message);
    log.error(`Тул ${name} упал: ${err instanceof Error ? err.message : 'неизвестная ошибка'}`);
    return fail(`Внутренняя ошибка в ${name}. Подробности — в логе MCP-сервера.`);
  }
}

export function createServer(deps: ToolDeps): McpServer {
  const { db, clock } = deps;
  const nowSec = () => Math.floor(clock.nowMs() / 1000);
  const server = new McpServer({ name: 'monobank', version: '0.1.0' });

  server.registerTool(
    'spending_summary',
    {
      title: 'Траты за период',
      description: [
        'Сколько и на что потрачено за период: брутто, возвраты и нетто по группам, итог и среднее в день по каждой валюте счёта.',
        'Используй для вопросов «сколько я потратил…», «на что уходят деньги», «траты по месяцам / счетам / MCC», «личные vs ФОП».',
        DATES_NOTE,
        MONEY_NOTE,
        SPENDING_RULES,
        'group_by: category (по умолчанию) | month | account | mcc | scope | operation_currency.',
        'currency и суммы gross/refunds/net — в валюте счёта (что реально списано). Блок operation — те же строки в валюте операции, ' +
          'есть только если у группы одна валюта операции.',
        TRIP_NOTE,
        'Если period.incomplete = true — период ещё не закончился или данные не досинхронизированы: скажи об этом пользователю.',
        'НЕ делает: не показывает отдельные операции и мерчантов (для этого search_transactions), не считает поступления (для них income_summary), ' +
          'не сравнивает периоды (для этого compare_periods), не синхронизирует данные.',
      ].join('\n'),
      inputSchema: {
        from: DATE,
        to: DATE,
        group_by: z.enum(SPENDING_GROUP_BY).optional().describe('Группировка, по умолчанию category.'),
        ...FILTERS,
        operation_currency: OPERATION_CURRENCY,
        category: z.enum(SPENDING_CATEGORIES).optional().describe('Только одна категория трат.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (a) =>
      run('spending_summary', async () => {
        const s = await spendingSummary(
          db,
          {
            from: a.from, to: a.to, groupBy: a.group_by, scope: a.scope, accountId: a.account_id, category: a.category,
            operationCurrency: parseOperationCurrency(a.operation_currency),
          },
          nowSec(),
        );
        return {
          period: periodBlock(s.period),
          group_by: s.groupBy,
          filters: {
            ...s.filters,
            ...(s.filters.operationCurrency !== undefined ? { operationCurrency: cur(s.filters.operationCurrency) } : {}),
          },
          groups: s.groups.map((g) => ({
            currency: cur(g.currency),
            key: g.key,
            ...(g.label ? { account: g.label } : {}),
            lines: g.lines,
            gross: money(g.gross, g.currency),
            refunds: money(g.refunds, g.currency),
            net: money(g.net, g.currency),
            net_per_day: moneyOrNull(g.netPerDay, g.currency),
            ...operationBlock(g.operation),
          })),
          totals: s.totals.map((t) => ({
            currency: cur(t.currency),
            lines: t.lines,
            gross: money(t.gross, t.currency),
            refunds: money(t.refunds, t.currency),
            net: money(t.net, t.currency),
            net_per_day: moneyOrNull(t.netPerDay, t.currency),
            ...operationBlock(t.operation),
          })),
          notes: [
            ...periodNotes(s.period),
            ...currencyNote(s.totals.map((t) => t.currency)),
            ...(s.groups.length === 0 ? ['Трат в этом периоде с этими фильтрами нет.'] : []),
            ...(await staleNote(db, clock.nowMs())),
            SPENDING_RULES,
          ],
        };
      }),
  );

  server.registerTool(
    'compare_periods',
    {
      title: 'Сравнение трат за два периода',
      description: [
        'Сравнивает нетто-траты периода B с базовым периодом A по группам: A, B, разница (B − A), % от A, новые и исчезнувшие группы.',
        'Используй для «сколько я потратил в августе по сравнению с июлем», «что выросло», «где стал тратить больше».',
        DATES_NOTE,
        MONEY_NOTE,
        SPENDING_RULES,
        'Если периоды разной длины или один неполный — сравнивай totals.a_per_day и b_per_day, а не суммы.',
        TRIP_NOTE,
        'НЕ делает: не объясняет причины роста, не показывает отдельные операции и мерчантов, не сравнивает поступления.',
      ].join('\n'),
      inputSchema: {
        a_from: DATE.describe('Начало базового периода A (YYYY-MM-DD, включительно).'),
        a_to: DATE.describe('Конец базового периода A (YYYY-MM-DD, включительно).'),
        b_from: DATE.describe('Начало сравниваемого периода B (YYYY-MM-DD, включительно).'),
        b_to: DATE.describe('Конец сравниваемого периода B (YYYY-MM-DD, включительно).'),
        group_by: z.enum(SPENDING_GROUP_BY).optional().describe('Группировка, по умолчанию category.'),
        ...FILTERS,
        operation_currency: OPERATION_CURRENCY,
        category: z.enum(SPENDING_CATEGORIES).optional().describe('Только одна категория трат.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (a) =>
      run('compare_periods', async () => {
        const c = await comparePeriods(
          db,
          {
            a: { from: a.a_from, to: a.a_to },
            b: { from: a.b_from, to: a.b_to },
            groupBy: a.group_by,
            scope: a.scope,
            accountId: a.account_id,
            category: a.category,
            operationCurrency: parseOperationCurrency(a.operation_currency),
          },
          nowSec(),
        );
        const unequal = c.a.days !== c.b.days || c.a.incomplete || c.b.incomplete;
        return {
          period_a: periodBlock(c.a),
          period_b: periodBlock(c.b),
          group_by: c.groupBy,
          rows: c.rows.map((r) => ({
            currency: cur(r.currency),
            key: r.key,
            ...(r.label ? { account: r.label } : {}),
            a: money(r.a, r.currency),
            b: money(r.b, r.currency),
            diff: money(r.diff, r.currency),
            diff_pct: r.diffPct,
            status: r.status,
          })),
          totals: c.totals.map((t) => ({
            currency: cur(t.currency),
            a: money(t.a, t.currency),
            b: money(t.b, t.currency),
            diff: money(t.diff, t.currency),
            diff_pct: t.diffPct,
            a_per_day: moneyOrNull(t.aPerDay, t.currency),
            b_per_day: moneyOrNull(t.bPerDay, t.currency),
          })),
          notes: [
            ...periodNotes(c.a, 'Период A'),
            ...periodNotes(c.b, 'Период B'),
            ...(unequal ? ['Периоды разной длины или неполные: честное сравнение — a_per_day против b_per_day.'] : []),
            ...currencyNote(c.totals.map((t) => t.currency)),
            'status: both — есть в обоих периодах, new — только в B, gone — только в A; diff_pct = null, если в A было 0.',
            ...(await staleNote(db, clock.nowMs())),
          ],
        };
      }),
  );

  server.registerTool(
    'income_summary',
    {
      title: 'Поступления за период',
      description: [
        'Сколько денег пришло за период, по источнику, месяцу, счёту или scope; итог и среднее в день по каждой валюте.',
        'Используй для «сколько я заработал / получил», «доход ФОП в долларах», «поступления по месяцам».',
        DATES_NOTE,
        MONEY_NOTE,
        'source (по форме операции, не по имени): named_sender — перевод «Від: …» (люди и клиенты ФОП), ' +
          'other_bank — перевод из другого банка, transfer — прочие входящие переводы, other — остальное.',
        'НЕ делает: не считает внутренние переводы между своими счетами и возвраты покупок доходом, не учитывает кэшбэк, ' +
          'не называет отправителей.',
      ].join('\n'),
      inputSchema: {
        from: DATE,
        to: DATE,
        group_by: z.enum(INCOME_GROUP_BY).optional().describe('Группировка, по умолчанию source.'),
        ...FILTERS,
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (a) =>
      run('income_summary', async () => {
        const s = await incomeSummary(db, { from: a.from, to: a.to, groupBy: a.group_by, scope: a.scope, accountId: a.account_id }, nowSec());
        return {
          period: periodBlock(s.period),
          group_by: s.groupBy,
          filters: s.filters,
          groups: s.groups.map((g) => ({
            currency: cur(g.currency),
            key: g.key,
            ...(g.label ? { account: g.label } : {}),
            lines: g.lines,
            total: money(g.total, g.currency),
            total_per_day: moneyOrNull(g.totalPerDay, g.currency),
          })),
          totals: s.totals.map((t) => ({ currency: cur(t.currency), lines: t.lines, total: money(t.total, t.currency), total_per_day: moneyOrNull(t.totalPerDay, t.currency) })),
          notes: [
            ...periodNotes(s.period),
            ...currencyNote(s.totals.map((t) => t.currency)),
            ...(s.groups.length === 0 ? ['Поступлений в этом периоде с этими фильтрами нет.'] : []),
            ...(await staleNote(db, clock.nowMs())),
          ],
        };
      }),
  );

  server.registerTool(
    'search_transactions',
    {
      title: 'Поиск операций',
      description: [
        'Отдельные операции за период: дата и время, сумма в валюте счёта, сумма и валюта операции, мерчант, категория, MCC, счёт.',
        'Используй для «где я покупал…», «покажи траты в ALL», «сколько раз я был в X», «найди платёж на 500 грн», ' +
          'и чтобы расшифровать итог spending_summary.',
        DATES_NOTE,
        TRIP_NOTE,
        'text ищет по описанию операции (мерчанту) и по контрагенту без учёта регистра, в том числе кириллицу. ' +
          'min_amount / max_amount — модуль суммы в валюте счёта, включительно.',
        'Имена людей в ответе — только инициалы («О. Т.»); номера карт скрыты. amount < 0 — списание, > 0 — зачисление.',
        `Ответ: total — сколько совпало всего, truncated — показаны не все (limit по умолчанию ${SEARCH_DEFAULT_LIMIT}, максимум ${SEARCH_MAX_LIMIT}); ` +
          'totals и operation_totals считаются по ВСЕМ совпадениям, а не только по показанным.',
        'НЕ делает: не отдаёт полные имена контрагентов и номера карт, не знает страну операции, не считает траты по правилам ' +
          'spending_summary (внутренние переводы и поступления здесь тоже видны — смотри поля internal и category).',
      ].join('\n'),
      inputSchema: {
        from: DATE,
        to: DATE,
        operation_currency: OPERATION_CURRENCY,
        text: z.string().min(1).max(100).optional().describe('Часть названия мерчанта или контрагента, любой регистр.'),
        min_amount: z.number().nonnegative().optional().describe('Минимальный модуль суммы в валюте счёта, основные единицы (500 = 500 ₴).'),
        max_amount: z.number().nonnegative().optional().describe('Максимальный модуль суммы в валюте счёта, основные единицы.'),
        category: z.enum(Object.values(CATEGORY) as [string, ...string[]]).optional().describe('Категория операции.'),
        ...FILTERS,
        limit: z.number().int().min(1).max(SEARCH_MAX_LIMIT).optional().describe(`Сколько операций показать, по умолчанию ${SEARCH_DEFAULT_LIMIT}.`),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (a) =>
      run('search_transactions', async () => {
        const r = await searchTransactions(
          db,
          {
            from: a.from, to: a.to, operationCurrency: parseOperationCurrency(a.operation_currency), text: a.text,
            minAmount: a.min_amount, maxAmount: a.max_amount, category: a.category, scope: a.scope, accountId: a.account_id, limit: a.limit,
          },
          nowSec(),
        );
        const totals = (list: typeof r.totals) =>
          list.map((t) => ({ currency: cur(t.currency), lines: t.lines, debits: money(t.debits, t.currency), credits: money(t.credits, t.currency) }));
        return {
          period: periodBlock(r.period),
          total: r.total,
          truncated: r.truncated,
          limit: r.limit,
          transactions: r.transactions.map((t) => ({
            time: t.time,
            amount: money(t.amount, t.currency),
            currency: cur(t.currency),
            operation_amount: money(t.operationAmount, t.operationCurrency),
            operation_currency: cur(t.operationCurrency),
            merchant: t.merchant,
            ...(t.counterparty ? { counterparty: t.counterparty } : {}),
            category: t.category,
            mcc: t.mcc,
            account: t.account,
            scope: t.scope,
            ...(t.internal ? { internal: true } : {}),
            ...(t.hold ? { hold: true } : {}),
          })),
          totals: totals(r.totals),
          operation_totals: totals(r.operationTotals),
          notes: [
            ...(r.truncated ? [`Показано ${r.transactions.length} из ${r.total}: сузь фильтры или увеличь limit (до ${SEARCH_MAX_LIMIT}). totals — по всем ${r.total}.`] : []),
            ...(r.total === 0 ? ['Ничего не найдено с этими фильтрами.'] : []),
            ...periodNotes(r.period),
            'totals — в валюте счёта (списано), operation_totals — в валюте операции; валюты не складываются.',
            ...(await staleNote(db, clock.nowMs())),
          ],
        };
      }),
  );

  server.registerTool(
    'get_balances',
    {
      title: 'Балансы счетов',
      description: [
        'Текущие балансы карт и банок: own_funds (собственные деньги), credit_limit, available (что показывает банк).',
        'Используй для «сколько у меня денег», «какой долг по кредитке», «сколько на банке». Также даёт id счетов для фильтра account_id.',
        MONEY_NOTE,
        'Главное число — own_funds = available − credit_limit. У кредитки available включает кредитный лимит банка: ' +
          'не называй его деньгами пользователя; отрицательный own_funds — это долг.',
        'Баланс — на момент updated_at (обновляется командой pnpm --filter @mono/mcp sync в терминале; sync_recent балансы не обновляет).',
        'НЕ делает: не обновляет балансы (для этого sync_recent), не показывает историю и номера карт.',
      ].join('\n'),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      run('get_balances', async () => {
        const b = await getBalances(db);
        return {
          accounts: b.accounts.map((x) => ({
            id: x.id,
            account: x.label,
            kind: x.kind,
            currency: cur(x.currency),
            own_funds: money(x.own_funds, x.currency),
            credit_limit: money(x.credit_limit, x.currency),
            available: money(x.available, x.currency),
            updated_at: x.updated_at,
          })),
          totals: b.totals.map((t) => ({ currency: cur(t.currency), own_funds: money(t.own_funds, t.currency) })),
          notes: [
            'own_funds — собственные деньги (основное число); available у кредитки включает лимит банка.',
            ...currencyNote(b.totals.map((t) => t.currency)),
            ...(await staleNote(db, clock.nowMs())),
          ],
        };
      }),
  );

  server.registerTool(
    'get_sync_status',
    {
      title: 'Статус данных',
      description: [
        'Насколько свежие данные: сегодняшняя дата, покрытый период по каждому счёту, дата последней синхронизации, ' +
          'когда Monobank разрешит следующий запрос, диагностика разметки.',
        'Используй, когда пользователь спрашивает, актуальны ли данные, перед ответом про «сегодня / эту неделю», ' +
          'или чтобы узнать сегодняшнюю дату для расчёта периода.',
        'НЕ делает: не синхронизирует (для этого sync_recent), не показывает операции.',
      ].join('\n'),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () =>
      run('get_sync_status', async () => {
        const s = await getSyncStatus(db, clock.nowMs());
        const notImported = s.accounts.filter((x) => !x.imported);
        return {
          today: new Date(clock.nowMs()).toLocaleDateString('sv-SE', { timeZone: 'Europe/Kyiv' }),
          accounts: s.accounts.map(({ label, ...x }) => ({ account: label, ...x })),
          data_until: s.data_until,
          last_sync_at: s.last_sync_at,
          next_request_at: s.next_request_at,
          diagnostics: s.diagnostics,
          notes: [
            ...(notImported.length > 0
              ? [`Не импортированы: ${notImported.map((x) => x.label).join(', ')} — нужен pnpm --filter @mono/mcp sync --since YYYY-MM-DD в терминале.`]
              : []),
            ...(s.diagnostics.unpaired_service_4829 > 0
              ? [`${s.diagnostics.unpaired_service_4829} служебных переводов между своими счетами без пары — часть внутренних переводов могла попасть в траты.`]
              : []),
            ...(s.diagnostics.pending_holds > 0 ? [`${s.diagnostics.pending_holds} незавершённых холдов за последние 3 дня.`] : []),
            ...(await staleNote(db, clock.nowMs())),
            'Время — по Киеву. data_until — дата, по которую покрыты все счета.',
          ],
        };
      }),
  );

  server.registerTool(
    'sync_recent',
    {
      title: 'Подтянуть свежие операции',
      description: [
        'Загружает из Monobank новые операции с момента последней синхронизации.',
        'Используй, когда данные устарели (notes других тулов об этом скажут) или пользователь просит обновить.',
        'Лимит Monobank — 1 запрос в минуту: за один вызов обновляется, как правило, один счёт (самый давний), ' +
          'остальные вернутся со status = rate-limited и retry_after_sec. Не вызывай в цикле — скажи пользователю, когда повторить.',
        'НЕ делает: не обновляет балансы счетов (их обновляет pnpm --filter @mono/mcp sync в терминале), не загружает историю старше одного окна (31 день), ' +
          'не ждёт лимит.',
      ].join('\n'),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () =>
      run('sync_recent', async () => {
        let api: MonoClient;
        try {
          api = deps.getApi();
        } catch (err) {
          throw new ToolInputError(err instanceof Error ? err.message : 'Не удалось создать клиент Monobank');
        }
        const warnings: string[] = [];
        const results = await syncRecent({
          db, api, clock,
          warn: (m) => {
            warnings.push(m);
            log.warn(m); // ids only, no names — stays in the server log
          },
        });
        const labels = new Map((await getBalances(db)).accounts.map((x) => [x.id, x.label]));
        const synced = results.filter((r) => r.status === 'synced');
        if (synced.length > 0 && deps.refreshCopy) {
          try {
            await deps.refreshCopy(db);
          } catch (err) {
            log.error(`Обезличенная копия не обновлена: ${err instanceof Error ? err.message : 'неизвестная ошибка'}`);
          }
        }
        const limited = results.filter((r) => r.status === 'rate-limited');
        const full = results.filter((r) => r.status === 'needs-full-sync' || r.status === 'not-imported');
        return {
          results: results.map((r) => ({
            account_id: r.accountId,
            account: labels.get(r.accountId) ?? r.accountId,
            status: r.status,
            ...(r.status === 'synced' ? { new_or_updated: r.result.upserted, cancelled_holds: r.result.cancelledHolds } : {}),
            ...(r.status === 'rate-limited' ? { retry_after_sec: r.retryAfterSec } : {}),
          })),
          notes: [
            ...(limited.length > 0
              ? [`Лимит Monobank: ещё ${limited.length} счёт(ов) не обновлено, повтори через ${Math.max(...limited.map((r) => (r.status === 'rate-limited' ? r.retryAfterSec : 0)))} с.`]
              : []),
            ...(full.length > 0 ? ['Часть счетов требует полной синхронизации: пользователь запускает pnpm --filter @mono/mcp sync в терминале.'] : []),
            ...(warnings.length > 0 ? [`Предупреждений синхронизации: ${warnings.length} (подробности в логе сервера).`] : []),
          ],
        };
      }),
  );

  return server;
}
