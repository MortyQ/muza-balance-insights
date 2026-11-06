## Purpose

Defines whether cash withdrawals count as spending: a switch the user owns, on by default, and what every spending
figure does while it is off.

## ADDED Requirements

### Requirement: A switch for cash withdrawals
The system SHALL store one switch «cash withdrawals count as spending», on by default, apart from transactions. Only a
value different from the default SHALL be stored. Changing it SHALL NOT change any stored operation or its category.

#### Scenario: A new database
- **WHEN** nothing was ever chosen
- **THEN** cash withdrawals count as spending

#### Scenario: Turned off and on again
- **WHEN** the user turns the switch off and then on
- **THEN** every spending figure is what it was before, and nothing about the operations changed

### Requirement: Cash left out of spending while off
While the switch is off, operations whose category is «Cash» SHALL be left out of every spending figure the way
transfers between own accounts are, in every grouping and view, the budget, limits, budget metrics, the usual months,
the Insights detectors and the MCP spending tools. A commission on a withdrawal SHALL stay spending as a bank
commission. Income is not affected. «Cash» SHALL NOT be offered as a limit's category while the switch is off.

#### Scenario: A withdrawal in a month
- **WHEN** the switch is off and the month has 1 000 ₴ of groceries and a 2 000 ₴ withdrawal with a 20 ₴ commission
- **THEN** the month's spending is 1 020 ₴: groceries and the bank commission, no «Cash» category

#### Scenario: The usual month follows
- **WHEN** the switch is off and the past months held withdrawals
- **THEN** the usual month and the Insights feed count those months without them too

### Requirement: Withdrawn total
While the switch is off, the system SHALL give the total withdrawn in cash for a period and view (person, banks,
scope), net of cash refunds, in the main currency at today's rate, so the money stays visible.

#### Scenario: Two withdrawals
- **WHEN** the switch is off and the month has withdrawals of 2 000 ₴ and 500 ₴
- **THEN** the withdrawn total for the month is 2 500 ₴
