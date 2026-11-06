## ADDED Requirements

### Requirement: Financial health block
The Insights screen SHALL show a «Financial health» block right under the month at a glance, across the screen's width:
the shares chart on one side and the checklist on the other (stacked on a narrow screen). It SHALL follow the person,
banks, scope and main currency like the rest of the screen, and show only the checklist while history is too short.

#### Scenario: Enough history
- **WHEN** a finished month with income and 5 whole months before it is shown
- **THEN** the block shows the chart and the checklist side by side

#### Scenario: Two months of history
- **WHEN** the data covers two whole months before the shown one
- **THEN** the block shows the checklist without the chart

### Requirement: Shares chart
The chart SHALL draw, as one line, the share of income left after essential and wants spending for each whole month of
the usual (oldest first, up to 6) and the shown month when finished, the 20% guide dashed, the newest value beside it
with its change in percentage points from the first month with income. A month without income SHALL be a gap, not a
zero. The chart SHALL have a text equivalent listing each month's value.

#### Scenario: Six months
- **WHEN** the left share was 15, 17, 13, 19, 21 and 24% from May to October and October is shown finished
- **THEN** the line has six points, reads 24% and «+9 pp over 6 mo.», with the 20% guide drawn

#### Scenario: A running month
- **WHEN** the current month is shown
- **THEN** the line ends at the last whole month

### Requirement: Chart switch
A switch under the chart SHALL show the wants share against its 30% guide instead of the left share; the choice is not
kept between visits.

#### Scenario: Wants
- **WHEN** the user picks «Wants»
- **THEN** the line shows the wants share per month with the 30% guide

### Requirement: Checklist against guides
The checklist SHALL list, in this order: what is left (≥ 20%), essential (≤ 50%), wants (≤ 30%), fixed costs
(≤ 60%), loan payments (≤ 30% of income), the reserve (≥ 3 months, today's figure) and the monthly limits (none
exceeded; only when the view has monthly limits), each with its figure and its «?» (what it means, the formula with
the user's numbers, the guide), under the income bar of a finished month with income.

#### Scenario: A finished month
- **WHEN** a finished month with income is shown
- **THEN** the income bar against 50/30/20 is above seven items, each with its figure and «?»

### Requirement: Standing marks
Each checklist item SHALL show its standing — «within the guide», «near the guide» or «outside the guide» (core rule) —
as a coloured circle with a check, a dash or a cross, and in words for screen readers; the words SHALL never say «good»
or «bad». The header SHALL say how many items are within the guide out of those with a standing.

#### Scenario: Wants above the guide
- **WHEN** wants are 32% of income
- **THEN** the wants item shows 32% with a dash and «near the guide»

#### Scenario: A limit over
- **WHEN** one monthly limit is exceeded in the shown month
- **THEN** the limits item shows «1 over» with a cross and «outside the guide»

#### Scenario: A running month
- **WHEN** the current month is shown
- **THEN** the share items say they come when the month ends and carry no standing; the reserve and the limits keep theirs

#### Scenario: No income
- **WHEN** a finished month has no income
- **THEN** the share items say there was no income and carry no standing

#### Scenario: Colour is not the only cue
- **WHEN** the checklist is read by a screen reader
- **THEN** each item reads its name, figure and standing in words
