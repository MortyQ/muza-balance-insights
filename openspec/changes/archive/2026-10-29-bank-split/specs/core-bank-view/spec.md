# Spec Delta

## ADDED Requirements

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
