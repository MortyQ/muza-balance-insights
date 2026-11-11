# desktop-insights-page Specification

## Purpose
Defines the Insights screen: the month at a glance, one feed of every signal of the month ranked by money with its
filters, how it was counted, and the notice when history is too short.

## Requirements

### Requirement: Insights screen
The app SHALL have an «Insights» screen in the navigation, right after «General», that follows the month filter, the
person, the banks and «Personal / Business» like home, and reloads quietly when the data changes.

#### Scenario: Opening the screen
- **WHEN** the user picks «Insights» in the menu
- **THEN** the screen shows the month chosen in the filter

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

### Requirement: How it was counted
The screen SHALL say what the usual is over (N whole months, first – last), that transfers between own accounts are
left out, refunds lower spending, that pending holds are left out and how many there are, whether cash withdrawals
count as spending, and the thresholds of a change.

#### Scenario: Pending holds
- **WHEN** the month has pending holds
- **THEN** the note says how many are pending and that they count once the bank finalises them

#### Scenario: Cash off
- **WHEN** cash withdrawals do not count as spending
- **THEN** the note says so

### Requirement: Too little history
With fewer than 3 whole months before the shown month the screen SHALL say so and that it needs 3, instead of the feed.

#### Scenario: Two months of history
- **WHEN** the data covers two whole months before the shown one
- **THEN** the screen shows the notice and no feed

### Requirement: Links from home
Home's «Insights» block and «What's unusual» slide SHALL link to the screen.

#### Scenario: All insights
- **WHEN** the user clicks «All insights» on home
- **THEN** the Insights screen opens for the same month

### Requirement: Limit exceeded in the feed
The feed SHALL list each monthly limit exceeded in the shown month as a «Limit exceeded» card with the category (or the
monthly budget), the amount over the limit, its severity by the same rule as the other cards and a link to
the «Budget» screen, ranked among the other cards by money. Spent amounts SHALL leave pending holds out, as the
«Budget» screen does.

#### Scenario: An exceeded cafe limit
- **WHEN** the shown month spent 5 300 ₴ on cafes against a 4 000 ₴ limit
- **THEN** the feed has a «Limit exceeded» card for cafes, 1 300 ₴ over

#### Scenario: Over only with a hold
- **WHEN** cafes have 3 900 ₴ of final payments and a 300 ₴ hold from today against a 4 000 ₴ limit
- **THEN** the feed has no «Limit exceeded» card for cafes

### Requirement: Forecast above the limit in the feed
In the current month the feed SHALL list each monthly limit (and the budget's flexible part) that is not exceeded but
in attention for its pace or its forecast — the rule of the «Budget» screen — as a «Forecast above the limit» card: the
category (or the budget), the forecast, the overrun, «per day» to stay within and a link to the «Budget» screen. Its
severity and rank SHALL follow the other cards' rule, from the overrun. A past month SHALL have no such cards.

#### Scenario: Ahead of pace on cafes
- **WHEN** on day 10 of 30 cafes have 1 900 ₴ spent against a 4 000 ₴ monthly limit
- **THEN** the feed has a «Forecast above the limit» card for cafes: forecast 5 700 ₴, 1 700 ₴ over, 100 ₴ a day to stay within

#### Scenario: A small lead early in the month
- **WHEN** on day 2 of 30 a limit's spending is only slightly ahead of its pace
- **THEN** there is no forecast card

#### Scenario: Well ahead early in the month
- **WHEN** on day 2 of 30 a 35 € limit has 6 € spent
- **THEN** the feed has its «Forecast above the limit» card

#### Scenario: Already exceeded
- **WHEN** the limit is exceeded
- **THEN** only the «Limit exceeded» card is shown for it

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

### Requirement: Month-end forecast
While the shown month runs and there is a usual, «The month at a glance» SHALL add a fifth figure, «Forecast based on
your plan»: the spending so far (without pending holds, as the screen counts the month), plus the regular payments of
the same view still due after today within the month, plus the typical day times the days left after today. A finished
month, or a month without a usual, SHALL show no forecast figure.

#### Scenario: Day 10 of 30
- **WHEN** 6 000 ₴ is spent by the 10th of a 30-day month, a 500 ₴ regular payment is due on the 20th and the typical day is 200 ₴
- **THEN** the figure reads 10 500 ₴

#### Scenario: A finished month
- **WHEN** the shown month is over
- **THEN** «The month at a glance» has four figures and no forecast

#### Scenario: Too little history
- **WHEN** the data covers two whole months before the running one
- **THEN** there is no forecast figure

### Requirement: Typical day without regular payments
The forecast's typical day SHALL be the median over the usual months of each month's spending without its regular
payments, divided by that month's days, so a regular payment is never counted twice.

#### Scenario: A regular payment already paid
- **WHEN** this month's rent was paid on the 3rd and the shown day is the 10th
- **THEN** the rent is in the spending so far, not among the payments still due, and the typical day leaves rent out

### Requirement: Forecast range and formula
Under the forecast the screen SHALL show a range «from … to …» from the 25th and the 75th percentile of the usual
months' per-day figures, and a «?» giving the formula with the user's numbers. Every amount SHALL follow the main
currency and the «Show also» lines.

#### Scenario: Quartiles of the usual months
- **WHEN** the forecast of day 10 of 30 is 10 500 ₴ and the quartiles of the typical day are 150 ₴ and 260 ₴
- **THEN** the range reads «from 9 500 ₴ to 11 700 ₴» and the «?» reads 6 000 ₴ + 500 ₴ + 200 ₴ × 20 days

#### Scenario: «Show also» picked
- **WHEN** euros are picked under «Show also»
- **THEN** the forecast figure has an approximate euro line under it
