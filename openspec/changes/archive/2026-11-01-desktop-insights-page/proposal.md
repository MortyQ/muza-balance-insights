# Proposal

## Why

Home shows at most five «What's unusual» lines and the «Insights» block explains them, but there is no place to see
every signal of a month, to tell the big ones from the small ones, or to see a category's change against its own
months. The Notion insights spec («Специфікація: Інсайти») plans an Insights page: «what is unusual, why, and what to
do about it», with the full feed, severity, the main driver and «how it was counted». The user asked (01.11) for a
working page they can open and test: thought-out design, readable charts, the important things first, not overloaded.

## What Changes

- **A new «Insights» screen** in the app navigation, after «General». It follows the global month filter (like home),
  the person, the banks and «Personal / Business».
- **The month at a glance** at the top: four figures — spent against the usual month (in a running month: how much of a
  usual month is spent and how much of the month has passed), income against the usual (a finished month), the share of
  income kept against the usual (a finished month), and how many signals the month has by severity.
- **The full «What's unusual» feed**, ranked by money: every insight of core's detectors, not only the first five. Each
  card: the category (or income), a severity mark (high / medium / low), the change in money and per cent, a small bar
  chart of the usual months and the shown month with the usual (median) line, the main driver when there is one, and a
  link to the category screen.
- **Severity** (new core rule): the change's share of a usual month's total spending — high from 10%, medium from 4%,
  low below.
- **New payees** (new core detector): payees with at least 500 ₴ of spending in the shown month and none in any of the
  usual months, largest first, at most 10.
- **Large one-offs** (new core detector): single spending operations of the shown month of at least 10% of a usual
  month's total spending (and at least 500 ₴) whose payee does not usually spend half of that a month, largest first, at
  most 10.
- **«How it was counted»**: the usual is the median of N whole months (first – last), transfers between own accounts are
  left out, refunds lower spending, pending holds are counted (how many), and the thresholds (20% and 500 ₴).
- **Empty and early states**: fewer than 3 whole months of history → a notice how many there are and that the page
  needs 3; nothing unusual → a calm «everything is within the usual» line; new payees and one-offs still show then.
- **«All insights»** link in home's «Insights» block and «What's unusual» slide.
- **Payees on the screen**: the cards, the new payees and the one-offs show bank descriptions, cut as in «Recent
  operations». This widens the 01.11 approvals (home's lists) to this screen; the user asked for the page with drivers
  and payees (01.11, «рабочий вариант»).
- **`CHANGELOG.md`** (0.1.13, unreleased): «A new «Insights» screen lists everything unusual in the month, ranked and
  marked by importance, with each category's months on a small chart, the payee behind the change, new payees and large
  one-off payments.»

## Capabilities

### New Capabilities
- `desktop-insights-page`: the screen — route and menu entry, the month at a glance, the feed, the side lists, the
  states, the home links.
- `core-insight-signals`: severity, new payees and large one-offs (pure rules in core).

### Modified Capabilities
None (the home links are a requirement of the new page's spec).

## Impact

- `packages/core`: `src/read/insights.ts` gains `insightSeverity`, `newPayees`, `oneOffs` and their constants; tests in
  `tests/read/insights.test.ts`.
- `apps/desktop`: a new read `getInsightsOverview` (channel, zod schema, data-protocol method, rated, main handler,
  `DataService.insightsOverview`); `api.ts` types; the renderer page `pages/insights`, feature
  `features/insights-page`, route `insights` with `meta.nav`; home links; i18n keys in `uk.json`, `en.json`, `ru.json`;
  `.agents/project/desktop-import.md` (one more channel with descriptions), `desktop-renderer.md`, `domain-rules.md`;
  `docs/backlog.md` live checks.
- `apps/mcp`: untouched. Trust anchors: none change. No migration.

## Out of scope

- «This is expected» / dismissing an insight; actions beyond opening the category.
- A dearer subscription and duplicate payments detectors.
- Insights over a range of months (the page is one month).
