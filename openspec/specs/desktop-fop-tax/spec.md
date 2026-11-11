# desktop-fop-tax Specification

## Purpose
Defines the FOP tax screen: a quick estimate of the single tax of a sole proprietor of the 3rd group as a percent of
income for a picked period — from the FOP accounts' income, from all income, or from a typed amount. It is an
estimate, not tax advice.

## Requirements

### Requirement: Always in the menu
The side menu SHALL always show the «FOP tax» item, whether or not a business account (Monobank: a FOP account)
exists, and the screen SHALL be usable without imported data through a typed amount.

#### Scenario: No FOP account
- **WHEN** every enabled account is a personal card or a jar
- **THEN** the side menu still has the «FOP tax» item and the screen offers «All income» and «Custom amount»

### Requirement: The base is picked
The screen SHALL offer the bases «FOP accounts income» (only while the view has an enabled business account), «All
income» and «Custom amount». The default SHALL be «FOP accounts income» when it is offered, «All income» otherwise. A
custom amount SHALL replace the base.

#### Scenario: Default without a FOP account
- **WHEN** the view has no business account
- **THEN** «All income» is picked and «FOP accounts income» is not offered

### Requirement: What income counts
Income SHALL be the period's income of the view (the picked person's, or the whole family's), all scopes, folded into
hryvnia at today's rates, counting neither refunds nor transfers from the user's own accounts nor transfers between
family members; «FOP accounts income» SHALL keep only the enabled business accounts. A currency without a rate SHALL
stay out of the base and be named.

#### Scenario: Refunds and own transfers
- **WHEN** a FOP account receives 50 000 ₴ from a client, 5 000 ₴ from the owner's own card and a 2 000 ₴ refund
- **THEN** the «FOP accounts income» base is 50 000 ₴

#### Scenario: Personal cards are not in the FOP base
- **WHEN** a personal card receives a salary in the same period
- **THEN** the «FOP accounts income» base does not change and the «All income» base includes the salary

### Requirement: The period is picked
The screen SHALL pick the period with the same month range picker as the «Analytics» screen: one month or a range of
whole months, never after this month, with quick picks for this and last month, this and last quarter, each
quarter of this year that is over, and this and last year. This quarter so far
SHALL be picked at first; the end SHALL be cut at today and a running period marked. A custom amount SHALL hide it.

#### Scenario: Default period
- **WHEN** the screen opens on 10 November 2026
- **THEN** October–November 2026 is picked as «Q4 2026», running, with the year from 1 January to today under it

#### Scenario: A month
- **WHEN** the user picks September 2026
- **THEN** the base and the tax are those of 1–30 September 2026 and no year row is shown

#### Scenario: A range of months
- **WHEN** the user picks March to June 2026
- **THEN** the base is the income of 1 March to 30 June 2026

### Requirement: Year to date for a quarter
A pick that is one calendar quarter (or this quarter so far) SHALL also show the year from 1 January to its end.

#### Scenario: A past quarter
- **WHEN** the user picks July to September 2026
- **THEN** a second row shows the income and tax from 1 January to 30 September 2026

### Requirement: Rates
The screen SHALL offer the rates 5% and 6% and a field for the user's own percent (above 0, at most 100, up to two
decimals); typing a valid percent SHALL replace the preset. The tax SHALL be the percent of the base, rounded to a
kopeck, worded «from income», and shown at once on every change.

#### Scenario: A preset
- **WHEN** the base is 100 000 ₴ and 5% is picked
- **THEN** the tax reads 5 000 ₴ «5% from income»

#### Scenario: Own percent
- **WHEN** the base is 20 000 ₴ and the user types 3 as the percent
- **THEN** the tax reads 600 ₴ and neither preset is marked

### Requirement: Estimate only, ЄСВ not included
The screen SHALL say that the figure is an estimate, not tax advice, and that the single social contribution (ЄСВ) is
not included. It SHALL NOT show any ЄСВ amount.

#### Scenario: Disclaimer always shown
- **WHEN** the screen shows a tax
- **THEN** the disclaimer and the ЄСВ note are shown under it
