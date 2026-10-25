# core-provider-modules Specification

## Purpose

Defines how a bank becomes part of the app: one provider module per bank, declared in one registry that every part of
the app reads, so adding a bank is a contained task that does not touch the domain.

## Requirements

### Requirement: One registry of providers
The app SHALL learn which banks exist only from one provider registry. Each entry SHALL declare the bank's id, its
name, the ways it can be connected (API credential, statement file or both), the shape of its credential when it has
one, the network services it needs, its rules, and its statement readers. No other list of banks SHALL exist.

#### Scenario: A bank appears from its entry alone
- **WHEN** a provider entry for a new bank is added with statement files as its only way of access
- **THEN** the bank is offered when the user connects a bank, with upload as its only way
- **AND** no domain module, import step or screen outside the provider's own module was edited for it

#### Scenario: A file-only bank asks for no credential
- **WHEN** the user connects a bank whose entry declares no API access
- **THEN** no token field is shown and no credential is stored for that connection

### Requirement: Only a provider's module names its bank
Outside a provider's own module, no code SHALL name a bank or rely on one bank's conventions: no bank id literal used
as a default, no bank host, MCC convention, description text or account type. A missing provider SHALL be an error,
never a fallback to a default bank.

#### Scenario: An account without a provider
- **WHEN** an account's connection names a provider the registry does not know
- **THEN** reading or deriving that account fails with a connection error instead of using another bank's rules

#### Scenario: A screen meets an unknown bank
- **WHEN** a screen is given a connection whose provider has no entry
- **THEN** it shows a neutral bank mark and the provider id, not another bank's look

### Requirement: Ids never collide between banks
Every account and operation id a provider other than Monobank brings SHALL be stored with its provider's id as a
prefix, so ids of two banks can never be equal. Monobank's ids SHALL stay as they are stored today. Ids of rows read
from a statement file SHALL derive from the account's stored id.

#### Scenario: Two banks send the same id
- **WHEN** two providers send an operation with the same bank id
- **THEN** both operations are stored, each under its own provider's prefix

#### Scenario: Existing data is untouched
- **WHEN** a database with Monobank data is opened after the update
- **THEN** no account or operation id changes and no figure changes

### Requirement: Operations without a merchant code
An operation SHALL be allowed to have no merchant category code. The domain SHALL treat a missing code as unknown:
never as zero or any other code. Its category SHALL then come from the provider's hint, else the default category.
Grouping by code SHALL give missing codes their own group, apart from the bank fee lines.

#### Scenario: A purchase without a code
- **WHEN** a provider stores a purchase without a merchant code and gives no hint
- **THEN** the purchase is spending in the default category

#### Scenario: Grouping by code
- **WHEN** spending is grouped by merchant code over operations with and without one, some with a fee
- **THEN** operations without a code form one group of their own, and the fees stay in the fee group

### Requirement: The bank's own category
A provider SHALL be able to keep the bank's own category of an operation, as the bank states it, and map it to a
domain category in its rules. The mapping SHALL be applied when operations are derived, so a changed mapping applies
to stored operations at the next re-derivation. The bank's category text SHALL stay in the main database only.

#### Scenario: A mapped bank category
- **WHEN** an operation without a merchant code carries a bank category the provider maps to groceries
- **THEN** its category is groceries

#### Scenario: A category override still wins
- **WHEN** the user has a category override for the operation's counterparty
- **THEN** the override wins over the bank's category, as it wins over any hint today

#### Scenario: The anonymised copy
- **WHEN** the anonymised copy is rebuilt
- **THEN** it contains no bank category text

### Requirement: Every provider passes one conformance suite
Every provider in the registry SHALL pass the same contract suite on fictional fixtures: its rules answer every
question for rows with and without a merchant code, its rules and readers do no network or file access, its readers
give the same result for the same document, and the ids it produces carry its prefix.

#### Scenario: A new provider is listed
- **WHEN** a provider entry is added to the registry
- **THEN** the conformance suite runs for it without being edited, and fails if any contract rule is broken
