## ADDED Requirements

### Requirement: Budget card
The Insights screen SHALL show a «Budget» card first in its side column. For a finished month with income it SHALL show
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
