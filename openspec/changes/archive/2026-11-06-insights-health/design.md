# Design

## Context

- The screen is `features/insights-page` (`InsightsFeature.vue`, `utils.ts` builds `InsightsPageView` from
  `InsightsOverview`). The glance is `InsightsGlance.vue`; the signals figure is `signalsGlance()`, counting `v.cards`
  only and joining the counts with « · ». The side column holds `BudgetCard.vue` («Budget structure»), two
  `SignalList.vue` (new payees, one-offs) and «How it was counted».
- The data process's `insightsOverview` (`apps/desktop/src/data/data.ts`) already reads, for up to 6 whole usual
  months, each month's income (`found.income`), spending (`found.spent`) and spending by category (`found.byCategory`),
  by today's rates. `budgetOf` folds the shown month by kind with core `byKind` / `budgetSplit`; the reserve comes from
  `reserveMonths`. Severity is core `insightSeverity(amount, usualTotal)`; new payees and one-offs carry none.
- `shared/ui` has `VChart` (ECharts), `VToggleGroup` / `VSegmentedControl`, `VHelpHint`; per-feature preferences in
  `localStorage` follow `features/now-strip` and `features/spending-summary` (`constants.ts` key, try/catch read).

Rules followed: `.agents/project/core-layout.md` (new code in `read/`), `.agents/project/domain-rules.md` (kinds,
scope), `.agents/project/desktop-renderer.md` (FSD, «`shared/ui` first», interface texts, the bars style), and
`.agents/project/desktop-import.md` for the data channel. It updates `desktop-import.md`: `getInsightsOverview` also
carries `history`. No security-relevant change: same channel, same gates, no new bank text.

## Goals / Non-Goals

**Goals:** a signals figure that reads at a glance; one place that says where the user stands and which way it goes;
one feed that can be filtered.

**Non-Goals:** the reserve's history, a single score, new detectors, home's blocks, changing any threshold of the
insights.

## Decisions

1. **The chart's line is the 50/30/20 «left» share, not the glance's «kept».** The checklist's 20% guide is about
   the left share (investments count as left), so the line and the guide must mean the same thing. «Kept» on the glance
   stays as it is (investments count as spending, as today). The «?» of «What is left» says the difference.
   Alternative: plot «kept» — rejected, the 20% guide line would sit on a different measure.
2. **History from what is already read.** Core gets `monthShares(income, byCategory, kinds)` in `read/budget.ts`
   (pure: `byKind` + the split's arithmetic, null without income). The data process maps it over `found`'s months
   (oldest first) plus the shown month when finished: `history: Array<{ month, left: number | null, wants: number | null }>`.
   A finished month needs no new query; a running month's usual carries no income (home relies on that), so the
   overview reads the usual months' income once more by month for the chart only. Without a usual `history` is empty.
   Alternative: a separate 12-month query — rejected: more reads for a chart that would then disagree with the usual.
3. **Standing is a core rule.** `guideStanding(kind, value)` in `read/budget.ts` returns `within | near | outside`
   with the 5-point band and the reserve's 2-month floor; the limits' standing from `limitsOver.length` and
   `limitsAhead.length`. The renderer only draws it. Keeping it in core lets MCP say the same later.
4. **Payee signals get severity in the data process** by `insightSeverity(amount, usual.total)` — the same rule as the
   cards — added as `severity` to `NewPayeeView` and `OneOffView`. The renderer merges cards, limit cards, payees and
   one-offs into one list of `FeedItemView { key, kind, severity, money, … }` sorted by `money` (the change, the overrun
   or the amount).
5. **Filters are renderer state.** `useFeedFilter()` in `features/insights-page/composables`: `{ severity, kind }`,
   stored as JSON under `insights.feedFilter`, read with try/catch, unknown values → `all`. Counts per severity come
   from the merged list of the month (not after the kind filter), so the numbers on the buttons do not jump. Buttons are
   `VToggleGroup` (single choice, `aria-pressed`).
6. **Severity bar on the glance** — a `GlanceView.split: { high, medium, low } | null`; drawn as three flex parts with
   a 2 px gap in the thin rounded bar style (danger / warning / muted neutral), labels «4 high» etc. from the existing
   plural keys, no « · ».
7. **Layout.** The glance; the health block (`@5xl`: chart 7 columns, checklist 5; below that stacked); the feed with
   its filters across the width; «How it was counted» last. `BudgetCard.vue` is split: its income bar and help texts
   move into `HealthChecklist.vue`; `SignalList.vue` is removed, a payee / one-off is `SignalCard.vue` (icon, name,
   caption, amount, severity chip, link).
8. **FSD placement.** All in the slice `features/insights-page`: `components/HealthBlock.vue`, `SharesChart.vue`
   (`VChart` line, dashed `markLine` for the guide, gaps for null), `HealthChecklist.vue`, `FeedFilters.vue`,
   `SignalCard.vue`, `SignalsGlance` stays in `InsightsGlance.vue`; `utils/health.ts` (view of history and checklist),
   `utils/feed.ts` (merge, filter, counts); `utils.ts` becomes `utils/index.ts` if it grows past ~400 lines. A new
   slice was considered for the health block — rejected: it is fed by the same overview and only lives on this screen.

9. **Bars, not a line (revised 06.11 after the first live look).** A line of «−59%» with «−38 pp over 6 mo.» read
   like a stock chart. Bars coloured by each month's standing, a sentence for the newest month, «N mo. ago: X%» and a
   legend in words read without any finance background. The month's standing comes with `history`
   (`leftStanding`, `wantsStanding`, core `guideStanding`), so a bar's colour never disagrees with the checklist. The
   chart grows to the checklist's height (at least 14rem). While no finished month has income, the five share rows
   fold into one «Income shares» row.

## Risks / Trade-offs

- Coloured marks reverse the «no grade colour» rule of «Budget structure». Mitigated by neutral words, an icon and the
  figure on every item, and the «?» that states the guide as a guide.
- A short history (3 months) makes a thin line; the chart still draws it, with points.
- The checklist and the chart need a finished month for the shares; in a running month they show the last whole
  months and the share items wait — said in place.
- `localStorage` survives «Delete all data» only if the renderer keeps it; it holds no data, only the two choices.
