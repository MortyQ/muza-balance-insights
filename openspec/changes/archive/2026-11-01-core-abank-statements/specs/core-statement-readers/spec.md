# Spec Delta

## ADDED Requirements

### Requirement: A statement may state the credit limit
A reader SHALL pass on the account's credit limit when the file states it, in the account currency. When the file
does not state it, the reader SHALL pass no limit. On import, a stated limit SHALL be stored with the account under
the same rule as the closing balance: it is written for a new account, and later only from a statement newer than
what the account holds. An unstated limit SHALL leave the stored one as it is.

#### Scenario: A credit card's statement
- **WHEN** a statement states a credit limit and a closing balance that includes it
- **THEN** the account's own funds are the balance minus the limit, as for a Monobank credit card

#### Scenario: An older statement uploaded later
- **WHEN** a statement older than what the account already holds states another credit limit
- **THEN** the stored limit does not change

#### Scenario: A statement without a limit
- **WHEN** a statement states no credit limit
- **THEN** the account's stored limit does not change
