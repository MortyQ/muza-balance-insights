# core-csob-provider Specification

## Purpose
Defines how the app reads a ČSOB payment history (CSV, English) and how its operations are understood, so a ČSOB
account counts in spending, income and transfers although the bank states no MCC and no time of day.

## Requirements

### Requirement: ČSOB is connected by statement files only
ČSOB SHALL be offered as a bank connected by its statement file, with no token and no network access.

#### Scenario: Adding a ČSOB connection
- **WHEN** the user adds a connection and picks ČSOB
- **THEN** only the statement file way is offered, and no request leaves the computer

### Requirement: The ČSOB payment history is recognised by its content
A reader SHALL claim a ČSOB payment history CSV in English by its content only: its 24-column header. A file that also
starts with the «Payment history <account>/<bank code> on …» title line SHALL be claimed with more certainty than one
with the header alone. No other bank's reader SHALL claim it, and the ČSOB reader SHALL NOT claim another bank's file.

#### Scenario: A ČSOB file
- **WHEN** a ČSOB payment history CSV is uploaded into a ČSOB connection
- **THEN** the ČSOB reader is picked and the comparison is shown

#### Scenario: A ČSOB file into another bank's connection
- **WHEN** a ČSOB file is uploaded into a Monobank, PrivatBank, A-Bank or SLSP connection
- **THEN** it is refused as another bank's statement and nothing is written

#### Scenario: A Monobank CSV
- **WHEN** a Monobank card statement CSV is uploaded
- **THEN** the ČSOB reader does not claim it

### Requirement: One statement per file, its IBAN from the account number
A ČSOB file SHALL become one statement for one account. Its IBAN SHALL be computed from the Czech account number and
bank code: `CZ`, two check digits (ISO 7064 mod 97-10), the 4-digit bank code, the 6-digit prefix and the 10-digit
number, each padded with zeros. The account currency SHALL be the `currency` column. A file with two account numbers or
two currencies SHALL be refused as a row that does not read.

#### Scenario: A second upload of the same account
- **WHEN** a newer file of the same account is uploaded
- **THEN** it matches the account created by the first one by its IBAN, and only new rows are added

#### Scenario: An account number with a prefix
- **WHEN** the account number is `<prefix>-<number>/<bank code>`
- **THEN** the IBAN holds the prefix and the number, each padded with zeros

### Requirement: Rows and the closing balance
Rows SHALL be read newest first and handed over oldest first. Trailing rows that hold only a balance SHALL be skipped.
The closing balance SHALL be the `balance` of the newest row. Each row SHALL be dated by its `due date` at midnight,
Europe/Prague.

#### Scenario: Trailing balance-only rows
- **WHEN** the file ends with rows that fill only the balance column
- **THEN** they become no operations, and the closing balance is the newest operation's balance

### Requirement: Direction of an amount
A signed amount SHALL keep its sign. An unsigned amount SHALL take its direction from the transaction type: incoming
payments, incoming instant and foreign payments, card refunds and cash deposits are credits; card payments, outgoing
payments, instant payments, the payment button, standing orders and foreign payment fees are debits.

#### Scenario: An unsigned card payment
- **WHEN** a row of type «Debit card transaction» has the amount `250`
- **THEN** it is stored as a debit of 250.00

#### Scenario: A signed amount with decimals
- **WHEN** a row has the amount `-452,30`
- **THEN** it is stored as a debit of 452.30, whatever its type

### Requirement: Amount formats and unknown types
Amounts SHALL be read with or without decimals, with a decimal comma or dot. A row whose amount has no sign and whose
type is unknown SHALL refuse the file as a row that does not read, naming that row.

#### Scenario: An unknown type
- **WHEN** a row with an unsigned amount has a type the reader does not know
- **THEN** the file is refused with that row's number and nothing is written

### Requirement: Foreign currency, counterparties and descriptions
An `original transaction` in another currency than the account's SHALL be stored as the operation amount and currency.
A counter account with a 4-digit Czech bank code SHALL be stored as the counterparty's IBAN, and its name as the
counterparty's name. The description SHALL be the `Place:` part of the note when it is present, else the counterparty's
name, else the type.

#### Scenario: A card payment abroad
- **WHEN** a card row states `12,50 EUR` as the original transaction
- **THEN** the operation amount is 12.50 in euros and the account amount is the row's amount

#### Scenario: A transfer to the user's own account in another bank
- **WHEN** an outgoing payment names a Czech counter account whose IBAN the user's other account has
- **THEN** the counterparty IBAN is stored, and the domain's IBAN rule pairs the two rows as an own transfer

### Requirement: The bank category and transfers
The reader SHALL store the `category` column as the bank category. For a transfer type whose category is «Income»,
«Outgoing unclassified», «Bank transactions» or empty, it SHALL store the type instead. Rows whose bank category is a
transfer type SHALL be transfers: income when credited, a payment to a person when debited. The bank's categories SHALL
map to the common category hints; an unknown one SHALL be reported by the re-derivation report.

#### Scenario: A utility paid by transfer
- **WHEN** an outgoing payment has the category «TV, internet, phone»
- **THEN** it keeps that category and gets the telecom hint, not a payment to a person

#### Scenario: An incoming payment with a generic category
- **WHEN** an incoming payment has the category «Income»
- **THEN** its bank category is the type and it counts as income from a transfer

### Requirement: Nothing from the file in the analysis copy
Every ČSOB description SHALL reach the analysis copy as `[other]` with its shape class. The holder's name and address,
the symbols and the payer references SHALL NOT be read.

#### Scenario: Masking a ČSOB row
- **WHEN** the analysis copy is rebuilt
- **THEN** every ČSOB description in it is `[other]`
