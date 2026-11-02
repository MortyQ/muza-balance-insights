## MODIFIED Requirements

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

## ADDED Requirements

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
