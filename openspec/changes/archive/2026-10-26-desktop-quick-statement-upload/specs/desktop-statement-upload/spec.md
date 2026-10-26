# Spec Delta

## Purpose

Lets the user refresh a bank connected by statement files in one action from the data screens: the app finds the
file's bank and connection by itself and adds only what is new.

## ADDED Requirements

### Requirement: Upload from the data screens
The data screens SHALL offer «Upload statement», and SHALL take a statement file dropped onto the window. Both SHALL
start the same flow without the user choosing a connection first.

#### Scenario: The button on home
- **WHEN** the user presses «Upload statement» on home and picks a file
- **THEN** the file is read and its comparison is shown

#### Scenario: A dropped file
- **WHEN** the user drops a statement file onto a data screen
- **THEN** the same flow starts as with the button

#### Scenario: Several files dropped
- **WHEN** the user drops more than one file
- **THEN** nothing is read and the screen says one file at a time

### Requirement: The connection is found from the file
The bank SHALL be the one whose reader picks the file. With exactly one file connection of that bank it SHALL be used;
with several the user SHALL pick one; with none the user SHALL be offered to add one, and nothing SHALL be written
until a connection is chosen or added.

#### Scenario: One PrivatBank connection
- **WHEN** a PrivatBank statement is uploaded and the user has one PrivatBank file connection
- **THEN** the comparison is shown against that connection's accounts with no question asked

#### Scenario: No connection of that bank
- **WHEN** a PrivatBank statement is uploaded and there is no PrivatBank connection
- **THEN** the user is offered to add a PrivatBank file connection, and after adding it the comparison is shown

#### Scenario: A bank connected by token only
- **WHEN** a Monobank statement is uploaded and Monobank is connected only by token
- **THEN** the comparison is shown as a check and cannot be written

### Requirement: Only new rows are written
After the comparison, one confirmation SHALL write every account of the file or none, adding only rows the accounts do
not have.

#### Scenario: Refreshing with a longer statement
- **WHEN** a statement overlapping the last upload is uploaded
- **THEN** the comparison counts only the new rows and writing adds only them

### Requirement: The renderer never sees the file
The renderer SHALL NOT receive a dropped or picked file's path, name or content; only counts, dates, currencies, card
types, last four card digits, the bank and problem codes.

#### Scenario: A dropped file
- **WHEN** a file is dropped onto the window
- **THEN** its path goes from the preload to main only, and the screen gets the same view as with the button
