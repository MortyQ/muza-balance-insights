# Spending block: category ring, who spent what, comparison with last month

Date: 02.10.2026. Version: 0.1.7. Prototype: the «Итог» column of the canvas «Блок трат — варианты»
(https://claude.ai/artifact/CV6SkYkam3onTy7p4mTqa7) — artboards `FinalFamily` (the family) and `FinalSolo` (one person:
`solo` — the only person in the app, `member` — a person picked in the global filter). The ideas came from variants 1
(category ring), 3 (comparison with last month) and 7 (who spends on what); variant B plus the people list of A, the
person click of the prototype and the category expansion of D.

## Why

The block «Spending» on the home screen is a table per currency (gross / refunds / net and a share bar). It answers
«how much» but not «on what, compared to what, and who». The new block answers the three at a glance: a ring of
categories with the month's total, each category with its share, operations and the change since last month, and in
the family view who spent how much.

Charts over time (pace of the month, calendar, half-year columns, tiles with trends) are not part of this block: they go
to a future analytics block.

## What the user sees

### Header (both views)

- «Spending», and to the right of it the month and who: «September · Whole family» / «September · Serhii» / «September»
  (one person in the app).
- On the right: the existing «Personal / Business» switch and a gear button «Block settings» (icon-only, `aria-label`).
- The gear opens a menu (popover, closes on Esc and a click outside) with two sections of switches (`VSwitch`):
  - «Show on the bars»:
    - «Who spent how much» — the category bar is split by people's colours (family view only); default **on**;
    - «Last month's mark» — a tick on each bar at last month's amount; default **off**;
  - «Also show in currency» (note «Totals stay in hryvnia»):
    - «Dollars $», «Euro €» — default **off** (see «Currencies»).
  - The choices are remembered on this computer (renderer `localStorage`, a convenience: when storage is unavailable
    the defaults apply). They are the same for the family and for one person.

### Family (global filter «Whole family», more than one person)

Left column (≈236 px):

- **Ring of categories**: the top 7 categories in their colours and «Other · N» (the rest, grey). In the middle:
  «Whole family» (or the picked person's name), the amount, «N ₴ a day».
- Under it, a chip comparing with last month: «14% more than in August» / «less» / «as in August» (difference under 3%).
  Orange arrow up for more, blue arrow down for less (blue/orange, not red/green).
- With currencies on: under the amount, a line per currency «≈ 1 140 $ +11%» — the amount at this month's rate and the
  change in that currency (it can differ from the hryvnia change when the rate moved); the tooltip gives last month's
  amount and both rates.
- **Operations and last month**: «Operations 141 +4 vs Aug.», «In August 41 210 ₴».
- **People list**: the first row «Whole family» (stacked colour dots, «together · 141 op.», total, change), then each
  person: avatar in the person's colour with the initial, name, «48% · 72 op.», amount, change («+9%»). Each row is a
  `<button aria-pressed>`.
  - A click on a person **picks** them inside the block: the ring, the centre, the amounts, shares, operations and
    changes of the categories show **that person's part of the family's spending**; the categories re-sort by it; on the
    bars that person's segment stays bright, the others fade. «Whole family» goes back.
  - The pick is the block's own: it does not change the global filter and is reset when the month, the scope or the
    global filter changes.

Right column — **categories** (the same 7 + «Other»), each a `<button aria-expanded>`:

- line 1: category icon in its colour, name (shrinks with an ellipsis, full name in a tooltip), and on the right
  «38 operations +2» (the difference against last month in orange / blue; tooltip «In August — 36 operations»);
- line 2: the bar (length = amount relative to the largest category; split by people when «Who spent how much» is on,
  otherwise in the category colour; the last month's tick when that switch is on) and the share «31%» to the right of it;
- right columns: amount (with «≈ 359 $» lines under it when currencies are on) and the change chip («▲ 1 090 ₴»,
  «as in August», «new» when last month had none);
- a chevron.
- A click expands the category (one at a time; a second click folds it): a line per person who spent in it this or last
  month — avatar, name, a bar in their colour (relative to the largest person's amount of this category; last month's
  tick when on), «17 op. +3», amount (with currency lines), change. With a person picked, the others' lines fade.

### One person (only one person in the app, or a person in the global filter)

The same block without the people list and without the expansion: the ring, the centre, the chip, «Operations» and «In
August», and the categories with bars in the category colour. The gear menu has no «Who spent how much».

- When the person is picked in the global filter of a family (`member`), a card under the stats: their avatar,
  «46% of the family's spending», «family — 101 830 ₴». This uses the family's total for the same month and scope.
- Numbers here are the person's own view (as in balances): a transfer to another family member counts as their spending
  (category «To family»). That is why the in-block pick in the family view (their part of the family's spending, no
  family transfers) can differ from the global filter on the same person. The global filter is the person's own view;
  the in-block pick explains the family's total.

### States (kept from the current block)

- Loading: the previous numbers stay, dimmed; reloads after an import window are quiet (`useAsyncData` `quiet`).
- Error: «Could not count the spending…» notice.
- Period notes: no data / not yet / month not complete (`periodNote`), «Import in progress — the numbers fill in…»,
  pending holds.
- Empty month: «No spending this month.»
- No comparison (last month not covered by data): change chips, operation differences and last month's ticks are not
  shown; under the ring «No data for August to compare».
- A month in progress is compared with the **same days** of last month: «14% more than by this day in August».
- Foreign-currency spending without any exchange rate: «+ 25 $ without a rate — not in the totals» under the ring.

### Layout rule

Numbers never wrap or overlap: amounts, changes and operation counts have fixed widths and `white-space: nowrap`; only
the category name shrinks (ellipsis + tooltip). The share sits on the bar line, not next to the name.

## Numbers

All amounts leave main as hryvnia kopecks; the renderer only converts for the «≈ $ / €» lines.

- **Spending** of a category = `net` of the core `spendingSummary` (`groupBy: 'category'`, the block's scope; gross −
  refunds; own transfers, income and — for the family — family transfers excluded), as today.
- **Operations** = new core field `purchases`: the number of spending lines with `amount < 0` (refunds are not
  operations; a bank fee is its own line in «Bank fees»). `lines` stays as is (MCP output unchanged: it maps fields
  explicitly).
- **Currencies of accounts**: spending on foreign-currency accounts is folded into hryvnia by the month's rate of the
  user's own exchanges (`exchangeRates`, `toUah` — the same as the balance block). A currency without any rate stays out
  of the sums and is listed (`leftOut`).
- **Per day** = total net / `coveredDays` (null when 0).
- **Last month** (`compare`): the previous calendar month. If this month is incomplete and `dataUntil` falls inside it,
  the previous month is cut to the same day (`1 … min(day, last day)`), `partial: true`. No comparison (`null`) when
  `dataFrom` is null or later than the previous period's start.
  - The previous period's numbers use that period's own rates.
- **Family split** (family view only): for each participant, `spendingSummary` with `participantId`; a category's
  `people[i]` = that person's net / purchases in that category (and last month's). Only categories present in the
  family view are split; a person's total in the people list is the sum of their parts (so the people add up to the
  family's total). Participants are in `listParticipants` order; their colours come from the renderer's people store.
- A category whose net is ≤ 0 (refunds only) is not listed; it still counts in the total («Other» in the ring takes
  the difference).
- **Percentages** are of the total of the current pick (family or the picked person).
- **Change**: amount difference and percent of last month; under 3% of last month → «as in August»; last month 0 →
  «new».
- **Currencies** (USD 840, EUR 978): `fx` carries each one's rate for this period and for the comparison period
  (`exchangeRates`, kopecks per cent) and `nearest`. Converted = `round(uah / rate)`. A currency with no rate this month
  → its switch is disabled with the hint «No exchanges in $ yet». The change in a currency compares this month at this
  month's rate with last month at last month's rate.

## Data contract

New IPC `getSpendingOverview({ month, scope, participantId? })` replaces `spendingSummary` (its only user is this block).

```ts
type SpendingAmounts = { net: number; purchases: number };
type SpendingPersonPart = SpendingAmounts & { participantId: number; prev: SpendingAmounts | null };
type SpendingCategoryView = SpendingAmounts & {
  category: string; categoryId: CategoryId | null;
  prev: SpendingAmounts | null;
  people: SpendingPersonPart[]; // family view only, else []
};
type SpendingOverview = {
  month: string;
  period: { from; to; days; incomplete; dataUntil; coveredDays; pendingHolds };
  compare: { from: string; to: string; partial: boolean } | null;
  total: SpendingAmounts & { netPerDay: number | null; prev: SpendingAmounts | null };
  people: SpendingPersonPart[];          // family view only
  categories: SpendingCategoryView[];    // net desc
  fx: Array<{ currency: 840 | 978; rate: number | null; prevRate: number | null; nearest: boolean }>;
  leftOut: Array<{ currency: number; net: number }>;
  familyTotal: number | null;            // with participantId: the family's net for the same month and scope
};
```

No names, descriptions, card numbers or IBANs: categories, amounts, counts, ids and rates only.

## Colours

Categories take colours by rank from the series tokens (as in the prototype); people keep their own `--series-<key>`.
Open question (decide before the renderer step): a category and a person can share a colour (groceries and Serhii are
both blue). Option: a separate category palette without the people's keys.

## Out of scope

- Charts over time — the analytics block.
- A «main currency» setting (totals in $ / €).
- Splitting one person's spending by their cards.

## Tests

- core: `purchases` per group and per currency total (refund and commission lines).
- main (`data.test.ts`): folding currencies, the people split adds up, previous period (full, cut to the same day, not
  covered), `fx` rates, `familyTotal`, `leftOut`, canaries.
- IPC: schema accepts / rejects, channel list, preload.
- renderer: pure helpers (change chips, operation differences, ring stops, rows for a pick, currency lines, top 7 +
  other); the prefs store (defaults, persistence, broken storage); the feature: person pick, expansion, settings menu,
  one-person view, states.
