# Spec Delta

## MODIFIED Requirements

### Requirement: Budget screen
Home's «Budget» row SHALL open a «Budget» screen attached to home like a category screen: it has no menu item of its
own, «General» stays current in the menu, and going back returns home. It SHALL show, for the global person filter: the monthly budget on top
(the total amount; the fixed rows, each paid of its typed amount; the flexible part with spent of it, the bar with the
pace marker, the state, the forecast and «per day»), the category limits sorted exceeded → attention → on track, then the savings goals. A person's view SHALL show
their limits and the family's, each with its owner; the family view SHALL show all. Amounts SHALL be in the main
currency. The screen SHALL reload quietly when the data changes.

Spent amounts SHALL include payments the bank is still processing (pending holds) as soon as they are imported;
cancelled payments SHALL NOT count. Where the budget's flexible part or a limit has pending payments, it SHALL show a
quiet note with how many of them its spent amount includes and their amount («incl. 2 pending, 650 ₴») and a tooltip
saying the bank may still change these amounts. Home's «Budget» row SHALL follow the same figures. A budget that does
not count taxes SHALL say so under its flexible part.

#### Scenario: Sorted by state
- **WHEN** one limit is exceeded and one is on track
- **THEN** the exceeded one is listed first with «Exceeded by N» and an icon

#### Scenario: A pending hold on a limit
- **WHEN** a cafe limit has a 600 ₴ hold from today
- **THEN** the limit's spent amount, bar, forecast and «per day» include it and the row says «incl. 1 pending, 600 ₴»

#### Scenario: Imported purchase counts at once
- **WHEN** an import brings today's purchase that the bank is still processing
- **THEN** the budget's flexible spent amount grows by it without waiting for the bank to finalise it

#### Scenario: Cancelled hold
- **WHEN** a pending payment is cancelled by the bank
- **THEN** it leaves the spent amount and the note

#### Scenario: No pending holds
- **WHEN** nothing is pending
- **THEN** no note is shown

### Requirement: Limit bar on the category screen
The category screen SHALL show the category's limit for the current period when the shown month is the current one:
spent of the limit (pending holds included, with the same note as on the «Budget» screen), the bar with the pace
marker, the state and a link to edit; without a limit, a quiet «Set a limit» with the suggestion.

#### Scenario: A category with a limit
- **WHEN** the user opens cafes in the current month with a monthly limit
- **THEN** the screen shows spent of the limit with the pace marker and its state

#### Scenario: Pending on the category screen
- **WHEN** the category's list shows a pending hold from today
- **THEN** the limit bar counts it and its note says how much of the spent amount is pending, while the list still shows the operation

## ADDED Requirements

### Requirement: Limit signals follow the budget's figures
The Insights screen's limit cards and the limits item of «Financial health» SHALL use the same spent amounts as the
«Budget» screen, pending payments included, so a limit is not over on one screen and within it on another.

#### Scenario: Over only with today's hold
- **WHEN** a cafe limit is over only with a hold from today
- **THEN** the «Budget» screen shows it exceeded and the Insights screen lists its «Limit exceeded» card
