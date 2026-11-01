## Purpose
Defines the short in-app explanations of category kinds, budget metrics, limits and savings goals: what each number
means, how it is counted and what is left out, in plain words and with the user's own numbers.

## ADDED Requirements

### Requirement: Every number explains itself
Every budget metric, limit figure (spent, expected by today, forecast, per day, state) and goal figure (progress, needed
per month) SHALL have a «?» next to it that opens a short explanation: what it means, the formula in words, and the
same formula filled with the user's current numbers in the main currency. Explanations SHALL be texts of the
dictionaries in every language, read by screen readers, and reachable from the keyboard.

#### Scenario: Explaining «per day»
- **WHEN** the user opens the «?» next to «Per day: 100 ₴» of a 4 000 ₴ monthly limit with 1 900 ₴ spent and 21 days left
- **THEN** it says «what is left of the limit, divided by the days left, today included» and «(4 000 ₴ − 1 900 ₴) ÷ 21 days = 100 ₴»

### Requirement: What is counted and what is not
The explanations of limits and metrics SHALL say which operations are counted and which are left out: refunds lower
spending, transfers between own accounts are left out, pending holds count, only «Personal» spending, every bank, and
for the monthly budget how the fixed rows are set aside first at the typed amounts, that spending above a row's
amount counts as flexible, and that savings categories are left out, with a link to edit the budget.

#### Scenario: The monthly budget's exclusions
- **WHEN** the user opens the «?» of the monthly budget
- **THEN** it shows «2 000 € − 1 250 € fixed (rent) = 750 € for flexible spending» and links to editing the budget

### Requirement: A short introduction on first visit
The «Budget» screen, the «Categories» section and the «Budget structure» card SHALL show, on the first visit, a short
introduction (at most three sentences and one example) of what they are for and how to start, closed with one action
and not shown again on this computer; a «How it works» link SHALL bring it back. Guides such as 50/30/20 SHALL be
introduced as common advice, not as a grade.

#### Scenario: Closing the introduction
- **WHEN** the user closes the introduction of the «Budget» screen and comes back later
- **THEN** it is not shown, and «How it works» shows it again

### Requirement: Per day by the budget
The budget's «per day» SHALL be labelled as per day by the budget, and its explanation SHALL say it is what is left of
the flexible part divided by the days left, unlike «Available per day» in «Planning», which spreads the money on cards
until the next income.

#### Scenario: Explaining the difference
- **WHEN** the user opens the «?» of the budget's per day
- **THEN** it gives the budget's formula with their numbers and says how it differs from «Available per day»
