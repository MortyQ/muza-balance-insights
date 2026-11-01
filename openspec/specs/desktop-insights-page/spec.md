# desktop-insights-page Specification

## Purpose
TBD - created by archiving change desktop-insights-page. Update Purpose after archive.

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
against the usual (a finished month only; otherwise said to come when the month ends), and the number of signals by
severity.

#### Scenario: A running month
- **WHEN** the shown month is the current one
- **THEN** spending reads as the share of a usual month with the days passed, and income and the kept share wait for the month's end

### Requirement: The full feed
The screen SHALL list every insight of the month ranked by money, each with its severity, its change in money and per
cent, a bar chart of the usual months and the shown month with the usual marked, its main driver when there is one,
and a link to the category's screen for a category.

#### Scenario: More than five insights
- **WHEN** the month has seven insights
- **THEN** all seven are listed, the largest change first

#### Scenario: Nothing unusual
- **WHEN** there is a usual and no insight
- **THEN** the feed says everything is within the usual

### Requirement: Payee signals
Beside the feed the screen SHALL list new payees and large one-off operations of the month (core rules), each with the
bank's description cut as in «Recent operations», its category and amount; a one-off also with its date.

#### Scenario: No payee signals
- **WHEN** the month has neither
- **THEN** the side lists say so instead of disappearing

### Requirement: How it was counted
The screen SHALL say what the usual is over (N whole months, first – last), that transfers between own accounts are
left out, refunds lower spending, how many pending holds are counted, and the thresholds of a change.

#### Scenario: Pending holds
- **WHEN** the month has pending holds
- **THEN** the note says how many are counted

### Requirement: Too little history
With fewer than 3 whole months before the shown month the screen SHALL say so and that it needs 3, instead of the feed
and the side lists.

#### Scenario: Two months of history
- **WHEN** the data covers two whole months before the shown one
- **THEN** the screen shows the notice and no feed

### Requirement: Links from home
Home's «Insights» block and «What's unusual» slide SHALL link to the screen.

#### Scenario: All insights
- **WHEN** the user clicks «All insights» on home
- **THEN** the Insights screen opens for the same month

### Requirement: Budget structure card
The Insights screen SHALL show a «Budget structure» card first in its side column. For a finished month with income it SHALL show
one bar of the income split into essential, wants and what is left with the 50/30/20 marks and each share in figures,
then the fixed share, the debt share and the reserve in months, each beside its guide in plain words and with no
grade or alarm colour. «How it was counted» SHALL say which categories are of which kind and that the reserve uses
today's money. A running month SHALL show the reserve only and say the shares come when the month ends; a month without
income SHALL say so; without a reserve (fewer than 3 whole months) its row SHALL say why. The card follows the
person, banks, scope and main currency like the rest of the screen.

#### Scenario: A finished month
- **WHEN** a finished month with income is shown
- **THEN** the card shows the split against 50/30/20, the fixed and debt shares and the reserve, each with its guide

#### Scenario: A running month
- **WHEN** the current month is shown
- **THEN** the card shows the reserve and says the shares come once the month is over

#### Scenario: Main currency
- **WHEN** euros are picked at the top
- **THEN** every amount the card names is in euros

### Requirement: Limit exceeded in the feed
The feed SHALL list each monthly limit exceeded in the shown month as a «Limit exceeded» card with the category (or the
monthly budget), the amount over the limit, its severity by the same rule as the other cards and a link to
the «Budget» screen, ranked among the other cards by money.

#### Scenario: An exceeded cafe limit
- **WHEN** the shown month spent 5 300 ₴ on cafes against a 4 000 ₴ limit
- **THEN** the feed has a «Limit exceeded» card for cafes, 1 300 ₴ over
