# Analytics screen — design

The «Analytics» item of the side menu (route `/analytics`, today a placeholder) becomes a screen that answers, for a
picked period and person: did I live within my income, where did the money go, and what changed. Picked on the design
canvas «Analytics screen concepts» (boards «Итог · страница» and «Итог · выбор периода»).

## What the user sees

Top to bottom, inside the default layout (global filters + side menu):

1. **Four KPI cards**: «Income», «Spending», «Left» (income − spending), «Savings rate» (left ÷ income). Each with the
   change against the comparison period (below); «Left» says the average per month (per day for one month).
2. **«Income and spending»** chart (left, wide) and **«What changed»** (right, ~320 px; under the chart when narrow).
   - A range: one point per month — income line (`--success`), spending line (`--primary`), the area between them
     green where income is higher, red where lower (crossings split exactly).
   - One month: one point per day, **running totals** of income and spending from the 1st, plus a dashed «usual
     month» line — the average running spending of up to 3 whole months before (only months with data). Days after
     today are not drawn.
   - «What changed»: the 5 categories whose spending moved most against the comparison period (4 largest increases,
     then the largest decrease if any, else the 5th increase), each with the amount and the percent change and where its
     peak was («peak — June» / «peak — 14 Oct»). A row click switches the views below to «Lines» with only that category on.
3. **«Categories»** with a `VSegmentedControl` of four views (default «Heatmap»):
   - **Heatmap** — rows: the top 7 categories of the period + «Other N» (the rest summed); columns: months (range) or
     calendar weeks Mon–Sun clipped to the month (one month, labelled «1–5», «6–12», …). The cell shows the sum; its
     colour says how far the cell is from the row's usual level: the row's mean per day over its full columns (a week
     of 2 days is not «low» for being short). Warmer = above usual, cooler = below, neutral within ±12%. The running
     column (the current month, or the week with today) is shown with a dashed outline and left out of the mean.
   - **Small charts** — one card per row of the heatmap: the period total, the change chip, per-bucket bars (months,
     or days for one month) with the dashed average and the peak bar solid.
   - **Lines** — one line per row of the heatmap over the same buckets (days: running totals, else daily lines are
     noise); chips under the chart switch a line on and off (top 5 on by default), «Top 5» / «All» buttons, hovering a
     chip or a line fades the others; «Amount / Share of spending» switch (share = the category ÷ that bucket's total).
   - **Compare** — every category with spending in either period: a bar to the right (spent more) or the left (less)
     from a centre line, sorted by the change; «was → now» amounts.
4. A footnote when some currency had no rate (its spending is left out), as on the other screens.

Colours of categories: `categoryColor(rank)` by the period's ranking, so a category keeps one colour on all four views.

## The period picker

On `/analytics` the global filters show a **period** button instead of the month button (the route's
`meta.periodFilter: 'range'`); person and currency stay. The period is its own store (`useRangeStore` in
`entities/period`), independent of the home screen's month; it lives while the app runs. Default: the last 12 whole
months.

The popover (`VMonthRangePicker` in `shared/ui`, built on reka-ui `MonthPicker` / `MonthRangePicker` like
`VMonthPicker`):

- a `VSegmentedControl` «One month | Range» on top;
- quick picks on the left — one month: «This month», «Last month», «Same month last year»; range: 3, 6, 12, 24, 36
  months (whole months ending with last month), «Since January», «Last year», «All time» (from the import floor);
- the year grid of months: in «One month» a click picks it; in «Range» the first click picks a start (and is already a
  valid one-month pick), the second click the end; months after this month or before the import floor
  (`importFloor`, 36 months) are disabled; the current month has a dot;
- footer: what is picked («Sep 2026» / «Oct 2025 – Sep 2026 · 12 months»), what it is compared with, a warning when
  the current (running) month is included; «Cancel» / «Show» (the pick applies only on «Show»).

## Data

One new IPC method `getAnalyticsOverview({ from, to, participantId? })` — `from` / `to` are `YYYY-MM`, `from ≤ to`,
at most 37 months (the import floor's 36 + the current one). Main refuses `to` after this month.

- **Unit**: `from === to` → days of that month; else months.
- **Figures**: all scopes, the same fold as the balances' «In» / «Spent» (core `spendingSummary` and `incomeSummary`
  lines, account currency → hryvnia by today's rates, a currency without a rate left out). So the KPIs of one month
  equal the balances of that month.
- **Comparison period**: one month — `comparePeriod` (last month, cut to the same day while this month runs); a range of
  N months — the N whole months right before `from`. Null when the data does not reach its start.
- **Buckets** carry a state: `full`, `running` (the current month / today), `none` (before the first data, or a day
  after today). Values of `none` buckets are 0 and are not drawn.
- **No bank text**: only category words/ids, numbers and dates leave main (a canary test proves it).

New core aggregate `spendingGrid` (category × day/month, one query over `spendingLinesSql`, so every line rule is the
spending block's), and `incomeSummary` learns `groupBy: 'day'` (desktop only, like `spendingSummary`'s `day`).

## Out of scope (backlog)

- Opening the category screen from analytics: that screen is one scope and one month, analytics is all scopes over a
  range — the numbers would not match. Later, with a scope filter here or a range there.
- Exchange rates of the operation's date (today's rate for every period, as everywhere — the footnote says so).
- A personal / business switch; weeks or quarters as a unit for ranges; saving the period between launches.
