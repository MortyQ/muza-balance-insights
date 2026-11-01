## Purpose
Defines the kind of every spending category (essential, wants, savings) and whether it is a fixed cost, the defaults
core gives and the user's own choices, kept apart from the operations.

## ADDED Requirements

### Requirement: Every spending category has a kind and a fixed flag
The system SHALL give every spending category one kind — essential, wants or savings — and a fixed flag. Categories
that are not spending (own transfers, income, transfers to family) SHALL have no kind. Bank fees and transfer fees,
though never chosen for an operation, SHALL have a kind, since spending counts them.

#### Scenario: Defaults without any choice
- **WHEN** the user has never changed a kind
- **THEN** rent reads as essential and fixed, cafes and restaurants as wants and not fixed, investments as savings

#### Scenario: Not a spending category
- **WHEN** the kinds are listed
- **THEN** own transfers, income and transfers to family are not in the list

### Requirement: The user's choice wins and survives
The system SHALL let the user set a category's kind and fixed flag, store the choice apart from the operations, and use
it above the default. Imports, re-uploads, syncs and full recalculations SHALL NOT change or remove a choice. Resetting
SHALL remove the choice for one category or for all, so the default applies again. An unknown category, kind or a
category without a kind SHALL be refused and nothing stored.

#### Scenario: A choice beats the default
- **WHEN** the user marks «одежда» as essential
- **THEN** it reads as essential, and is marked as changed from the default

#### Scenario: Reset all
- **WHEN** the user resets all kinds
- **THEN** every category reads its default again and none is marked as changed

#### Scenario: A refused choice
- **WHEN** a kind is set for «поступления»
- **THEN** the call fails and nothing is stored

### Requirement: Kinds stay on this computer
The kinds table SHALL NOT go into the analysis copy and SHALL NOT be offered through MCP tools.

#### Scenario: The analysis copy
- **WHEN** the analysis copy is rebuilt
- **THEN** it holds no category kinds
