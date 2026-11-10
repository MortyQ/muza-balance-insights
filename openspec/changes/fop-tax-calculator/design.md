# Design

## Context

See proposal.md. Income is core `incomeSummary` (`read/income.ts`): non-internal «поступления» rows, refunds and own
transfers left out, family transfers left out in the whole family's view. Business accounts are the provider's
`isBusinessAccount` (Monobank: `type = 'fop'`), already used by `derive/scope.ts`. Follows `.agents/project/desktop-import.md`
(an IPC read: `channels.ts`, `ipc-args.ts`, `data-protocol.ts`, `data/data.ts`, `data/host.ts`, `main/index.ts`,
`CACHED_READS`) and `.agents/project/desktop-renderer.md` (FSD, routes and `meta.nav`, «shared/ui first», i18n). Updates
both briefly. No core change, so `core-layout.md` is not touched.

## Decisions

- **Base = `incomeSummary` of the whole family, grouped by account, kept for the view's business accounts.** One call
  per period (`groupBy: 'account'`, no `participantId`), then only the groups whose account is an enabled business
  account of the picked person (or of anyone in the family view). The family view's rules leave out family
  transfers as well as own ones: money from a spouse to the FOP card is not business income. Alternatives: a new core
  `accountIds` filter — rejected, the account grouping already gives it without touching core; the person view of
  `incomeSummary` — rejected, it would count family transfers as income.
- **All scopes.** A FOP account's rows are business by rule, but a scope override may mark one personal; the base is
  about the account, not the scope.
- **The bank filter is ignored**, like «Budget»: a tax base must not change with a display filter.
- **Today's Monobank rates** for a foreign-currency FOP account, like every other screen; the law's NBU rate on the
  day of receipt is out of scope and named in the CHANGELOG review note and the backlog.
- **Year to date** = 1 January to the end of the picked quarter, cut at today: the cumulative figure a quarterly
  declaration of the 3rd group reports.
- **The tax is computed in the renderer** (`features/fop-tax/utils.ts`, pure): percent × base, `Math.round` to a
  kopeck. Main knows nothing of rates; presets are constants (`FOP_RATES` = 5, 1, 6). No ЄСВ figure anywhere: the
  amount changes yearly and must be checked by a person, so the screen only says it is not included.
- **Custom amount** replaces the quarter's base (whole or decimal hryvnias, typed); the year-to-date row is hidden then,
  since a typed amount has no year behind it.
- **Availability**: `DataStatus.businessAccounts` (any enabled business account, whatever the view) drives the menu
  item; `FopTaxOverview.available` (one in the view) drives the screen's own empty state. Quarter after the current
  one → main refuses (like a day after today).
- **Menu condition**: `RouteNav.when?: 'business'`; `navGroups(routes, holds)` drops an item whose condition does not
  hold (`holds` defaults to none holding). `useNav` / `useAppSidebar` pass the sync-status store's flag; the menu updates
  when the status refreshes. Alternative: adding and removing the route at run time — rejected, the route stays and
  the screen explains itself when opened.

## FSD placement

- `shared/config/routes.ts`: `ROUTE.fopTax`.
- `app/router/routes.ts`: `/fop-tax`, `meta.nav` (order 5, `lucide:badge-percent`, `when: 'business'`), `periodFilter: 'none'`.
- `pages/fop-tax`: `FopTaxPage` over the feature.
- `features/fop-tax`: `FopTaxFeature.vue`; `api/useFopTaxRequest.ts` (fetch + peek); `composables/useFopTax.ts` (the
  query from the picked period and person, `useAsyncData`); `components/` — `QuarterPicker`, `RatePicker`, `TaxResult`;
  `constants.ts` (`FOP_RATES`); `utils.ts` (`yearOptions`, `quarterAllowed`, `taxMinor`, `percentValue`, `amountMinor`, `taxView`);
  `types.ts`. Quarters (`quarterOf`, `quarterBounds`) in `src/shared/quarters.ts`, shared with the data process.

## Security

A read only: amounts and dates, no description, name, card number or IBAN. Nothing new leaves the data process.

## Risks

- A FOP account that receives a refund the core does not pair counts it as income (core's refund rules).
- A business account of a bank other than Monobank depends on that provider's `isBusinessAccount` (none today).
- Rates and the ЄСВ wording must be checked by a person before the release (`docs/backlog.md`).
