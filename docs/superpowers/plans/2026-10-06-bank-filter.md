# Bank Filter and Refresh by Bank Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every data screen can be narrowed to one bank (provider) and a refresh can be run for one bank, with nothing
changing while only one bank is connected.

**Architecture:** The bank is one more optional field (`provider`) in the filter that already carries the person: core
`Filters` → the desktop data queries → the request composables. The chosen bank lives in the participant store (it owns
the connections); the select and the refresh popover live in the `global-filters` widget. A refresh is the existing
auto-sync run, started by the user and restricted to the provider's connections.

**Tech Stack:** TypeScript, libsql (SQLite), zod, Electron IPC, Vue 3.5 + Pinia, vue-i18n, vitest.

**Spec:** `docs/superpowers/specs/2026-10-06-bank-filter-design.md`

## Global Constraints

- English only in code comments, docs, test names and commit messages; UI texts only in `apps/desktop/src/shared/i18n/{uk,en,ru}.json`
  (`uk.json` is the reference; the same key goes into all three in the same change). No literal UI text in code.
- With one connected provider the app looks and behaves exactly as today: no select, no popover, no `provider` in any query.
- `provider` is optional everywhere; absent = all banks. `apps/mcp` is not changed.
- An own transfer between accounts of two providers stays excluded from spending and income in every view.
- Coverage (`periodInfo`) and `firstDataDate` stay family-wide.
- Trust anchors are not touched: `apps/mcp/package.json` scripts, `apps/mcp/tests/recategorize-safety.test.ts`,
  `.claude/settings.json`, `.github/workflows/release.yml`. No change to the analysis copy or masking.
- Never run the real-data commands (`sync`, `accounts`, `dev:mcp`, `export:analysis`, …) and never read `data/`, `*.db`, `.env`.
- Renderer architecture (checked by `apps/desktop/tests/architecture.test.ts`): layers import only downwards, slices of
  one layer do not import each other, `balanceApi` is called only from a slice's `api/` segment, a slice is used from
  outside only through its `index.ts`.
- No `CHANGELOG.md` entry (nothing user-visible with one bank).
- Commit only when the user has asked for commits; otherwise leave each task's changes staged.
- On this Windows machine `pnpm test` fails in file-system tests unrelated to this work (symlink `EPERM`, `EBUSY` on temp
  databases). Judge a task by its own test files; report the full-suite state as it is.

## Review Focus

- A remembered bank that is no longer connected: the screens show all banks, not an empty app (Task 4).
- A person with no connection at the selected bank: zeros and the usual «no data» states, never an error (Tasks 1, 2).
- The family view narrowed to a bank: each person's part is «that person, that bank», and the parts still add up to the head figure (Task 2).
- «Refresh» pressed while an import or a refresh is already running: refused with `running`, button disabled, nothing queued (Tasks 3, 7).
- A bank whose connections have no saved token: `no-token`, worded next to the button, no run started (Tasks 3, 7).

---

### Task 1: Core — `provider` in the filters and the balances

**Files:**
- Modify: `packages/core/src/summaries.ts` (`Filters`, `accountWhere`, `validateFilters`)
- Modify: `packages/core/src/status.ts` (`loadAccounts`, `getBalances`, `balancesAt`)
- Test: `packages/core/tests/bank-filter.test.ts` (new)

**Interfaces:**
- Produces: `Filters = { scope?: Scope; accountId?: string; participantId?: number; provider?: ProviderId }`;
  `getBalances(db, opts: { participantId?: number; provider?: ProviderId })`;
  `balancesAt(db, opts: { endSec: number; participantId?: number; provider?: ProviderId })`.
  Everything that takes `Filters` (`spendingSummary`, `spendingGrid`, `comparePeriods`, `incomeSummary`, `incomeRowsSql`,
  `categoryLines`, `incomeLines`) narrows by it with no change of its own.

- [ ] **Step 1: Write the failing test**

A second bank exists only in the test, by mocking the two registries (follow `family.test.ts` for the fixture style):

```ts
vi.mock('../src/providers/types.ts', async (orig) => ({
  ...(await orig<typeof import('../src/providers/types.ts')>()),
  PROVIDER_IDS: ['monobank', 'testbank'],
}));
vi.mock('../src/providers/rules.ts', async () => {
  const { monobankRules } = await import('../src/providers/monobank/rules.ts');
  const PROVIDER_RULES: Record<string, typeof monobankRules> = { monobank: monobankRules, testbank: monobankRules };
  return { PROVIDER_RULES, rulesFor: (p: string) => PROVIDER_RULES[p] };
});
```

Fixture (February 2026, `q = { from: '2026-02-01', to: '2026-02-28' }`, rows inserted by SQL with their derived
columns set, no `rederiveCore`): participant «me» with a `monobank` connection (account `me-mono`) and a `testbank`
connection (account `me-test`); participant «her» with a `monobank` connection (account `her-mono`).

| id | account | amount (minor) | category | is_internal_transfer |
|---|---|---|---|---|
| `g1` | `me-mono` | −10000 | groceries | 0 |
| `g2` | `me-test` | −5000 | groceries | 0 |
| `g3` | `her-mono` | −3000 | groceries | 0 |
| `t-out` | `me-mono` | −20000 | transfers | 1 |
| `t-in` | `me-test` | 20000 | transfers | 1 |
| `s1` | `me-test` | 70000 | income | 0 |

Tests and what each asserts (spending totals as the groceries net of `spendingSummary(..., groupBy: 'category')`):

- `'no provider: every bank'` — 18000.
- `'one provider narrows the accounts'` — `provider: 'monobank'` → 13000; `provider: 'testbank'` → 5000.
- `'provider and participant combine'` — me + `monobank` → 10000; her + `testbank` → no groups, total 0.
- `'an own transfer between two banks is not spending or income in any view'` — no `transfers` group and no income
  from `t-in` for no provider, `monobank`, `testbank`.
- `'income narrows the same way'` — `incomeSummary` with `testbank` counts `s1`; with `monobank` counts nothing.
- `'balances narrow the same way'` — `getBalances(db, { provider: 'testbank' })` lists only `me-test`;
  `balancesAt(db, { endSec, provider: 'monobank', participantId: her })` lists only `her-mono`.
- `'an unknown provider is refused'` — `spendingSummary(db, { ...q, provider: 'nobank' as never }, NOW)` rejects.

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm --filter @mono/core exec vitest run tests/bank-filter.test.ts`
Expected: FAIL (the `provider` field is ignored: the narrowed totals equal the full ones).

- [ ] **Step 3: Implement**

`accountWhere`: with `participantId` and/or `provider`, one subquery over `accounts pa JOIN connections pc` with the
conditions that are present. `excludedTransferSql` is not touched. `validateFilters`: `provider !== undefined` →
`parseProviderId(f.provider)` (from `connections.ts`), rethrown as `SummaryError`. `loadAccounts(db, participantId?, provider?)`
gets the same two optional conditions; `getBalances` and `balancesAt` pass `opts.provider` on.

- [ ] **Step 4: Run the core tests**

Run: `pnpm --filter @mono/core exec vitest run tests/bank-filter.test.ts tests/family.test.ts tests/summaries.test.ts tests/balances-at.test.ts tests/purity.test.ts`
Expected: PASS. Then `pnpm --filter @mono/core typecheck` → no errors.

- [ ] **Step 5: Commit** (if commits were asked for)

`feat(core): filter aggregates and balances by provider`

---

### Task 2: Desktop main — `provider` in the six data channels

**Files:**
- Modify: `apps/desktop/src/shared/api.ts` (the six query types)
- Modify: `apps/desktop/src/main/ipc.ts` (zod schemas)
- Modify: `apps/desktop/src/main/data.ts` (`monthOverview`, `spendingOverview`, `categoryOverview`, `incomeOverview`, `analyticsOverview`, `nowOverview`)
- Test: `apps/desktop/tests/data.test.ts`, `apps/desktop/tests/ipc.test.ts`

**Interfaces:**
- Consumes: Task 1's `Filters.provider`, `balancesAt` `provider`.
- Produces: `provider?: ProviderKey` on `MonthOverviewQuery`, `SpendingOverviewQuery`, `NowOverviewQuery`,
  `CategoryOverviewQuery`, `IncomeOverviewQuery`, `AnalyticsQuery`. Answer types unchanged.

- [ ] **Step 1: Write the failing tests**

`data.test.ts` (mock the registries as in Task 1 so the fixture can hold a second provider; reuse the file's own
fixture helpers):

- `'each data channel narrows to a provider'` — for each of the six methods: the figure with `provider: 'testbank'`
  equals the figure of the fixture's test-bank rows only, and differs from the figure without `provider`.
- `'the family view of one bank: the parts add up to the head'` — `spendingOverview` and `monthOverview` without
  `participantId`, with `provider: 'monobank'`: the sum of the people's parts equals the head figure.
- `'a person without a connection at the bank gets zeros'` — her + `testbank` → resolves, totals 0, no throw.

`ipc.test.ts`:

- `'data channels accept a known provider and refuse an unknown one'` — `{ month, provider: 'monobank' }` passes the
  schema; `{ month, provider: 'nobank' }` and `{ month, provider: 1 }` are refused.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter @mono/desktop exec vitest run tests/data.test.ts tests/ipc.test.ts`
Expected: FAIL (zod `strictObject` refuses the unknown key `provider`; the service ignores it).

- [ ] **Step 3: Implement**

zod: `provider: z.enum(PROVIDER_IDS).optional()` in the six schemas. `data.ts`: build the core filter once per method
(`participantId` and `provider`, each only when defined) and use it wherever `participantId` is passed today — the head
figure, the compared period, the per-person parts (`{ participantId: p.id, provider }`), `balancesAt`, the «usual day /
usual month» queries. Do not add `provider` to `status()`, `lastSyncSec()` or `periodInfo`.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @mono/desktop exec vitest run tests/data.test.ts tests/ipc.test.ts tests/spending-main.test.ts tests/now-main.test.ts tests/analytics-main.test.ts tests/category.test.ts`
Expected: PASS. Then `pnpm --filter @mono/desktop typecheck`.

- [ ] **Step 5: Commit** (if asked) — `feat(desktop): data channels take a provider`

---

### Task 3: Desktop main — `refreshNow`

**Files:**
- Modify: `apps/desktop/src/main/importer.ts` (`startAuto`)
- Modify: `apps/desktop/src/shared/channels.ts`, `apps/desktop/src/shared/api.ts` (`BalanceApi`), `apps/desktop/src/main/ipc.ts`, `apps/desktop/src/main/index.ts`
- Test: `apps/desktop/tests/importer.test.ts`, `apps/desktop/tests/ipc.test.ts`, `apps/desktop/tests/preload.test.ts`

**Interfaces:**
- Produces: `Importer.startAuto(opts?: { providers?: ReadonlyArray<ProviderId> }): Promise<StartImportResult>`;
  IPC method `refreshNow(q: { provider?: ProviderKey }): Promise<StartImportResult>` in `METHODS` and `BalanceApi`.

- [ ] **Step 1: Write the failing tests**

`importer.test.ts`:

- `'startAuto with providers takes only their connections'` — connections `{1: monobank, 2: testbank}`, both with
  tokens; `startAuto({ providers: ['testbank'] })` → the worker's `start` message carries only connection 2, marked `auto`.
- `'startAuto without providers takes every connection'` — unchanged behaviour (both connections).
- `'a provider whose connections have no token → no-token'` — `{ started: false, reason: 'no-token' }`, no worker started.
- `'refused while an import runs or waits'` — `{ started: false, reason: 'running' }` in both cases.

`ipc.test.ts`: `refreshNow` accepts `{}` and `{ provider: 'monobank' }`, refuses `{ provider: 'nobank' }`; it is not in
`ALLOWED_WHEN_LOCKED` and not in `ALLOWED_WHEN_DB_UNAVAILABLE`. `preload.test.ts`: its method list includes `refreshNow`.

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm --filter @mono/desktop exec vitest run tests/importer.test.ts tests/ipc.test.ts tests/preload.test.ts`
Expected: FAIL (`startAuto` takes no argument; `refreshNow` is not a method).

- [ ] **Step 3: Implement**

`startAuto`: with `providers`, resolve `this.d.connections()` to the ids whose provider is listed and pass them as
`only` to `launch`; an empty list of ids → `{ started: false, reason: 'no-token' }`. `launch` already returns
`no-token` when none of the taken connections has a token — keep that path as the single source of the reason.
`index.ts`: `refreshNow: (q) => importer.startAuto(q.provider ? { providers: [q.provider] } : undefined)`. The
`AutoSync` scheduler keeps calling `startAuto()` with no argument.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @mono/desktop exec vitest run tests/importer.test.ts tests/ipc.test.ts tests/preload.test.ts tests/auto-sync.test.ts tests/lock-gate.test.ts`
Expected: PASS. Then `pnpm --filter @mono/desktop typecheck`.

- [ ] **Step 5: Commit** (if asked) — `feat(desktop): refreshNow — a user-started refresh, optionally for one provider`

---

### Task 4: Renderer — the chosen bank in the participant store

**Files:**
- Modify: `apps/desktop/src/renderer/src/entities/participant/store/useParticipantStore.ts`
- Modify: `apps/desktop/src/renderer/src/entities/participant/constants.ts` (`SELECTED_PROVIDER_KEY = 'balance.provider'`)
- Test: `apps/desktop/tests/renderer/bank-filter.test.ts` (new, `// @vitest-environment happy-dom`)

**Interfaces:**
- Produces, on `useParticipantStore()`: `providers: ProviderKey[]` (distinct providers of the connections, in the order
  they first appear), `multipleBanks: boolean`, `selectedProvider: ProviderKey | null`, `selectProvider(p: ProviderKey | null): void`.

- [ ] **Step 1: Write the failing test**

Mock `@/shared/api` (`balanceApi.listPeople`) as the other renderer tests do. A second provider in a fixture is a
cast: `'testbank' as ProviderKey`.

- `'one bank: nothing to choose'` — one `monobank` connection → `providers` `['monobank']`, `multipleBanks` false,
  `selectedProvider` null even after `selectProvider('monobank')`.
- `'two banks: the choice is kept and remembered'` — `selectProvider('testbank')` → `selectedProvider` `'testbank'`,
  `localStorage['balance.provider']` `'testbank'`; a new store instance reads it back.
- `'a remembered bank that is gone reads as all banks'` — `localStorage` holds `'testbank'`, the people have only
  `monobank` → `selectedProvider` null.
- `'null clears the choice'` — `selectProvider(null)` → null, and the key is removed.

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm --filter @mono/desktop exec vitest run tests/renderer/bank-filter.test.ts`
Expected: FAIL (`providers` is undefined).

- [ ] **Step 3: Implement**

`selectedProvider` is computed like `selectedId`: the remembered value only while `multipleBanks` and it is among
`providers`. Storage access in `try/catch`, as `readSelected` / `writeSelected`. Return all four from the store.

- [ ] **Step 4: Run** the same command → PASS; `tests/renderer/people.test.ts` still passes.

- [ ] **Step 5: Commit** (if asked) — `feat(renderer): the chosen bank in the participant store`

---

### Task 5: Renderer — the bank select in the global filters

**Files:**
- Create: `apps/desktop/src/renderer/src/widgets/global-filters/components/BankFilter.vue`
- Modify: `apps/desktop/src/renderer/src/widgets/global-filters/GlobalFilters.vue`, `utils.ts`, `constants.ts`
- Modify: `apps/desktop/src/shared/i18n/{uk,en,ru}.json`
- Test: `apps/desktop/tests/renderer/bank-filter.test.ts`

**Interfaces:**
- Consumes: Task 4's store fields; `bankOf(provider)` from `@/entities/bank`.
- Produces: `ALL_BANKS = ''` (the select's value for «All banks») in `constants.ts`;
  `bankOptions(providers: ReadonlyArray<ProviderKey>): Array<{ label: string; value: string }>` in `utils.ts`
  («All banks» first, then one per provider, labels through `t`).

Texts (exact):

| key | uk | en | ru |
|---|---|---|---|
| `home.filters.bank` | Банк | Bank | Банк |
| `home.filters.allBanks` | Усі банки | All banks | Все банки |

- [ ] **Step 1: Write the failing tests**

- `'bankOptions: «All banks», then the connected banks by name'` — `bankOptions(['monobank'])` →
  `[{ label: 'Все банки', value: '' }, { label: 'Monobank', value: 'monobank' }]` (the renderer tests read Russian).
- `'the select is absent with one bank and present with two'` — mount `GlobalFilters` with `hasData`: no element with
  `data-test="bank-filter"` for one provider; one for two.
- `'picking a bank selects it; «All banks» clears it'` — the select's `update:modelValue` with `'testbank'` →
  `participant.selectedProvider === 'testbank'`; with `''` → null.

- [ ] **Step 2: Run** `pnpm --filter @mono/desktop exec vitest run tests/renderer/bank-filter.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`BankFilter.vue`: a `VSelect` (sr-only `<label>` with `home.filters.bank`, `data-test="bank-filter"`), value
`participant.selectedProvider ?? ALL_BANKS`. In `GlobalFilters.vue` it goes inside the `left` group after
`CurrencyToggle`, under `v-if="participant.multipleBanks"` (so `useParticipantLayout` measures it with the rest of the
left side).

- [ ] **Step 4: Run**

`pnpm --filter @mono/desktop exec vitest run tests/renderer/bank-filter.test.ts tests/renderer/global-filters.test.ts tests/i18n.test.ts tests/architecture.test.ts` → PASS.

- [ ] **Step 5: Commit** (if asked) — `feat(renderer): the bank select in the global filters`

---

### Task 6: Renderer — the data blocks follow the chosen bank

**Files (each feature's request composable; the `api/` request functions only if their parameter type needs it):**
- Modify: `features/balances/composables/useMonthOverview.ts`, `features/balances/composables/useCardStack.ts`
- Modify: `features/spending-summary/composables/useSpending.ts`
- Modify: `features/now-strip/composables/useNowStrip.ts`
- Modify: `features/category-detail/composables/useCategoryDetail.ts`, `useCategoryView.ts`
- Modify: `features/income-detail/composables/useIncomeDetail.ts`, `useIncomeView.ts`
- Modify: `features/analytics-overview/composables/useAnalytics.ts`
- Test: `apps/desktop/tests/renderer/{balances,spending-feature,now-strip,category-detail,income-detail,analytics}.test.ts`

(paths under `apps/desktop/src/renderer/src/`)

**Interfaces:**
- Consumes: `participant.selectedProvider` (Task 4); Task 2's `provider?` on the query types.

- [ ] **Step 1: Write the failing tests** — in each of the six test files, next to its existing «sends participantId» case:

- `'sends the chosen bank and reloads when it changes'` — with two providers: the first request has no `provider` key;
  after `participant.selectProvider('testbank')` and `flushPromises()` the last request's argument has
  `provider: 'testbank'`.
- `'one bank: no provider in the request'` — the request argument has no `provider` key (`'provider' in arg` is false).

And for the blocks with their own state: `'a bank change resets the block like a person change'` — the card stack
closes (`balances`), the spending block's own pick clears (`spending-feature`), the list's merchant filter and search
clear (`category-detail`, `income-detail`).

- [ ] **Step 2: Run** the six files → FAIL (the requests never carry `provider`).

- [ ] **Step 3: Implement**

In every composable: build the query with `provider` only when `selectedProvider !== null` (the same shape as the
existing `id !== null ? { participantId: id } : {}`), add `() => participant.selectedProvider` to the `useAsyncData`
dependency list, and to every `watch` that today lists `participant.selectedId` as a reset trigger.

- [ ] **Step 4: Run**

`pnpm --filter @mono/desktop exec vitest run tests/renderer` → PASS; `pnpm --filter @mono/desktop typecheck`.

- [ ] **Step 5: Commit** (if asked) — `feat(renderer): data blocks follow the chosen bank`

---

### Task 7: Renderer — refresh by bank from the sync status

**Files:**
- Create: `apps/desktop/src/renderer/src/widgets/global-filters/api/useRefreshRequest.ts`
- Create: `apps/desktop/src/renderer/src/widgets/global-filters/components/RefreshPopover.vue`
- Create: `apps/desktop/src/renderer/src/widgets/global-filters/composables/useRefresh.ts`
- Modify: `apps/desktop/src/renderer/src/widgets/global-filters/GlobalFilters.vue`, `utils.ts`, `types.ts`
- Modify: `apps/desktop/src/shared/i18n/{uk,en,ru}.json`
- Test: `apps/desktop/tests/renderer/sync-status.test.ts`, `apps/desktop/tests/renderer/bank-filter.test.ts`

**Interfaces:**
- Consumes: `balanceApi.refreshNow` (Task 3); `participant.providers`, `multipleBanks`, `connections` (Task 4);
  `importProgress.running`; `bankOptions` / `ALL_BANKS` (Task 5); `syncedWhen` from `@/shared/lib`.
- Produces: `useRefreshRequest(): { refreshNow: (provider: ProviderKey | null) => Promise<StartImportResult> }`;
  `lastRefreshOf(connections: ReadonlyArray<ConnectionView>, provider: ProviderKey | null): string | null` in `utils.ts`
  — the **oldest** `lastSyncAt` among the connections of the provider (all connections for null); null if any of them
  was never refreshed or there are none;
  `useRefresh(): UseRefreshReturn` = `{ bank: Ref<string>; error: Ref<string>; busy: ComputedRef<boolean>; refresh: () => Promise<void> }`.

Texts (exact):

| key | uk | en | ru |
|---|---|---|---|
| `home.filters.refresh.title` | Оновлення даних | Refresh data | Обновление данных |
| `home.filters.refresh.button` | Оновити | Refresh | Обновить |
| `home.filters.refresh.last` | Оновлено {when} | Refreshed {when} | Обновлено {when} |
| `home.filters.refresh.never` | Ще не оновлювалось | Not refreshed yet | Ещё не обновлялось |
| `home.filters.refresh.running` | Уже триває імпорт. | An import is already running. | Уже идёт импорт. |
| `home.filters.refresh.noToken` | Немає збереженого токена для цього банку. | No saved token for this bank. | Нет сохранённого токена для этого банка. |
| `home.filters.refresh.unavailable` | База зараз недоступна. | The database is unavailable right now. | База сейчас недоступна. |

- [ ] **Step 1: Write the failing tests**

- `'lastRefreshOf: the oldest refresh of the bank'` — two `monobank` connections (`…T10:00`, `…T12:00`) and one
  `testbank` (`…T09:00`): `'monobank'` → the 10:00 value; null (all) → the 09:00 value; a `monobank` connection with
  `lastSyncAt: null` → null; a provider with no connection → null.
- `'one bank: the status is a plain line'` — mounted `GlobalFilters`: no `data-test="refresh-trigger"`.
- `'two banks: the status opens the refresh popover'` — the trigger exists; opened, it shows the select and the button.
- `'Refresh asks for the selected bank'` — select `'testbank'`, click → `refreshNow` called with `{ provider: 'testbank' }`;
  with «All banks» → called with `{}`.
- `'a refusal is worded next to the button'` — `{ started: false, reason: 'no-token' }` → the `noToken` text is shown;
  `'running'` → the `running` text; `'db-unavailable'` → the `unavailable` text.
- `'disabled while an import runs'` — `importProgress.set({ phase: 'windows', … })` → the button has `disabled`, and a
  click calls nothing.

- [ ] **Step 2: Run** `pnpm --filter @mono/desktop exec vitest run tests/renderer/sync-status.test.ts tests/renderer/bank-filter.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`RefreshPopover.vue`: a `VPopover` whose trigger is the current status line (`SyncStatus` content as the trigger's
text, `data-test="refresh-trigger"`); inside — the title, a `VSelect` over `bankOptions(participant.providers)` bound
to `useRefresh().bank` (its own choice, default `ALL_BANKS`, not the data filter's), the `last` / `never` line from
`lastRefreshOf`, the «Refresh» `VButton` (`:disabled="busy"`, where `busy` = `importProgress.running` or a request in
flight) and a `VInfoNotice` for `error`. If `VPopover`'s trigger cannot carry the status content as is, give it a
`trigger` slot (a `shared/ui` change, its own step in the report). `GlobalFilters.vue`: `RefreshPopover` when
`participant.multipleBanks`, the plain `SyncStatus` otherwise. After a started refresh nothing else is needed: the
existing progress subscription moves the status line.

- [ ] **Step 4: Run**

`pnpm --filter @mono/desktop exec vitest run tests/renderer tests/i18n.test.ts tests/architecture.test.ts tests/ui.test.ts` → PASS; `pnpm --filter @mono/desktop typecheck`.

- [ ] **Step 5: Commit** (if asked) — `feat(renderer): refresh one bank or all from the sync status`

---

### Task 8: Docs and the full check

**Files:**
- Modify: `.agents/project/domain-rules.md` (the `provider` filter: what it narrows, own transfers stay internal)
- Modify: `.agents/project/desktop-import.md` (`refreshNow`; the data channels take `provider`)
- Modify: `.agents/project/desktop-renderer.md` (the participant store's bank fields, `BankFilter`, `RefreshPopover`)
- Modify: `.agents/project/core-providers.md` (the checklist «what adding a bank takes», from the spec; the filter and the refresh need nothing)
- Modify: `docs/backlog.md` (not checked on a live system: the bank select and the refresh popover, hidden until a second provider exists)

- [ ] **Step 1: Write the doc changes** — English, a few lines each, in the style of the surrounding text.

- [ ] **Step 2: Run the whole suite**

Run: `pnpm typecheck` → no errors. Run: `pnpm -r --no-bail test`.
Expected: every test file touched or added by this plan passes; the only failures are the Windows file-system ones
listed in «Global Constraints» (compare with a run on the base commit if in doubt).

- [ ] **Step 3: Commit** (if asked) — `docs: the bank filter and refresh by bank`
