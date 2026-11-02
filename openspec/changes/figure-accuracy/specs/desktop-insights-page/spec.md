## MODIFIED Requirements

### Requirement: The full feed
The screen SHALL list every insight of the month ranked by money, each with its severity, its change in money and per
cent, a bar chart of the usual months and the shown month with the usual marked, its main driver when there is one,
and a link to the category's screen for a category. The insights SHALL count the shown month without pending holds,
so an insight does not appear and vanish as the bank finalises or cancels them; home's «What's unusual» SHALL count
the same way, so both show the same insights.

#### Scenario: More than five insights
- **WHEN** the month has seven insights
- **THEN** all seven are listed, the largest change first

#### Scenario: Nothing unusual
- **WHEN** there is a usual and no insight
- **THEN** the feed says everything is within the usual

#### Scenario: A large pending hold
- **WHEN** a category would be over its usual month only with a hold from today
- **THEN** there is no insight for it until the hold is final

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

## ADDED Requirements

### Requirement: Forecast above the limit in the feed
In the current month, once a quarter of it has passed, the feed SHALL list each monthly limit (and the budget's
flexible part) not exceeded but forecast above it as a «Forecast above the limit» card: the category (or the budget),
the forecast, the overrun, «per day» to stay within and a link to the «Budget» screen. Its severity and rank SHALL
follow the other cards' rule, from the overrun. A past month SHALL have no such cards.

#### Scenario: Ahead of pace on cafes
- **WHEN** on day 10 of 30 cafes have 1 900 ₴ spent against a 4 000 ₴ monthly limit
- **THEN** the feed has a «Forecast above the limit» card for cafes: forecast 5 700 ₴, 1 700 ₴ over, 100 ₴ a day to stay within

#### Scenario: Too early
- **WHEN** on day 5 of 30 the forecast is above the limit
- **THEN** there is no forecast card

#### Scenario: Already exceeded
- **WHEN** the limit is exceeded
- **THEN** only the «Limit exceeded» card is shown for it
