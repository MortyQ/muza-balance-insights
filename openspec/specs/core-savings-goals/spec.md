# core-savings-goals Specification

## Purpose
Defines savings goals: a target the user saves towards, where its progress comes from, and how much is still needed.

## Requirements

### Requirement: A savings goal
The system SHALL store savings goals apart from transactions: a name of the user's own (1–60 characters), a target in
hryvnia, dollars or euros, an optional last date, an owner (a person or the family) and a source of progress — one
jar, or «cards and jars» of the owner. At most 20 goals. An invalid target, date, owner or jar SHALL be refused and
nothing stored.

#### Scenario: Picking a jar with its own target
- **WHEN** the user picks a jar that has a target in the bank
- **THEN** that target is offered as the goal's amount

### Requirement: Progress and need
The system SHALL give a goal's progress as the source's own money now — the jar's balance, or the owner's cards and
jars without credit money, other currencies at today's rate — its per cent of the target and what is left. With a date
it SHALL give the amount needed per month: what is left ÷ whole months to the date, counting the current one; a date
passed with the goal unmet SHALL read as overdue. A jar that is no longer there SHALL leave the goal without progress
and say so.

#### Scenario: Needed per month
- **WHEN** a 50 000 ₴ goal has 31 000 ₴ in its jar in November with a date in June
- **THEN** it reads 62%, 19 000 ₴ left and 2 715 ₴ a month over 7 months

#### Scenario: A jar that is gone
- **WHEN** the goal's jar is closed in the bank
- **THEN** the goal stays, shows no progress and says the jar is not found

### Requirement: Goals stay on this computer
Goals SHALL NOT go into the analysis copy and SHALL NOT be offered through MCP tools.

#### Scenario: The analysis copy
- **WHEN** the analysis copy is rebuilt
- **THEN** it holds no goals
