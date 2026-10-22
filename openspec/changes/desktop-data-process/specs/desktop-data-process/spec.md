# Spec Delta

## Purpose

Defines where the desktop app's database work runs. The data screens and their writes run in a data process of their
own, so the main process stays responsive and keeps only the gates and the secrets.

## ADDED Requirements

### Requirement: Database work runs outside the main process
Every database read and write behind the renderer's IPC methods SHALL run in a separate data process. This covers the
overviews, status, people, connections and their accounts, reserves, recurring marks, and comparing and writing a
statement. The import keeps its own worker. The main process SHALL run no query while the app is running.

#### Scenario: A long re-derivation
- **WHEN** the user turns an account off and the data process re-derives every operation
- **THEN** the main process keeps handling window events, the menu and other IPC calls during the re-derivation

#### Scenario: A screen asks for an overview
- **WHEN** the renderer asks for a month overview
- **THEN** the data process runs the queries and main only passes the validated request and the answer

#### Scenario: Launch-only work stays in main
- **WHEN** the app starts
- **THEN** main may still open the database once to decide its state and to encrypt a plain database, before the window exists

### Requirement: Main keeps the gates and the secrets
Main SHALL check every IPC call (sender, lock, database state, arguments) before the data process sees it. Main SHALL
keep the tokens, the system dialogs, the statement file and its parsing, and the lock. The data process SHALL get the
database key only in a message, never in its arguments or environment. It SHALL have no network access and no channel
to the renderer.

#### Scenario: A call while locked
- **WHEN** the app is locked and the renderer asks for an overview
- **THEN** main refuses it as today, and the data process receives nothing

#### Scenario: Adding a token connection
- **WHEN** the user adds a connection with a token
- **THEN** main checks the token's shape and keeps the token, and the data process only writes the participant and the connection

#### Scenario: Uploading a statement
- **WHEN** the user picks a statement file
- **THEN** main reads and parses it, and the data process receives the parsed operations only for compare and write, never the file's path or name

### Requirement: A closed list of methods
A call from main to the data process SHALL name one method from a fixed list. Its arguments SHALL be validated in the
data process before anything runs. Every reply SHALL be checked by main against the call it answers. No message SHALL
carry SQL or name an arbitrary function. An error SHALL reach main as a code and an error name, never as data.

#### Scenario: An unknown message
- **WHEN** the data process receives a message that is not one of the listed methods with valid arguments
- **THEN** it ignores it and runs nothing

#### Scenario: A failing query
- **WHEN** a method fails inside the data process
- **THEN** main gets a failure with the error's name only and answers the renderer with the fixed failure message, as today

#### Scenario: An answer that is a refusal
- **WHEN** a colour is taken, a statement no longer fits its account, or a connection is unknown
- **THEN** the renderer gets the same answer or error as before this change

### Requirement: The data process lifecycle
Main SHALL start the data process once the database is ready and before the first data call is answered. After a crash,
main SHALL fail the calls in flight and start the process again on the next call. A database that the data process
cannot open SHALL set the database state to unreadable, as opening in main does today.

#### Scenario: A crash during a call
- **WHEN** the data process exits while a call is in flight
- **THEN** that call fails with the fixed failure message, and the next call is answered by a new data process

#### Scenario: The key stops fitting
- **WHEN** the data process reports that the database is not readable with its key
- **THEN** the database state becomes unreadable and the renderer is shown the database recovery screen, as when opening fails in main today

#### Scenario: Today's rates change
- **WHEN** main fetches new rates
- **THEN** the next overview is computed with them

### Requirement: Stopped before the files go
Before «Delete all data» and «Start over» delete the database files, main SHALL stop the data process and wait for it to
exit. A data process that does not exit in time SHALL be killed, and the deletion SHALL wait for that exit.

#### Scenario: Delete all data
- **WHEN** the user confirms «Delete all data»
- **THEN** the data process has exited before any database file is removed

#### Scenario: Use after a wipe
- **WHEN** the renderer asks for data after «Delete all data»
- **THEN** a new data process opens the new, empty database
