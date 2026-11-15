## MODIFIED Requirements

### Requirement: The full feed
The screen SHALL list every item of the month ranked by money as one list of rows of one shape: icon, title with one sentence, the amount or change with its «≈» lines. Items: each insight, limit item, new payee (the bank's description cut as in «Recent transactions», its category, amount) and large one-off (the same, with its date), each with a severity by one rule. Insights SHALL count the month without pending holds, and home's «What's unusual» SHALL count the same way.

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
- **THEN** the one-off row comes first

#### Scenario: One shape
- **WHEN** the feed holds an insight and a new payee
- **THEN** both are rows of the same list with the same parts, not cards of different shapes

#### Scenario: Severity as a dot
- **WHEN** a row is medium or low
- **THEN** its severity is a small coloured dot with the word for screen readers, and the word shows as a chip only on high rows

### Requirement: How it was counted
The screen SHALL say, in one disclosure folded under the feed and opened by its button, what the usual is over (N whole months, first – last), that transfers between own accounts are left out, refunds lower spending, that pending holds are left out and how many there are, whether cash withdrawals count as spending, and the thresholds of a change.

#### Scenario: Pending holds
- **WHEN** the month has pending holds
- **THEN** the note says how many are pending and that they count once the bank finalises them

#### Scenario: Cash off
- **WHEN** cash withdrawals do not count as spending
- **THEN** the note says so

#### Scenario: Folded until opened
- **WHEN** the screen opens
- **THEN** only the disclosure's title shows, its button reads as collapsed, and opening it lists the same lines

### Requirement: Feed filters
Above the feed the screen SHALL offer one row: severity toggle buttons — «All», «High», «Medium», «Low», each with its count in the month, pressed state announced — and, at the row's end, a «Kind» select: «All kinds», «Spending up» (more than usual, rare, over a whole usual month), «Spending down», «Income», «Limits» (exceeded and forecast above), «New payees», «One-offs». One choice each; the feed shows the items matching both.

#### Scenario: High only
- **WHEN** the user picks «High»
- **THEN** only high items are listed and the button reads as pressed

#### Scenario: Both rows
- **WHEN** «Low» and «Spending down» are picked
- **THEN** only low items of spending below the usual are listed

#### Scenario: The kind select
- **WHEN** the user picks «One-offs» in the «Kind» select
- **THEN** only one-offs are listed and the severity counts stay those of the month

## ADDED Requirements

### Requirement: Details on demand
A feed row with details (the usual-months chart, the payee line, or a link to a category or the «Budget» screen) SHALL be a disclosure: a button with its expanded state and the details it controls, opened and closed by Enter and Space. High rows SHALL start opened, the others folded. A row without details SHALL not be a button.

#### Scenario: Folded and high
- **WHEN** the feed has a high and a medium insight
- **THEN** the high row is open, the medium row is folded and opens on its button

#### Scenario: Keyboard
- **WHEN** a folded row's button has focus and the user presses Enter or Space
- **THEN** the row opens and its button reads as expanded

#### Scenario: A row with nothing behind it
- **WHEN** a new payee has no category to link
- **THEN** its row is not a button and shows no chevron

### Requirement: The chart explains itself
An opened insight SHALL show its months chart at the row's width with a caption and a legend of three entries: the shown month, the other months, and the dashed line named with its value, such as «Your usual month: 79 €». The bars keep their thin rounded look on a sunken track.

#### Scenario: Reading the chart
- **WHEN** an insight's details are open
- **THEN** the caption says what the bars are and the legend names this month, the other months and the dashed line with the usual month's amount
