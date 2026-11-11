# Design

## Context

`DataService.insightsOverview` already reads, for the shown month, its spending without pending holds (`spent`) and
the usual (`spendingUsual`: the whole months before the shown one, each month's total and per-category net, folded by
today's rates). The regular payments screen reads core `findRecurring` over the last 13 months. The forecast combines
the two. Follows `.agents/project/desktop-import.md` (the `getInsightsOverview` channel), `.agents/project/domain-rules.md`
(pending holds in a spending read, regular payments) and `.agents/project/desktop-renderer.md` (FSD, i18n); updates
`desktop-import.md` and `desktop-renderer.md` with a line each; `domain-rules.md` needs no change.

## Decisions

- **Running month only.** `forecast` is set when the shown month is today's month (system time zone) and there is a
  usual; null otherwise (a finished month, fewer than 3 whole months, or data that stops before the month starts — no
  usual then either).
- **Spent so far = the screen's `spent`**: the month without the pending holds of the last 3 days, as the glance's
  «Spent» figure and the insights count it (spec desktop-insights-page). Keeping one «spent» on the screen matters more
  than the few days' holds; they join the forecast once the bank finalises them. A regular payment paid today as a
  pending hold is the one case that drops out (its next date is next month, its amount is not final yet): accepted, it
  corrects itself within 3 days.
- **Days left = month days − today's day of month** (today counts as passed), the rule of the limits' forecast
  (`periodPosition` in `data/limits.ts`). Data synced a few days ago is not extrapolated: the forecast reads low until
  the next update (a backlog check).
- **Regular payments still due**: `findRecurring` (spending) over the 13-month window of the regular payments screen,
  with the screen's scope, person and banks (`findRecurring` takes the same `SpendingFilters`, so the rows carry no
  scope of their own: the query filters by it). Active, not marked `hidden` (a hidden payee is not a regular payment),
  whose next date (`nextMonthDay` of the last payment) is after today and within the month; their usual amounts at
  today's rates (none without a rate). A payment whose date has passed without a payment this month (late) is left
  out: it may have stopped, and «Regular payments» shows it anyway.
- **Typical day without the regular payments.** No daily series of the usual months is read: the usual already has each
  month's total, so the per-day figure is month-based — for each usual month, its total minus the usual amounts of the
  regular series (active or ended, not hidden) whose first … last payment spans that month, divided by the month's
  days, never below 0. The typical day is the median of those figures. A daily median of days was rejected: most days
  have no large purchase, so a day median under-reads a month by far (it is home's «usual day», a different question).
  Subtracting today's monthly regular sum from every usual month was rejected: a subscription started last month would
  be taken out of months it was never paid in.
- **Range = the 25th and the 75th percentile** (linear interpolation) of the same per-day figures: spent + due +
  quartile × days left. The usual has at least 3 months, so the quartiles are always computable and the ±15% fallback
  of the brief is never needed; it is not implemented. Low ≤ value ≤ high always holds (the median is the 50th
  percentile of the same figures). With equal figures, or on the month's last day, low = high and the screen shows no
  range line.
- **Where the code lives**: the arithmetic is pure, in `apps/desktop/src/data/forecast.ts`, beside `allowance.ts` and
  `income-regular.ts` (the same kind of screen arithmetic over core results). It is not core domain logic: it mixes a
  screen's rates fold and the desktop's usual, as those do. No core change.
- **The answer** carries the formula's parts, so the renderer words the «?» in the user's numbers without arithmetic of
  its own: `value`, `low`, `high`, `spent`, `regular`, `regularCount`, `perDay`, `perDayLow`, `perDayHigh`, `daysLeft`.
- **Renderer (FSD)**: layer `features`, slice `insights-page`: the view in `utils/index.ts` (`forecastGlance`), the
  type in `types.ts` (`GlanceView` gains `forecast`, `range`, `help`), the markup in `components/InsightsGlance.vue`
  (`VHelpHint` from `shared/ui` beside the label). Five figures lay out as three, then five columns by the container's
  width. Keys `insights.glance.forecast*` in uk (reference), en, ru; uk / ru informal.

## Risks

- A regular payment that skipped a month inside its series is still taken out of that month, so that month's per-day
  figure reads a little low. Rare; checked live.
- The usual months' totals include their one-offs; the median damps one large month, the 75th percentile shows it.
