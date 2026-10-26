# Spec Delta

## MODIFIED Requirements

### Requirement: The header shows a connection that is behind
The header SHALL show the date the live data reaches. When a connection's data ends more than one day before that date,
the trigger SHALL name that bank and its date. With several banks behind, it SHALL give their count instead.

#### Scenario: One bank behind
- **WHEN** PrivatBank's data ends at 21.09 and the live data reaches today
- **THEN** the header reads «Дані до <today>» with «PrivatBank: до 21.09»

#### Scenario: Several banks behind
- **WHEN** two connections end more than a day before the live data
- **THEN** the trigger reads «2 банки відстають»

#### Scenario: Nothing behind
- **WHEN** every connection reaches the same day
- **THEN** the header shows the date alone

### Requirement: Every connection's reach on demand
Pressing the data status SHALL list every connection, grouped by person. Each row SHALL show:
- the bank;
- the way (token or file);
- the date its data reaches, marked when the connection is behind;
- one action.

The action SHALL be «Refresh» for a token connection, and «Upload from <date>» for a file connection, where the date is
the day after its data ends. The upload SHALL start bound to that connection. Under the list the user SHALL find:
- «Upload statement»;
- «Add bank», which lists the banks the app knows, each with the way it connects.

#### Scenario: Bringing a file bank up to date
- **WHEN** the user opens the list and presses «Upload from 22.09» at PrivatBank
- **THEN** the upload sheet starts bound to that PrivatBank connection

#### Scenario: Grouped by person
- **WHEN** Serhii has Monobank and PrivatBank and Vlada has Monobank
- **THEN** the list shows Serhii's two rows under «Serhii» and Vlada's row under «Vlada»

#### Scenario: Adding a bank
- **WHEN** the user presses «Add bank» and picks a file bank
- **THEN** the upload sheet opens for that bank's files, with the hint where to download its statement
