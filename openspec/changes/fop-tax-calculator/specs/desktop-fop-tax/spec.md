# Spec Delta

## Purpose

Defines the FOP tax screen: an estimate of the single tax of a sole proprietor of the 3rd group as a percent of the
income on their business accounts, by quarter and for the year to date. It is an estimate, not tax advice.

## ADDED Requirements

### Requirement: Offered only with a business account
The side menu SHALL show the «FOP tax» item only while at least one enabled account is a business account by its
provider's rule (Monobank: a FOP account). Opened without one in the view, the screen SHALL say that no FOP account
is connected and show no figures.

#### Scenario: No FOP account
- **WHEN** every enabled account is a personal card or a jar
- **THEN** the side menu has no «FOP tax» item

#### Scenario: A FOP account turned off
- **WHEN** the only FOP account is turned off in «People and banks»
- **THEN** the item leaves the side menu after the data status refreshes

### Requirement: The base is income on the business accounts
The base SHALL be the income of the period on the enabled business accounts of the view (the picked person's, or
the whole family's), all scopes, folded into hryvnia at today's rates, counting neither refunds nor transfers from
the user's own accounts nor transfers between family members. A currency without a rate SHALL stay out of the base
and be named.

#### Scenario: Refunds and own transfers
- **WHEN** a FOP account receives 50 000 ₴ from a client, 5 000 ₴ from the owner's own card and a 2 000 ₴ refund
- **THEN** the quarter's base is 50 000 ₴

#### Scenario: Personal cards are not in the base
- **WHEN** a personal card receives a salary in the same quarter
- **THEN** the base does not change

### Requirement: Quarter and year to date
The screen SHALL offer a year and a quarter (Q1–Q4), the current quarter at first, never a quarter after the current
one, and SHALL show the base and the tax for the quarter and for the year from 1 January to the end of the picked
quarter. A quarter that is not over SHALL be marked as running.

#### Scenario: Default period
- **WHEN** the screen opens on 10 November 2026
- **THEN** Q4 2026 is picked and the year to date runs from 1 January to today

### Requirement: Rates and custom inputs
The screen SHALL offer the rates 5%, 1% and 6%, a custom percent (above 0, at most 100), and a custom amount that
replaces the base; the tax SHALL be the percent of the base, rounded to a kopeck, and be worded «from income».

#### Scenario: A preset
- **WHEN** the quarter's base is 100 000 ₴ and 5% is picked
- **THEN** the tax reads 5 000 ₴ «5% from income»

#### Scenario: A custom amount
- **WHEN** the user types 20 000 as the amount and picks 1%
- **THEN** the tax reads 200 ₴ and the year to date is not shown

### Requirement: Estimate only, ЄСВ not included
The screen SHALL say that the figure is an estimate, not tax advice, and that the single social contribution (ЄСВ) is
not included. It SHALL NOT show any ЄСВ amount.

#### Scenario: Disclaimer always shown
- **WHEN** the screen shows a tax
- **THEN** the disclaimer and the ЄСВ note are shown under it
