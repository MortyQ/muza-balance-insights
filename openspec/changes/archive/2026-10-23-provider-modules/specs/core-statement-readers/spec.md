# Spec Delta

## Purpose

Defines how a statement file of any bank becomes operations: one reader contract over a neutral document, the reader
picked from the file itself, several accounts per file, and re-uploads that add only what is new.

## ADDED Requirements

### Requirement: Readers work on a neutral document
A statement reader SHALL read a neutral document, never file bytes: plain text, a grid of cell texts per sheet, or
text items with their page and position. Turning a file into this document SHALL happen outside the core.

#### Scenario: The same reader on any platform
- **WHEN** a reader is given a neutral document built from fictional fixture data
- **THEN** it reads it with no file system, archive or PDF code in the core

### Requirement: The reader is picked from the file itself
Each reader SHALL say how sure it is that a document is its own, from the document's format and its column or
heading signature. The app SHALL pick the reader that is most sure, never from the file's extension or the bank the
user expected. When no reader is sure, or two readers are equally sure, the file SHALL be refused with its own code.

#### Scenario: A Monobank card statement
- **WHEN** the user uploads a Monobank card statement in Ukrainian
- **THEN** the Monobank reader is picked and reads it as today

#### Scenario: A renamed file
- **WHEN** a statement file is uploaded under another extension
- **THEN** the same reader is picked as for the original name

#### Scenario: Not a statement
- **WHEN** the file matches no reader
- **THEN** it is refused as an unknown format and nothing is written

#### Scenario: Two readers claim one file
- **WHEN** two readers are equally sure of a document
- **THEN** the file is refused as ambiguous and nothing is written

### Requirement: The file's bank must match the connection
A file SHALL be written only into a connection of the bank whose reader read it. Uploading another bank's statement
into a connection SHALL be refused with its own code, before any comparison or write.

#### Scenario: Another bank's statement
- **WHEN** the user uploads a file that a PrivatBank reader picks into a Monobank file connection
- **THEN** the upload is refused as another bank's statement and nothing is written

### Requirement: Several accounts in one file
A reader SHALL return one statement per account the file holds, each with the account's currency, its rows and what
identifies it in the file: its IBAN and the masked numbers of its cards, as far as the file states them. Several cards
on one account SHALL stay one account.

#### Scenario: Two cards, two accounts
- **WHEN** a file holds rows of two cards that are separate accounts
- **THEN** the reader returns two statements, and each row is in exactly one of them

#### Scenario: Two cards on one account
- **WHEN** a file names one IBAN with two cards on it
- **THEN** the reader returns one statement for that account, with both masked card numbers

### Requirement: Statements find their accounts
Each statement in a file SHALL be matched to an account of the connection by IBAN, else by a masked card number,
else offered as a new account. The comparison SHALL be shown per account before anything is written, and the write
SHALL cover every account of the file or none.

#### Scenario: A second upload of the same file
- **WHEN** a file whose accounts were created by an earlier upload is uploaded again
- **THEN** every statement is matched to its existing account and no new account is offered

#### Scenario: One account is blocked
- **WHEN** one of the file's accounts would leave a gap in its coverage or has another currency
- **THEN** the comparison names that account and the reason, and no account of the file is written

### Requirement: Re-uploads add only what is new
For every provider, uploading a file again, or a file that overlaps an earlier one, SHALL add only the rows the
account does not have. A row SHALL get the same id in every upload of the same statement. This SHALL hold for
statements whose times are stated to the minute.

#### Scenario: The same file twice
- **WHEN** the same statement file is uploaded twice
- **THEN** the second upload adds no row and changes no figure

#### Scenario: Times to the minute
- **WHEN** a statement states times to the minute and has two equal rows in one minute
- **THEN** both rows are stored, and a re-upload adds neither again

### Requirement: Problems are codes
A reader SHALL report why a document was not taken as a code the screen words: unknown format, ambiguous, another
bank, a kind of statement not supported, a language whose service texts the rules do not know, no rows, or a row
that does not read with its place in the document. It SHALL NOT report text from the file.

#### Scenario: A row that does not read
- **WHEN** one row of an otherwise valid statement has an amount that does not read
- **THEN** the file is refused with the bad-row code and the row's place, and nothing is written
