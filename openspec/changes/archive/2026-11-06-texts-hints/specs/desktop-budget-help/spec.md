## MODIFIED Requirements

### Requirement: What is counted and what is not
The explanations of limits and metrics SHALL say which operations are counted and which are left out: refunds lower
spending, transfers between own accounts are left out, pending holds are left out until the bank finalises them, only
«Personal» spending, every bank, and for the monthly budget how the fixed rows are set aside first at the typed
amounts, that spending above a row's amount counts as flexible, and that savings categories are left out, with a link
to edit the budget.

#### Scenario: The monthly budget's exclusions
- **WHEN** the user opens the «?» of the monthly budget
- **THEN** it shows «2 000 € − 1 250 € fixed (rent) = 750 € for flexible spending» and links to editing the budget

#### Scenario: Pending holds
- **WHEN** the user opens the «?» of a limit
- **THEN** it says pending holds are left out until the bank finalises them
