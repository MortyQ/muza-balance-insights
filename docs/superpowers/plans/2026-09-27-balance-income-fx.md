# «Пришло / Ушло» с валютой по курсу своих обменов — план

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Цель:** доход и траты в валюте (доллары на ФОП) входят в «Пришло / Ушло» блока балансов в гривне — по курсу
собственных обменов пользователя; такая сумма помечена «≈», курс виден в панели месяца.

**Почему:** сейчас `DataService.monthOverview` берёт из `incomeSummary` / `spendingSummary` только итог в UAH. Доход
ФОП приходит в USD (единственная крупная строка «поступления»), а продажа $ → ₴ и перевод ₴ ФОП → карта — свои
переводы (`pair_fx`, `pair`), размечены верно и доходом не считаются. Итог: «Пришло» — только мелкие гривневые
зачисления, «потрачено N% прихода» бессмыслен.

**Архитектура:** новый модуль ядра `packages/core/src/fx.ts` — курс месяца по валютам из строк `pair_fx` на
гривневых счетах (обе суммы есть в строке: `amount` в ₴, `operation_amount` в валюте). `monthOverview` считает курсы
один раз и сворачивает итоги по валютам в гривну; `CardTotal` получает список пересчитанных частей. Renderer рисует
«≈» и строку курса. Карты отдельных счетов (режим человека) не меняются — там всё в валюте счёта. Остатки
(`ownFunds` / `others`) не меняются. MCP (`incomeSummary`, `spendingSummary`) не меняется.

**Tech Stack:** TypeScript, SQLite (`Db`), vitest, Vue 3.5 + Tailwind v4.

---

## Правило курса (одно место — `fx.ts`)

- Источник — неотменённые строки `transfer_rule = 'pair_fx'` на счёте в UAH (`accounts.currency_code = 980`), где
  `transactions.currency_code ≠ 980` и `operation_amount ≠ 0`. Курс строки = `|amount| / |operation_amount|`
  (копейки ₴ за минорную единицу валюты; у всех валют Monobank 2 знака).
  `transfer_rule = 'family'` сюда не попадает — у таких строк правило другое, это нормально.
- **Продажа** (гривна пришла: `amount > 0`) — основной источник. **Покупка** (`amount < 0`) — только если продаж этой
  валюты нет вообще: курс покупки выше, доход по нему завышается.
- Курс месяца `[from, to]` (по `local_date`): средневзвешенный по продажам месяца —
  `Σ|amount| / Σ|operation_amount|`, `nearest = false`. Продаж в месяце нет — одна ближайшая по времени продажа к
  месяцу (до начала или после конца; равенство — более ранняя), `nearest = true`. Продаж нет вообще — так же по
  покупкам. Нет ни того, ни другого — курса нет.
- Пересчёт: `Math.round(minor × rate)`. Валюта без курса в сумму не входит и показывается отдельно («без $…»).
- Курсы общие для семьи (это факт рынка, не участника): считаются без фильтра участника.

## Контракт (`apps/desktop/src/shared/api.ts`)

```ts
/** A foreign-currency part of a card's income / spending, converted to hryvnia by the user's own exchanges. */
export type FxPart = {
  currency: number;
  /** Minor units of `currency`. */
  income: number;
  spending: number;
  /** Hryvnia kopecks per minor unit; null — no exchange of this currency at all, the part is left out of the sums. */
  rate: number | null;
  /** The rate is from the nearest exchange, not from this month's. */
  nearest: boolean;
};
// CardTotal: income / spending — hryvnia including the converted parts; new field `fx: FxPart[]` (UAH never in it).
```

## Файлы

- Create: `packages/core/src/fx.ts`, `packages/core/tests/fx.test.ts`
- Modify: `apps/desktop/src/shared/api.ts`,
  `apps/desktop/src/main/data.ts`, `apps/desktop/tests/data.test.ts`
- Modify: `apps/desktop/src/renderer/src/features/balances/{types.ts,utils.ts,components/FlowBars.vue,components/MonthPanel.vue,BalancesFeature.vue}`,
  `apps/desktop/tests/renderer/balances.test.ts`
- Modify: `docs/superpowers/specs/2026-09-27-balance-cards-design.md`, `.agents/project/domain-rules.md`, `CHANGELOG.md`

---

### Задача 1: ядро — `exchangeRates`

**Files:** Create `packages/core/src/fx.ts`, `packages/core/tests/fx.test.ts`

- [ ] **Шаг 1: тесты** (`packages/core/tests/fx.test.ts`, фикстуры вымышленные, хелперы как в `balances-at.test.ts`)

```ts
// Month rates of foreign currencies from the user's own exchanges (pair_fx rows on hryvnia accounts).
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.ts';
import { kyivStartOfDay } from '../src/format.ts';
import { exchangeRates, toUah } from '../src/fx.ts';
import { insertAccountRow, memoryDb } from './helpers.ts';

let db: Db;
let seq = 0;
const USD = 840;
const EUR = 978;

async function acc(id: string, currency: number) {
  await insertAccountRow(db, { id, kind: 'card', type: 'fop', currency_code: currency, balance: 0, credit_limit: 0, updated_at: 0 });
}
/** One row; `date` Kyiv YYYY-MM-DD, time = noon of that day. */
async function row(accountId: string, date: string, amount: number, opCurrency: number, opAmount: number, o: { rule?: string | null; cancelled?: number } = {}) {
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, operation_amount, currency_code,
            is_cancelled, transfer_rule, raw_json, synced_at) VALUES (?, ?, ?, ?, '', 4829, 0, ?, ?, ?, ?, ?, '{}', 0)`,
    args: [`t${++seq}`, accountId, kyivStartOfDay(date) + 12 * 3600, date, amount, opAmount, opCurrency, o.cancelled ?? 0,
      o.rule === undefined ? 'pair_fx' : o.rule],
  });
}
const SEP = { from: '2026-09-01', to: '2026-09-30' };

beforeEach(async () => { seq = 0; db = await memoryDb(); await acc('uah', 980); await acc('usd', USD); });
afterEach(() => db.close());

describe('exchangeRates', () => {
  it('weights the month\'s sales: Σ hryvnia / Σ currency', async () => {
    await row('uah', '2026-09-05', 400_000, USD, 10_000); // 40.00
    await row('uah', '2026-09-20', 1_260_000, USD, 30_000); // 42.00
    await row('usd', '2026-09-05', -10_000, 980, -400_000); // the other half: never a source
    const r = await exchangeRates(db, SEP);
    expect(r.get(USD)).toEqual({ rate: 41.5, nearest: false });
  });

  it('no sale in the month → the nearest sale in time, before or after', async () => {
    await row('uah', '2026-08-25', 400_000, USD, 10_000); // 6 days before
    await row('uah', '2026-10-03', 420_000, USD, 10_000); // 3 days after — nearer
    expect((await exchangeRates(db, SEP)).get(USD)).toEqual({ rate: 42, nearest: true });
  });

  it('equal distance → the earlier sale', async () => {
    await row('uah', '2026-08-31', 400_000, USD, 10_000);
    await row('uah', '2026-10-01', 420_000, USD, 10_000);
    expect((await exchangeRates(db, SEP)).get(USD)).toEqual({ rate: 40, nearest: true });
  });

  it('purchases only when the currency was never sold', async () => {
    await row('uah', '2026-09-10', -520_000, EUR, -10_000); // bought € at 52.00
    await row('uah', '2026-09-11', -450_000, USD, -10_000); // bought $ at 45.00 …
    await row('uah', '2026-07-01', 400_000, USD, 10_000); // … but $ was sold once: the sale wins
    const r = await exchangeRates(db, SEP);
    expect(r.get(EUR)).toEqual({ rate: 52, nearest: false });
    expect(r.get(USD)).toEqual({ rate: 40, nearest: true });
  });

  it('skips cancelled rows, other rules and rows without an operation amount', async () => {
    await row('uah', '2026-09-05', 400_000, USD, 10_000, { cancelled: 1 });
    await row('uah', '2026-09-06', 400_000, USD, 10_000, { rule: 'family' });
    await row('uah', '2026-09-07', 400_000, USD, 10_000, { rule: null });
    await row('uah', '2026-09-08', 400_000, USD, 0);
    expect((await exchangeRates(db, SEP)).size).toBe(0);
  });

  it('toUah rounds to a kopeck; hryvnia passes through', () => {
    const rates = new Map([[USD, { rate: 44.355, nearest: false }]]);
    expect(toUah(316_200, USD, rates)).toBe(14_025_051);
    expect(toUah(5_000, 980, rates)).toBe(5_000);
    expect(toUah(5_000, EUR, rates)).toBeNull();
  });
});
```

- [ ] **Шаг 2:** `pnpm --filter @mono/core exec vitest run tests/fx.test.ts` → FAIL (нет модуля).

- [ ] **Шаг 3: реализация** `packages/core/src/fx.ts`

```ts
// Rates of foreign currencies from the user's own exchanges: the hryvnia side of a pair_fx row holds both amounts.
import type { Db } from './db.ts';

const UAH = 980;

export type FxRate = { rate: number; nearest: boolean };

type Ex = { currency: number; time: number; date: string; uah: number; minor: number; sale: boolean };

/**
 * Hryvnia kopecks per minor unit of each currency for the month [from, to] (Kyiv local_date). Sales (hryvnia in) are
 * the source; purchases only for a currency that was never sold. The month's sales weighted by amount, else the one
 * nearest in time (a tie → the earlier), nearest = true.
 */
export async function exchangeRates(db: Db, q: { from: string; to: string }): Promise<Map<number, FxRate>> {
  const rs = await db.execute({
    sql: `SELECT t.currency_code AS currency, t.time, t.local_date, t.amount, t.operation_amount
          FROM transactions t JOIN accounts a ON a.id = t.account_id
          WHERE t.is_cancelled = 0 AND t.transfer_rule = 'pair_fx' AND a.currency_code = ?
            AND t.currency_code <> ? AND t.operation_amount <> 0 AND t.amount <> 0`,
    args: [UAH, UAH],
  });
  const byCurrency = new Map<number, Ex[]>();
  for (const r of rs.rows) {
    const e: Ex = {
      currency: Number(r.currency), time: Number(r.time), date: String(r.local_date),
      uah: Math.abs(Number(r.amount)), minor: Math.abs(Number(r.operation_amount)), sale: Number(r.amount) > 0,
    };
    byCurrency.set(e.currency, [...(byCurrency.get(e.currency) ?? []), e]);
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
    // Distance in days to the month: before it → from − date, after it → date − to.
    const gap = (e: Ex) => (e.date < q.from ? dayDiff(e.date, q.from) : dayDiff(q.to, e.date));
    const best = [...pool].sort((x, y) => gap(x) - gap(y) || x.time - y.time)[0];
    if (best) out.set(currency, { rate: best.uah / best.minor, nearest: true });
  }
  return out;
}

function dayDiff(a: string, b: string): number {
  return (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000;
}

/** Minor units of `currency` in hryvnia kopecks; hryvnia as is; null — no rate. */
export function toUah(minor: number, currency: number, rates: ReadonlyMap<number, FxRate>): number | null {
  if (currency === UAH) return minor;
  const r = rates.get(currency);
  return r ? Math.round(minor * r.rate) : null;
}
```

  `Date.parse` с явной датой — не часы: `purity.test.ts` запрещает только `Date.now()` / `new Date()` без аргументов.

- [ ] **Шаг 4:** экспорт не нужен (`"./*": "./src/*.ts"`), импорт — `@mono/core/fx`. `pnpm --filter @mono/core test` + `pnpm --filter @mono/core typecheck` → PASS.
- [ ] **Шаг 5:** коммит `feat(core): month exchange rates from the user's own currency sales`.

### Задача 2: main — пересчёт в `monthOverview`

**Files:** `apps/desktop/src/shared/api.ts`, `apps/desktop/src/main/data.ts`, `apps/desktop/tests/data.test.ts`

- [ ] **Шаг 1: тесты** в `describe('DataService.monthOverview')` (хелперы файла; суммы вымышленные):
  - счёт ФОП в USD: «поступления» +1 000.00 $ (100 000 центов) в марте; гривневый ФОП: `pair_fx` +41 000.00 ₴
    (4 100 000 коп.) за 1 000.00 $ в марте; перевод ₴ ФОП → карта (`pair`, internal) → `total.income` =
    4 100 000 + гривневые зачисления месяца; `total.fx` =
    `[{ currency: 840, income: 100_000, spending: 0, rate: 41, nearest: false }]`; перевод на карту доходом не стал;
  - та же продажа в феврале, доход в марте → `nearest: true`, сумма по февральскому курсу;
  - доход в EUR без единого обмена EUR → `rate: null`, в `total.income` не входит;
  - траты в USD (−10.00 $) пересчитываются в `total.spending` по тому же курсу;
  - снятие наличных в EUR (MCC 6011, «наличные») −1 000.00 € и комиссия 9.00 € (`commission_rate`) на счёте в EUR;
    покупка € с гривневой карты (`pair_fx`, `amount < 0`) — единственный обмен EUR → обе суммы в `total.spending` по
    курсу покупки; `fx` = `[{ currency: 978, income: 0, spending: 100_900, rate: <курс покупки>, nearest: false }]`;
  - вид человека и семьи: у `people[i].total` свои `fx`; карты счетов (`accounts[]`) — в валюте счёта, без пересчёта.
- [ ] **Шаг 2:** прогон → FAIL.
- [ ] **Шаг 3: реализация.** `api.ts`: тип `FxPart` (как в «Контракте»), `CardTotal.fx: FxPart[]`, комментарий к
  `income` / `spending`: «hryvnia, foreign parts converted by `fx`». `data.ts`, в `monthOverview`:

```ts
const rates = await exchangeRates(db, period);
const flowOf = (inc: IncomeSummary, sp: SpendingSummary): FlowView & { fx: FxPart[] } => {
  const cur = new Set([...inc.totals.map((t) => t.currency), ...sp.totals.map((t) => t.currency)]);
  let income = 0;
  let spending = 0;
  const fx: FxPart[] = [];
  for (const c of [...cur].sort((a, b) => a - b)) {
    const i = inc.totals.find((t) => t.currency === c)?.total ?? 0;
    const s = sp.totals.find((t) => t.currency === c)?.net ?? 0;
    const iu = toUah(i, c, rates);
    const su = toUah(s, c, rates);
    if (iu !== null && su !== null) (income += iu), (spending += su);
    if (c !== UAH) fx.push({ currency: c, income: i, spending: s, rate: rates.get(c)?.rate ?? null, nearest: rates.get(c)?.nearest ?? false });
  }
  return { income, spending, fx };
};
// cardTotal: ...flowOf(income, spending) вместо income/spending только из UAH.
```

  Части с нулём и в доходе, и в тратах в `fx` не попадают (отфильтровать).
- [ ] **Шаг 4:** `cd apps/desktop && npx vitest run tests/data.test.ts tests/ipc.test.ts` + `pnpm --filter @mono/desktop typecheck` → PASS.
- [ ] **Шаг 5:** коммит `feat(desktop): income and spending in other currencies count in hryvnia by the user's own exchange rate`.

### Задача 3: renderer — «≈» и строка курса

**Files:** `features/balances/{types.ts,utils.ts,components/FlowBars.vue,components/MonthPanel.vue}`,
`tests/renderer/balances.test.ts`

- [ ] **Шаг 1: тесты utils:**
  - `slidesOf`: у итоговых карт `flow.approx === true`, если в `fx` есть часть с `rate !== null`; у карт счетов —
    `false`; `netText` итоговой карты начинается с «≈»;
  - `fxNote(fx)`: `[{840, income 316_200, rate 44.355, nearest false}]` → `«вкл. $3 162 по курсу 44,36»`;
    `nearest: true` → `«… по курсу ближайшего обмена 44,36»`; `rate: null` → `«без $3 162 — не было обмена»`;
    несколько валют — через « · »; пустой список → `''`.
- [ ] **Шаг 2:** прогон → FAIL.
- [ ] **Шаг 3: реализация.**
  - `types.ts`: `Flow.approx?: boolean`; `Flow.note?: string` (строка курса, только для итоговых карт).
  - `utils.ts`: `fxNote(fx: ReadonlyArray<FxPart>): string` (сумма = доход части, если он есть, иначе траты; знак
    валюты — через `formatMoney`; курс — `rate / 1`, 2 знака, запятая: `rate.toFixed(2).replace('.', ',')`);
    `totalSlide`: `flow.approx`, `flow.note`, `netText` с префиксом «≈ » при `approx`.
  - `FlowBars.vue`: суммы с префиксом «≈ » при `flow.approx`.
  - `MonthPanel.vue`: под `FlowBars` — `<p v-if="flow.note" class="text-xs text-foreground-muted">{{ flow.note }}</p>`.
  - `spentShare` без изменений: считает по уже пересчитанным суммам.
- [ ] **Шаг 4:** `cd apps/desktop && npx vitest run tests/renderer` + `pnpm --filter @mono/desktop typecheck` → PASS.
- [ ] **Шаг 5:** коммит `feat(desktop): the month panel shows converted income with its rate`.

### Задача 4: документы и финальная проверка

- [ ] Спека `docs/superpowers/specs/2026-09-27-balance-cards-design.md`: раздел «Валюта в „Пришло / Ушло“» — правило
  курса, `FxPart`, «≈», строка курса; убрать «только гривна» для потоков, если так написано.
- [ ] `.agents/project/domain-rules.md`: пункт про курс обменов (`fx.ts`), рядом с `balancesAt`.
- [ ] `CHANGELOG.md`, `## 0.1.5 — unreleased` → `### Balances`:
  «Income and spending in other currencies (for example, dollars on a sole-proprietor account) now count in «Пришло»
  and «Ушло» in hryvnia, at the rate of your own currency sales that month; such sums are marked «≈» and the rate is
  shown under the bars.»
- [ ] В корне `pnpm test` и `pnpm typecheck` → всё зелёное; коммит `docs: exchange rates in the balance block`.

---

## Не входит

- Остатки на картах (`ownFunds` / `others`) — валюта по-прежнему отдельно.
- Карты отдельных счетов в режиме человека — в валюте счёта, как сейчас.
- MCP-тулы и `incomeSummary` / `spendingSummary` — без изменений.
- Курс НБУ или другой сетевой источник — нет.
