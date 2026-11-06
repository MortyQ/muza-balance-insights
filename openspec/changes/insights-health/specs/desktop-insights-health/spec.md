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
The chart SHALL draw a bar for each whole month of the usual (oldest first, up to 6) and the shown month when finished:
the share of income left after essential and wants spending, its value on the bar, zero as a solid line and the 20%
guide dashed. A month without income SHALL have no bar. The chart SHALL have a text equivalent listing each month's
value, and SHALL grow to the height of the checklist beside it.

#### Scenario: Six months
- **WHEN** the left share was −21, 44, 18, −12, 8 and −59% from May to October and October is shown finished
- **THEN** there are six bars with their values, three above zero and three below, with the 20% guide drawn

#### Scenario: A running month
- **WHEN** the current month is shown
- **THEN** the bars end at the last whole month

### Requirement: Chart in plain words
The chart SHALL be titled by what it measures in plain words («How much of your income is left», «after essential and
wants spending») and name the newest month in a sentence — what was left, or that spending was more than income — with
the first month's value as «N mo. ago: X%», never in percentage points. Each bar SHALL be coloured by its standing
(core rule) with a legend in words, and a line SHALL explain bars below zero when there is one.

#### Scenario: Spent more than earned
- **WHEN** October's left share is −59% and May's −21%
- **THEN** the chart reads «−59%», «October: spent more than earned», «5 mo. ago: −21%», and explains a bar below zero

#### Scenario: Within the guide
- **WHEN** a month's left share is 24%
- **THEN** its bar is in the «within the guide» colour, as the legend says

### Requirement: Chart switch
A switch beside the chart's title SHALL show what goes on wants against its 30% guide instead («How much goes on
wants»); the choice is not kept between visits.

#### Scenario: Wants
- **WHEN** the user picks «Wants»
- **THEN** the bars show the wants share per month with the 30% guide, a bar above 35% in the «outside» colour

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
- **THEN** one «Income shares» row says they come when the month ends, with no standing; the reserve and the limits keep theirs

#### Scenario: No income
- **WHEN** a finished month has no income
- **THEN** one «Income shares» row says there was no income, with no standing

#### Scenario: Colour is not the only cue
- **WHEN** the checklist is read by a screen reader
- **THEN** each item reads its name, figure and standing in words

### Requirement: Personal references on the chart
Beside the guide the chart SHALL draw the user's own usual — the median of the months it shows — as a solid line with a
light band of ± 15 percentage points around it («your usual range»), and SHALL mark a month outside that band as
unusual with a dashed outline and ▲ (above) or ▼ (below). A legend in words SHALL name each reference. With fewer than
3 months with income there SHALL be no usual line, band or marks.

#### Scenario: An unusual month
- **WHEN** the months show −21, 44, 18, −12, 8 and −59% (usual −2%)
- **THEN** June (44%) and July (18%) are marked ▲, May (−21%) and October (−59%) ▼; August and September stay plain

### Requirement: Summary tiles
Above the chart three tiles SHALL say, in plain words: the user's usual with the guide beside it; whether the last 3
months with income are better, worse or about the same as the months before them (core rule), with both averages;
and, while the shown month runs, the forecast of it (otherwise the shown month's own figure against the usual).

#### Scenario: Getting worse
- **WHEN** the last three months average −21% and the three before 14%
- **THEN** the trend tile reads «worse» with both averages

#### Scenario: Too early for a forecast
- **WHEN** the current month is on its 6th day
- **THEN** the forecast tile says it is too early to tell

### Requirement: Forecast bar
While the shown month runs and the forecast exists (core rule), the chart SHALL end with a hatched bar for it, its
range as a whisker and «≈ X%» on it, coloured by the forecast's standing; «How it was counted» SHALL say how it is made.

#### Scenario: A running month on day 15
- **WHEN** the forecast of the left share is −5% with a range of −15 to 5%
- **THEN** the last bar is hatched, reads «≈ −5%» and shows the range

### Requirement: Direction in the checklist
Each share item of a finished month SHALL say beside its figure whether it is better, worse or about as usual against
the user's usual of that share (core rule), with the usual's value — better meaning more left, or less of the others.

#### Scenario: Wants better than usual
- **WHEN** wants are 32% and usually 36%
- **THEN** the wants item reads «better than usual (36%)»

### Requirement: Checklist groups
The checklist SHALL group its items under three headings: «This month» (the income shares), «Safety cushion» (the
reserve, months in the red, income against the usual) and «Spending and plans» (spending against the usual, the
monthly limits, strong signals).

#### Scenario: Three groups
- **WHEN** a finished month with income and monthly limits is shown
- **THEN** the items sit under «This month», «Safety cushion» and «Spending and plans», in that order

### Requirement: Cushion and spending items
The checklist SHALL add, each with a figure, a standing (core rule) and a «?»: months in the red (of the chart's months
with income, how many left less than zero), income against the usual (a finished month against the usual median),
spending against the usual (a finished month's total, or a running month's share of a usual month against the share of
the month passed) and strong signals (the feed's high items, with a link down to them).

#### Scenario: A running month has more than the reserve
- **WHEN** the current month is shown
- **THEN** besides the income shares row, the checklist shows the reserve, months in the red, spending against the usual's pace, the limits and strong signals

#### Scenario: Two months in the red
- **WHEN** two of the six months on the chart left less than zero
- **THEN** «Months in the red» reads «2 of 6», outside the guide
