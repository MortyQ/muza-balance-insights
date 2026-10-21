# Spec Delta

## MODIFIED Requirements

### Requirement: Total card looks like a summary, not a bank card

The total of the view (the family, a picked person, and each person in the family view) SHALL be shown on a summary
card that does not use any bank's look and keeps the card's size. Its header SHALL be a band tinted with the colours of
the people it adds up, holding a summary icon, the title, a «Total» label and the people as coloured dots. Under it the
card SHALL show the caption, the amount and the account count under it. The conversions of the amount to the other
picked currencies SHALL be shown in a column on the right, one row per currency with its symbol, amount and code; with
no other currency picked there SHALL be no column. In the middle, the family card with two or more people SHALL show
their shares: a bar in their colours and each person's free amount; one person's card with reserves SHALL show a meter
of the free share against the reserved share. At the bottom it SHALL show tiles: own funds («Actually») and the reserved amount when reserves
are set against the card, and the month's net. It SHALL NOT show the foreign-currency rate line. Negative figures (the
amount, own funds, the month's net) SHALL be drawn in a soft red that tells a minus apart without the full danger
colour, in both themes.

#### Scenario: Family view

- **WHEN** the family view is shown
- **THEN** the front card is the summary card with a dot per person and a header band in their colours, and each person's card in the row is a summary card in their colour

#### Scenario: One person

- **WHEN** a person is picked
- **THEN** the front card is their summary card, and every card after it is an account card

#### Scenario: Reserves set

- **WHEN** reserves are set against the card
- **THEN** the amount is what is free, and the tiles show own funds, the reserved amount and the month's net

#### Scenario: No reserves

- **WHEN** no reserve is set against the card
- **THEN** only the month's net tile is shown, with no empty tiles

#### Scenario: Foreign currency held

- **WHEN** the view holds money in another currency
- **THEN** it is counted in the amount, and no «incl. … at the rate …» line is shown on the card

#### Scenario: Other currencies picked

- **WHEN** the currency switch has other currencies picked beside the main one
- **THEN** the card shows a column on the right with the amount converted to each of them, one row per currency

#### Scenario: No other currency picked

- **WHEN** only the main currency is picked
- **THEN** the card shows no conversions column and the amount takes the full width

#### Scenario: The family's shares

- **WHEN** the family card adds up two or more people
- **THEN** its middle shows a bar in the people's colours sized by their free amounts and a line with each person's first name and free amount in whole units, as their own cards show it

#### Scenario: A person below zero in the shares

- **WHEN** a person's free amount is zero or below
- **THEN** they have no part of the bar and their amount in the line is drawn in the soft red

#### Scenario: Many people

- **WHEN** the family has more than three people
- **THEN** the line names the three with the largest free amounts and «+N» for the rest, the full list in its tooltip, while the bar keeps a part for everyone above zero

#### Scenario: Many people in the header

- **WHEN** the family has more than five people
- **THEN** the header shows five dots and «+N» for the rest, and its band keeps every person's colour

#### Scenario: One person's reserves

- **WHEN** a person's card (picked, or in the family row) has reserves set against it and their own funds are above zero
- **THEN** its middle shows a meter of the free share and the reserved share in whole percent that add up to 100

#### Scenario: One person without reserves

- **WHEN** a person's card has no reserves set against it
- **THEN** its middle shows no meter

#### Scenario: A minus

- **WHEN** the amount or the month's net is below zero
- **THEN** that figure is drawn in the soft red, and the month's tile is tinted the soft red instead of green
