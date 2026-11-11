# desktop-global-search Specification

## Purpose
Defines the one search field of the data screens: what it finds, how results are grouped and opened, and what bank
text it may show.

## Requirements

### Requirement: Search from any data screen
Every data screen SHALL offer one search field, also opened with Cmd+K (Ctrl+K), that finds transactions by
description, comment, amount (±1 in the main currency) or date, and groups results as Transactions, Payees,
Categories and Regular payments.

#### Scenario: By amount
- **WHEN** the user types «250»
- **THEN** transactions of 249–251 in the main currency are listed, newest first

#### Scenario: By date range
- **WHEN** the user types «5–11 Oct»
- **THEN** the transactions of 5 to 11 October are listed

### Requirement: Results open where they belong
A transaction result SHALL open its category screen for its month with the list filtered to it; a payee its category
with the payee filter; a category its screen; a regular payment the regular payments screen.

#### Scenario: Open a transaction
- **WHEN** the user picks a grocery transaction of 12 October
- **THEN** the groceries screen for October opens with that transaction in the list

### Requirement: Bank text kept as narrow as the category screen
The search channel SHALL carry each transaction's description and comment cut exactly as the category screen's lines,
and SHALL NOT carry a counterparty's full name, an IBAN, a full card number or a jar title.

#### Scenario: Canary
- **WHEN** a transaction has a counterparty name, an IBAN and a card number in its stored data
- **THEN** none of them appears in the search answer
