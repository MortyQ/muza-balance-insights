# desktop-currency-display Specification

## Purpose
Defines how amounts are shown in the main currency of the currency choice and in the «Show also» currencies the user
picked, so every amount can be read in each currency the user spends in.

## Requirements

### Requirement: Extra currencies under every listed amount
Every amount in a list, a table row or a block's headline SHALL show, under the main-currency figure, one quiet line
per picked «Show also» currency that has a rate («≈ 1 200 ₴»), in the menu order. Without a picked currency, or for
the main currency itself, no extra line SHALL be shown.

#### Scenario: Euros main, hryvnia also
- **WHEN** the main currency is euros and «Hryvnia» is on under «Show also»
- **THEN** each row of «Who spent», the payee list and the category limits shows its euro amount and an «≈ … ₴» line under it

#### Scenario: Nothing picked
- **WHEN** no «Show also» currency is on
- **THEN** amounts show the main currency only, as before

### Requirement: Exact amount of a transaction in its own currency
A transaction row SHALL show, under its amount, each picked «Show also» currency; when the transaction was made in
one of them, that line SHALL be its exact amount without «≈». The original-currency line SHALL stay for a currency
that is not picked, and no currency SHALL appear twice.

#### Scenario: A hryvnia payment, euros main
- **WHEN** a 250 ₴ payment is listed, euros are main and hryvnia is picked
- **THEN** the row shows the euro amount and «250 ₴» under it, without «≈»

#### Scenario: A koruna payment, hryvnia not picked
- **WHEN** a payment was made in korunas, euros are main and only dollars are picked
- **THEN** the row shows the euro amount, «≈ … $» and the original «… Kč»

### Requirement: Charts keep their labels
Charts SHALL keep their axis and bar labels in the main currency and SHALL show the picked currencies in their
tooltips.

#### Scenario: A bar's tooltip
- **WHEN** the user hovers a day's bar on a category screen with hryvnia picked
- **THEN** the tooltip shows the day's amount in the main currency and «≈ … ₴»
