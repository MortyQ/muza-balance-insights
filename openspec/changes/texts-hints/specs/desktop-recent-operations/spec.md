## MODIFIED Requirements

### Requirement: What is listed
«Recent transactions» SHALL list the newest six operations of the shown month that «Spending» counts — spending and
refunds, no fee lines — for the home's person, banks and «Personal / Business» choice, newest first. It SHALL NOT list
income, transfers between the user's own accounts or family transfers.

#### Scenario: A past month
- **WHEN** the global filter shows a past month
- **THEN** the list shows that month's last six operations

#### Scenario: One bank off
- **WHEN** a bank is turned off in the filters
- **THEN** its operations are not listed

### Requirement: A row
A row SHALL show the category's icon, the bank's description (cut as on the category screen), the amount in the home's
currency and the day and time. A refund SHALL read as one; a pending bank operation SHALL be marked, and the mark SHALL
carry a hint that the bank has not finalised it yet. A row SHALL open the operation's category screen, by mouse and by
keyboard.

#### Scenario: Open a row
- **WHEN** the user clicks a «Кафе» operation
- **THEN** the category screen for «Кафе» and the shown month opens

#### Scenario: A pending row
- **WHEN** a row is a payment the bank has not finalised
- **THEN** its «pending» mark has a hint saying so
