# Spec Delta

## MODIFIED Requirements

### Requirement: Stack and month panel never overlap

While the row is folded, the block SHALL show the card stack and the month panel («In» / «Out», jars, reserves) side by
side when both fit at their minimum widths, and the panel under the stack otherwise. When the stack, the month panel
and the pace panel all fit at their minimum widths, the pace panel SHALL sit to the right of the month panel; otherwise
it SHALL go under them. No card SHALL cover any part of either panel at any block width.

#### Scenario: Wide block

- **WHEN** the block is wide enough for the stack and the panel at its minimum width
- **THEN** the panel sits to the right of the stack and takes the remaining width, up to its full width

#### Scenario: Very wide block

- **WHEN** the block is wide enough for the stack, the month panel and the pace panel at their minimum widths
- **THEN** the pace panel sits to the right of the month panel and takes the remaining width

#### Scenario: Narrow block

- **WHEN** the window is narrowed until the stack and the panel no longer fit side by side
- **THEN** the panel moves under the stack, and the block grows to hold both

#### Scenario: Row open in a narrow block

- **WHEN** the row is open while the panel or the pace panel is under the stack
- **THEN** that panel is hidden and leaves no empty space under the row

## ADDED Requirements

### Requirement: Month pace

The balances block SHALL show the shown month's spending added up day by day, for the view's person or family, against
the usual month's running spending by day (the mean of up to 3 whole months before), and today's point while the month
runs. With no data for the month the pace panel SHALL NOT be shown.

#### Scenario: Chart of a running month

- **WHEN** the current month is shown and a usual month is known
- **THEN** the chart shows the month's line and the dashed usual line up to today, with today's point

#### Scenario: Month without data

- **WHEN** a month before the first data is picked
- **THEN** the pace panel is not shown

### Requirement: Month pace figures

Under the pace chart the block SHALL show the spending so far (the whole month for a past month), the usual spending by
the same day, and, for the current month only, the amount available per day, in the home's currency choice. With fewer
than 3 covered months before, the usual line and figure SHALL be left out and a note SHALL say so.

#### Scenario: Running month above usual

- **WHEN** the current month is shown and the spending so far is above the usual by the same day
- **THEN** the chart shows both lines up to today, the point for today, and the three figures

#### Scenario: Past month

- **WHEN** a past month is shown
- **THEN** the line covers the whole month, «spent» is the month's total, and «available per day» is not shown

#### Scenario: Not enough history

- **WHEN** fewer than 3 whole months before the shown one have data
- **THEN** only the month's line and «spent» are shown, with a note that the usual month needs three months of history

#### Scenario: Person picked

- **WHEN** a person is picked in the global filters
- **THEN** the pace panel shows that person's spending and usual
