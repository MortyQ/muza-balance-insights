## Purpose
Defines the «Limits and goals» screen in «Planning», the sheet to add or edit a limit or a goal, and the limit bar on
the category screen.

## ADDED Requirements

### Requirement: Limits and goals screen
«Planning» SHALL have a «Limits and goals» screen showing, for the global person filter: the monthly budget on top
(the total amount; the fixed rows, each paid of its typed amount; the flexible part with spent of it, the bar with the
pace marker, the state, the forecast and «per day»), the category limits sorted exceeded → attention → on track, then the savings goals. A person's view SHALL show
their limits and the family's, each with its owner; the family view SHALL show all. Amounts SHALL be in the main
currency. The screen SHALL reload quietly when the data changes.

#### Scenario: Sorted by state
- **WHEN** one limit is exceeded and one is on track
- **THEN** the exceeded one is listed first with «Exceeded by N» and an icon

### Requirement: Empty state with suggestions
Without any limit, the screen SHALL offer the suggested limits for the largest flexible categories with their amounts
and a «Suggest limits» action that adds them; with fewer than 3 whole months it SHALL say limits can be set by hand and
suggestions come later.

#### Scenario: One action
- **WHEN** the user presses «Suggest limits»
- **THEN** a monthly limit is added for each offered category at its suggested amount

### Requirement: Add and edit sheet
A sheet SHALL add or edit a limit — what (a category or the monthly budget), amount and currency, period, owner — with
the suggested amount and quick choices (the suggestion, −10%, −20%), a chart of the past whole months against the
amount and how many of them it would exceed. It SHALL also add or edit a savings goal — name, target, date, owner,
source. Deleting SHALL ask in the sheet itself. A failed save SHALL keep the sheet open with a message.

#### Scenario: Preview against the past
- **WHEN** the user types 4 000 ₴ for cafes, monthly
- **THEN** the sheet shows the last months against 4 000 ₴ and how many would have exceeded it

### Requirement: Monthly budget sheet
The monthly budget SHALL be created and edited in one sheet: the total with its currency and quick choices from the
usual month (the usual, −10%, −20%); the fixed costs, empty at first, where «Add a fixed cost» picks a category not yet
listed and the user types its amount, and each row can be removed; the owner. Beside the form a live result SHALL show
the total, each fixed row taken off, the flexible part and its average per day, a chart of the past whole months'
flexible spending (without the listed categories) against the flexible part with how many months would exceed it, and
a warning when the fixed costs take the whole total. Saving SHALL be unavailable while a row has no amount.

#### Scenario: Building a budget
- **WHEN** the user types 2 000 €, adds rent and types 1 250 €
- **THEN** the result shows 2 000 € − 1 250 € = 750 € for flexible spending, about 25 € a day

#### Scenario: A row without an amount
- **WHEN** a category is added and no amount typed
- **THEN** the result says to type the amount and «Save» is unavailable until it is typed or the row removed

#### Scenario: Removing a row
- **WHEN** the user removes the rent row
- **THEN** rent is no longer set aside and the flexible part grows by its amount

### Requirement: Limit bar on the category screen
The category screen SHALL show the category's limit for the current period when the shown month is the current one:
spent of the limit, the bar with the pace marker, the state and a link to edit; without a limit, a quiet «Set a
limit» with the suggestion.

#### Scenario: A category with a limit
- **WHEN** the user opens cafes in the current month with a monthly limit
- **THEN** the screen shows spent of the limit with the pace marker and its state
