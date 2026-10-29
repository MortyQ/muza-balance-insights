# desktop-bank-breakdown Specification

## Purpose
Shows on the category and income screens how the period's amount splits between the user's banks, the way those
screens already split it between people.

## Requirements

### Requirement: A «By bank» card on the category and income screens

The category screen and the income screen SHALL show a «By bank» card with one bar per bank that has a positive part
in the period. Each bar SHALL show the bank's mark and name, the part's amount, the number of operations and their
average, and SHALL be drawn on the largest part's scale. Bars SHALL be ordered by amount, largest first.

#### Scenario: Two banks in a category

- **WHEN** a category's operations in the period are on two banks' accounts, with the larger amount on the first bank
- **THEN** the «By bank» card shows two bars, the first bank's first and full width, the second bank's shorter in
  proportion

#### Scenario: Income screen

- **WHEN** the period's income came to accounts of two banks
- **THEN** the income screen shows a «By bank» card with a bar for each of them

### Requirement: The card appears only with two or more banks

The «By bank» card SHALL be shown only when at least two banks have a positive part in the period. With one bank, or
none, it SHALL NOT be shown.

#### Scenario: One bank only

- **WHEN** every operation of the category in the period is on one bank's accounts
- **THEN** the category screen shows no «By bank» card

#### Scenario: A bank with refunds only

- **WHEN** one bank has only refunds in the category, so its part is not positive, and one other bank has spending
- **THEN** the card is not shown, since only one bank has a positive part

### Requirement: The breakdown follows the current view

The parts SHALL be counted over the same operations the screen shows: the banks chosen in the bank filter and the
chosen person, or the whole family. A bank turned off in the bank filter SHALL NOT appear in the card.

#### Scenario: A bank turned off

- **WHEN** three banks have spending in a category and the user turns one of them off in the bank filter
- **THEN** the card shows the two remaining banks only

#### Scenario: One person

- **WHEN** the user picks a person whose spending in the category is on one bank, while the family's is on two
- **THEN** the card is shown for the family and not shown for that person

### Requirement: The parts add up to the screen's total

A bank's part SHALL be the sum of the screen's own operations on that bank's accounts, so the parts add up to the
screen's total (the category's net spending, or the period's income). An own transfer between two banks SHALL count in
no bank's part; a transfer fee SHALL count in the part of the bank the money was sent from.

#### Scenario: Parts add up

- **WHEN** a category has spending and a refund on one bank and spending on another
- **THEN** each bank's part is its spending minus its refunds, and the parts add up to the category's net amount

#### Scenario: A transfer fee

- **WHEN** the «Transfer fees» category holds the fee of a transfer sent from one bank to another
- **THEN** the fee counts in the sending bank's part only
