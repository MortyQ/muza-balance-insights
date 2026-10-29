# Spec Delta

## Purpose

Defines how the app reads a Slovenská sporiteľňa account statement (PDF, Slovak) and how its operations are understood,
so an SLSP account counts in spending, income and transfers although the bank states no MCC and no category.

## ADDED Requirements

### Requirement: SLSP is connected by statement files only
Slovenská sporiteľňa SHALL be offered as a bank connected by its statement file, with no token and no network access.

#### Scenario: Adding an SLSP connection
- **WHEN** the user adds a connection and picks Slovenská sporiteľňa
- **THEN** only the statement file way is offered, and no request leaves the computer

### Requirement: The SLSP account statement is recognised by its content
A reader SHALL claim an SLSP account statement PDF in Slovak by its content only: the six-column table header in
Slovak. A file that also carries the statement's title («Výpis z Účtu») and the bank's BIC SHALL be claimed with more
certainty than one with the header alone. No other bank's reader SHALL claim it.

#### Scenario: An SLSP statement
- **WHEN** an SLSP account statement PDF is uploaded into an SLSP connection
- **THEN** the SLSP reader is picked and the comparison is shown

#### Scenario: An SLSP statement into another bank's connection
- **WHEN** an SLSP statement is uploaded into a Monobank, PrivatBank or A-Bank file connection
- **THEN** it is refused as another bank's statement and nothing is written

#### Scenario: Another PDF
- **WHEN** a PDF with another table header is uploaded
- **THEN** the SLSP reader does not claim it

### Requirement: One statement per file, one account
An SLSP statement SHALL become one statement for one account. The account is identified by the IBAN in the heading,
and its cards are every masked card number the rows name. The account currency SHALL be the heading's currency, and
the closing balance the heading's closing balance.

#### Scenario: Matching an existing account
- **WHEN** a second month's statement of the same IBAN is uploaded
- **THEN** it matches the account created by the first one, and only new rows are added

### Requirement: Operations not carried out are not imported
Rows listed under «Nezrealizované transakcie» SHALL NOT become operations, and their text SHALL NOT join any other
row.

#### Scenario: A rejected transfer at the end of the month
- **WHEN** a statement ends with a rejected transfer in that section
- **THEN** the import holds every booked row and not the rejected one, and the last booked row keeps its own details

### Requirement: A statement that does not add up is refused
The reader SHALL check every row's balance against the previous balance plus the row's amount and fee, and the
heading's opening balance, deposit and withdrawal totals and closing balance against the rows. On any mismatch the
file SHALL be refused as a row that does not read, naming the first row that breaks, and nothing SHALL be written.

#### Scenario: A misread row
- **WHEN** one row's amount is read wrong, so its balance no longer follows
- **THEN** the upload is refused with that row's number

### Requirement: Times, amounts, fees and currencies
- A card operation SHALL take the date and time stated in its details, to the second.
- An operation without a stated time SHALL take its booking date.
- Both SHALL be read in the Europe/Bratislava zone.
- The stored amount SHALL be the amount plus the fee. The fee SHALL be kept as the row's commission.
- A card operation that states an amount in another currency SHALL keep that amount and currency as its operation
  amount and currency.

#### Scenario: A purchase abroad
- **WHEN** a card payment in hryvnias is booked on a euro account
- **THEN** the row's amount is in euros and its operation amount is the hryvnia amount, in hryvnias

#### Scenario: A cash withdrawal with a fee
- **WHEN** a withdrawal has a fee in the fee column
- **THEN** the row's amount includes the fee, and the fee shows as a bank fee in spending

### Requirement: Operation types decide transfers, cash and refunds
The operation type SHALL be stored as the row's bank category.
- The four transfer types SHALL be transfers: an incoming one is income, an outgoing one a payment to a person.
- A card withdrawal SHALL be cash. A cash deposit SHALL be income.
- A returned purchase SHALL be a refund.
- A transfer to or from an IBAN of the user's own account SHALL be an own transfer, by the existing IBAN rule.
- A type the bank's table does not know SHALL be reported by the re-derivation report.

#### Scenario: An incoming instant payment
- **WHEN** a «Prijatá Okamžitá platba» row is imported
- **THEN** it counts as income from a transfer, not as spending

#### Scenario: A transfer to the user's own Monobank account
- **WHEN** an outgoing SEPA payment names the IBAN of an account the app already holds
- **THEN** it is an own transfer and does not count as spending

### Requirement: Card payments are categorised by merchant keywords
A row with no MCC and no hint from its operation type SHALL get a category from the bank's merchant keyword list:
- matched on whole words of the merchant text, ignoring case and diacritics;
- the first matching entry in the list's order wins, so more specific entries come first;
- a merchant no entry matches SHALL fall into «other»;
- a user's category override SHALL win over a keyword.
The list SHALL hold chains and brands only.

#### Scenario: A supermarket chain
- **WHEN** a card payment's merchant text starts with «BILLA»
- **THEN** it counts under groceries

#### Scenario: A kiosk named after a supermarket
- **WHEN** a merchant text reads «TABAK-PRESS-BILLA»
- **THEN** it does not count under groceries

#### Scenario: A part of a word
- **WHEN** a merchant text contains a keyword only inside a longer word
- **THEN** that keyword does not match

#### Scenario: An unknown merchant
- **WHEN** no keyword matches a card payment
- **THEN** it counts under «other»
