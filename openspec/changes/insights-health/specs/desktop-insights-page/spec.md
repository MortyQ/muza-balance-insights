## MODIFIED Requirements

### Requirement: The month at a glance
The screen SHALL start with four figures: spending against the usual month (a running month: the share of a usual
month already spent beside the share of the month passed), income against the usual and the share of income kept
against the usual (a finished month only; otherwise said to come when the month ends), and the number of signals. The
signals figure SHALL count every item of the feed (insights, limits, new payees and one-offs) and show under it one bar
split by severity — high, medium, low, in that order, each part as wide as its count — with each count labelled in
words beside its colour, never as a dot-joined line. Without a usual it SHALL show the count only.

#### Scenario: A running month
- **WHEN** the shown month is the current one
- **THEN** spending reads as the share of a usual month with the days passed, and income and the kept share wait for the month's end

#### Scenario: Signals by severity
- **WHEN** the feed has 4 high, 1 medium and 12 low items
- **THEN** the figure reads 17, its bar has three parts in that proportion, and «4 high», «1 medium», «12 low» are labelled

#### Scenario: Only low signals
- **WHEN** every item is low
- **THEN** the bar is one part and only «low» is labelled

### Requirement: The full feed
The screen SHALL list every item of the month ranked by money: each insight with its severity, its change in money and
per cent, a bar chart of the usual months and the shown month with the usual marked, its main driver when there is one,
and a link to the category's screen for a category; each limit card; each new payee (the bank's description cut as in
«Recent transactions», its category and amount) and each large one-off operation (the same, with its date), with a
severity by the same rule as the insights and a link to its category. The insights SHALL count the shown month without
pending holds, so an insight does not appear and vanish as the bank finalises or cancels them; home's «What's unusual»
SHALL count the same way, so both show the same insights.

#### Scenario: More than five insights
- **WHEN** the month has seven insights
- **THEN** all seven are listed, the largest change first

#### Scenario: Nothing unusual
- **WHEN** there is a usual and no item
- **THEN** the feed says everything is within the usual

#### Scenario: A large pending hold
- **WHEN** a category would be over its usual month only with a hold from today
- **THEN** there is no insight for it until the hold is final

#### Scenario: A one-off among the insights
- **WHEN** a 9 900 ₴ one-off and a 2 400 ₴ category insight are in the month
- **THEN** the one-off card comes first

### Requirement: Too little history
With fewer than 3 whole months before the shown month the screen SHALL say so and that it needs 3, instead of the feed.

#### Scenario: Two months of history
- **WHEN** the data covers two whole months before the shown one
- **THEN** the screen shows the notice and no feed

## ADDED Requirements

### Requirement: Feed filters
Above the feed the screen SHALL offer two rows of toggle buttons: severity — «All», «High», «Medium», «Low», each with
its count in the month — and kind — «All kinds», «Spending up» (more than usual, rare, over a whole usual month),
«Spending down», «Income», «Limits» (exceeded and forecast above), «New payees», «One-offs». One choice per row,
pressed state announced; the feed shows the items matching both.

#### Scenario: High only
- **WHEN** the user picks «High»
- **THEN** only high items are listed and the button reads as pressed

#### Scenario: Both rows
- **WHEN** «Low» and «Spending down» are picked
- **THEN** only low items of spending below the usual are listed

### Requirement: Empty filter
When nothing matches the feed's filter, the feed SHALL say no signal matches and offer to reset both rows.

#### Scenario: Nothing matches
- **WHEN** «Medium» and «One-offs» are picked and the month has no medium one-off
- **THEN** the feed says no signal matches and offers to reset the filters

### Requirement: Remembered filter
The feed's filter SHALL be remembered on this computer across visits and months; an unknown stored value SHALL read as
«All».

#### Scenario: Back the next day
- **WHEN** the user picked «High» and opens the screen again later on another month
- **THEN** «High» is still picked

## REMOVED Requirements

### Requirement: Payee signals
**Reason**: New payees and one-offs join the feed as cards so they can be filtered and ranked with the rest.
**Migration**: See «The full feed» and «Feed filters».

### Requirement: Budget structure card
**Reason**: The split, the fixed and debt shares and the reserve move into the «Financial health» block, which marks
each against its guide.
**Migration**: See `desktop-insights-health`.
