## MODIFIED Requirements

### Requirement: Month pace figures

Under the pace chart the block SHALL show the spending so far (the whole month for a past month) and the usual spending
by the same day, in the home's currency choice. It SHALL NOT show «Available per day»: on home, the per day figure is
the budget's (the «Budget» row); «Available per day» stays in «Planning». With fewer than 3 covered months before, the
usual line and figure SHALL be left out and a note SHALL say so.

#### Scenario: Running month above usual

- **WHEN** the current month is shown and the spending so far is above the usual by the same day
- **THEN** the chart shows both lines up to today, the point for today, and the two figures

#### Scenario: Past month

- **WHEN** a past month is shown
- **THEN** the line covers the whole month and «spent» is the month's total

#### Scenario: Not enough history

- **WHEN** fewer than 3 whole months before the shown one have data
- **THEN** only the month's line and «spent» are shown, with a note that the usual month needs three months of history

#### Scenario: Person picked

- **WHEN** a person is picked in the global filters
- **THEN** the pace panel shows that person's spending and usual
