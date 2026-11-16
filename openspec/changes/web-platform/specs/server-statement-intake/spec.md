# Spec Delta

## Purpose

Describes statement uploads in the web edition: the file is read and parsed on the user's device, the server checks
and writes the parsed rows by the domain's rules, and the raw file is kept nowhere.

## ADDED Requirements

### Requirement: The raw file never leaves the device

The web client SHALL decode and parse a statement file on the device. The server SHALL offer no way to send it a
statement file's bytes, its name or its path.

#### Scenario: Uploading a PDF statement

- **WHEN** a member picks a PDF statement in the web client
- **THEN** the requests that follow carry parsed accounts and rows only, and no request carries the file's bytes or
  name

### Requirement: The device applies fixed decoding limits

On the device the file's kind SHALL be told by its leading bytes, never its name, and decoding SHALL keep fixed
limits on file size, unpacked size, sheets, cells, pages, text items and time, the same as the desktop decoder's. Decoding SHALL run apart
from the page, so a file that breaks the decoder cannot reach the signed-in session's page state.

#### Scenario: A zip bomb named like a spreadsheet

- **WHEN** an archive whose declared unpacked size exceeds the limit is picked
- **THEN** it is refused as «over limits» before anything is inflated, and the page stays usable

#### Scenario: A renamed file

- **WHEN** a spreadsheet statement with a `.pdf` name is picked
- **THEN** it is read as a spreadsheet

### Requirement: The server checks what it is sent

The server SHALL accept parsed statements only in the contract's shape and within its own limits — accounts per
file, files per upload, rows, text lengths, body size — and SHALL make every stored id itself. Anything else SHALL
be refused with `invalid` and nothing kept.

#### Scenario: Too many accounts

- **WHEN** a parsed file with more accounts than the limit is sent
- **THEN** it is refused with `invalid`

#### Scenario: A client sends its own ids

- **WHEN** a parsed statement names an id for a new account or operation
- **THEN** the id is ignored or the call refused; stored ids are always the server's

### Requirement: Compare and commit give the reference result

Matching an account to a connection, comparing with what is stored, the blocks that refuse a write, writing a whole
file or nothing, and re-derivation after the write SHALL give the same result as the desktop's core for the same parsed
statement.

#### Scenario: The same statement on the server and on the reference

- **WHEN** one parsed statement is committed to an empty database of the desktop's core and to an empty household
- **THEN** both hold the same accounts, operations and derived values

#### Scenario: One blocked account

- **WHEN** a file with two accounts is committed and one is blocked
- **THEN** nothing of the file is written

### Requirement: Opened statements are kept briefly and never stored readable

Parsed statements waiting for the member's choices SHALL be kept at most 10 minutes, for that member and household
only, and SHALL NOT be written in readable form to disk, a log or a job. They SHALL be dropped when the session
locks or ends.

#### Scenario: A sheet left open

- **WHEN** a member opens an upload and commits it 11 minutes later
- **THEN** the commit answers that the upload expired and asks to pick the files again

#### Scenario: Another member tries the same upload id

- **WHEN** a second member of the household sends the first member's upload id
- **THEN** it is refused as unknown

### Requirement: Clients never get back what identifies an account

Answers about an opened or compared statement SHALL carry counts, dates, the currency, the card type and the last
four card digits — never an IBAN or a full card number.

#### Scenario: A statement with an IBAN

- **WHEN** a statement that states an IBAN is opened and compared
- **THEN** no answer contains the IBAN, and the match is reported as a connection and a person

### Requirement: Nothing made from the data is stored as a file

Reports and exports SHALL be produced when asked and sent in the answer. The server SHALL keep no generated file
after the answer ends, and no storage of user files SHALL exist besides the database and its backups.

#### Scenario: After an export

- **WHEN** an export finished downloading
- **THEN** no copy of it remains on the server
