# core-insight-detectors Specification

## Purpose
Defines the «What's unusual» detectors in core: which differences between the shown month and the usual month count as
insights, their thresholds, their ranking and the plain data they return.

## Requirements

### Requirement: Pure detectors
`@mono/core` SHALL provide `detectInsights` in `read/insights.ts`: a pure function over the shown month's spending and
income sums and the usual month's medians. It SHALL NOT read the database and SHALL NOT return any text; each insight
SHALL carry its type, direction, the difference in money, the share of the usual (or none), the category it is about
(none for income), the month's value and the usual value.

#### Scenario: No text in core
- **WHEN** `detectInsights` returns an insight
- **THEN** it holds only types, numbers and the category word, and the caller words it

### Requirement: Both thresholds
An insight SHALL be returned only when the difference is at least `INSIGHT_MIN` kopecks and at least `INSIGHT_SHARE`
of the usual. A category whose usual is below `INSIGHT_BASE`, or that has no usual at all, SHALL be returned only when
it grew by at least `INSIGHT_MIN`, as `category-rare` and without a share.

#### Scenario: Big share, small money
- **WHEN** a category's usual is 1 500 ₴ and this month it is 1 900 ₴ (+27%, +400 ₴)
- **THEN** no insight is returned for it

#### Scenario: Big money, small share
- **WHEN** a category's usual is 20 000 ₴ and this month it is 22 000 ₴ (+10%, +2 000 ₴)
- **THEN** no insight is returned for it

#### Scenario: New category this month
- **WHEN** a category had no spending in the usual months and has 800 ₴ this month
- **THEN** a `category-rare` insight with no share is returned

### Requirement: Running month
While the shown month runs, only categories already over a whole usual month by both thresholds SHALL be returned
(`category-over-month`, with the share against the whole usual month); a category with a small or no usual SHALL be
`category-rare` as in a month that is over; no income and no «less» insights.

#### Scenario: Mid-month
- **WHEN** the month is running and a category is already 40% over its whole usual month and over `INSIGHT_MIN`
- **THEN** a `category-over-month` insight with a share of 40 is returned, and no income insight

### Requirement: Ranking by money
Insights SHALL be ranked together, income included, by the difference in money, largest first; ties by category word.

#### Scenario: Income between categories
- **WHEN** income is off by 6 000 ₴ and two categories by 9 000 ₴ and 3 000 ₴
- **THEN** the order is the first category, income, the second category

### Requirement: Enough history
`detectInsights` SHALL return nothing when fewer than `INSIGHT_MIN_MONTHS` (3) whole months are behind the usual.

#### Scenario: Two months of history
- **WHEN** the usual is over 2 months
- **THEN** `detectInsights` returns null
