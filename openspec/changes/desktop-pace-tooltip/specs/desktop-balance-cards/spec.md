## ADDED Requirements

### Requirement: Month pace tooltip

Pointing at a day of the month pace chart SHALL show a tooltip for that day, in the style of the app's other charts: the
date; the month's spending up to that day when the day has data; the usual month's spending up to that day when a usual
month is known; and, when both are shown, how much more or less than usual the month is. Amounts SHALL follow the
home's currency choice.

#### Scenario: A past day of a running month

- **WHEN** the current month is shown with a usual month and the user points at a day before today
- **THEN** the tooltip shows the date, the spending up to that day, the usual up to that day and the difference

#### Scenario: A day after today

- **WHEN** the user points at a day after today in the current month
- **THEN** the tooltip shows the date and the usual up to that day only

#### Scenario: No usual month

- **WHEN** fewer than 3 whole months before the shown one have data and the user points at a day
- **THEN** the tooltip shows the date and the spending up to that day only
