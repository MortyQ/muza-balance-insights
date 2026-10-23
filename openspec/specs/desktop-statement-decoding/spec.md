# desktop-statement-decoding Specification

## Purpose

Defines where and how the desktop app turns an uploaded statement file into the neutral document the readers take,
so that decoding an untrusted spreadsheet or PDF never runs next to the database key or the bank tokens.

## Requirements

### Requirement: Decoding runs in a process of its own
Decoding a spreadsheet or a PDF statement file SHALL run in a separate process started for that upload. That
process SHALL have no network, no database key, no bank token and no access to the database. It SHALL get only the
file's bytes and SHALL return only the neutral document. It SHALL end when the document is returned.

#### Scenario: A PDF statement is uploaded
- **WHEN** the user uploads a PDF statement
- **THEN** the PDF is decoded in the decoding process, not in the main process and not in the data process
- **AND** the decoding process ends after it answers

#### Scenario: What the decoder can reach
- **WHEN** the decoding process's code is checked
- **THEN** it reaches no network module, no database code, no Electron module and nothing of the main process
- **AND** the process starts with an empty environment

### Requirement: The format comes from the file's bytes
The app SHALL tell a spreadsheet, a PDF and a text file apart by their leading bytes, never by the extension. A text
file SHALL be decoded as UTF-8, with or without a byte order mark.

#### Scenario: A spreadsheet named as a PDF
- **WHEN** a spreadsheet file is uploaded with a `.pdf` extension
- **THEN** it is decoded as a spreadsheet

### Requirement: Decoding has fixed limits
The app SHALL refuse a file above a size limit before reading it. The decoder SHALL stop at fixed limits on pages,
cells and text items, and SHALL be stopped after a time limit. A file that hits a limit SHALL be refused with its own
code and nothing SHALL be written.

#### Scenario: A huge file
- **WHEN** the user picks a file above the size limit
- **THEN** it is refused as too large, and it is not read or decoded

#### Scenario: A decoder that does not answer
- **WHEN** decoding a file takes longer than the time limit
- **THEN** the decoding process is stopped and the upload is refused, and the app keeps working

### Requirement: The decoded document is checked before use
The main process SHALL check the decoder's answer against the neutral document's shape and the limits before any
reader sees it. An answer that does not match SHALL be refused as a failed decode.

#### Scenario: A malformed answer
- **WHEN** the decoder answers with something that is not a neutral document
- **THEN** the upload is refused and no reader runs

### Requirement: File contents stay out of the screen
The renderer SHALL NOT receive the file's bytes, the decoded document, or any text from the file. It SHALL receive the
picked bank, per account the counts of the comparison and what identifies the account to the user (card type,
currency, the last digits of a card), and refusals as codes.

#### Scenario: A comparison is shown
- **WHEN** a decoded statement is compared with the connection's accounts
- **THEN** the screen gets counts, the account's card type, currency and last card digits, and no description, name or IBAN from the file
