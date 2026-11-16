# Spec Delta

## Purpose

Describes how the server takes, keeps and uses a bank API token: the public-facing part can only put it away, the
import worker alone can open it, it is never shown again, and it is removed whenever its owner or its household
goes.

## ADDED Requirements

### Requirement: A token is sealed on arrival and never returned

The server SHALL check a submitted token's shape, seal it at once so that only the import worker can open it, and
store only the sealed form. No method SHALL return a token or any part of it; clients get a status only.

#### Scenario: A token is entered

- **WHEN** a member enters a token of the right shape for a connection
- **THEN** the answer is the connection with the status «checking», and no later answer of any method contains the
  token

#### Scenario: A token of the wrong shape

- **WHEN** the submitted value does not fit the bank's credential shape
- **THEN** it is refused before anything is stored

### Requirement: The public-facing process cannot open a stored token

Opening a sealed token SHALL need a key that only the import worker has. The process that answers client requests
SHALL NOT hold that key and SHALL NOT contain the code path that opens a token.

#### Scenario: The public-facing process is taken over

- **WHEN** an attacker reads everything the public-facing process can read — its memory, its secrets and the
  database
- **THEN** they obtain no stored bank token in a usable form

#### Scenario: The code path is added by mistake

- **WHEN** a change makes the public-facing entry import the token-opening code
- **THEN** a test fails before the change can ship

### Requirement: A sealed token is bound to its household and connection

A sealed token SHALL carry the household and the connection it was entered for. The import worker SHALL use a token
only in a job for that household and connection.

#### Scenario: A sealed token is copied to another connection

- **WHEN** one connection's sealed token is copied into another household's connection row
- **THEN** the worker refuses to use it there and reports the connection as «token needed»

### Requirement: A new token is checked against the bank before it is trusted

After a token is stored, the worker SHALL ask the bank who it belongs to and report one of: accepted, rejected by
the bank, another holder than the connection's, a holder already connected in this household. A token that is not
accepted SHALL be deleted.

#### Scenario: A token of another person

- **WHEN** a token is entered for a connection whose data belongs to another bank client
- **THEN** the client is told «another holder», nothing of that client's data is written, and the token is deleted

#### Scenario: The same holder twice

- **WHEN** a token is entered whose holder is already connected in the household
- **THEN** the client is told «already connected» and the token is deleted

### Requirement: A token can be kept for one run only

A member SHALL be able to enter a token for a single import. The server SHALL delete it when that run ends, whatever
its result, and scheduled refreshes SHALL skip that connection.

#### Scenario: A one-run token

- **WHEN** a member starts an import with a token marked for one run and the run finishes
- **THEN** the stored token is gone and the connection shows «token needed» for the next import

### Requirement: Tokens are deleted with what they belong to

The server SHALL delete a stored token when its connection is removed, when the member who entered it leaves or is
removed, when the household is deleted, and when the bank rejects it. Deleting the token SHALL come before the
action is reported done.

#### Scenario: A connection is removed

- **WHEN** a member removes a connection after a fresh passkey confirmation
- **THEN** the stored token is deleted first, then the connection's data

### Requirement: Tokens stay out of household data, exports, logs and events

A token SHALL NOT be written to the household's data, an export, a log line, the audit trail, a job's stored
arguments or an event. The request that carries a token SHALL NOT have its body logged.

#### Scenario: Searching for a token after it was entered

- **WHEN** a marker token is entered in a test and every log, event, job row, audit row and the household's data is
  searched for it
- **THEN** it is found nowhere in readable form

### Requirement: Entering and replacing a token is a sensitive action

Entering or replacing a token SHALL need a fresh passkey confirmation and the role `member` or `owner`, and SHALL be
recorded in the audit trail without the token.

#### Scenario: A viewer tries to enter a token

- **WHEN** a viewer submits a token
- **THEN** the call answers `forbidden` and nothing is stored
