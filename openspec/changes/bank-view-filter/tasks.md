# Tasks

## 1. Core: the bank view in the reads — `feat(core): bank view in the statistics`

- [x] 1.1 `read/filters.ts`: `Filters.providers?: readonly ProviderId[]`; `validateFilters` refuses an empty list, an
      unknown id and duplicates; `accountWhere` restricts to the chosen providers' accounts. Verify with
      `tests/read/bank-view.test.ts`: one bank of three, no list equals today's figures, bank and person together, an
      invalid list throws.
- [x] 1.2 In the same test file, on the fictional second and third bank of the cross-bank tests: an own transfer stays
      out of spending and income when the other bank is hidden; a family transfer follows the person; the implicit fee
      appears only with the debit's bank; the single-bank views add up, per category and currency, to the all-banks
      view (spending and income).
- [x] 1.3 `people/accounts.ts`: `liveAccountIdsSql(providers?)`, with `LIVE_ACCOUNT_IDS_SQL` as its call without
      providers. `periodInfo` reads `q.providers` for completeness, covered days and pending holds. Verify the two
      completeness scenarios of `core-bank-view` and that a call without providers is unchanged.
- [x] 1.4 `read/status.ts`: `loadAccounts` takes `{ participantId?, providers? }`; `getBalances` and `balancesAt`
      take `providers`. Verify with tests: one bank's balances, labels unchanged, bank and person together.
- [x] 1.5 Check that `categoryLines`, `incomeLines` and `findRecurring` follow the filter through the shared builders.
      Verify with one test each.
- [x] 1.6 Add a «bank view» bullet to `.agents/project/domain-rules.md`. Run the core checks (`tsc` both configs,
      `vitest`) and the bench (`node --import tsx bench/run.ts`) against `bench/budgets.ts`.

## 2. Desktop: the data process takes the banks — `feat(desktop): bank view in the data process`

- [x] 2.1 `src/shared/api.ts`: `providers?: ProviderId[]` on every overview query that has `participantId`.
      `ipc-args.ts`: the zod schema applies core's rule (non-empty, known, unique). Verify with
      `tests/data-protocol.test.ts` and `tests/ipc.test.ts`: a valid list passes; an empty, unknown or duplicated one is
      refused.
- [x] 2.2 `src/data/data.ts`: every overview passes `providers` into its core filters — month (with the family's
      per-person groups), spending with the usual medians, «Now», category, income, analytics, regular payments, and
      the allowance's balances and regular flows (reserves by person only). Verify with `tests/data.test.ts`:
      - each overview narrows to one bank;
      - every overview without `providers` is unchanged;
      - `tests/data-queries.test.ts` statement counts are unchanged.
- [x] 2.3 Note in `.agents/project/desktop-import.md` that the overview queries take `providers`. Run the desktop
      checks (`tsc -p tsconfig.node.json`, `vitest`).

## 3. Renderer: a toggle group in shared/ui — `feat(desktop): VToggleGroup`

- [ ] 3.1 `shared/ui/components/inputs/VToggleGroup.vue`, exported from `@/shared/ui`. It has:
      - an array `v-model` and `options` with a label slot;
      - buttons with `aria-pressed` inside `role="group"` with a required `aria-label`;
      - `required` keeps the last value on and shows `lockedHint` as its tooltip.

      Verify with a renderer test: toggling, keyboard (Tab, Space, Enter), the last value staying on, the pressed
      state.
- [ ] 3.2 List `VToggleGroup` as our own component in `shared/ui/README.md`. Run `vue-tsc -p tsconfig.web.json`.

## 4. Renderer: the bank filter in the header — `feat(desktop): bank filter in the header`

- [ ] 4.1 `entities/participant`:
      - `utils.ts`: `offeredBanks(connections)` (enabled, imported, in `PROVIDER_IDS` order) and
        `nextBanks(chosen, offered, id)`;
      - the store: `banks`, `chosenBanks`, `selectedProviders` (`undefined` when every offered bank is on),
        `toggleBank`, remembered in `localStorage` `balance.banks` (`BANKS_KEY`, `try`/`catch`; stale ids dropped;
        nothing left → all).

      Verify with `tests/renderer` cases for every scenario of «All banks by default, never none» and «The choice is
      remembered on this computer».
- [ ] 4.2 `entities/participant/components/BankFilter.vue`: `VToggleGroup` with `BankMark` and the bank's name, shown
      only with two or more offered banks; exported from the slice. New keys in `uk.json`, `en.json` and `ru.json`:
      the group's label and the locked hint. Verify with a renderer test and `tests/i18n.test.ts`.
- [ ] 4.3 `widgets/global-filters/GlobalFilters.vue`: `BankFilter` in the left group after `CurrencyToggle`. Verify in
      `tests/renderer/app-header.test.ts`: shown with two banks, hidden with one; the person switch still falls back
      to the select in a narrow row.
- [ ] 4.4 Add the bank filter to the root `CLAUDE.md` «settings-ui» notes, next to `GlobalFilters`.

## 5. Renderer: every data screen follows the banks — `feat(desktop): data screens follow the bank filter`

- [ ] 5.1 Each feature composable that passes `participantId` also passes `participant.selectedProviders` and reloads
      on its change:
      - balances (`useMonthOverview`, `useMonthPace`, `useCardStack`);
      - `useNowStrip`;
      - `useSpending`;
      - `useAnalytics`;
      - `useCategoryDetail` / `useCategoryView`;
      - `useIncomeDetail` / `useIncomeView`;
      - `useRecurring` / `useRecurringTeaser`;
      - `useAllowance`.

      Verify with renderer tests:
      - a subset sends `providers`;
      - every bank on sends none;
      - toggling a bank reloads.
- [ ] 5.2 Add `## 0.1.13 — unreleased` to `CHANGELOG.md` with the bank filter: «show one, two or all of your banks on
      every screen; all banks by default». Verify with `tests/release-notes.test.ts`.

## 6. Checks

- [ ] 6.1 Add live checks to `docs/backlog.md`, section «Not checked on a live system»:
      - with real Monobank, PrivatBank and A-Bank data, the three single-bank views add up to the all-banks view on
        home and in analytics;
      - a statement-only bank's view reads complete up to its last day;
      - an own transfer between two banks is not spending in either bank's view.
- [ ] 6.2 Ask the user to run `pnpm test` and `pnpm typecheck` at the root and the desktop build; before that, run each
      package's checks from its folder (core, mcp, desktop) and report the counts.

## Workflow follow-up

- Sync the specs and archive the change after the user's review and root checks.
- After the merge, add the block to the Notion work log, then start the per-bank breakdown change noted in the Notion
  plan.
