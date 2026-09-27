# Блок балансов: карта, карусель, выбор месяца — план

> Спека: `docs/superpowers/specs/2026-09-27-balance-cards-design.md`. Ветка `feat/balance-cards`.
> Шаги — чекбоксы; после каждой задачи — тесты пакета, typecheck и коммит. Прототип — артборд 19 холста
> https://claude.ai/artifact/Lugww7pYigDwefKBA45xhm (размеры, отступы, тайминги анимации брать оттуда).

**Цель:** на главной вместо сетки балансов — стопка банковских карт с приходом и тратами месяца; клик раскладывает её
в ряд (семья → люди, человек → его счета); выбор месяца показывает остаток на конец месяца.

**Архитектура:** ядро считает остаток на конец месяца (`balancesAt`) и дату начала данных (`firstDataDate`); main
собирает `MonthOverview` из них и готовых `incomeSummary` / `spendingSummary`; renderer — `VMonthPicker` в `shared/ui`,
`entities/period` (выбранный месяц), `entities/account` (`BalanceCard`), переписанный `features/balances`.

**Стек:** TypeScript, libsql, Vue 3.5, Pinia, Tailwind v4, reka-ui 2.10.5 (`MonthPicker`, `Popover`), vitest.

---

### Задача 1: ядро — `balancesAt`, `firstDataDate`

**Файлы:** `packages/core/src/status.ts`; тест `packages/core/tests/balances-at.test.ts` (новый).

- [x] Тест (фикстуры — `insertAccountRow`, прямой INSERT в `transactions` и `sync_state`, как в `family.test.ts`):

```ts
// End-of-month balances from the stored per-operation balance, with the backward calculation as the fallback.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Db } from '../src/db.ts';
import { kyivStartOfDay } from '../src/format.ts';
import { addConnection, addParticipant } from '../src/participants.ts';
import { balancesAt, firstDataDate } from '../src/status.ts';
import { insertAccountRow, memoryDb } from './helpers.ts';

let db: Db;
let seq = 0;
const END_JULY = kyivStartOfDay('2026-08-01');
const SYNCED = kyivStartOfDay('2026-09-27') + 12 * 3600;

async function account(id: string, balance: number, o: { creditLimit?: number; kind?: 'card' | 'jar'; oldest?: number | null; connection?: number } = {}) {
  await insertAccountRow(db, {
    id, kind: o.kind ?? 'card', type: o.kind === 'jar' ? null : 'black', currency_code: 980, balance, credit_limit: o.creditLimit ?? 0,
    updated_at: SYNCED, ...(o.connection ? { connection_id: o.connection } : {}),
  });
  if (o.oldest !== null) {
    await db.execute({ sql: 'INSERT INTO sync_state VALUES (?, ?, ?, ?)', args: [id, o.oldest ?? kyivStartOfDay('2026-06-14'), SYNCED, SYNCED] });
  }
}
async function tx(accountId: string, time: number, amount: number, balance: number | null, cancelled = 0) {
  await db.execute({
    sql: `INSERT INTO transactions (id, account_id, time, local_date, description, mcc, hold, amount, currency_code, balance, is_cancelled, raw_json, synced_at)
          VALUES (?, ?, ?, '2026-07-01', '', 5411, 0, ?, 980, ?, ?, '{}', 0)`,
    args: [`t${++seq}`, accountId, time, amount, balance, cancelled],
  });
}
const own = async (endSec: number, participantId?: number) =>
  Object.fromEntries((await balancesAt(db, { endSec, ...(participantId === undefined ? {} : { participantId }) })).accounts.map((a) => [a.id, a.own_funds]));

beforeEach(async () => { seq = 0; db = await memoryDb(); });
afterEach(() => db.close());

describe('balancesAt', () => {
  it('takes the balance after the last operation of the month (the bank\'s own number)', async () => {
    await account('a', 50_000);
    await tx('a', END_JULY - 100, -1_000, 70_000);
    await tx('a', END_JULY + 100, -20_000, 50_000);
    expect(await own(END_JULY)).toEqual({ a: 70_000 });
  });

  it('counts back from the current balance when the stored balance is missing or two operations share the last second', async () => {
    await account('a', 50_000);
    await account('b', 50_000);
    await tx('a', END_JULY - 100, -1_000, null);
    await tx('a', END_JULY + 100, -20_000, 50_000);
    await tx('b', END_JULY - 5, -1_000, 71_000);
    await tx('b', END_JULY - 5, 1_000, 70_000);
    await tx('b', END_JULY + 100, -20_000, 50_000);
    expect(await own(END_JULY)).toEqual({ a: 70_000, b: 70_000 });
  });

  it('ignores cancelled operations', async () => {
    await account('a', 50_000);
    await tx('a', END_JULY - 100, -1_000, 70_000);
    await tx('a', END_JULY - 50, -9_000, 61_000, 1);
    await tx('a', END_JULY + 100, -20_000, 50_000);
    expect(await own(END_JULY)).toEqual({ a: 70_000 });
  });

  it('no operation after the end → the current balance; the current month → the current balance', async () => {
    await account('a', 50_000);
    await tx('a', END_JULY - 100, -1_000, 50_000);
    expect(await own(END_JULY)).toEqual({ a: 50_000 });
    expect(await own(SYNCED + 1)).toEqual({ a: 50_000 });
  });

  it('coverage starting after the end, or no sync state → null, counted in missing and left out of totals', async () => {
    await account('late', 10_000, { oldest: kyivStartOfDay('2026-08-10') });
    await account('never', 5_000, { oldest: null });
    await account('ok', 7_000);
    const b = await balancesAt(db, { endSec: END_JULY });
    expect(Object.fromEntries(b.accounts.map((a) => [a.id, a.own_funds]))).toEqual({ late: null, never: null, ok: 7_000 });
    expect(b.missing).toBe(2);
    expect(b.totals).toEqual([{ currency: 980, own_funds: 7_000 }]);
  });

  it('a credit card: own funds against the current limit', async () => {
    await account('cc', 25_000, { creditLimit: 30_000 });
    await tx('cc', END_JULY - 100, -500, 28_000);
    await tx('cc', END_JULY + 100, -3_000, 25_000);
    expect(await own(END_JULY)).toEqual({ cc: -2_000 });
  });

  it('participantId keeps that participant\'s accounts only', async () => {
    const her = await addParticipant(db, { label: 'Вигадана' }, 0);
    const conn = await addConnection(db, her, 'monobank', 0);
    await account('mine', 1_000);
    await account('hers', 2_000, { connection: conn });
    expect(Object.keys(await own(END_JULY, her))).toEqual(['hers']);
  });
});

describe('firstDataDate', () => {
  it('the Kyiv date of the oldest covered second; null without data', async () => {
    expect(await firstDataDate(db)).toBeNull();
    await account('a', 0, { oldest: Date.UTC(2025, 4, 31, 23, 30) / 1000 }); // 1 June 02:30 in Kyiv
    expect(await firstDataDate(db)).toBe('2025-06-01');
  });
});
```

  Проверь сигнатуры `addParticipant` / `addConnection` в `participants.ts` (в предыдущей задаче они получили `color?`) и
  поправь вызовы теста, если они другие.

- [x] `pnpm --filter @mono/core exec vitest run tests/balances-at.test.ts` — падает: функций нет.
- [x] Реализация в `status.ts` после `getBalances`:

```ts
// ---------- balancesAt ----------

export type AccountBalanceAt = Omit<AccountBalance, 'own_funds' | 'available' | 'updated_at'> & {
  /** At the end: balance − credit limit (today's limit — the bank keeps no history of it). null = no data then. */
  own_funds: number | null;
};

export type BalancesAt = {
  accounts: AccountBalanceAt[];
  /** Own funds per currency, accounts with data only. */
  totals: Array<{ currency: number; own_funds: number }>;
  /** Accounts without data at the end (imported from a later date, or never). */
  missing: number;
};

/**
 * Balances at `endSec` (exclusive: the first second after the period), the same accounts as getBalances. The bank's
 * balance after the last operation before the end; when it is missing or ambiguous (two operations in that second) —
 * today's balance minus every operation from the end on. From the moment of the last fetch on — today's balance.
 */
export async function balancesAt(db: Db, opts: { endSec: number; participantId?: number }): Promise<BalancesAt> {
  const { rows, labels } = await loadAccounts(db, opts.participantId);
  const accounts: AccountBalanceAt[] = [];
  for (const r of rows.filter((x) => x.kind === 'card' || x.balance > 0 || x.synced)) {
    const balance = await balanceAt(db, r, opts.endSec);
    accounts.push({
      id: r.id,
      label: labels.get(r.id) ?? r.id,
      kind: r.kind === 'jar' ? 'jar' : 'card',
      currency: r.currency,
      credit_limit: r.creditLimit,
      own_funds: balance === null ? null : balance - r.creditLimit,
    });
  }
  const totals = new Map<number, number>();
  for (const a of accounts) if (a.own_funds !== null) totals.set(a.currency, (totals.get(a.currency) ?? 0) + a.own_funds);
  return {
    accounts,
    totals: [...totals].sort(([a], [b]) => a - b).map(([currency, own_funds]) => ({ currency, own_funds })),
    missing: accounts.filter((a) => a.own_funds === null).length,
  };
}

async function balanceAt(db: Db, r: AccountRow, endSec: number): Promise<number | null> {
  if (endSec > r.updatedAt) return r.balance;
  if (r.oldest === null || r.oldest >= endSec) return null;
  const last = await db.execute({
    sql: 'SELECT time, balance FROM transactions WHERE account_id = ? AND is_cancelled = 0 AND time < ? ORDER BY time DESC LIMIT 2',
    args: [r.id, endSec],
  });
  const [a, b] = last.rows;
  if (a && a.balance !== null && !(b && Number(b.time) === Number(a.time))) return Number(a.balance);
  const after = await db.execute({
    sql: 'SELECT COALESCE(SUM(amount), 0) AS s FROM transactions WHERE account_id = ? AND is_cancelled = 0 AND time >= ?',
    args: [r.id, endSec],
  });
  return r.balance - Number(after.rows[0]?.s ?? 0);
}

/** Kyiv date of the oldest covered second over every account; null — nothing imported. */
export async function firstDataDate(db: Db): Promise<string | null> {
  const rs = await db.execute('SELECT MIN(oldest_synced_time) AS t FROM sync_state');
  const t = rs.rows[0]?.t;
  return t === null || t === undefined ? null : toKyivDate(Number(t));
}
```

  Тест «current month»: `own(SYNCED + 1)` — `endSec > updatedAt` → текущий. Тест «no operation after the end»:
  `END_JULY < SYNCED`, последняя операция до конца с `balance` → её число (50 000).
- [x] Тесты ядра целиком и typecheck: `pnpm --filter @mono/core test && pnpm --filter @mono/core typecheck`.
- [x] Коммит: `feat(core): balancesAt — balances at the end of a month; firstDataDate`.

### Задача 2: main — `getMonthOverview` вместо `getBalances`, `DataStatus.dataFrom`

**Файлы:** `apps/desktop/src/shared/api.ts`, `src/shared/channels.ts`, `src/main/ipc.ts`, `src/main/index.ts`,
`src/main/data.ts`; тесты `tests/data.test.ts`, `tests/ipc.test.ts`. Перед правкой — `grep -rn "getBalances\|BalancesView\|BalanceLine" apps/desktop/src apps/desktop/tests`:
убрать всё, что держится только на старом IPC (renderer-часть уйдёт в задаче 6; до неё `features/balances` временно
переключить на новый вызов — см. последний шаг задачи).

- [x] Типы в `api.ts` (вместо `BalanceLine` / `BalancesView` / `BalancesQuery`):

```ts
export type MonthOverviewQuery = { month: string; participantId?: number };

/** Hryvnia, minor units: income and spending of the month (the core aggregates, all scopes). */
export type FlowView = { income: number; spending: number };

export type CardTotal = FlowView & {
  /** Own funds in hryvnia at the end of the month (accounts with data only). */
  ownFunds: number;
  /** Other currencies — never summed with hryvnia. */
  others: Array<{ currency: number; ownFunds: number }>;
  /** Accounts without data at that date. */
  missing: number;
};

export type OverviewAccount = FlowView & {
  id: string;
  /** «black/UAH»-style label: never a card number or a jar title. */
  label: string;
  kind: 'card' | 'jar';
  currency: number;
  creditLimit: number;
  /** null — no data at that date. Income / spending are in the account's currency. */
  ownFunds: number | null;
};

export type MonthOverview = {
  month: string;
  /** 'now' for the current month, else the month's last day YYYY-MM-DD. */
  balanceAt: 'now' | string;
  /** Kyiv dates of the month actually covered by data. */
  coverage: { from: string; to: string };
  total: CardTotal;
  /** The whole family only: each person in their own view of transfers. */
  people: Array<{ participantId: number; label: string; color: ColorKey | null; total: CardTotal }>;
  /** One person only: their accounts. */
  accounts: OverviewAccount[];
};
```

  `DataStatus` — поле `dataFrom: string | null` («Kyiv date the data starts at; null = never imported»). `BalanceApi`:
  `getMonthOverview(q: MonthOverviewQuery): Promise<MonthOverview>` вместо `getBalances`.
- [x] `channels.ts`: `'getBalances'` → `'getMonthOverview'`. `ipc.ts`:

```ts
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
// …
getMonthOverview: z.tuple([z.strictObject({ month, participantId: id.optional() })]),
```

  `index.ts`: `getMonthOverview: (q) => data.monthOverview(q),`.
- [x] Тесты `ipc.test.ts`: в `INVALID` — `getMonthOverview: [[], [{}], [{ month: '2026-13' }], [{ month: '2026-9' }], [{ month: '2026-09', participantId: 1.5 }], [{ month: '2026-09', extra: 1 }]]`
  (формат — как у соседних методов в файле).
- [x] Тесты `data.test.ts` (фикстуры — существующие `account`, `tx`, `synced`; добавить `balance` в `tx` через
  необязательный параметр `o.balance`), новый `describe('monthOverview')`:
  - текущий месяц (`2026-03`): `balanceAt: 'now'`, `total.ownFunds` = сумма гривневых счетов, `others` — доллары,
    `income` / `spending` = суммы `tx` с категориями `поступления` / трат; `coverage` = `{ from: '2026-03-01', to: '2026-03-10' }`;
  - прошлый месяц (`2026-02`): `balanceAt: '2026-02-28'`, остаток из `balance` последней февральской операции;
  - месяц до покрытия (`2025-12`): счета `ownFunds: null`, `total.missing` = их число;
  - семья: `people` по участникам с `label` и `color`, `accounts: []`; человек: `people: []`, `accounts` с
    `income` / `spending` по счёту;
  - канарейки: `JSON.stringify(view)` не содержит ни одной строки из `CANARIES`.
  - `status()`: `dataFrom: '2026-01-01'`.
- [x] `DataService` в `data.ts` (вместо `balances()`):

```ts
const UAH = 980;

async monthOverview(q: MonthOverviewQuery): Promise<MonthOverview> {
  const db = await this.conn();
  const now = this.d.nowSec();
  const { from, to } = monthBounds(q.month);
  const endSec = kyivStartOfDay(nextMonthStart(q.month));
  const current = endSec > now;
  const first = await firstDataDate(db);
  const period = { from, to };

  const cardTotal = async (participantId?: number): Promise<{ total: CardTotal; balances: BalancesAt }> => {
    const f = participantId === undefined ? {} : { participantId };
    const balances = await balancesAt(db, { endSec, ...f });
    const income = await incomeSummary(db, { ...period, ...f }, now);
    const spending = await spendingSummary(db, { ...period, groupBy: 'category', ...f }, now);
    return {
      balances,
      total: {
        ownFunds: balances.totals.find((t) => t.currency === UAH)?.own_funds ?? 0,
        others: balances.totals.filter((t) => t.currency !== UAH).map((t) => ({ currency: t.currency, ownFunds: t.own_funds })),
        missing: balances.missing,
        income: income.totals.find((t) => t.currency === UAH)?.total ?? 0,
        spending: spending.totals.find((t) => t.currency === UAH)?.net ?? 0,
      },
    };
  };

  const head = await cardTotal(q.participantId);
  const status = await this.status();
  const coverage = {
    from: first !== null && first > from ? first : from,
    to: status.dataUntil !== null && status.dataUntil.slice(0, 10) < to ? status.dataUntil.slice(0, 10) : to,
  };
  const base = { month: q.month, balanceAt: current ? 'now' : to, coverage, total: head.total };
  if (q.participantId === undefined) {
    const people = [];
    for (const p of await listParticipants(db)) {
      people.push({ participantId: p.id, label: p.label, color: p.color, total: (await cardTotal(p.id)).total });
    }
    return { ...base, people, accounts: [] };
  }
  const f = { participantId: q.participantId };
  const inc = await incomeSummary(db, { ...period, groupBy: 'account', ...f }, now);
  const sp = await spendingSummary(db, { ...period, groupBy: 'account', ...f }, now);
  const accounts = head.balances.accounts.map((a) => ({
    id: a.id, label: a.label, kind: a.kind, currency: a.currency, creditLimit: a.credit_limit, ownFunds: a.own_funds,
    income: inc.groups.find((g) => g.key === a.id)?.total ?? 0,
    spending: sp.groups.find((g) => g.key === a.id)?.net ?? 0,
  }));
  return { ...base, people: [], accounts };
}
```

  Помощники в том же файле: `monthBounds('2026-02')` → `{ from: '2026-02-01', to: '2026-02-28' }`,
  `nextMonthStart('2026-12')` → `'2027-01-01'` (UTC-арифметика дат, как `monthRange` в renderer). `status()` добавляет
  `dataFrom: await firstDataDate(db)`. Импорты: `balancesAt`, `firstDataDate`, `type BalancesAt` из `@mono/core/status`,
  `incomeSummary`, `spendingSummary` из `@mono/core/summaries`, `listParticipants` из `@mono/core/participants`,
  `kyivStartOfDay` из `@mono/core/format`. Проверь поле `color` у `Participant` (задача прошлой ветки) — тип
  `ColorKey | null`, совпадает с `src/shared/colors.ts` (сверка `COLOR_KEYS_MATCH` в `people.ts`).
- [x] Временный мост для renderer: в `features/balances/api/useBalancesRequest.ts` вызов `getBalances` меняется на
  `getMonthOverview`, `BalancesFeature.vue` пока показывает `total.ownFunds` одной строкой (renderer переписывается в
  задаче 6) — только чтобы `typecheck` и тесты оставались зелёными между коммитами.
- [x] `cd apps/desktop && npx vitest run tests/data.test.ts tests/ipc.test.ts && pnpm typecheck`; затем `pnpm test` desktop.
- [x] Коммит: `feat(desktop): getMonthOverview (balances at the month end, income, spending) replaces getBalances; DataStatus.dataFrom`.

### Задача 3: `shared/ui` — `VMonthPicker` и три иконки

**Файлы:** `shared/ui/components/inputs/VMonthPicker.vue`, `shared/ui/components/inputs/calendarMonth.ts`,
`shared/ui/styles/components/inputs/vmonthpicker.scss`, `shared/ui/index.ts`, `shared/ui/README.md`,
`shared/ui/components/base/icons.ts`; тест `tests/renderer/calendarMonth.test.ts`.

- [x] Иконки в реестр (канонические имена Lucide): `lucide:arrow-up-right`, `lucide:arrow-down-right`,
  `lucide:maximize-2` — импорт `~icons/lucide/<name>` + строка в объекте, по алфавиту (правило `ui.test.ts`).
- [x] Тест преобразований:

```ts
import { describe, expect, it } from 'vitest';
import { calendarToMonth, monthToCalendar } from '../../src/renderer/src/shared/ui/components/inputs/calendarMonth.ts';

describe('calendarMonth', () => {
  it('YYYY-MM ⇄ CalendarDate (the 1st of the month)', () => {
    const d = monthToCalendar('2025-06');
    expect(d?.toString()).toBe('2025-06-01');
    expect(calendarToMonth(d ?? null)).toBe('2025-06');
  });
  it('rejects anything but YYYY-MM', () => {
    expect(monthToCalendar('2025-6')).toBeUndefined();
    expect(monthToCalendar('2025-13')).toBeUndefined();
    expect(calendarToMonth(null)).toBeNull();
  });
});
```

- [x] `calendarMonth.ts`:

```ts
import { CalendarDate, type DateValue } from '@internationalized/date';

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** «2025-06» → CalendarDate 2025-06-01; anything else → undefined. */
export function monthToCalendar(ym: string | null | undefined): CalendarDate | undefined {
  const m = ym ? MONTH_RE.exec(ym) : null;
  return m ? new CalendarDate(Number(m[1]), Number(m[2]), 1) : undefined;
}

export function calendarToMonth(d: DateValue | null): string | null {
  return d ? `${d.year}-${String(d.month).padStart(2, '0')}` : null;
}
```

- [x] `VMonthPicker.vue` (шапка — как у `VDatepicker`: «built on reka-ui (2026-09-27)…», без `copied from muzakit`):

```vue
<!-- built on reka-ui (2026-09-27): MonthPicker in a Popover. Ours, not copied: muzakit has no month picker.
     The value is «YYYY-MM»; CalendarDate stays inside (calendarMonth.ts). Month names are ours (Russian UI). -->
<script setup lang="ts">
import { computed, ref } from "vue";
import {
  MonthPickerCell, MonthPickerCellTrigger, MonthPickerGrid, MonthPickerGridBody, MonthPickerGridRow, MonthPickerHeader,
  MonthPickerHeading, MonthPickerNext, MonthPickerPrev, MonthPickerRoot, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger,
} from "reka-ui";
import { calendarToMonth, monthToCalendar } from "./calendarMonth";
import VIcon from "../base/VIcon.vue";

const { min = undefined, max = undefined, label = "Месяц", currentYear = undefined } = defineProps<{
  min?: string;
  max?: string;
  label?: string;
  /** The year shown without a suffix on the trigger (default: max's year). */
  currentYear?: number;
}>();
const month = defineModel<string>({ required: true });
const open = ref(false);

const NAMES = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

const calendarValue = computed({
  get: () => monthToCalendar(month.value),
  set: (v) => {
    const ym = calendarToMonth(v ?? null);
    if (ym) month.value = ym;
    open.value = false;
  },
});
const triggerText = computed(() => {
  const d = monthToCalendar(month.value);
  if (!d) return label;
  const year = currentYear ?? monthToCalendar(max)?.year;
  return `${NAMES[d.month - 1]}${d.year === year ? "" : ` ${d.year}`}`;
});
function toMax() {
  if (max) month.value = max;
  open.value = false;
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger class="v-month-picker__trigger" :aria-label="`${label}: ${triggerText}`">
      <VIcon icon="lucide:calendar" class="v-month-picker__icon" />
      <span>{{ triggerText }}</span>
      <VIcon icon="lucide:chevron-down" class="v-month-picker__icon" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent class="v-month-picker__content" align="end" :side-offset="6">
        <MonthPickerRoot
          v-slot="{ grid }"
          v-model="calendarValue"
          :min-value="monthToCalendar(min)"
          :max-value="monthToCalendar(max)"
          locale="ru-RU"
          :calendar-label="label"
        >
          <MonthPickerHeader class="v-month-picker__header">
            <MonthPickerPrev class="v-month-picker__nav" aria-label="Предыдущий год"><VIcon icon="lucide:chevron-left" /></MonthPickerPrev>
            <MonthPickerHeading class="v-month-picker__heading" />
            <MonthPickerNext class="v-month-picker__nav" aria-label="Следующий год"><VIcon icon="lucide:chevron-right" /></MonthPickerNext>
          </MonthPickerHeader>
          <MonthPickerGrid class="v-month-picker__grid">
            <MonthPickerGridBody>
              <MonthPickerGridRow v-for="(row, i) in grid.rows" :key="i" class="v-month-picker__row">
                <MonthPickerCell v-for="m in row" :key="m.toString()" :date="m">
                  <MonthPickerCellTrigger :month="m" class="v-month-picker__cell">{{ SHORT[m.month - 1] }}</MonthPickerCellTrigger>
                </MonthPickerCell>
              </MonthPickerGridRow>
            </MonthPickerGridBody>
          </MonthPickerGrid>
        </MonthPickerRoot>
        <div v-if="max" class="v-month-picker__footer">
          <button type="button" class="v-month-picker__now" @click="toMax">Текущий месяц</button>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>

<style lang="scss" scoped>
@use "../../styles/components/inputs/vmonthpicker.scss";
</style>
```

  Перед записью сверить с `node_modules/reka-ui/dist/MonthPicker/*.js` и `Popover/*.js`: форма `grid` (`{ value, rows }`),
  имена свойств (`date` у `MonthPickerCell`, `month` у `MonthPickerCellTrigger`), что `MonthPickerHeading` выводит год.
  Если `Heading` форматирует по локали иначе, чем нужно, — выводить год из `grid.value.year` своим `<span>`.
- [x] `vmonthpicker.scss` — только `--ui-*` токены (правила `ui-component-migration.md`, шаги 5–7):
  - `__trigger` — высота `--ui-control-h`, `border-radius: var(--ui-radius-full)`, рамка `--ui-border`, фон `--ui-surface`,
    `gap: var(--ui-control-gap)`, шрифт `--ui-text-base` 600, наведение `--ui-surface-hover`, `:focus-visible` — `--ui-ring`;
  - `__content` — ширина 17rem, `padding: var(--ui-space-lg)`, `border-radius: var(--ui-radius-xl)`, фон
    `--ui-surface-overlay`, тень `--ui-shadow-lg`; появление `opacity` + `translateY(-4px)` 160 ms, под
    `prefers-reduced-motion` без сдвига;
  - `__grid` / `__row` — сетка 3 колонки, `gap: var(--ui-space-xs)`; `__cell` — высота `--ui-control-h-md`, радиус
    `--ui-radius`, `[data-selected]` → `--ui-primary` / `--ui-primary-foreground`, `[data-disabled]` →
    `--ui-foreground-subtle` + `text-decoration: line-through`, `cursor: not-allowed`; `[data-today]` → внутренняя рамка
    `--ui-primary-muted`;
  - `__footer` — верхняя граница `--ui-border-subtle`, кнопка `__now` цвета `--ui-primary`, `--ui-text-sm`.
  Атрибуты `data-selected` / `data-disabled` / `data-today` сверить с `MonthPickerCellTrigger.js`.
- [x] `index.ts`: `export { default as VMonthPicker } from "./components/inputs/VMonthPicker.vue";`; README — абзац в
  «Ours, not copied» рядом с `VDatepicker` (reka `MonthPicker` + `Popover`, значение `YYYY-MM`, названия месяцев свои,
  потребитель — блок балансов).
- [x] `cd apps/desktop && npx vitest run tests/ui.test.ts tests/renderer/calendarMonth.test.ts tests/styles.test.ts && pnpm typecheck`.
- [x] Коммит: `feat(desktop): VMonthPicker on reka-ui MonthPicker; arrow and maximize icons`.

### Задача 4: `entities/period` — один месяц на главную

**Файлы:** `entities/period/{index.ts,store/useMonthStore.ts}`, `features/spending-summary/composables/useSpending.ts`,
`features/spending-summary/types.ts`, `features/spending-summary/SpendingFeature.vue`; тест
`tests/renderer/period.test.ts`.

- [x] Тест (Pinia как в соседних тестах renderer: `setActivePinia(createPinia())`):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useMonthStore } from '@/entities/period';

describe('month store', () => {
  beforeEach(() => setActivePinia(createPinia()));
  it('starts at the current Kyiv month; set clamps to [first, this month]', () => {
    const s = useMonthStore();
    expect(s.month).toBe(s.thisMonth);
    s.set('2099-01', '2025-06');
    expect(s.month).toBe(s.thisMonth);
    s.set('2020-01', '2025-06');
    expect(s.month).toBe('2025-06');
    s.set('2025-08', '2025-06');
    expect(s.month).toBe('2025-08');
  });
});
```

- [x] Store:

```ts
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { kyivToday, monthOf, type YearMonth } from '@/shared/lib';

/** The month the home screen shows — one for the balance block and the spending block. */
export const useMonthStore = defineStore('period', () => {
  const thisMonth = monthOf(kyivToday(new Date()));
  const month = ref<YearMonth>(thisMonth);

  /** Sets the month, kept inside [first month with data, this month]. */
  function set(next: YearMonth, first: YearMonth | null): void {
    month.value = next > thisMonth ? thisMonth : first !== null && next < first ? first : next;
  }

  return { thisMonth, month, set };
});
```

  `index.ts`: `export { useMonthStore } from './store/useMonthStore.ts';`
- [x] `useSpending`: `month` — `storeToRefs(useMonthStore()).month` вместо своего `ref`; `thisMonth` — из стора; в
  возврат — `firstMonth` (`computed` от `syncStatus.status?.dataFrom` → `monthOf`). `SpendingFeature`: стрелка «назад»
  `:disabled="firstMonth !== null && month <= firstMonth"`. Тип `UseSpendingReturn` в `types.ts` — поле `firstMonth`.
- [x] `npx vitest run tests/renderer tests/architecture.test.ts && pnpm typecheck`.
- [x] Коммит: `feat(desktop): one selected month for the home screen (entities/period)`.

### Задача 5: `entities/account` — `BalanceCard`

**Файлы:** `entities/account/{index.ts,components/BalanceCard.vue,types.ts}`.

- [x] `types.ts`:

```ts
export interface BalanceCardProps {
  title: string;
  caption: string;
  amount: string;
  /** Other currencies, one line under the amount; '' — none. */
  others: string;
  bottom: string;
  /** Net of the month: sign decides the arrow; null — no arrow and no text. */
  net: number | null;
  netText: string;
  /** Colours of the corner circles (CSS values): the family — every person, one person or account — theirs. */
  accents: ReadonlyArray<string>;
  /** No data at that date: dimmed. */
  dim: boolean;
}
```

- [x] `BalanceCard.vue` (Tailwind-утилиты, как остальной renderer; вне `shared/ui`):

```vue
<script setup lang="ts">
import { VIcon } from '@/shared/ui';
import type { BalanceCardProps } from '../types.ts';

const { title, caption, amount, others, bottom, net, netText, accents, dim } = defineProps<BalanceCardProps>();
defineEmits<{ click: [] }>();
</script>

<template>
  <button
    type="button"
    class="relative flex h-[214px] w-[340px] shrink-0 flex-col justify-between overflow-hidden rounded-[18px] bg-nav p-5 text-left text-white shadow-md
           transition-[transform,box-shadow] duration-450 ease-[cubic-bezier(.34,1.8,.64,1)] hover:-translate-y-[3px] hover:shadow-lg
           active:scale-[.97] active:duration-100 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-border-focus
           motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
    :class="{ 'opacity-55': dim }"
    @click="$emit('click')"
  >
    <span
      v-for="(color, i) in accents"
      :key="i"
      class="absolute -top-7 size-24 rounded-full bg-(--accent) opacity-90"
      :style="{ '--accent': color, right: `${-28 + i * 34}px` }"
      aria-hidden="true"
    />
    <span class="relative flex items-center gap-2 text-base font-semibold">
      <span class="grid size-6 place-items-center rounded-[7px] bg-[#141414] text-sm font-extrabold ring-1 ring-white/15" aria-hidden="true">m</span>
      {{ title }}
    </span>
    <span class="relative flex flex-col gap-1">
      <span class="text-sm text-white/65">{{ caption }}</span>
      <span class="text-[30px] leading-none font-bold tracking-tight tabular-nums">{{ amount }}</span>
      <span v-if="others" class="text-sm text-white/65 tabular-nums">{{ others }}</span>
    </span>
    <span class="relative flex items-center justify-between text-sm text-white/70">
      <span>{{ bottom }}</span>
      <span v-if="net !== null" class="inline-flex items-center gap-1 tabular-nums">
        <VIcon :icon="net < 0 ? 'lucide:arrow-down-right' : 'lucide:arrow-up-right'" :class="net < 0 ? 'text-[oklch(72%_0.19_25)]' : 'text-[oklch(76%_0.2_145)]'" />
        <span class="font-bold text-white">{{ netText }}</span>
      </span>
    </span>
  </button>
</template>
```

  `right` в `:style` — отступ круга; если правило «no inline styles» из `vue-syntax.instructions.md` (Rule 15)
  проверяется тестом стилей — вынести в CSS-переменную `--i` и `right-[calc(-28px+var(--i)*34px)]`. Цвета стрелок —
  константы для всегда тёмной карты (фон `--nav` тёмный в обеих темах); если `styles.test.ts` запрещает сырые цвета в
  renderer — завести в `theme.css` пару токенов `--card-up` / `--card-down` в обеих темах одинаковыми значениями.
  `aria-expanded` / `aria-controls` приходят через `$attrs` (они падают на корневой `<button>`).
- [x] `index.ts`: `export { default as BalanceCard } from './components/BalanceCard.vue'; export type { BalanceCardProps } from './types.ts';`
- [x] `npx vitest run tests/architecture.test.ts tests/styles.test.ts tests/ui.test.ts && pnpm typecheck`.
- [x] Коммит: `feat(desktop): BalanceCard (entities/account)`.

### Задача 6: `features/balances` — стопка, ряд, панель месяца

**Файлы:** `features/balances/{BalancesFeature.vue,index.ts,types.ts,utils.ts,constants.ts}`,
`features/balances/api/useBalancesRequest.ts`, `features/balances/composables/{useMonthOverview.ts,useCardStack.ts}`,
`features/balances/components/{CardStack.vue,FlowBars.vue,MonthPanel.vue,BalancesHeader.vue}`; тест
`tests/renderer/balances.test.ts`.

- [x] Тест чистых функций:

```ts
import { describe, expect, it } from 'vitest';
import type { MonthOverview, PersonView } from '@contract/api.ts';
import { balanceCaption, coverageNote, flowWidths, maxOffset, monthIn, netText, slidePosition, slidesOf } from '@/features/balances/utils.ts';

const card = (ownFunds: number, income: number, spending: number, missing = 0) => ({ ownFunds, others: [], missing, income, spending });

describe('balances utils', () => {
  it('slidePosition: a stack of at most 4 visible cards; a row with the offset applied', () => {
    expect(slidePosition(0, false, 0)).toEqual({ x: 0, y: 52, z: 20, opacity: 1 });
    expect(slidePosition(2, false, 0)).toEqual({ x: 44, y: 20, z: 18, opacity: 1 });
    expect(slidePosition(5, false, 0).opacity).toBe(0);
    expect(slidePosition(3, true, 1)).toEqual({ x: 712, y: 0, z: 17, opacity: 1 });
  });

  it('maxOffset: two cards fit', () => {
    expect(maxOffset(1)).toBe(0);
    expect(maxOffset(9)).toBe(7);
  });

  it('captions: today, the month end, another year', () => {
    expect(balanceCaption('now', 2026)).toBe('Свои деньги · на сегодня');
    expect(balanceCaption('2026-07-31', 2026)).toBe('Свои деньги · на 31 июля');
    expect(balanceCaption('2025-12-31', 2026)).toBe('Свои деньги · на 31 декабря 2025');
    expect(monthIn('2026-09', 2026)).toBe('в сентябре');
    expect(monthIn('2025-12', 2026)).toBe('в декабре 2025');
  });

  it('netText: plus for a positive month, the minus sign for a negative one', () => {
    expect(netText(34_000, 980)).toBe('+340,00 ₴');
    expect(netText(-678_000, 980).startsWith('−')).toBe(true);
  });

  it('coverageNote: whole month, from, until', () => {
    expect(coverageNote('2026-07', { from: '2026-07-01', to: '2026-07-31' })).toBe('весь месяц');
    expect(coverageNote('2025-06', { from: '2025-06-14', to: '2025-06-30' })).toBe('с 14 июня');
    expect(coverageNote('2026-09', { from: '2026-09-01', to: '2026-09-27' })).toBe('по 27 сен');
  });

  it('flowWidths: people shares scaled to the larger of income and spending', () => {
    expect(flowWidths([60, 40], 100, 50)).toEqual([60, 40]);
    expect(flowWidths([30, 10], 50, 100)).toEqual([37.5, 12.5]);
    expect(flowWidths([0, 0], 0, 0)).toEqual([0, 0]);
  });

  it('slidesOf: the family — head then people; a person — head then accounts, no data dimmed', () => {
    const people: PersonView[] = [
      { id: 1, label: 'Сергей', labelFromBank: true, color: 'blue', connections: [] },
      { id: 2, label: 'Аня', labelFromBank: false, color: 'orange', connections: [] },
    ];
    const fam: MonthOverview = {
      month: '2026-09', balanceAt: 'now', coverage: { from: '2026-09-01', to: '2026-09-27' }, total: card(10_000, 5_000, 4_000),
      people: [{ participantId: 1, label: 'Сергей', color: 'blue', total: card(6_000, 3_000, 2_000) }, { participantId: 2, label: 'Аня', color: 'orange', total: card(4_000, 2_000, 2_000) }],
      accounts: [],
    };
    const s = slidesOf(fam, { people, selectedId: null, currentYear: 2026 });
    expect(s.map((x) => x.title)).toEqual(['Вся семья', 'Сергей', 'Аня']);
    expect(s[0]?.accents).toEqual(['var(--series-blue)', 'var(--series-orange)']);

    const one: MonthOverview = {
      ...fam, people: [], total: card(6_000, 3_000, 2_000, 1),
      accounts: [
        { id: 'a', label: 'black/UAH', kind: 'card', currency: 980, creditLimit: 0, ownFunds: 6_000, income: 3_000, spending: 2_000 },
        { id: 'b', label: 'jar/UAH', kind: 'jar', currency: 980, creditLimit: 0, ownFunds: null, income: 0, spending: 0 },
      ],
    };
    const p = slidesOf(one, { people, selectedId: 1, currentYear: 2026 });
    expect(p.map((x) => [x.title, x.dim])).toEqual([['Сергей', false], ['black/UAH', false], ['jar/UAH', true]]);
    expect(p[2]?.amount).toBe('—');
    expect(p[0]?.bottom).toContain('без 1');
  });
});
```

  Ожидаемые строки сумм уточнить по реальному `formatMoney` (`shared/lib/money.ts`: разделители `Intl`), не менять
  логику под тест.
- [x] `utils.ts` (чистые функции; `slidesOf` возвращает `Slide[]` — тип в `types.ts`):

```ts
import type { CardTotal, MonthOverview, PersonView } from '@contract/api.ts';
import { colorVar } from '@/entities/participant';
import { formatMoney } from '@/shared/lib';
import { CARD_STEP, MONTHS_GEN, MONTHS_IN, MONTHS_SHORT, STACK_DEPTH, UAH, VISIBLE_CARDS } from './constants.ts';
import type { Slide } from './types.ts';

export function slidePosition(i: number, open: boolean, offset: number): { x: number; y: number; z: number; opacity: number } {
  if (open) return { x: (i - offset) * CARD_STEP, y: 0, z: 20 - i, opacity: 1 };
  const depth = Math.min(i, STACK_DEPTH);
  return { x: depth * 22, y: 52 - depth * 16, z: 20 - i, opacity: i <= STACK_DEPTH ? 1 : 0 };
}

export function maxOffset(n: number): number {
  return Math.max(0, n - VISIBLE_CARDS);
}

const yearSuffix = (y: number, current: number) => (y === current ? '' : ` ${y}`);

export function balanceCaption(balanceAt: 'now' | string, currentYear: number): string {
  if (balanceAt === 'now') return 'Свои деньги · на сегодня';
  const [y, m, d] = balanceAt.split('-').map(Number) as [number, number, number];
  return `Свои деньги · на ${d} ${MONTHS_GEN[m - 1]}${yearSuffix(y, currentYear)}`;
}

export function monthIn(month: string, currentYear: number): string {
  const [y, m] = month.split('-').map(Number) as [number, number];
  return `в ${MONTHS_IN[m - 1]}${yearSuffix(y, currentYear)}`;
}

export function netText(net: number, currency: number): string {
  const s = formatMoney(Math.abs(net), currency, { minorUnits: true });
  return `${net < 0 ? '−' : '+'}${s}`;
}

export function coverageNote(month: string, c: { from: string; to: string }): string {
  const last = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  if (c.from > `${month}-01`) return `с ${Number(c.from.slice(8))} ${MONTHS_GEN[Number(month.slice(5, 7)) - 1]}`;
  if (Number(c.to.slice(8)) < last) return `по ${Number(c.to.slice(8))} ${MONTHS_SHORT[Number(month.slice(5, 7)) - 1]}`;
  return 'весь месяц';
}

/** Widths in % of each part: shares of `parts`, scaled so the larger of income / spending fills the bar. */
export function flowWidths(parts: ReadonlyArray<number>, value: number, other: number): number[] {
  const sum = parts.reduce((s, x) => s + x, 0);
  const max = Math.max(value, other);
  return parts.map((x) => (sum > 0 && max > 0 ? (x / sum) * (value / max) * 100 : 0));
}

function others(t: CardTotal): string {
  return t.others.map((o) => formatMoney(o.ownFunds, o.currency, { minorUnits: true })).join(' · ');
}

export function slidesOf(v: MonthOverview, ctx: { people: ReadonlyArray<Readonly<PersonView>>; selectedId: number | null; currentYear: number }): Slide[] {
  const caption = balanceCaption(v.balanceAt, ctx.currentYear);
  const month = monthIn(v.month, ctx.currentYear);
  const totalSlide = (key: string, title: string, t: CardTotal, accents: string[], accountsText: string): Slide => ({
    key, title, caption, accents, dim: false,
    amount: formatMoney(t.ownFunds, UAH, { minorUnits: true }),
    others: others(t),
    bottom: t.missing > 0 ? `${accountsText} · без ${t.missing}` : accountsText,
    net: t.income - t.spending,
    netText: `${netText(t.income - t.spending, UAH)} ${month}`,
    flow: { currency: UAH, income: t.income, spending: t.spending },
  });
  if (ctx.selectedId === null) {
    const accents = v.people.map((p) => colorVar(p.color));
    return [
      totalSlide('family', 'Вся семья', v.total, accents, `${v.people.length} чел.`),
      ...v.people.map((p) => totalSlide(`p${p.participantId}`, p.label, p.total, [colorVar(p.color)], '')),
    ];
  }
  const person = ctx.people.find((p) => p.id === ctx.selectedId);
  const accent = colorVar(person?.color ?? null);
  return [
    totalSlide('person', person?.label ?? '', v.total, [accent], `${v.accounts.length} сч.`),
    ...v.accounts.map((a): Slide => ({
      key: a.id, title: a.label, accents: [accent], dim: a.ownFunds === null,
      caption: a.ownFunds === null ? 'Нет данных на эту дату' : caption.replace('Свои деньги', a.kind === 'jar' ? 'Банка' : 'Карта'),
      amount: a.ownFunds === null ? '—' : formatMoney(a.ownFunds, a.currency, { minorUnits: true }),
      others: '',
      bottom: a.creditLimit > 0 ? `лимит ${formatMoney(a.creditLimit, a.currency)}` : 'Monobank',
      net: a.ownFunds === null ? null : a.income - a.spending,
      netText: `${netText(a.income - a.spending, a.currency)} ${month}`,
      flow: { currency: a.currency, income: a.income, spending: a.spending },
    })),
  ];
}
```

  Подписи числа счетов («3 человека · 8 счетов») — склонение как `connectionsCount` в `features/settings/people/utils.ts`;
  функцию для счетов добавить здесь же (`accountsCount`) и поправить ожидания теста. `constants.ts`: `UAH = 980`,
  `CARD_STEP = 356`, `STACK_DEPTH = 3`, `VISIBLE_CARDS = 2`, `MONTHS_GEN`, `MONTHS_IN`, `MONTHS_SHORT`.
- [x] `types.ts`: `Slide` (поля `BalanceCardProps` + `key`, `flow: { currency: number; income: number; spending: number }`),
  `UseCardStackReturn`, `UseMonthOverviewReturn`.
- [x] `api/useBalancesRequest.ts`: `{ fetchOverview: (q: MonthOverviewQuery) => balanceApi.getMonthOverview(q) }`.
- [x] `composables/useMonthOverview.ts`: `useAsyncData(() => fetchOverview({ month: month.value, ...(id !== null ? { participantId: id } : {}) }), [() => monthStore.month, () => participant.selectedId], { quiet: [() => syncStatus.version] })`.
- [x] `composables/useCardStack.ts`: `open`, `offset`, `stubShown` (`ref`); `toggle()` (меняет `open`, `offset = 0`,
  `stubShown = false`), `close()`, `prev()`, `next(n)` (в пределах `maxOffset(n)`), `showStub()`; `watch` на месяц и
  человека → `offset = 0`.
- [x] `components/CardStack.vue`: контейнер `relative h-[270px] overflow-hidden`; на каждый слайд — обёртка
  `absolute w-[340px] flex flex-col gap-3`, позиция через `:style="{ '--x': …px, '--y': …px, '--d': …ms, zIndex, opacity }"` и
  классы `left-(--x) top-(--y) delay-(--d) transition-[left,top,opacity] duration-550 ease-[cubic-bezier(.2,.8,.2,1)] motion-reduce:transition-opacity`;
  внутри `BalanceCard` (`@click="emit('toggle')"`, `:aria-expanded`, `aria-controls` = id ряда) и `FlowBars` под картой
  (`v-show="open"` с плавным появлением через `opacity` + задержку 150 ms). Задержка: `open ? i * 45 : (n - i) * 20`,
  при листании стрелками — 0.
- [x] `components/FlowBars.vue`: две строки «Пришло» / «Ушло», полоса из сегментов (`flowWidths`), сумма справа;
  свойства `income`, `spending`, `currency`, `segments?: ReadonlyArray<{ color: string; income: number; spending: number }>`
  (у семьи — люди; иначе одна полоса цвета человека и её приглушённая копия `color-mix(in oklch, <цвет> 55%, var(--surface))`),
  `size: 'sm' | 'md'` (8 px под картой / 12 px в панели). Зазор 2 px между сегментами, скругление только у последнего.
- [x] `components/MonthPanel.vue`: заголовок месяца (`monthTitle` с большой буквы) + `coverageNote` +
  «потрачено N% прихода» (скрыть, если приход 0), `FlowBars size="md"`, легенда людей (только семья; точка
  `colorVar`), `VButton` «Все счета» + текст заглушки.
- [x] `components/BalancesHeader.vue`: два слоя с перекрёстным `opacity` (как в прототипе): свёрнутый — «Баланс», подсказка с
  иконкой `lucide:maximize-2`, `VMonthPicker`; развёрнутый — «Карты семьи» / «Счета · Имя», `VMonthPicker`, `VButton`
  `neutral` со стрелками (`aria-label` «Назад» / «Дальше», `disabled` на границах), «Все счета», «Свернуть» (`lucide:x`).
  `VMonthPicker`: `v-model` — `monthStore.month` через `set(…, firstMonth)`, `min` — первый месяц из
  `syncStatus.status.dataFrom`, `max` — `thisMonth`.
- [x] `BalancesFeature.vue`: `VCard` без заголовка (padding `md`), `@keydown.esc="stack.close"`; ошибка —
  `VInfoNotice` как сейчас; пустые данные — прежний текст; сетка: `BalancesHeader`, затем `relative` блок с `CardStack` и
  `MonthPanel` (абсолютно справа, `left-[452px]`; при `open` — `opacity-0 translate-x-8 pointer-events-none` с переходом).
- [x] `npx vitest run tests/renderer tests/architecture.test.ts tests/ui.test.ts tests/styles.test.ts && pnpm typecheck`.
- [x] Коммит: `feat(desktop): the balance block — card stack, carousel, month panel`.

### Задача 7: документы, CHANGELOG, финальная проверка

- [x] `CHANGELOG.md`, раздел `## 0.1.5 — unreleased`:
  - «Balances on the home screen are now a bank card with this month's income and spending; click it to see a card for
    every person (or, for one person, every account).»
  - «Pick a month: the cards show the balance at the end of that month, and income and spending for it. The spending
    block below follows the same month.»
- [x] `.agents/project/desktop-renderer.md`: блок балансов (стопка / ряд, `entities/account`, `entities/period`, один
  месяц на главную, `VMonthPicker`); `.agents/project/desktop-import.md`: `getMonthOverview` вместо `getBalances`,
  `DataStatus.dataFrom`; `.agents/project/domain-rules.md`: остаток на конец месяца (`balancesAt`, обратный расчёт,
  текущий лимит кредитки).
- [x] В корне: `pnpm test && pnpm typecheck` — всё зелёное; отметить чекбоксы этого плана.
- [x] Коммит: `docs: changelog 0.1.5 and project notes for the balance block`.
- [x] Отчёт пользователю: что сделано, что проверить глазами (анимация стопки и ряда, пружина нажатия, выбор месяца в
  обеих темах, «уменьшить движение», прошлый месяц с остатком на конец, счёт без данных). Приложение агент не запускает.
