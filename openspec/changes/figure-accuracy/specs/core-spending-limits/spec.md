## MODIFIED Requirements

### Requirement: What a limit counts
A limit SHALL count net spending of its categories in its current period as «Spending» does: refunds lower it,
transfers between own accounts are left out, cash withdrawals are left out while they do not count as spending. Pending
holds — holds from the last 3 days, which the next sync may still change or cancel — SHALL be left out of the spent
amount, the forecast and the state; for each limit the system SHALL give how many pending holds its categories have in
the period and their amount, so they can be shown apart. A hold older than 3 days counts as final spending. It SHALL
count «Personal» spending only and every bank, whatever the bank filter. A family limit SHALL count every person; a
person's limit SHALL count that person's accounts. Amounts in another currency than the limit's SHALL be compared at
today's rate.

#### Scenario: A refund lowers the spent amount
- **WHEN** a cafe limit's month has 3 000 ₴ spent and a 500 ₴ refund
- **THEN** the limit reads 2 500 ₴ spent

#### Scenario: Business spending
- **WHEN** a cafe payment is in «Business» scope
- **THEN** it does not count against the limit

#### Scenario: A pending hold
- **WHEN** a 4 000 ₴ cafe limit has 3 800 ₴ of final payments and a 600 ₴ hold from today
- **THEN** the limit reads 3 800 ₴ spent, state attention, with one pending hold of 600 ₴ given apart

#### Scenario: An old hold
- **WHEN** a hold is five days old and still flagged
- **THEN** it counts as spending

### Requirement: The monthly budget takes fixed costs out first
The monthly budget SHALL hold one total amount for all spending and its own list of fixed costs, each a spending
category and an amount the user types; the list starts empty, nothing is filled in for the user, a category appears in
it at most once and a row can be removed. The fixed costs SHALL be set aside first, at the typed amounts; the rest is
the flexible part, counted against flexible spending: every category that is neither in the budget's fixed list nor
of the savings kind, nor taxes while the budget does not count taxes. What a listed category spends above its typed
amount SHALL count against the flexible part. Pace, forecast, per day and state SHALL apply to the flexible part only.
For each fixed row the budget SHALL give what is paid this month against the typed amount. When the fixed costs reach
the total, the flexible part SHALL be 0 and the budget SHALL say so. A row without an amount SHALL be refused.

The budget SHALL have a «count taxes» choice, on by default and kept with the budget. Off, «Taxes and government
payments» SHALL count neither against the flexible part nor as a fixed row: a budget that is off and lists taxes as a
fixed row SHALL be refused. The choice SHALL NOT change category limits, «Spending» or the 50/30/20 split.

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

#### Scenario: Taxes left out
- **WHEN** the budget does not count taxes and the month paid 300 € of taxes and 500 € of groceries
- **THEN** the flexible part reads 500 € spent, and the taxes stay in «Spending» and in the essential share of 50/30/20

#### Scenario: Taxes as a fixed row while off
- **WHEN** a budget that does not count taxes is saved with a taxes fixed row
- **THEN** the save fails and nothing is stored

#### Scenario: An existing budget
- **WHEN** a budget saved before this choice existed is read
- **THEN** it counts taxes
