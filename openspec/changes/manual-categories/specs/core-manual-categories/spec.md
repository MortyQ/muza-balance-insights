## ADDED Requirements

### Requirement: Manual category of one operation
The system SHALL let the user set the category of one operation to any category an override may assign, store it
apart from the operation by the operation's stored id, and apply it after every automatic rule, the MCC and payee
rules. The derived-only categories (own transfers, bank fees, transfer fees, family) SHALL NOT be assignable, and
operations in them SHALL NOT take a manual category.

#### Scenario: A pick beats the MCC
- **WHEN** an operation with MCC 5411 («продукты») gets the manual category «аренда жилья»
- **THEN** it is stored and reported as «аренда жилья», and the aggregates count it there

#### Scenario: Undo
- **WHEN** the manual category of an operation is removed
- **THEN** the operation returns to the category the automatic rules give it

### Requirement: Payee rule
The system SHALL let the user set a category for every operation with the same counterparty name or, when it has
none, the same description (trimmed, case-insensitive), past and future, and report how many operations changed. A
manual category of one operation SHALL win over a payee rule.

#### Scenario: Applied to past operations
- **WHEN** a payee rule «инвестиции» is set for a description shared by three operations
- **THEN** the answer reports 3 and all three are «инвестиции»

#### Scenario: A one-operation pick wins
- **WHEN** an operation has a manual category and its payee has a rule with another one
- **THEN** the operation keeps its manual category

### Requirement: Manual decisions survive imports
Imports and derivations SHALL NOT write, duplicate or delete manual categories and payee rules.

#### Scenario: Same statement uploaded again
- **WHEN** a statement is imported, an operation gets a manual category, and the same file is imported again
- **THEN** the operation exists once and keeps its manual category

#### Scenario: Overlapping statement
- **WHEN** a statement covering the same operation and later ones is imported
- **THEN** the operation keeps its manual category and the new operations follow the payee rules

#### Scenario: Full re-derivation
- **WHEN** every derived value is recomputed
- **THEN** every manual category and payee rule still applies

### Requirement: New spending categories
The system SHALL know the categories «аренда жилья», «авто», «дети», «подписки» and «инвестиции» as spending
categories that an override may assign. No MCC SHALL map to them in this change.

#### Scenario: Investments are spending
- **WHEN** a debit operation gets «инвестиции»
- **THEN** it counts in spending totals and has its own category total
