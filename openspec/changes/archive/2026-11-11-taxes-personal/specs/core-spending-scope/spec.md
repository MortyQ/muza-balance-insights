# Spec Delta

## Purpose

Decides whether an operation is personal or business, and so which operations the personal views — «Spending»,
categories, category limits, «Budget structure» and the monthly budget — take into account.

## ADDED Requirements

### Requirement: Treasury payments from personal cards are personal by default
A payment to the state treasury (a tax or a government fee) made from a personal card SHALL be personal by default and
SHALL count in «Spending», in the «Taxes and government fees» category and in «Budget structure» like any other
spending. The user MAY switch treasury payments back to business with the user-run setting; a scope override for a
payment SHALL win over this default in both directions.

#### Scenario: Tax paid from a personal card
- **WHEN** a treasury payment is imported from a personal card and the user has not changed the setting
- **THEN** it is personal, and «Spending» and the taxes category for its month include it

#### Scenario: Setting turned back on
- **WHEN** the user turns the treasury setting on
- **THEN** treasury payments from any card are business and leave the personal views

#### Scenario: Override wins
- **WHEN** a scope override names a treasury payment as business
- **THEN** that payment is business while other treasury payments stay personal

### Requirement: Business-account payments stay business
Every operation of a business account (Monobank: FOP) SHALL be business unless a scope override says otherwise,
whatever the treasury setting, so taxes paid from a business account stay out of the personal views.

#### Scenario: Tax paid from a FOP account
- **WHEN** a treasury payment is imported from a FOP account
- **THEN** it is business and «Spending» does not include it

### Requirement: Stored operations follow a changed scope rule
When the scope rules change in a release, operations imported before it SHALL be re-scoped once, without the user
importing their history again.

#### Scenario: Taxes imported before the update
- **WHEN** the app with this change runs its next import over a database whose treasury payments were scoped business
  by the old default
- **THEN** after that import those payments from personal cards are personal and show in «Spending»

### Requirement: The budget's tax switch affects only the budget
The monthly budget's «Count taxes» switch SHALL decide only whether taxes count against the budget's flexible part
(and whether taxes can be a fixed row). Turning it off SHALL NOT remove taxes from «Spending», the category screens or
«Budget structure».

#### Scenario: Switch off
- **WHEN** the budget's «Count taxes» switch is off and a tax was paid from a personal card this month
- **THEN** the budget's flexible spending leaves the tax out, while «Spending» and the taxes category include it

#### Scenario: Switch on
- **WHEN** the switch is on
- **THEN** the budget's flexible spending includes the tax as well
