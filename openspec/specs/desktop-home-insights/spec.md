# desktop-home-insights Specification

## Purpose
TBD - created by archiving change desktop-home-insights. Update Purpose after archive.

## Requirements

### Requirement: A block beside «Spending»
Home SHALL show an «Insights» block in the same row as «Spending by category» when it has a driver or a savings rate to
show. On a home wide enough for twelve columns «Spending by category» SHALL take seven and the block five; on narrower
homes the block SHALL take the whole row under «Spending». Without anything to show the block SHALL NOT be shown and
«Spending» SHALL take the whole row. The block SHALL follow home's person, banks, month and «Personal / Business».

#### Scenario: A month with drivers
- **WHEN** «What's unusual» has a category with a driver
- **THEN** the block sits to the right of «Spending» on a wide home

#### Scenario: Nothing to explain
- **WHEN** the shown month has no driver and no savings rate
- **THEN** there is no block and «Spending» spans the row

### Requirement: Drivers
The block SHALL list, in the order of «What's unusual», each category line that has a driver: the category, the
payee's name (the bank's description, cut as in «Recent operations»), its change in money with its direction, and its
share of the category's change. A row SHALL open that category's screen for the shown month and scope.

#### Scenario: A driver row
- **WHEN** a category grew mostly because of one payee
- **THEN** its row names the category and the payee, the payee's extra money and its share, and opens the category

### Requirement: Savings rate line
For a month that is over, the block SHALL show the share of the income kept and the usual share. A negative share SHALL
read as spending more than was earned.

#### Scenario: A finished month
- **WHEN** a past month with income is shown and the usual months had income
- **THEN** the block shows the month's savings rate beside the usual one

#### Scenario: The running month
- **WHEN** the current month is shown
- **THEN** there is no savings rate line

### Requirement: How it was counted
Whenever the block is shown it SHALL end with a note: the usual is the median of N whole months, from the first to the
last of them; transfers between own accounts are left out; refunds lower spending; and, when there are holds still
pending, how many are counted. The note alone SHALL NOT make the block appear.

#### Scenario: Holds pending
- **WHEN** the month has two holds still pending
- **THEN** the note says two pending operations are counted
