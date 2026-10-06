# Category screen: everything about one spending category

Date: 05.10.2026. Version: 0.1.8 (unreleased). Mockup approved by the user (artifact «Экран категории», a «Taxi»
example with fictional data).

## Why

The «Spending» block says how much went to each category this month, and nothing more. The user wants to open a
category and see everything the data can tell about it: every transaction, where, when, who, how it compares with other
months.

## Entry and navigation

- A click (Enter / Space) on a category row of «Spending» opens the category screen. The row becomes a link-like button;
  it no longer expands. The per-person split that the row showed for the family moves to the screen («Who spent»).
- Route `category` (`/category/:id`, `id` = `CategoryId`), default layout, no side-menu item. Query: `scope`
  (`personal | business`, the block's toggle at the moment of the click; absent → `personal`). Month, person and
  currency are the global filters (pinned above, as on home): changing them reloads the screen.
- «← Spending» at the top returns to home (`router.back()` when the previous route is home, else push `home`).
- An unknown `id` → home. A category with no spending this month → the screen with «No spending in this category in
  {month}» and the 12-month history (it can still be useful).
- The «Now» strip's top category of the week may link here later; not in this step.

## What the screen shows

For the selected month, person (or the family), scope; every amount in the home-wide main currency through
`MoneyFormat` (today's Monobank rates, as «Spending»).

1. **Header**: category icon and name, «· {month} · {who} · {scope}».
2. **Summary**: net for the month; change chip vs the compared period (the same rule as «Spending»: last month, cut to
   the same day while the month is incomplete) and «vs {month} ({amount})»; a muted line «gross · refunds · ≈ other
   currencies». Six figures: operations (+ last month's), average check (+ median), per day (+ days with spending of N),
   share of all spending of the scope (+ the category's rank this month), the largest operation (where, when), cashback
   (sum and the number of operations with it).
3. **12 months**: bars for the 12 months ending with the selected one, the selected highlighted, a dashed average line,
   a caption «on average X a month · {month} higher/lower by Y». Months before the data are empty stubs and do not
   count into the average.
4. **Who spent** (family only, more than one person): per person amount, operations, average, bar in the person's colour.
5. **Where**: merchants by net desc (sum, operations, average, share), top 8 + «N more». A click filters the transaction
   list; a second click or the chip above the list clears it.
6. **When**: weekdays (7 bars), time of day (morning 6–12, day 12–18, evening 18–23, night 23–6), days of the month (bars),
   and one sentence «mostly on {weekday}, {part of day}». Weekday, hour and day are in the system time zone (the date fix
   of 05.10.2026).
7. **Transactions**: every line of the category in the month. Columns: date (+ weekday, time), merchant (+ the bank's
   comment), person and card (`black/UAH`-style label as elsewhere), marks (pending hold, refund, refunded, foreign
   currency, cashback), amount (+ the operation-currency amount when it differs). Search (merchant, comment, amount),
   sort by date / amount. Footer: the list's total — equal to the category's figure on home when no filter is on.

Merchant text: the description as the bank sends it (this is the user's own screen; nothing leaves the computer), jar
titles and card numbers hidden as in core's `merchantForOutput` with `reveal = true`. Names in «Transfers to people»
are shown in full. No masking setting for the desktop in this step.

## Data

### Core

`categoryLines(db, q, nowSec)` in `packages/core/src/summaries.ts` (or its own module importing the shared SQL):
`q = { from, to, category, scope?, participantId? }`. It must use **the same line rules as `spendingSummary`**
(commission split, internal / family exclusion, crossing to disabled accounts, refunds as positive lines, «income» and
«own transfers» excluded). To guarantee that, the `base` / `lines` CTE of `spendingSummary` is extracted into one
builder used by both; `lines` gains the transaction id, `time`, the account, and a `kind` (`body | commission`).
Each line: `id`, `time` (unix s), `accountId`, `amount` (account currency, minor, sign kept, body without commission),
`currency`, `operationAmount` / `operationCurrency` (null for a commission line), `description`, `comment`, `mcc`,
`hold`, `pending` (fresh hold, the `pendingHolds` rule), `cashback`, `refund` (positive line), `refunded` (its
`refund_pair_id` points to a refund in the period), `commission` (the line is a commission), `participantId`.

Test (fictional fixtures): for every category of a fixture month, the sum of `categoryLines` = `spendingSummary` net
per currency; family vs one person; commission line in «Bank fees»; refund pair; a crossing to a disabled account.

### Main

IPC `getCategoryOverview({ month, category: CategoryId, scope, participantId? })` → `CategoryOverview`
(`src/shared/api.ts`), built in `DataService.categoryOverview` with helpers in `main/category.ts` (pure, tested):
- `lines`: as above, folded to hryvnia kopecks per line (`toUah`, today's rates; a line without a rate keeps its own
  currency and goes to `leftOut`), with the account label, person id, merchant text, a local date / time / weekday /
  hour (system time zone);
- `summary`: net, gross, refunds, purchases, median, per day, active days, largest, cashback, share and rank (from the
  month's `spendingSummary` by category, same scope / person), compared period and its net and purchases;
- `months`: 12 × `{ month, net | null }` (one `spendingSummary` with `groupBy: 'month'` and `category`);
- `people` (family only), `merchants`, `weekdays`, `dayParts`, `days` — aggregated in main, so the renderer only
  formats.
- `rates`, `period` (`incomplete`, `dataUntil`, `pendingHolds`) as in `SpendingOverview`.
Closed under the lock and when the database is not ready, like the other data channels. Zod: `category` from
`CATEGORY_IDS`, `month` as today.

### Renderer

- `pages/category` (`CategoryPage`, thin) → `features/category-detail` (`CategoryDetailFeature.vue`, `api/`,
  `composables/useCategoryDetail.ts` — request, quiet reload on `syncStatus.version`; `useCategoryView.ts` — view model;
  `utils.ts` pure and tested; `components/`: `CategorySummary`, `MonthsChart`, `WhoSpent`, `MerchantList`, `WhenCharts`,
  `TransactionList`). Merchant filter, search and sort are local state of the feature.
- `features/spending-summary`: `CategoryRow` becomes a button that navigates (`categoryLink(id, scope)` in
  `shared/config`), the expand state and the people panel go away (`open`, `onToggle`, `expandable`).
- Texts: `category.*` keys in uk / en / ru.

## Not in this step

Recurring payments / subscriptions inside a category, editing a transaction's category, export, the «Now» strip link.

## Order of work

1. Core: shared CTE builder + `categoryLines` + tests (the sum check first).
2. Main: `CategoryOverview` contract, `main/category.ts` helpers + tests, IPC + preload + zod tests.
3. Renderer: route + link from «Spending» (row no longer expands), the feature with summary, 12 months, who, where,
   when, transactions; renderer tests.
4. i18n, CHANGELOG 0.1.8, `.agents/project/desktop-renderer.md`, `pnpm test`, `pnpm typecheck`.

Starts after the time-zone fix of 05.10.2026 is committed (it touches the same date helpers and `DataService`).
