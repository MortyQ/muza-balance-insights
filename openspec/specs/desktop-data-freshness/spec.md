# desktop-data-freshness Specification

## Purpose
Says how far the app's data reaches when banks are updated in different ways and at different times, which data decides
whether a period is complete, and how the user learns that a bank is behind and brings it up to date.

## Requirements

### Requirement: Live connections decide completeness
A period SHALL count as complete up to the date that every account of a token connection reaches. Accounts of file
connections SHALL NOT hold that date back while any token connection has imported data; without one, every imported
account SHALL count.

#### Scenario: A token bank and an older statement file
- **WHEN** Monobank (token) is imported up to today and PrivatBank (file) up to 21.09
- **THEN** the month in progress is complete up to today, and PrivatBank's rows count as they are

#### Scenario: Files only
- **WHEN** every connection is a file connection
- **THEN** the period is complete up to the oldest date any of them reaches

### Requirement: The header shows a connection that is behind
The header SHALL show the date the live data reaches. When a connection's data ends more than one day before it, the
header SHALL add a mark naming that bank and its date, or the number of banks behind when there are several.

#### Scenario: One bank behind
- **WHEN** PrivatBank's data ends at 21.09 and the live data reaches today
- **THEN** the header reads «Дані до <today>» with «PrivatBank: до 21.09»

#### Scenario: Nothing behind
- **WHEN** every connection reaches the same day
- **THEN** the header shows the date alone

### Requirement: Every connection's reach on demand
Pressing the data status SHALL list every connection with its bank, person, way, the date its data reaches and its
action: refresh for a token connection, upload a statement for a file connection.

#### Scenario: Bringing a file bank up to date
- **WHEN** the user opens the list and presses «Завантажити виписку» at PrivatBank
- **THEN** the statement upload of the data screens starts
