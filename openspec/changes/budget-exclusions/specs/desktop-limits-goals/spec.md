# Spec Delta

## MODIFIED Requirements

### Requirement: Budget screen
The «Budget» screen SHALL be a menu entry of the app navigation, and home's «Budget» row SHALL open the same screen.
It SHALL show, for the global person filter: the monthly budget on top
(the total amount; the fixed rows, each paid of its typed amount; the flexible part with spent of it, the bar with the
pace marker, the state, the forecast and «per day»), the category limits sorted exceeded → attention → on track, then the savings goals. A person's view SHALL show
their limits and the family's, each with its owner; the family view SHALL show all. Amounts SHALL be in the main
currency. The screen SHALL reload quietly when the data changes.

Spent amounts SHALL include payments the bank is still processing (pending holds) as soon as they are imported;
cancelled payments SHALL NOT count. Where the budget's flexible part or a limit has pending payments, it SHALL show a
quiet note with how many of them its spent amount includes and their amount («incl. 2 pending, 650 ₴») and a tooltip
saying the bank may still change these amounts. Home's «Budget» row SHALL follow the same figures. A budget with
exclusions SHALL name them under its flexible part («Not counted: Taxes, Travel»), on the screen and on home.

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

#### Scenario: Exclusions named
- **WHEN** the budget excludes taxes and travel
- **THEN** the budget on the screen and on home says «Not counted: Taxes, Travel» under the flexible part

### Requirement: Monthly budget sheet
The monthly budget SHALL be created and edited in one sheet: the total with its currency and quick choices from the
usual month (the usual, −10%, −20%); the fixed costs, empty at first, where «Add a fixed cost» picks a category not yet
listed and the user types its amount, and each row can be removed; a «Count taxes» switch, on by default, with a hint
that taxes then stay out of the budget but not out of «Spending»; the exclusions; the owner. Beside the form a live result SHALL show
the total, each fixed row taken off, the flexible part and its average per day, a chart of the past whole months'
flexible spending (without the listed and the excluded categories) against the flexible part
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

## ADDED Requirements

### Requirement: Exclusions in the budget sheet
Under the «Count taxes» switch the sheet SHALL offer «Exclude from the budget»: a choice of the spending categories
that are neither excluded already, nor fixed costs, nor taxes, and the excluded ones listed by name, each removable.
An excluded category SHALL NOT be offered as a fixed cost. The live result and the past months' chart SHALL follow
each change at once. An existing budget SHALL open with its exclusions, and «Count taxes» off when taxes are among them.

#### Scenario: Excluding a category
- **WHEN** the user picks «Travel» in «Exclude from the budget»
- **THEN** «Travel» is listed as excluded, leaves the «Add a fixed cost» choices, and the past months' chart drops it

#### Scenario: Taking an exclusion back
- **WHEN** the user removes «Travel» from the excluded ones
- **THEN** travel counts as flexible spending again in the chart and can be picked as a fixed cost

#### Scenario: A fixed cost is not offered
- **WHEN** rent is a fixed cost of the budget
- **THEN** «Exclude from the budget» does not offer rent

#### Scenario: Reopening
- **WHEN** a budget saved with travel excluded and «Count taxes» off is opened
- **THEN** the sheet shows «Travel» as excluded and the switch off
