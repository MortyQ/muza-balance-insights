## ADDED Requirements

### Requirement: Month-end forecast
While the shown month runs and there is a usual, «The month at a glance» SHALL add a fifth figure, «Forecast based on
your plan»: the spending so far (without pending holds, as the screen counts the month), plus the regular payments of
the same view still due after today within the month, plus the typical day times the days left after today. A finished
month, or a month without a usual, SHALL show no forecast figure.

#### Scenario: Day 10 of 30
- **WHEN** 6 000 ₴ is spent by the 10th of a 30-day month, a 500 ₴ regular payment is due on the 20th and the typical day is 200 ₴
- **THEN** the figure reads 10 500 ₴

#### Scenario: A finished month
- **WHEN** the shown month is over
- **THEN** «The month at a glance» has four figures and no forecast

#### Scenario: Too little history
- **WHEN** the data covers two whole months before the running one
- **THEN** there is no forecast figure

### Requirement: Typical day without regular payments
The forecast's typical day SHALL be the median over the usual months of each month's spending without its regular
payments, divided by that month's days, so a regular payment is never counted twice.

#### Scenario: A regular payment already paid
- **WHEN** this month's rent was paid on the 3rd and the shown day is the 10th
- **THEN** the rent is in the spending so far, not among the payments still due, and the typical day leaves rent out

### Requirement: Forecast range and formula
Under the forecast the screen SHALL show a range «from … to …» from the 25th and the 75th percentile of the usual
months' per-day figures, and a «?» giving the formula with the user's numbers. Every amount SHALL follow the main
currency and the «Show also» lines.

#### Scenario: Quartiles of the usual months
- **WHEN** the forecast of day 10 of 30 is 10 500 ₴ and the quartiles of the typical day are 150 ₴ and 260 ₴
- **THEN** the range reads «from 9 500 ₴ to 11 700 ₴» and the «?» reads 6 000 ₴ + 500 ₴ + 200 ₴ × 20 days

#### Scenario: «Show also» picked
- **WHEN** euros are picked under «Show also»
- **THEN** the forecast figure has an approximate euro line under it
