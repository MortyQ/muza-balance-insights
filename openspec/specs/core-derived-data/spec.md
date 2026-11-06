# core-derived-data Specification

## Purpose

Defines which values the core derives from stored operations and keeps on each row, when each is refreshed, and the
guarantee that statistics read stored values that always equal their definitions.

## Requirements

### Requirement: Derived values are stored per operation
The core SHALL store on each operation the values derived from stored data: the internal-transfer mark and its rule
and pair, the implicit fee of a cross-bank transfer (none when there is none), the refund pair, the category, the
scope, and the category the operation gets when it crosses to a disabled account (none when it does not cross). A
statistic SHALL read these stored values. It SHALL NOT recompute them while answering.

#### Scenario: A statistic does no derivation work
- **WHEN** any spending, income, search or exchange-rate statistic is asked for a period
- **THEN** it answers from the stored derived values, without classifying operations or reading the bank's original payload

#### Scenario: A crossing operation counts as ordinary
- **WHEN** an enabled account's operation is paired with, or names by IBAN, an account that is disabled
- **THEN** its stored crossing category is the category it gets as an ordinary operation
- **AND** statistics count it as ordinary spending or income, exactly as the domain rules for disabled accounts state

#### Scenario: The implicit fee is stored on the sending row
- **WHEN** a cross-bank pair is found whose debit exceeds its credit by more than the stated commission
- **THEN** the difference is stored on the debit row as its implicit fee
- **AND** when a later re-derivation no longer finds the pair, the stored fee is cleared

#### Scenario: A cross-bank pair crosses to a disabled account
- **WHEN** one account of a cross-bank pair with an implicit fee is disabled
- **THEN** the enabled side counts as an ordinary operation, its whole amount included, and no transfer fee is counted

### Requirement: Crossing values follow the enabled accounts
The stored crossing values SHALL be refreshed whenever the set of enabled accounts can change: an account toggle,
writing accounts during an import or a statement upload, a new coverage record for an account, removing a connection,
and opening a database after a migration. When nothing they depend on changed, the refresh SHALL do no row writes.

#### Scenario: Disabling an account
- **WHEN** the user disables an account
- **THEN** the next statistic already treats transfers to that account as ordinary operations

#### Scenario: An empty jar becomes enabled by the auto rule
- **WHEN** an import raises a jar's balance above zero, so the auto rule enables it
- **THEN** transfers between that jar and enabled accounts are internal again in the next statistic

#### Scenario: Nothing changed
- **WHEN** the refresh runs and the enabled accounts and their identifying fields are the same as at the last refresh
- **THEN** no operation row is written

### Requirement: Stored values equal a full re-derivation
After every write path (import window, end of import, statement upload, toggle, category or scope rules, connection
removal), the stored derived values of every operation SHALL equal what a full re-derivation of the whole database
produces.

#### Scenario: Incremental equals full
- **WHEN** an import has finished and its incremental derivation ran
- **AND** a full re-derivation then runs on a copy of the same database
- **THEN** no derived value of any operation differs between the two

### Requirement: Re-derivation after an import is incremental
At the end of an import the core SHALL re-derive only the time spans the import touched. It SHALL run a full
re-derivation only when the accounts' IBANs, jar titles or card types changed during the import, when deriving a
committed window failed, or when the category rules changed since the last full re-derivation of this database.
A statement upload SHALL rely on its window's derivation, with a full pass only when that failed or when the upload
wrote an IBAN or a card number its accounts did not have, or when the category rules changed. Explicit re-derivation (recategorize, connection removal)
SHALL stay a full pass.

#### Scenario: Routine auto-sync
- **WHEN** an auto-sync re-reads the current month and no IBAN, jar title or card type changed and the rules are the same
- **THEN** only the spans of the committed windows, widened by the pairing windows, are re-derived

#### Scenario: A window's derivation failed
- **WHEN** a window was committed but deriving it failed
- **THEN** the end of the import runs a full re-derivation

#### Scenario: A new IBAN or jar title appears
- **WHEN** the import writes an IBAN or a jar title that was not there before
- **THEN** the end of the import runs a full re-derivation

#### Scenario: New category rules
- **WHEN** an update changed the category rules and the next import or auto-sync finishes
- **THEN** it runs one full re-derivation, and the following imports are incremental again

#### Scenario: Statement upload
- **WHEN** a statement file is uploaded and its window's derivation succeeds
- **THEN** no further re-derivation runs, and the stored values equal a full re-derivation
- **AND** when that derivation fails, a full re-derivation runs before the upload reports success

#### Scenario: A statement brings an IBAN
- **WHEN** a statement upload creates an account with an IBAN, or adds one to an existing account
- **THEN** a full re-derivation runs before the upload reports success, so other banks' rows that name that IBAN become transfers

### Requirement: The category rules have a version
The category rules SHALL carry a version that changes whenever a change to them can give an existing operation another
category. The database SHALL record the version its last full re-derivation used; a database that never recorded one
SHALL count as an older version. Every full re-derivation SHALL record the current version.

#### Scenario: An upgraded app
- **WHEN** the app with new rules opens a database derived with older rules
- **THEN** the database reads as needing a full re-derivation until one runs

#### Scenario: Recategorize
- **WHEN** recategorize runs on a database with an older version
- **THEN** it records the current version

### Requirement: Transport by MCC
An operation with MCC 4111 (local and suburban commuter transport) or 4789 (transportation services) and no stronger
rule SHALL get the «Taxi and transport» category; a manual category, a payee's category and a transfer mark SHALL still
win over it.

#### Scenario: A metro fare
- **WHEN** a card payment has MCC 4111 and no manual category
- **THEN** its category is «Taxi and transport»

#### Scenario: A manual category
- **WHEN** the user set a 4789 payment to «Travel»
- **THEN** it stays «Travel» after a full re-derivation
