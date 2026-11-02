## MODIFIED Requirements

### Requirement: Budget screen
Home's «Budget» row SHALL open a «Budget» screen attached to home like a category screen: it has no menu item of its
own, «General» stays current in the menu, and going back returns home. It SHALL show, for the global person filter: the monthly budget on top
(the total amount; the fixed rows, each paid of its typed amount; the flexible part with spent of it, the bar with the
pace marker, the state, the forecast and «per day»), the category limits sorted exceeded → attention → on track, then the savings goals. A person's view SHALL show
their limits and the family's, each with its owner; the family view SHALL show all. Amounts SHALL be in the main
currency. The screen SHALL reload quietly when the data changes.

Spent amounts SHALL leave pending holds out. Where the budget's flexible part or a limit has pending holds, it SHALL
show a quiet note with their number and amount («+ 2 pending, 650 ₴») and a tooltip saying they count once the bank
finalises them. Home's «Budget» row SHALL follow the same figures. A budget that does not count taxes SHALL say so
under its flexible part.

#### Scenario: Sorted by state
- **WHEN** one limit is exceeded and one is on track
- **THEN** the exceeded one is listed first with «Exceeded by N» and an icon

#### Scenario: A pending hold on a limit
- **WHEN** a cafe limit has a 600 ₴ hold from today
- **THEN** the limit's spent amount and bar leave it out and the row says «+ 1 pending, 600 ₴»

#### Scenario: No pending holds
- **WHEN** nothing is pending
- **THEN** no note is shown

### Requirement: Monthly budget sheet
The monthly budget SHALL be created and edited in one sheet: the total with its currency and quick choices from the
usual month (the usual, −10%, −20%); the fixed costs, empty at first, where «Add a fixed cost» picks a category not yet
listed and the user types its amount, and each row can be removed; a «Count taxes» switch, on by default, with a hint
that taxes then stay out of the budget but not out of «Spending»; the owner. Beside the form a live result SHALL show
the total, each fixed row taken off, the flexible part and its average per day, a chart of the past whole months'
flexible spending (without the listed categories, and without taxes while the switch is off) against the flexible part
with how many months would exceed it, and a warning when the fixed costs take the whole total. Saving SHALL be
unavailable while a row has no amount. While «Count taxes» is off, taxes SHALL NOT be offered as a fixed cost, and
turning it off with a taxes row listed SHALL remove that row.

#### Scenario: Building a budget
- **WHEN** the user types 2 000 €, adds rent and types 1 250 €
- **THEN** the result shows 2 000 € − 1 250 € = 750 € for flexible spending, about 25 € a day

#### Scenario: A row without an amount
- **WHEN** a category is added and no amount typed
- **THEN** the result says to type the amount and «Save» is unavailable until it is typed or the row removed

#### Scenario: Removing a row
- **WHEN** the user removes the rent row
- **THEN** rent is no longer set aside and the flexible part grows by its amount

#### Scenario: Taxes off
- **WHEN** the user turns «Count taxes» off
- **THEN** the past months' chart drops taxes, taxes leave the «Add a fixed cost» choices, and a listed taxes row is removed

### Requirement: Limit bar on the category screen
The category screen SHALL show the category's limit for the current period when the shown month is the current one:
spent of the limit (pending holds left out, with the same note as on the «Budget» screen), the bar with the pace
marker, the state and a link to edit; without a limit, a quiet «Set a limit» with the suggestion.

#### Scenario: A category with a limit
- **WHEN** the user opens cafes in the current month with a monthly limit
- **THEN** the screen shows spent of the limit with the pace marker and its state

#### Scenario: Pending on the category screen
- **WHEN** the category's list shows a pending hold from today
- **THEN** the limit bar leaves it out and says it is pending, while the list still shows the operation
