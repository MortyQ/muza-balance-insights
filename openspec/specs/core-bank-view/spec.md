# core-bank-view Specification

## Purpose
Defines what the core's statistics mean when a caller restricts them to some banks: which accounts and rows count, how
transfers between banks and their fees are counted, and how the completeness of a period is decided for that view.

## Requirements

### Requirement: A bank view counts only the chosen banks' accounts
The spending, income, balance, line and regular-payment reads SHALL accept an optional, non-empty list of providers.
With it, only the enabled accounts of connections of those providers SHALL count; without it every bank SHALL count,
exactly as before. The list SHALL combine with the participant filter: both must hold.

#### Scenario: One bank of three
- **WHEN** Monobank, PrivatBank and A-Bank accounts have spending in a month and the caller asks for PrivatBank only
- **THEN** the month's spending holds PrivatBank's rows only

#### Scenario: No list
- **WHEN** the caller passes no providers
- **THEN** every figure equals the one it was before this change

#### Scenario: Bank and person together
- **WHEN** the caller asks for one participant and Monobank only
- **THEN** only that participant's Monobank accounts count

#### Scenario: An invalid list
- **WHEN** the caller passes an empty list or an unknown provider
- **THEN** the read fails with a filter error and returns nothing

### Requirement: Bank views add up to the whole
For the same period, scope and participant, the spending and the income of a set of disjoint bank views covering every
bank SHALL add up, per category and currency, to the view of all banks.

#### Scenario: Three single-bank views
- **WHEN** the spending of Monobank alone, PrivatBank alone and A-Bank alone is added per category and currency
- **THEN** it equals the spending of all three banks

### Requirement: Own transfers between banks stay transfers
A transfer that the derivation marked internal SHALL stay out of spending and income in every bank view, also when the
other half of the pair belongs to a bank outside the view. A family transfer SHALL follow the participant filter's
rules, whatever banks are chosen.

#### Scenario: The other bank is hidden
- **WHEN** the user moved money from Monobank to their own PrivatBank card and the view is Monobank only
- **THEN** the debit is neither spending nor a transfer to anyone, and Monobank's spending is unchanged by it

#### Scenario: A family transfer to another bank
- **WHEN** one person sends money from Monobank to another person's A-Bank card and the view is that sender, Monobank
  only
- **THEN** the debit counts as spending «to family», as it does without the bank filter

### Requirement: The implicit fee belongs to the bank the money left
The implicit fee of a cross-bank transfer SHALL count in a bank view exactly when the bank of the debit is in it.

#### Scenario: The receiving bank alone
- **WHEN** a transfer from Monobank to PrivatBank carries an implicit fee and the view is PrivatBank only
- **THEN** no fee line appears in that view

#### Scenario: The sending bank alone
- **WHEN** the same transfer and the view is Monobank only
- **THEN** the fee line appears in «комиссии за переводы», as in the all-banks view

### Requirement: Completeness of a period follows the chosen banks
With a list of providers, whether a period is complete, its covered days and its pending holds SHALL be decided by the
chosen banks' accounts only, with the live-connection rule applied among them: their token connections decide while any
of them has imported data, else every chosen account.

#### Scenario: Only a statement bank chosen
- **WHEN** Monobank (token) reaches today, PrivatBank's statement ends three days ago and the view is PrivatBank only
- **THEN** the month in progress is complete up to PrivatBank's last day, not today

#### Scenario: A token bank among the chosen
- **WHEN** the view is Monobank and PrivatBank in the same situation
- **THEN** the month in progress is complete up to today, and PrivatBank's rows count as they are

### Requirement: The spending grid can be split by bank

The spending grid SHALL accept an option to split its cells by bank. With it, each cell SHALL also carry the bank of
its account, and for every currency, bucket and category the split cells SHALL add up to the cell the grid gives
without the option. Without the option the grid SHALL be unchanged.

#### Scenario: Two banks in one category

- **WHEN** a category has spending on a Monobank and a PrivatBank account on one day and the grid is split by bank
- **THEN** that day and category give one cell per bank, and their sums equal the unsplit cell

#### Scenario: An own transfer and its fee

- **WHEN** money is sent from one own bank to another with a fee and the grid is split by bank
- **THEN** the transfer is in no cell and the fee is in the sending bank's «Transfer fees» cell
