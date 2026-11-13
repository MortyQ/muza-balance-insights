# Spec Delta

## MODIFIED Requirements

### Requirement: The monthly budget takes fixed costs out first
The monthly budget SHALL hold one total amount for all spending and its own list of fixed costs, each a spending
category and an amount the user types; the list starts empty, nothing is filled in for the user, a category appears in
it at most once and a row can be removed. The fixed costs SHALL be set aside first, at the typed amounts; the rest is
the flexible part, counted against flexible spending: every category that is neither in the budget's fixed list, nor
of the savings kind, nor among the budget's exclusions. What a listed category spends above its typed
amount SHALL count against the flexible part. Pace, forecast, per day and state SHALL apply to the flexible part only.
For each fixed row the budget SHALL give what is paid this month against the typed amount. When the fixed costs reach
the total, the flexible part SHALL be 0 and the budget SHALL say so. A row without an amount SHALL be refused.

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
- **WHEN** the budget excludes taxes and the month paid 300 € of taxes and 500 € of groceries
- **THEN** the flexible part reads 500 € spent, and the taxes stay in «Spending» and in the essential share of 50/30/20

#### Scenario: Taxes as a fixed row while off
- **WHEN** a budget that excludes taxes is saved with a taxes fixed row
- **THEN** the save fails and nothing is stored

#### Scenario: An existing budget
- **WHEN** a budget saved before the «count taxes» choice existed is read
- **THEN** it has no exclusions and counts taxes

## ADDED Requirements

### Requirement: Budget exclusions
The budget SHALL hold a list of excluded spending categories, empty by default and kept with the budget, each at most
once. An excluded category SHALL count neither against the flexible part nor as a fixed row. Exclusions SHALL NOT
change category limits, «Spending» or the 50/30/20 split.

#### Scenario: A trip left out
- **WHEN** the budget excludes travel and the month spent 900 € on travel and 500 € on groceries
- **THEN** the flexible part reads 500 € spent, and travel stays in «Spending» and in the 50/30/20 split

#### Scenario: A limit on an excluded category
- **WHEN** travel is excluded from the budget and has its own monthly limit
- **THEN** the limit still counts the month's travel spending

### Requirement: Exclusions are checked and kept with the budget
A budget that lists one category both as excluded and as a fixed row SHALL be refused, and so SHALL one that excludes
something that is not a spending category; a refused budget stores nothing. A removed budget's exclusions SHALL go
with it.

#### Scenario: Excluded and fixed at once
- **WHEN** a budget is saved with travel both excluded and as a fixed row
- **THEN** the save fails and nothing is stored

#### Scenario: The budget is removed
- **WHEN** a budget with exclusions is deleted
- **THEN** its exclusions are deleted too

### Requirement: Taxes are an exclusion
«Taxes and government payments» SHALL be left out of the budget by being among its exclusions, like any other
category. A budget saved with «count taxes» off before exclusions existed SHALL read as excluding taxes; one saved
with it on, or before that choice existed, SHALL read with no exclusions.

#### Scenario: A budget saved with taxes off
- **WHEN** a budget saved earlier with «count taxes» off is read after the update
- **THEN** its exclusions are taxes alone, and its figures are the same as before
