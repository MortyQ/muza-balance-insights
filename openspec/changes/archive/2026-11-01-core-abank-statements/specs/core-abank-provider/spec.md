# Spec Delta

## Purpose

Defines how the app reads an A-Bank card statement (spreadsheet or PDF) and how A-Bank operations are understood, so an
A-Bank card counts in spending, income and transfers like a Monobank one.

## ADDED Requirements

### Requirement: A-Bank is connected by statement files only
A-Bank SHALL be offered as a bank connected by its statement file, with no token and no network access.

#### Scenario: Adding an A-Bank connection
- **WHEN** the user adds a connection and picks A-Bank
- **THEN** only the statement file way is offered, and no request leaves the computer

### Requirement: The A-Bank card statement is recognised in both formats
A reader SHALL claim an A-Bank card statement in Ukrainian by content only. A spreadsheet's first sheet, or a PDF's
table header, SHALL carry the statement's eleven columns, in either format's spelling. A file that also has the
statement's heading lines SHALL be claimed with more certainty than one with the headers alone.

#### Scenario: An A-Bank spreadsheet
- **WHEN** an A-Bank card statement `.xlsx` is uploaded into an A-Bank connection
- **THEN** the A-Bank spreadsheet reader is picked and the comparison is shown

#### Scenario: An A-Bank PDF
- **WHEN** an A-Bank card statement `.pdf` is uploaded into an A-Bank connection
- **THEN** the A-Bank PDF reader is picked and the comparison is shown

#### Scenario: An A-Bank statement into another bank's connection
- **WHEN** an A-Bank statement is uploaded into a Monobank or PrivatBank file connection
- **THEN** it is refused as another bank's statement and nothing is written

#### Scenario: Another spreadsheet
- **WHEN** a spreadsheet or PDF with other headers is uploaded
- **THEN** no A-Bank reader claims it

### Requirement: One statement per file, all its cards on one account
An A-Bank statement SHALL become one statement for one account. The account is identified by the IBAN the file
states, and its cards are every masked card number that appears in the rows. A row without a card number SHALL stay
in that account. The account currency SHALL be the one named in the header of the card-currency amount column.

#### Scenario: Two cards on one account
- **WHEN** the rows name two masked card numbers and the file states one IBAN
- **THEN** one statement is returned with that IBAN and both card numbers

#### Scenario: A row without a card
- **WHEN** a row has «-» instead of a card number
- **THEN** it is read into the same statement

### Requirement: Operation fields are read as stated
Each row SHALL give, as stated:
- the time in Kyiv time, to the minute;
- the signed amounts in the card and operation currencies;
- the operation currency;
- the MCC when present;
- the description;
- the fee as the commission and the cashback, when not «-»;
- the balance after the operation.

Text and numeric amounts SHALL read alike. Rows SHALL be held oldest first. A row that does not read SHALL refuse the
file with its row number.

#### Scenario: A purchase in another currency
- **WHEN** a row states a debit in hryvnias and its amount in US dollars
- **THEN** the stored row has the hryvnia amount, the dollar amount as the operation amount and the dollar currency

#### Scenario: A cash withdrawal with a fee
- **WHEN** a row states an operation amount, a fee, and a card amount equal to their sum
- **THEN** the stored row has the card amount and the fee as its commission

#### Scenario: A row without an MCC
- **WHEN** a row's MCC cell is empty
- **THEN** the stored row has no merchant category code

#### Scenario: A PDF row across lines
- **WHEN** a PDF row has its date on the line above the amounts and its time on the line below
- **THEN** the stored row has that date and time

#### Scenario: A table that continues on the next page
- **WHEN** the operations continue on the next page under a repeated table header
- **THEN** every operation is read once and no header line is read as an operation

### Requirement: A-Bank operations are understood by their MCC
A-Bank's rules SHALL follow the merchant category code the bank states, as Monobank's rules do:
- MCC 4829 SHALL be a transfer;
- MCC 6012 SHALL be a financial institution (a credit is income from another bank);
- every other code SHALL get its category from the common MCC table.

The rules SHALL never change a category by the merchant's name.

#### Scenario: A transfer from the user's Monobank card
- **WHEN** a Monobank debit and an A-Bank credit with MCC 4829 of one amount fall within the cross-bank window
- **THEN** they are paired as a transfer between the user's banks and count neither as spending nor as income

#### Scenario: A purchase with a merchant code
- **WHEN** an A-Bank debit has a merchant code that the common table maps
- **THEN** it gets the same category a Monobank debit with that code gets

### Requirement: Cashback credits are income, not transfers
The bank's cashback credit SHALL count as income and SHALL never be a transfer or pair with one, even though the bank
marks it with the transfer code. The cashback stated on each purchase SHALL be stored with that purchase and SHALL NOT
count as income a second time.

#### Scenario: A cashback credit
- **WHEN** the statement has the cashback credit row
- **THEN** it counts as income and no transfer pair is made with it

### Requirement: Cancellations are refunds
A positive row that cancels a purchase SHALL be a refund: either it starts with «Скасування.», or it is a credit with a
merchant code that is neither a transfer nor a financial institution, or it is a credit without a code that is not a
transfer.

#### Scenario: A cancelled purchase
- **WHEN** a purchase is followed by a «Скасування.» credit of the same merchant
- **THEN** the credit is a refund and reduces spending, not added to income

### Requirement: Named senders from Monobank
An incoming transfer whose description is `MONO*<name>` SHALL be a transfer from that named sender.

#### Scenario: A named incoming transfer
- **WHEN** an A-Bank credit with MCC 4829 reads `MONO*<name>`
- **THEN** its income source is a named sender and the sender is that name

### Requirement: A-Bank texts in the analysis copy
In the analysis copy, the cashback credit and the cash withdrawal texts SHALL be kept as they are. For «Скасування. …»
only the prefix SHALL be kept, and for `MONO*…` only the prefix; the merchant and the name SHALL be replaced. Every
other description SHALL be replaced by the shape-only placeholder.

#### Scenario: A named sender in the copy
- **WHEN** the analysis copy is rebuilt with an A-Bank `MONO*<name>` row
- **THEN** the copy holds the prefix and a placeholder, never the name
