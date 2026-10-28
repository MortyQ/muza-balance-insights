# Design

## Context

See proposal.md for why. The per-person split is the model:

- **Data process.** `getCategoryOverview` and `getIncomeOverview` (`src/data/data.ts`) build the screen's lines first,
  then count the per-person part from them: `lineStats(lines, family)` and `incomeStats(lines, family)` in
  `src/data/category.ts`. Each line carries `participantId` and `account: AccountName`, whose `provider` is the bank's
  id. The lines already follow the bank filter (`viewOf(q)`, change `bank-view-filter`), so anything counted from them
  is counted over the view.
- **Renderer.** `features/category-detail` and `features/income-detail` turn `view.people` into bars with
  `peopleBars` (`entities/operations/utils.ts`) and show them in `PeopleBars` / `PersonBar`
  (`entities/operations/components`), which draw a `VAvatar`, the name, a caption (operations · average), the amount
  and a `VShareBar`. The card is shown when more than one person has a positive part (`people.length > 1`).
- **Rules.** FSD forbids one entity importing another (`tests/helpers/architecture.ts`), so `entities/operations`
  cannot show `entities/bank`'s `BankMark`. One feature cannot import another, so the category and income screens
  cannot share a feature-level component.

Rules followed: `.agents/project/desktop-renderer.md` (FSD, «`shared/ui` first», i18n), `desktop-import.md` (IPC
contracts in `src/shared/api.ts`). Neither needs an update: the change adds no new rule.

## Goals / Non-Goals

**Goals:**
- One more part in two existing answers, counted from lines already in hand: no new query, no core change.
- One bars component for people and banks, so the two cards look and behave the same.

**Non-Goals:**
- No per-bank part in other answers (`SpendingOverview`, `MonthOverview`, analytics).
- No bank colours in `entities/bank`.

## Decisions

### 1. The data process counts the bank parts from the lines

`lineStats` and `incomeStats` gain `banks`, counted in the same loop as `people`, keyed by `l.account.provider`:
- `CategoryOverview.banks: Array<SpendingAmounts & { provider: string }>` (net and purchases, as a person's part);
- `IncomeOverview.banks: Array<IncomeAmounts & { provider: string }>` (total and lines).

Every bank with at least one counted line is listed, in the registry's order (`PROVIDER_IDS`), then any id the
registry does not know. Lines without a rate are skipped, as for people. Because the lines are the screen's own
operations, the parts add up to the screen's total, and the bank view's rules hold by construction: an own transfer
between banks is not among the lines, and a transfer fee line carries the debit's account.

The list is filled in every view, not only the family's: a person can have several banks. `provider` is a `string`,
as in `AccountName`, so an unknown id still reaches the screen.

*Alternative:* a grouped core query (`groupBy: 'provider'`). Rejected: the lines are already loaded, and a query would
add a statement to both overviews (`tests/data-queries.test.ts`) for the same numbers.

*Alternative:* count the parts in the renderer from `view.lines`. Rejected: the per-person part is counted in the data
process, and the two parts should come from one place.

### 2. One bars component with a mark slot

`entities/operations` gets `PartBars` (title + rows) and `PartBar` (one row). A row is a `PartView`
(`key`, `name`, `color`, `amount`, `caption`, `width`); the leading mark is a scoped slot `mark`. `partBars(parts,
fmt)` turns `{ key, value, count }` into rows: positive parts only, on the largest one's scale, largest first, with the
same caption as today.

`PeopleBars` and `peopleBars` stay with their current props and results: `PeopleBars` renders `PartBars` with
`VAvatar` in the slot, and `peopleBars` builds on `partBars`. Their callers do not change.

The features fill the slot with `BankMark` (`size="sm"`). Each feature's `utils.ts` gets `banksView(view, fmt)`, a
two-line mapping beside `peopleView`, taking the name from `bankOf(provider)` (`entities/bank`). The bar colour is
`var(--cat)`, the screen's own colour, as in the merchants' and sources' bars.

*Alternative:* a `BankBars` component in each feature. Rejected: two copies of the same markup.
*Alternative:* move the bars to a widget. Rejected: both screens are features, and a feature cannot import a widget.
*Alternative:* `PersonBar` with an optional mark slot. Rejected: a bank is not a person; `participantId` in its row
would be a lie.

### 3. Placement and visibility

The card goes at the bottom of the right column, after «Who spent» / «Who received». It is shown when
`banks.length > 1` after the positive-only filter, as the people card. The column's last shown card takes the rest of
the column's height: the rule moves from «Who spent, else When» to «By bank, else Who spent, else When».

The title is one shared key, `entities.operations.banks.title`: «За банками» / «By bank» / «По банкам». It fits both
screens, unlike «Who spent» and «Who received», which need a verb each.

## Risks / Trade-offs

- **[Risk]** A bank with refunds only in a category has a negative part and no bar, while the parts shown add up to more
  than the total. → Accepted: the people card behaves the same way, and the total in the summary stays right.
- **[Trade-off]** In a one-bank view the card never shows. → That is the point of the filter: the split is between the
  banks the user chose.
- **[Risk]** Taller right column on the category and income screens. → The left column is the merchants' list, which
  is usually taller; the grid already lets the right column's last card stretch.
