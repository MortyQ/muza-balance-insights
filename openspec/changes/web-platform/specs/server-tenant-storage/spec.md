# Spec Delta

## Purpose

Describes where a household's data lives on the server and what protects it: every row owned by exactly one
household, isolation enforced by the database itself, encryption at rest and its stated limits, export and deletion.

## ADDED Requirements

### Requirement: Every row of household data belongs to one household

Every table that holds household data SHALL record, on every row, the household it belongs to, and that value SHALL
never be null or changed. Tables that are not household data SHALL hold no amount, bank description, comment,
counterparty, IBAN, card number or person's name.

#### Scenario: A new data table without an owner

- **WHEN** a table for household data is added without the household on its rows
- **THEN** a structure test fails before the change can ship

#### Scenario: The control tables are searched for bank data

- **WHEN** every column outside the household data tables is listed
- **THEN** none of them is meant to hold household data, and a structure test fails if such a column is added

### Requirement: The database refuses another household's rows

The database SHALL return and accept only the rows of the household a transaction was opened for, for every
household data table and for every statement the running service can issue. A transaction opened for no household
SHALL see no row and SHALL not be able to write one.

#### Scenario: A statement that forgets the household

- **WHEN** a statement with no household condition runs in a transaction opened for household A
- **THEN** it returns only A's rows

#### Scenario: No household was set

- **WHEN** the running service's database role queries a household data table without a household set
- **THEN** it gets no rows, and an insert is refused

#### Scenario: Writing into another household

- **WHEN** a transaction opened for household A tries to insert or update a row marked as household B's
- **THEN** the database refuses it

### Requirement: The household of a transaction never carries over

The household a transaction was opened for SHALL end with that transaction. A database connection reused for
another call SHALL start with no household.

#### Scenario: A pooled connection is reused

- **WHEN** a connection that served household A is taken from the pool for a call that sets no household
- **THEN** that call sees no row of A

### Requirement: The running service cannot switch isolation off

The database roles the service runs as SHALL NOT own the household data tables and SHALL NOT be able to bypass or
alter the isolation rules. Changing the schema SHALL need a separate role that the running service does not have.

#### Scenario: The running role tries to disable isolation

- **WHEN** the service's role issues a statement that would disable or drop an isolation rule
- **THEN** the database refuses it

### Requirement: Ids and uniqueness are scoped to a household

Two households SHALL be able to hold rows with the same bank-given id, the same person colour and the same bank
client, without seeing or blocking each other. A row SHALL NOT be able to reference a row of another household.

#### Scenario: One bank account in two households

- **WHEN** the same bank account is connected in two households and both import it
- **THEN** each household holds its own copy of the account and its operations, and neither import fails

#### Scenario: A colour taken elsewhere

- **WHEN** a person in household A takes a colour that a person in household B already has
- **THEN** it is accepted

### Requirement: A call can reach only the household it passed the gate for

The server SHALL open a household's data only for a call that passed the gate for that household, or for a job
that belongs to it. A handler SHALL have no way to name another household.

#### Scenario: A member of one household asks for another

- **WHEN** a signed-in user calls a data method with the id of a household they are not in
- **THEN** the call answers `forbidden` before anything of that household is read

### Requirement: Statements are never built from client text

Every statement the service runs SHALL keep values out of its text: what a client sent SHALL reach the database
only as a parameter.

#### Scenario: A search with SQL in it

- **WHEN** a member searches for a text that contains quotes and SQL keywords
- **THEN** it is treated as text to find, and no statement's shape changes

### Requirement: Bank text is opaque to the database

No statement SHALL filter, group, join or sort by a bank description, comment, counterparty name, IBAN, card number,
holder name or raw bank row. Those values SHALL be read and written whole, and matched in the service's code.

#### Scenario: A statement that searches descriptions in the database

- **WHEN** a statement comparing or ordering by one of those columns is added
- **THEN** a structure test fails

### Requirement: Storage is encrypted at rest and its limits are stated

The database's storage SHALL be encrypted at rest, and every copy that leaves the host SHALL be encrypted before it
leaves with a key that is not stored with it. The web edition's texts SHALL say that the service's operator and its
hosting provider can technically read the data, and SHALL NOT claim otherwise.

#### Scenario: The backup storage is read by someone else

- **WHEN** a third party reads the backup bucket
- **THEN** it finds only data it cannot decrypt

#### Scenario: The storage text

- **WHEN** the «Storage» text of the web edition is read in each language
- **THEN** it says who can read the data, and promises neither that the operator cannot nor that changes are
  detected

### Requirement: A schema change is applied before the new version serves

A release that changes the schema SHALL apply the change before the new version answers calls, SHALL have tried it
on a copy of the latest backup first, and SHALL leave the previous version serving when the change fails.

#### Scenario: A migration fails

- **WHEN** a release's schema change fails halfway
- **THEN** nothing of it stays applied, the previous version keeps serving, and the operator is told

### Requirement: An owner can export the household

An owner SHALL be able to download the household's data as one file protected by a passphrase they choose, after a
fresh passkey confirmation. The export SHALL contain no bank token and no row of another household, and SHALL not
be kept on the server after the download.

#### Scenario: Export

- **WHEN** an owner asks for an export and sets a passphrase
- **THEN** they receive one file that opens only with that passphrase and holds the household's data

#### Scenario: Looking for tokens in an export

- **WHEN** an export is opened and searched
- **THEN** it contains no bank credential

### Requirement: Deleting a household removes every row of it, and stays deleted

Deleting a household SHALL remove its stored bank tokens and then every row of it in every table. Its data SHALL be
gone from backups when they expire, and a restore from a backup taken before the deletion SHALL delete it again
before the service answers calls.

#### Scenario: After a deletion

- **WHEN** a household was deleted and every table is searched for its id
- **THEN** no row names it

#### Scenario: A restore after a deletion

- **WHEN** the service is restored from a backup taken before a household was deleted
- **THEN** that household is deleted again before any call is answered, and it is offered to no user
