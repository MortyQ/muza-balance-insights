# core-spending-limits Specification

## Purpose
Defines spending limits — on one category or one monthly budget for all spending with the user's fixed costs set aside first — how they are stored, counted
against spending, and turned into pace, forecast, «per day», states and suggested amounts.

## Requirements

### Requirement: A limit and the monthly budget
The system SHALL store limits apart from transactions. A category limit SHALL have a spending category with a kind, an
amount in hryvnia, dollars or euros, a period — day, week (Monday to Sunday) or month — and an owner, a person or the
family. The monthly budget SHALL be one monthly amount for all spending, counted as the next requirement says. One owner SHALL have at most one limit per category and
period and at most one monthly budget. An invalid amount, category, period or owner SHALL be refused and nothing
stored.

#### Scenario: A second limit for the same category and period
- **WHEN** the family already has a monthly limit on cafes and another one is added
- **THEN** the call fails and the first one stays

### Requirement: The monthly budget takes fixed costs out first
The monthly budget SHALL hold one total amount for all spending and its own list of fixed costs, each a spending
category and an amount the user types; the list starts empty, nothing is filled in for the user, a category appears in
it at most once and a row can be removed. The fixed costs SHALL be set aside first, at the typed amounts; the rest is
the flexible part, counted against flexible spending: every category that is neither in the budget's fixed list nor
of the savings kind. What a listed category spends above its typed amount SHALL count against the flexible part. Pace,
forecast, per day and state SHALL apply to the flexible part only. For each fixed row the budget SHALL give what is
paid this month against the typed amount. When the fixed costs reach the total, the flexible part SHALL be 0 and the
budget SHALL say so. A row without an amount SHALL be refused.

#### Scenario: 2 000 € with rent of 1 250 €
- **WHEN** the budget is 2 000 € and its only fixed row is rent at 1 250 €
- **THEN** 1 250 € is set aside and 750 € is the flexible part the pace and per day are counted on

#### Scenario: Rent not paid yet
- **WHEN** it is the 2nd of the month and rent is not paid yet
- **THEN** 1 250 € is still set aside and the rent row reads 0 of 1 250 €

#### Scenario: Paid more than typed
- **WHEN** rent is typed as 1 250 € and 1 300 € is paid
- **THEN** the rent row reads 1 300 of 1 250 € and 50 € counts against the flexible part

#### Scenario: Rent paid as a transfer to a person
- **WHEN** rent goes as a transfer to a person and «transfers to people» is not in the fixed list
- **THEN** it counts against the flexible part, until the user sets the payee's category to rent

#### Scenario: Category kinds do not change the budget
- **WHEN** a category is marked fixed in the «Categories» section but is not in the budget's fixed list
- **THEN** the budget counts it as flexible

### Requirement: What a limit counts
A limit SHALL count net spending of its categories in its current period as «Spending» does: refunds lower it,
transfers between own accounts are left out, pending holds count. It SHALL count «Personal» spending only and every
bank, whatever the bank filter. A family limit SHALL count every person; a person's limit SHALL count that person's
accounts. Amounts in another currency than the limit's SHALL be compared at today's rate.

#### Scenario: A refund lowers the spent amount
- **WHEN** a cafe limit's month has 3 000 ₴ spent and a 500 ₴ refund
- **THEN** the limit reads 2 500 ₴ spent

#### Scenario: Business spending
- **WHEN** a cafe payment is in «Business» scope
- **THEN** it does not count against the limit

### Requirement: Pace, forecast, per day and state
For each limit the system SHALL give spent, left (limit − spent), the per cent spent, the expected amount by today
(limit × days passed ÷ days in the period, today counted), the forecast for the period's end (spent ÷ days passed ×
days in the period) and «per day» (left ÷ days left, today counted; 0 when nothing is left). The state SHALL be
exceeded above 100%, attention from 80% to 100% or when the forecast is above the limit, on track otherwise. The
forecast SHALL NOT make a state before a quarter of the period has passed, and never for a day limit.

#### Scenario: Ahead of pace
- **WHEN** a 4 000 ₴ monthly limit has 1 900 ₴ spent on day 10 of 30
- **THEN** the expected amount is 1 333 ₴, the forecast 5 700 ₴, per day 100 ₴, and the state is attention

#### Scenario: Exceeded
- **WHEN** 5 300 ₴ is spent against 4 000 ₴
- **THEN** the state is exceeded, left is −1 300 ₴, per day 0

#### Scenario: Too early for a forecast
- **WHEN** on day 3 of 30 the forecast is above the limit and 20% is spent
- **THEN** the state is on track

### Requirement: Suggested amount
The system SHALL suggest a limit's amount as the median of its categories' (or flexible spending's) net spending over
the whole months the usual uses (3 to 6), scaled to the period (a week: × 7 ÷ 30.44, a day: ÷ 30.44), rounded to 100 ₴.
With fewer than 3 whole months there SHALL be no suggestion. The system SHALL also offer suggestions for the
largest flexible categories without a limit, at most five.

#### Scenario: A monthly suggestion
- **WHEN** a category's last six whole months are 3 900, 4 100, 4 200, 4 300, 4 600 and 5 000 ₴
- **THEN** the suggestion is 4 300 ₴

### Requirement: Limits stay on this computer
Limits SHALL NOT go into the analysis copy and SHALL NOT be offered through MCP tools.

#### Scenario: The analysis copy
- **WHEN** the analysis copy is rebuilt
- **THEN** it holds no limits
