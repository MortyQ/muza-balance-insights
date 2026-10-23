# Spec Delta

## Purpose

Defines when a debit in one bank and a credit in another are one transfer, so money moved between a person's own
banks is neither spending nor income, and what the fee of such a transfer counts as.

## ADDED Requirements

### Requirement: A pair across banks
A debit and a credit SHALL be one transfer across banks when their accounts belong to different providers and have
one currency, both rows look like transfers to their own providers' rules, they are at most 3 minutes apart, and the
debit exceeds the credit by no more than the fee tolerance. Each row SHALL be in at most one pair.

#### Scenario: An own transfer between two banks
- **WHEN** a person's Monobank card sends an amount and the same person's card in another bank receives it 2 minutes later
- **THEN** both rows are an internal transfer: neither spending nor income

#### Scenario: Too far apart
- **WHEN** the credit arrives 4 minutes after the debit
- **THEN** the rows are not paired and count as they would without a pair

#### Scenario: Different currencies
- **WHEN** the two accounts have different currencies
- **THEN** the rows are not paired by this rule

### Requirement: Same-bank pairs keep their rules
Pairs inside one provider SHALL keep today's rules and today's 20-second window. The cross-bank rule SHALL run after
them and SHALL take only rows they left unpaired.

#### Scenario: Existing Monobank data
- **WHEN** the database holds only Monobank accounts
- **THEN** every transfer mark and every figure is the same as before the change

### Requirement: The fee tolerance
The debit SHALL be allowed to exceed the credit by at most 5 percent of the credit. When several credits fit one
debit, the pair SHALL be chosen by the smallest time apart, then the smallest difference, then by id.

#### Scenario: Within the tolerance
- **WHEN** the debit is 3 percent larger than the credit
- **THEN** the rows are paired

#### Scenario: Above the tolerance
- **WHEN** the debit is 6 percent larger than the credit
- **THEN** the rows are not paired

#### Scenario: The closest candidate wins
- **WHEN** two credits of equal amount in another bank fit one debit, one 30 seconds after it and one 2 minutes after
- **THEN** the debit is paired with the one 30 seconds after it

### Requirement: Who the transfer is between
A cross-bank pair between accounts of one participant SHALL be an own transfer. A cross-bank pair between accounts of
two participants SHALL be a family transfer, with today's family rules.

#### Scenario: From one person to another
- **WHEN** a cross-bank pair joins one participant's card and another participant's card
- **THEN** it is a family transfer: spending «to family» for the sender and income for the receiver when one person is viewed, and excluded when the whole family is viewed

### Requirement: The fee of a cross-bank transfer
When the sending row states its own commission, that commission SHALL be the fee and SHALL count as bank fees, as
any commission does today. The rest of the difference between the debit and the credit SHALL be the implicit fee: it
SHALL count as spending in its own category for transfer fees, apart from bank fees, in every view, and the body of
the transfer SHALL stay excluded.

#### Scenario: An implicit fee
- **WHEN** an own cross-bank pair's debit exceeds its credit and the sending row states no commission
- **THEN** the difference is spending in the transfer fees category and the rest of the debit is not spending

#### Scenario: A stated commission
- **WHEN** the sending row states a commission equal to the whole difference
- **THEN** the commission is a bank fee and no transfer fee is counted

#### Scenario: The whole family is viewed
- **WHEN** a family cross-bank pair has an implicit fee and the whole family is viewed
- **THEN** the transfer's body is excluded and its implicit fee still counts as spending
