# Spec Delta

## Purpose

Defines how the app reads a PrivatBank card statement file and how PrivatBank operations are understood, so a PrivatBank
card counts in spending, income and transfers like a Monobank one.

## ADDED Requirements

### Requirement: PrivatBank is connected by statement files only
PrivatBank SHALL be offered as a bank connected by its statement file, with no token and no network access.

#### Scenario: Adding a PrivatBank connection
- **WHEN** the user adds a connection and picks PrivatBank
- **THEN** only the statement file way is offered, and no request leaves the computer

### Requirement: The Privat24 card statement is recognised
The reader SHALL claim a spreadsheet whose first sheet has the «Історія операцій за період» title row and the ten
Ukrainian column headers of the Privat24 card statement, by content only. Other spreadsheets SHALL be left to other
readers.

#### Scenario: A Privat24 statement
- **WHEN** a Privat24 card statement in Ukrainian is uploaded into a PrivatBank connection
- **THEN** the PrivatBank reader is picked and the comparison is shown

#### Scenario: A PrivatBank statement into a Monobank connection
- **WHEN** the same file is uploaded into a Monobank file connection
- **THEN** it is refused as another bank's statement and nothing is written

#### Scenario: Another spreadsheet
- **WHEN** a spreadsheet with other headers is uploaded
- **THEN** the PrivatBank reader does not claim it

### Requirement: One statement per card
Rows SHALL be grouped by the masked card number of each row; each card SHALL become one statement with that masked
number and the card's currency. A card whose rows state two card currencies SHALL be refused as a bad row.

#### Scenario: Two cards in one file
- **WHEN** a file holds rows of two masked card numbers
- **THEN** two statements are returned, each row in exactly one of them

### Requirement: Operation fields are read as stated
Each row SHALL give the time (Kyiv time, to the second), the amount in the card's currency with its sign, the
operation's amount and currency, the description, the bank's category and the balance after the operation. Rows SHALL
have no merchant category code. Fully empty rows SHALL be skipped; any other row that does not read SHALL refuse the
file with its row number.

#### Scenario: A purchase in another currency
- **WHEN** a row states a debit in the card's currency and its amount in euros
- **THEN** the stored row has the card-currency amount, the euro amount as the operation amount and the euro currency

#### Scenario: Trailing empty rows
- **WHEN** the sheet ends with empty formatted rows
- **THEN** they are ignored and the statement holds only the operations

#### Scenario: A date that does not read
- **WHEN** one row's date is not a real moment
- **THEN** the file is refused with the bad-row code and that row's number

### Requirement: The bank's transfer fee is kept
When a debit's card-currency amount is larger than its operation amount in the same currency, the difference SHALL be
kept as the row's commission. A credit SHALL keep the amount it brought, with no commission: a fee withheld from a
transfer between the user's banks is counted once, by the transfer pairing.

#### Scenario: An outgoing transfer with a fee on top
- **WHEN** a debit's card amount is larger than its operation amount in the same currency
- **THEN** the row's commission is the difference, counted under bank fees

#### Scenario: An incoming transfer with a fee withheld
- **WHEN** a credit's card amount is smaller than its operation amount in the same currency
- **THEN** the row's amount is the card amount and it has no commission

### Requirement: Transfers and own transfers are recognised
Rows of the bank's transfer categories SHALL be transfer-like. Rows whose service text names a transfer to or from the
owner's own card, or the savings jar, SHALL be own transfers and never spending or income.

#### Scenario: To the owner's own card
- **WHEN** a row of the «Переказ на свою картку» category says the money went to the owner's card
- **THEN** it is an own transfer, not spending

#### Scenario: A transfer from Monobank
- **WHEN** a Monobank debit and a PrivatBank credit of the same money fall within the cross-bank window and fee
- **THEN** the two rows pair as one transfer, and a withheld fee shows under transfer fees

### Requirement: Categories come from the bank's category
A row's category SHALL come from the bank's own category through a fixed table; a bank category not in the table
SHALL give no hint.

#### Scenario: A grocery purchase
- **WHEN** a row's bank category is «Супермаркети та продукти»
- **THEN** it counts under groceries

#### Scenario: An unknown bank category
- **WHEN** the bank adds a category the table does not know
- **THEN** the row still imports and gets the default category

### Requirement: Re-uploads add only what is new
A row SHALL get the same id in every upload of the same statement, so an overlapping statement adds only new rows.

#### Scenario: The same Privat24 file twice
- **WHEN** the same statement is uploaded twice
- **THEN** the second upload adds no row
