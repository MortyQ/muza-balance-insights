# Bank filter and refresh by bank — design

Date: 2026-10-06. Scope: `packages/core`, `apps/desktop` (main, IPC, renderer). Mockup (approved by the user in chat):
the bank select next to the month and currency filters; the sync status opening a popover with a bank select and
«Refresh».

## Goal

The app has one bank today (Monobank). A second one is planned. This work makes the two things that are bank-wide
today — what the data screens show and what a refresh updates — selectable by bank, so that a new bank needs no change
in the filters, the data queries or the import launch.

Success criteria:

- every data screen can show one bank's data, combined with the person filter («Olena · Monobank»);
- the user can refresh one bank or all of them;
- with one connected bank the app looks and behaves exactly as today;
- adding a provider adds no code to the filter, the data channels or the refresh: the options come from the
  connections and from `BANKS`.

## Decisions (made with the user)

- «Bank» is the institution: the provider of a connection (`connections.provider`), not a connection and not a jar.
- The bank filter is a select («All banks», then each connected bank), not buttons.
- The bank to refresh is chosen in a select too, in a popover opened from the sync status.
- No per-bank switches in «Auto-sync»: auto-sync keeps refreshing every bank.
- A transfer between the owner's own accounts in two banks stays an own transfer in every view: never spending, never
  income. The filter only narrows the set of accounts. (Assumed and shown in the mockup; not objected to.)

## Out of scope

- A second provider itself (client, rules, token form, allowlisted hosts).
- A bank choice in the history download (that screen is being changed by another contributor).
- Per-bank shares on the home cards.
- `apps/mcp`: its tools keep working unchanged (the new filter field is optional).
- The analysis copy, masking, `recategorize` and every trust anchor: untouched.

## Approach

Three were considered:

1. **A `provider` field in the existing filters (chosen).** Core already narrows by participant in two places
   (`accountWhere` in `summaries.ts`, `loadAccounts` in `status.ts`); the bank is one more condition on the same join
   (`accounts → connections`). Smallest change, same shape as the person filter end to end.
2. A list of connection ids as the filter. More general (one of two connections of the same bank), but it puts ids in
   every query, needs its own validation and UI, and nobody asked for it.
3. Filtering in the renderer. Not possible: the screens get aggregates, not rows.

## Design

### Core (`packages/core`)

- `Filters` (`summaries.ts`) gets `provider?: ProviderId`. `accountWhere` adds the condition to the account subquery:
  the accounts of connections with that provider. With both `participantId` and `provider` it is one subquery with both
  conditions.
- `excludedTransferSql` does not change: the bank does not turn an own transfer into spending or income.
- `validateFilters` refuses a `provider` that is not in `PROVIDER_IDS` (`parseProviderId`), as core does everywhere
  else: the database never holds an unknown provider. Core tests get their second bank by mocking the two registries
  (`providers/types.ts`, `providers/rules.ts`) — which is also the proof that a new bank is registry entries only.
- `status.ts`: `loadAccounts`, `getBalances` and `balancesAt` take `provider?` next to `participantId`.
- Coverage (`periodInfo`: data until, covered days, pending holds) stays family-wide, exactly as it is for a person
  today; so does `firstDataDate` (the month filter's lower bound).
- Everything built on `Filters` gets the field for free: `spendingSummary`, `spendingGrid`, `comparePeriods`,
  `incomeSummary` / `incomeRowsSql`, `categoryLines`, `incomeLines`. A helper the desktop data service calls with a
  bare `participantId` instead of `Filters` gets a `provider` argument next to it.

### Main and IPC (`apps/desktop/src/main`, `src/shared/api.ts`)

- Every data query type gets `provider?: ProviderKey`: `MonthOverviewQuery`, `SpendingOverviewQuery`, `NowOverviewQuery`,
  `CategoryOverviewQuery`, `IncomeOverviewQuery`, `AnalyticsQuery`. zod: `provider: z.enum(PROVIDER_IDS).optional()`.
- `DataService` passes it to core wherever it passes `participantId` today, including the per-person parts of the family
  view (each part is «that person, that bank»).
- The answers do not change shape.
- New channel `refreshNow({ provider?: ProviderKey })` → `StartImportResult`. Main: `Importer.startAuto` gains an
  optional list of providers; it resolves them to connection ids and passes them as the existing `only` argument of
  `launch`. The run is the auto-sync run (no job file, no token prompts, states marked `auto: true`), started by the
  user, so `AutoSync`'s thresholds and switches do not apply. It refuses like `startAuto` does: `running` while an
  import runs or an unfinished one waits; `db-unavailable`. A provider with no connection that has a token →
  `no-token`.
- Like the other data channels, `refreshNow` is closed while locked and while the database is not ready.

### Renderer

State — `entities/participant` (it already owns the connections):

- `providers`: the distinct providers of the connections, in the order they first appear (the entity does not
  import `entities/bank`);
- `multipleBanks`: more than one;
- `selectedProvider: ProviderKey | null` (null = all banks), remembered in `localStorage` like the person choice;
  a remembered provider that is no longer connected reads as null;
- `selectProvider(provider | null)`.

Filter — `widgets/global-filters` (the widget may use both `entities/participant` and `entities/bank`; the entities do
not import each other):

- `components/BankFilter.vue`: a `VSelect` with «All banks» and one option per connected provider (name from
  `bankOf`). Rendered only when `participant.multipleBanks`, after `CurrencyToggle`.
- `useParticipantLayout` already measures the left group, so the person buttons fall back to their select when the row
  gets too narrow; no new layout rule.

Data — each request composable sends `provider` next to `participantId` and reloads on its change: `balances`,
`spending-summary`, `now-strip`, `category-detail`, `income-detail`, `analytics-overview`. What a block resets on a
person change (card stack, list filters, the block's own pick) it also resets on a bank change.

Refresh — `widgets/global-filters`:

- With one bank the sync status stays the plain line it is today.
- With more than one it becomes the trigger of a `VPopover`: a select («All banks» + banks, its own choice, not the
  data filter's), the last refresh of the selection (from the connections' `lastSyncAt`: the oldest among the selected
  bank's connections, so «refreshed» never overstates), and a «Refresh» button → `refreshNow`.
- While an import or a refresh runs the button is disabled; the status line shows progress as it does today.
- A refusal is worded next to the button (`running`, `no-token`, `db-unavailable`), with the existing import texts
  where they fit.

Texts: new keys in `uk.json`, `en.json`, `ru.json` (`home.filters.bank`, `home.filters.allBanks`,
`home.filters.refresh*`). No literal texts.

### What adding a bank still takes (unchanged by this work)

The provider's rules and client in core, its entry in `PROVIDER_IDS` / `PROVIDER_RULES`, `DESKTOP_PROVIDERS`,
`WORKER_PROVIDERS` and the worker's `FETCH` table, its hosts in `TRUSTED_SERVICES` (a separate, reviewed step), its entry
in `BANKS` and its form folder in `features/integrations`. None of it touches the filter or the refresh.

## Error handling

- An unknown `provider` at the IPC boundary is refused by zod, like any malformed argument.
- A person with no connection at the selected bank shows zeros and the existing «no data» states, not an error.
- A remembered bank that is gone falls back to all banks.

## Testing

- Core (`packages/core/tests`): with two connections of different providers — spending, income and balances
  for each provider, for both, and combined with a participant; an own transfer between the two providers is excluded
  in all three views; an unknown provider is refused.
- Main (`apps/desktop/tests/data.test.ts`, `ipc`): each data channel accepts `provider` and narrows; zod refuses an
  unknown one; `refreshNow` launches only the provider's connections, refuses while running, reports `no-token`.
- Renderer (`tests/renderer`): the store (`providers`, `multipleBanks`, fallback of a remembered provider); the filter
  is absent with one bank and present with two; each request composable sends `provider` and reloads on change; the
  refresh popover's last-refresh line and disabled state.
- `pnpm test` and `pnpm typecheck` at the root.

Not verifiable on a live system until a second provider exists: the filter and the popover are hidden with one bank.

## Changelog

Nothing user-visible changes with one bank, so no `CHANGELOG.md` entry now; the entry goes in with the second bank.
