# desktop-ui-wording Specification

## Purpose
Defines the shared rules of the interface's words: one term for a bank operation, how a change of an amount is said,
and that a figure or mark whose meaning is not obvious explains itself.

## Requirements

### Requirement: One term for a bank operation
Every screen, dialog and menu SHALL call a bank operation a «transaction» in each language (uk «транзакція», ru
«транзакция», en «transaction»), with the language's full plural forms, and SHALL NOT abbreviate it. Headings that
name lists of them SHALL use the same word («Transactions», «Recent transactions»).

#### Scenario: A count on home
- **WHEN** «Spending» shows a person with five bank operations in the month
- **THEN** it reads «5 transactions» in English, «5 транзакцій» in Ukrainian and «5 транзакций» in Russian, never «5 op.»

#### Scenario: The category screen's list
- **WHEN** the category screen lists its operations
- **THEN** the list is headed «Transactions»

### Requirement: A change says money first
Every change of an amount against a base (a previous month or week, a usual month or day) SHALL be said as the
difference in money with its direction, then: below twice the base the percent; from twice up to ten times the base
the ratio «×N» with one decimal; above ten times nothing, with the base in the hint. Under 3% of the base it SHALL
read «as before», and from a base of zero as new.

#### Scenario: Five times the previous month
- **WHEN** a category spent 131 € in September against 26 € in August
- **THEN** its chip reads «+105 € (×5.0)» and its hint «105 € more than in August (26 €)»

#### Scenario: A small change
- **WHEN** a category spent 1 090 ₴ against 1 000 ₴ in the previous month
- **THEN** its chip reads «+90 ₴ (9%)»

#### Scenario: One big payment against a tiny day
- **WHEN** today has 3 000 ₴ spent against a usual day of 50 ₴
- **THEN** the change reads «+2 950 ₴», with «usual day 50 ₴» in its hint, and no ratio or percent

### Requirement: Blocks say what they count
Home's «Balance», «Month pace», «Today» / «This week», «Spending» and «Insights» blocks, and «Analytics»' totals,
«Income and spending» chart, changes list and category views SHALL each have a «?» that says in two or three sentences
what the block counts and what it leaves out, as dictionary texts reachable by keyboard and read by screen readers.

#### Scenario: Home «Spending»
- **WHEN** the user opens the «?» of «Spending»
- **THEN** it says spending is what was charged minus refunds and that own transfers and income are left out

### Requirement: Non-obvious figures explain themselves
The «pending» mark of a transaction, the change in the number of transactions, an average «a day», «Compared with …»
and the balance card's «Free» SHALL each carry a hint saying what they mean, reachable by keyboard and read by screen
readers.

#### Scenario: The pending mark
- **WHEN** the user points at or focuses the «pending» mark of a transaction on the category screen
- **THEN** a hint says the bank has not finalised the transaction yet and its amount may still change

#### Scenario: The count change
- **WHEN** «Spending» shows «−4» by the number of transactions in September
- **THEN** its hint reads «4 fewer transactions than in August»

### Requirement: No empty columns
A transactions table SHALL leave out its «Marks» column when no row of the shown list has a mark, and give its width to
the other columns; it SHALL show the column again as soon as a shown row has one.

#### Scenario: A list without marks
- **WHEN** the category screen lists transactions of which none is pending, a refund, a fee, in a foreign currency,
  with cashback or a manual choice
- **THEN** the table has no «Marks» column

#### Scenario: Filtering to a payee with a refund
- **WHEN** the user picks a payee whose transactions include a refund
- **THEN** the «Marks» column is shown with the refund's mark
