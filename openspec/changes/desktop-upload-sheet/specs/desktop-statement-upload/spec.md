# Spec Delta

## MODIFIED Requirements

### Requirement: Upload from the data screens
The data screens SHALL offer «Upload statement», and SHALL take statement files dropped onto the window. Both SHALL open
the same upload sheet over the current screen, without the user choosing a bank or a connection first. The sheet SHALL
take up to 12 files at once and SHALL show one card per account found in them.

#### Scenario: The button on home
- **WHEN** the user presses «Upload statement» on home and picks two files
- **THEN** the sheet opens over home with one card per account of both files

#### Scenario: A dropped file
- **WHEN** the user drops a statement file onto a data screen
- **THEN** the same sheet opens as with the button

#### Scenario: Several files dropped
- **WHEN** the user drops three statement files onto a data screen
- **THEN** the sheet shows every account of the three files

#### Scenario: A file no reader knows
- **WHEN** one of the dropped files is no known statement
- **THEN** its card says «Format not recognised» and is skipped, and the other cards stay ready

#### Scenario: Too many files
- **WHEN** more than 12 files are dropped
- **THEN** nothing is read and the sheet says how many files it takes at most

### Requirement: The connection is found from the file
Each account of a file SHALL go to the file connection of its bank that already has that account, matched by IBAN or
card number, and SHALL take that connection's person without asking. An account no connection has SHALL ask «Whose
account?». The chosen person's file connection of that bank SHALL take it, and when the person has none the sheet
SHALL add one for them, named after the bank. Nothing SHALL be written for an account with no target.

#### Scenario: One PrivatBank connection
- **WHEN** a PrivatBank statement of a card Serhii's PrivatBank connection already has is uploaded
- **THEN** its card shows Serhii and its comparison with no question asked

#### Scenario: A new card of a person with that bank
- **WHEN** a PrivatBank statement of a new card is uploaded and the user picks Vlada, who has a PrivatBank file connection
- **THEN** the card is compared as a new account of Vlada's connection

#### Scenario: No connection of that bank
- **WHEN** a statement of a file bank with no connection is uploaded and the user picks Serhii
- **THEN** a file connection of that bank is added to Serhii in the sheet, and the card is compared against it

#### Scenario: A bank connected by token only
- **WHEN** a Monobank statement is uploaded and Monobank is connected only by token
- **THEN** its card shows the comparison as a check and cannot be written

### Requirement: Only new rows are written
Each card SHALL show how many of its rows are new and how many are already there. One «Import» SHALL write every ready
card, and each file SHALL be written whole or not at all. Only rows the accounts do not have SHALL be added.

#### Scenario: Refreshing with a longer statement
- **WHEN** a statement overlapping the last upload is uploaded
- **THEN** its card counts only the new rows and «Import» adds only them

#### Scenario: One card waits for a person
- **WHEN** two cards are ready and a third still asks «Whose account?»
- **THEN** «Import» writes the two ready cards' files, and the third stays in the sheet

### Requirement: The renderer never sees the file
The renderer SHALL NOT receive a dropped or picked file's path, name or content. It SHALL receive only counts, dates,
currencies, card types, the last four card digits, the bank and problem codes.

#### Scenario: A dropped file
- **WHEN** files are dropped onto the window
- **THEN** their paths go from the preload to main only, and the sheet gets the same view as with the button

## ADDED Requirements

### Requirement: An upload bound to one connection
An upload started from one connection SHALL offer only its bank's files. It SHALL say the date the file should start
from: the day after that connection's data ends. Any account of the file SHALL still be matched as above.

#### Scenario: Upload from a date
- **WHEN** the user starts the upload from PrivatBank, whose data ends at 21.09
- **THEN** the dialog offers PrivatBank's statement files and the sheet says «Download a statement from 22.09»
