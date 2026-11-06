## ADDED Requirements

### Requirement: Shares by month
For each whole month of the usual and for the shown month when it is finished, the system SHALL give the left share
(income − essential − wants, as for the split) and the wants share of that month's income, whole per cent, by the same
fold and kinds as the split. A month without income SHALL have no shares.

#### Scenario: One month
- **WHEN** a month has 50 000 ₴ of income, 22 000 ₴ essential and 16 000 ₴ wants
- **THEN** its left share is 24% and its wants share 32%

#### Scenario: No income
- **WHEN** a usual month has no income
- **THEN** it has no shares

### Requirement: Standing against a guide
The system SHALL place a figure against its guide as `within`, `near` or `outside`: a share is near when it is beyond
its guide by at most 5 percentage points (left 15–19% for ≥ 20%; essential 51–55%, wants 31–35%, fixed 61–65%, loan
payments 31–35%) and outside beyond that; the reserve is near from 2 months up to 3 and outside below 2; the monthly
limits are outside with any exceeded, near with none exceeded but one forecast over, within otherwise.

#### Scenario: Left share
- **WHEN** the left share is 18%
- **THEN** it is near the guide

#### Scenario: Reserve
- **WHEN** the reserve is 1.5 months
- **THEN** it is outside the guide

#### Scenario: Limits ahead
- **WHEN** no monthly limit is exceeded and one is forecast over
- **THEN** the limits are near the guide

### Requirement: Usual and unusual months
Of a series of monthly shares the system SHALL give the usual as the median of the months with income (at least 3) and
mark a month unusual when it is more than 15 percentage points from it, above or below.

#### Scenario: Unusual months
- **WHEN** the shares are −21, 44, 18, −12, 8 and −59%
- **THEN** the usual is −2%, June and October are unusual

### Requirement: Trend of a share
The system SHALL compare the mean of the last 3 months with income with the mean of the months with income before them
(at least 1, at most 3) and call it better or worse when they differ by 3 points or more in the share's good direction
(up for the left share, down for the others), else about the same; with fewer than 4 months with income, no trend.

#### Scenario: Worse
- **WHEN** the left share's last three months average −21% and the three before 14%
- **THEN** the trend is worse

### Requirement: Forecast of the left share
For a running month from its 10th day, with at least 3 usual months with income, the system SHALL forecast the left
share as (the usual income − forecast essential − forecast wants) ÷ the usual income, where a kind's forecast is what
it spent so far plus the median of the usual months' spending of that kind times the share of the month still to come;
its range uses the lowest and highest usual month of each kind instead of the median. Before the 10th day the forecast
SHALL be absent.

#### Scenario: Mid-month
- **WHEN** on day 15 of 30, 20 000 ₴ essential and 9 000 ₴ wants are spent, the usual income is 50 000 ₴ and the usual essential and wants months 30 000 ₴ and 12 000 ₴
- **THEN** the forecast is (50 000 − 35 000 − 15 000) ÷ 50 000 = 0%

### Requirement: Standing of the cushion and spending items
The system SHALL place: months in the red — within at 0, near at 1, outside from 2; income against the usual — within
at 90% of the usual or more, near from 75%, outside below; spending against the usual — within up to the usual (or, in
a running month, up to the share of the month passed), near up to 10% over (10 points over the pace), outside beyond;
strong signals — within at 0, near at 1, outside from 2.

#### Scenario: Spending ahead of pace
- **WHEN** on day 10 of 30, 45% of a usual month is spent
- **THEN** spending against the usual is outside the guide (12 points over the pace)
