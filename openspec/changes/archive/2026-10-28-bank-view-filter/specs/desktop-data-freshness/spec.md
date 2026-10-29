# Spec Delta

## MODIFIED Requirements

### Requirement: Live connections decide completeness
A period SHALL count as complete up to the date that every account of a token connection reaches. Accounts of file
connections SHALL NOT hold that date back while any token connection has imported data; without one, every imported
account SHALL count. When the data screens show some banks only (`desktop-bank-filter`), the rule SHALL apply among the
chosen banks' accounts; the header's date and its marks of a connection that is behind SHALL stay those of every bank.

#### Scenario: A token bank and an older statement file
- **WHEN** Monobank (token) is imported up to today and PrivatBank (file) up to 21.09
- **THEN** the month in progress is complete up to today, and PrivatBank's rows count as they are

#### Scenario: Files only
- **WHEN** every connection is a file connection
- **THEN** the period is complete up to the oldest date any of them reaches

#### Scenario: Only the statement bank chosen
- **WHEN** Monobank (token) is imported up to today, PrivatBank (file) up to 21.09, and only PrivatBank is chosen
- **THEN** the month in progress is complete up to 21.09, while the header still reads «Дані до <today>» with
  «PrivatBank: до 21.09»
