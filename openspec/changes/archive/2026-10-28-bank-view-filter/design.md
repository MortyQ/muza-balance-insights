# Design

## Context

See proposal.md for why. The person switch is the model to follow:

- **Core.** `read/filters.ts`: `Filters.participantId` narrows `accountWhere` to one participant's accounts, and
  `personView` switches family transfers from excluded to counted. Every statistic is built on `accountWhere`:
  `spendingLinesSql` (spending, grid, category lines, regular payments) and `incomeRowsSql` (income, income lines).
  `loadAccounts` in `read/status.ts` builds its own `WHERE` for balances. `periodInfo` gets the query object but
  ignores its filters. It reads `LIVE_ACCOUNT_IDS_SQL` (`people/accounts.ts`) for completeness and
  `ENABLED_ACCOUNT_IDS_SQL` for pending holds.
- **Transfers.** The derivation stores `is_internal_transfer`, `transfer_rule`, `transfer_fee` and `crossing_category`
  per row (`derive/`, `domain-rules.md`), and a view excludes rows by these stored flags only. An own cross-bank pair is
  internal on both halves. Its implicit fee is a `transfer_fee` line built from the debit row (`spendingLinesSql`).
- **Desktop.** Each overview query in `src/shared/api.ts` carries `participantId?`, checked by `ipc-args.ts`. The data
  process (`src/data/data.ts`) spreads it into the core filters. The renderer reads
  `useParticipantStore().selectedId` in each feature's composable (home, analytics, category, income, regular
  payments, planning). The read cache keys answers by the method and its arguments (`desktop-read-cache`).
- **Rules.** FSD forbids one entity slice importing another (`tests/helpers/architecture.ts`). The participant store
  is the only renderer store that holds the connections (`ConnectionView.provider`, `enabledAccounts`, `coveredFrom`).

Rules followed: `.agents/project/domain-rules.md`, `core-layout.md`, `core-providers.md`, `desktop-import.md`,
`desktop-renderer.md`. Updated:
- `domain-rules.md` gets a «bank view» bullet beside the family-transfer one.
- `desktop-import.md` notes that the overview queries take `providers`.
- The root `CLAUDE.md` «settings-ui» notes list the bank filter among `GlobalFilters`.

## Goals / Non-Goals

**Goals:**
- One optional filter, `providers`, threaded from the header to every core read the data screens use.
- No new query per screen. With every bank on, the queries and the cache keys are identical to today's.

**Non-Goals:**
- No per-bank grouping (`groupBy: 'provider'`) and no breakdown bars. That is the later change.
- The MCP tools do not get the filter.
- The header's «data until» and «Data by bank» do not change.

## Decisions

### 1. The filter restricts accounts; stored transfer flags decide the rest

`Filters` gains `providers?: readonly ProviderId[]`. `accountWhere` adds
`t.account_id IN (SELECT … accounts JOIN connections … WHERE provider IN (…))`, next to the participant's clause.
Nothing else in the read paths changes.

The spec's behaviour follows from the stored flags:
- an internal pair stays excluded in every view;
- a family pair follows `personView`;
- the fee line rides on the debit row, so it appears exactly with the debit's bank.

Because a bank view is a subset of rows under unchanged rules, the views of disjoint banks add up to the whole.

*Alternative:* treat a pair whose other half is in a hidden bank like a crossing to a disabled account, i.e. as
ordinary spending and income. Rejected for three reasons:
- the bank views would no longer add up;
- an own transfer would show up as spending;
- it would need derived values per view, while the crossing is stored once per row.

### 2. Absent means all banks; the renderer sends a list only for a subset

The argument is optional and validated: non-empty, known ids, no duplicates, at most `PROVIDER_IDS.length`. Core
`validateFilters` and zod in `ipc-args.ts` apply the same rule. The renderer sends `providers` only when some offered
bank is off.

This keeps every current caller unchanged: the MCP server, the tests, `recategorize`'s imports. It also keeps the
all-banks cache keys and queries unchanged. *Alternative:* always send the full list. Rejected: it changes every cache
key and every query for no gain.

### 3. Completeness and pending holds follow the chosen banks

`periodInfo` reads `q.providers`. The live rule becomes a builder in `people/accounts.ts`,
`liveAccountIdsSql(providers?)`, and `LIVE_ACCOUNT_IDS_SQL` stays as the call without providers. It applies
`desktop-data-freshness`'s rule among the chosen accounts: their token connections decide while any of them has
imported data, else all of them. Pending holds count the chosen enabled accounts.

`getSyncStatus` / `DataService.status()` take no filter, so the header is unchanged. *Alternative:* keep completeness
global. Rejected: a statement bank alone would read as complete up to today and spread its per-day figure over days it
does not cover.

### 4. Balances

`loadAccounts(db, participantId?)` becomes `loadAccounts(db, { participantId?, providers? })`. `getBalances` and
`balancesAt` take `providers` in their options. Labels stay computed over all accounts, as today. The family's
per-person split (`balancesOf`) needs nothing new, because it splits the already-filtered answer.

### 5. Data process

Every overview's core filter object gets `providers` beside `participantId`:
- month, spending (including the usual medians), «Now», category, income, analytics, regular payments;
- allowance: `balancesAt`, and `findRecurring` for income and mandatory payments.

The family's per-person groups also get it. Reserves are not tied to a bank, so they follow the person only (spec
`desktop-bank-filter`, «Planning»). The helpers in `data/*.ts` take the filters as they are; each overview still runs
a fixed number of statements (`tests/data-queries.test.ts`).

### 6. The renderer: the view's state stays in the participant store

FSD placement:
- **entities/participant**
  - `store/useParticipantStore.ts`: `banks` (the providers offered), `chosenBanks`, `selectedProviders` (`undefined`
    when every offered bank is on), `toggleBank`;
  - `constants.ts`: `BANKS_KEY`;
  - `utils.ts`: `offeredBanks(connections)`, `shownBanks(chosen, offered)`, both pure and tested.
- **shared/ui**: `components/inputs/VToggleGroup.vue`.
- **widgets/global-filters**: `components/BankFilter.vue`, placed in `GlobalFilters`. It shows `entities/bank`'s marks,
  and one entity does not import another, so the component lives in the widget while the choice stays in the store.
- **features/***: each composable that passes `participantId` also passes `providers`.

The participant store already is «the family / person view», and it is the only store that holds the connections the
offered banks come from.
- *Alternative:* a new `entities/bank-view` slice. Rejected: it cannot import `entities/participant`, so every
  consumer would have to pass the connections in.
- *Alternative:* `entities/bank`. Rejected for the same reason.

Offered banks are the providers of connections with `enabledAccounts > 0` and `coveredFrom !== null`, in
`PROVIDER_IDS` order. They come from the whole family, whatever person is chosen, so the toggles do not jump while the
user switches people.

The choice is stored in `localStorage` `balance.banks` as a JSON array, read and written in `try`/`catch` like
`balance.participant`. Ids that are no longer offered are dropped. If none is left, every offered bank is on.

### 7. The control: a toggle group in shared/ui

`VSegmentedControl` picks one value, and `VButtonGroup` explicitly holds actions, not a selection. The new
`VToggleGroup` holds several values:
- `v-model` takes an array, and `options` holds `{ value, label }` with a slot for the label;
- each cell is a `button` with `aria-pressed`, inside `role="group"` with a required `aria-label`;
- the `required` prop keeps the last value on and shows its `lockedHint` as a tooltip.

`BankFilter` fills the label slot with `BankMark` and the bank's name. Below 45rem the names are kept for screen
readers only.

It sits in `GlobalFilters`' left group, after `CurrencyToggle`, on every route that shows the person switch. The left
group is already measured by `useParticipantLayout`, so the person buttons still fall back to the select when the row
gets too narrow. `shared/ui/README.md` lists `VToggleGroup` as our own component.

*Alternative:* a `VSelect` with checkboxes. Rejected: it hides the current view behind a click, while three short bank
names fit in the row.

### 8. Reloading

Each feature composable watches `participant.selectedProviders` next to `selectedId`, the same way. The cache needs
nothing: `providers` is part of the arguments, so it is part of the key.

## Risks / Trade-offs

- **[Risk]** A regular payment that moved from one bank to another splits into two series in a bank view.
  → Accepted. The all-banks view is unchanged, and the view shows what was paid from those banks.
- **[Risk]** A person with no account in the chosen banks sees empty screens.
  → Accepted, as with a person who has no data for the month. The empty states already exist.
- **[Risk]** One more `IN (subquery)` per read.
  → It joins `connections`, a handful of rows. The bench and the statement-count test catch a regression.
- **[Trade-off]** Planning with some banks: reserves and the person stay as they are, the money and the regular
  flows narrow to the chosen banks. That can make «Available per day» lower than for all banks. It is what «only these
  banks» means. The spec's «Planning» scenario fixes it.
