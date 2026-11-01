## Purpose
Defines the «Limits and goals» screen in «Planning», the sheet to add or edit a limit or a goal, and the limit bar on
the category screen.

## ADDED Requirements

### Requirement: Limits and goals screen
«Planning» SHALL have a «Limits and goals» screen showing, for the global person filter: the monthly budget on top
(the total amount; the fixed costs set aside, each fixed category paid or not yet; the flexible part with spent of it,
the bar with the pace marker, the state, the forecast and «per day»), the category limits sorted exceeded → attention → on track, then the savings goals. A person's view SHALL show
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

#### Scenario: Entering a total budget
- **WHEN** the user enters a monthly budget of 2 000 € and rent is usually 1 250 €
- **THEN** the sheet shows «fixed costs ≈ 1 250 €, 750 € left for flexible spending» before saving

#### Scenario: Preview against the past
- **WHEN** the user types 4 000 ₴ for cafes, monthly
- **THEN** the sheet shows the last months against 4 000 ₴ and how many would have exceeded it

### Requirement: Limit bar on the category screen
The category screen SHALL show the category's limit for the current period when the shown month is the current one:
spent of the limit, the bar with the pace marker, the state and a link to edit; without a limit, a quiet «Set a
limit» with the suggestion.

#### Scenario: A category with a limit
- **WHEN** the user opens cafes in the current month with a monthly limit
- **THEN** the screen shows spent of the limit with the pace marker and its state
