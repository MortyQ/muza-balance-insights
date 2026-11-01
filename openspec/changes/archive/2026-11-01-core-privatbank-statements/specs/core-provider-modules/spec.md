# Spec Delta

## ADDED Requirements

### Requirement: One category table per bank
A bank's own categories SHALL map to the app's common categories through one table per bank. A bank SHALL NOT add a
category of its own; every category shown is one of the common list, whatever bank a row came from.

#### Scenario: The same kind of purchase in two banks
- **WHEN** a Monobank grocery purchase (by its MCC) and a PrivatBank row of the bank's grocery category are imported
- **THEN** both count under the same common category

#### Scenario: A table entry outside the common list
- **WHEN** a bank's table maps a category to something that is not a common category
- **THEN** the core does not build

### Requirement: Unknown bank categories are counted
The re-derivation report SHALL list each bank category that its bank's table does not know, with its bank and its row
count, and nothing else of those rows.

#### Scenario: The bank adds a category
- **WHEN** rows arrive with a bank category the table does not know
- **THEN** they get the default category, and the report names that bank category with its row count
