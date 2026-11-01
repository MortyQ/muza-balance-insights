# core-budget-metrics Specification

## Purpose
Defines the budget metrics the app derives from spending, income and kinds — the 50/30/20 shares, the fixed and debt
shares and the reserve in months — with their reference ranges, all computed in core by formulas.

## Requirements

### Requirement: Income split 50/30/20
For a finished month with income the system SHALL give essential spending, wants spending and what is left
(income − essential − wants) as whole-percent shares of the income; savings-kind spending (investments) stays in what
is left. The reference SHALL be 50 / 30 / 20. Without income in the month the split SHALL be absent.

#### Scenario: A month within the guide
- **WHEN** income is 100 000 ₴, essential 45 000 ₴, wants 25 000 ₴, investments 5 000 ₴
- **THEN** the split reads 45% / 25% / 30%

#### Scenario: Spent more than earned
- **WHEN** essential and wants together exceed income
- **THEN** what is left is negative and shown as such

### Requirement: Fixed and debt shares
For a finished month with income the system SHALL give fixed spending (categories with the fixed flag) and the
«installments and loans» category as whole-percent shares of income. The fixed share SHALL be compared with 50–60%
(above: little room), the debt share with 30% (above: high).

#### Scenario: Debt share
- **WHEN** income is 100 000 ₴ and «рассрочки и кредиты» is 12 000 ₴
- **THEN** the debt share reads 12%, within the guide

### Requirement: Reserve in months
The system SHALL give the reserve as the view's own money now (cards and jars, credit money not counted, other
currencies at today's rate, currencies without a rate left out) divided by the median essential spending of the usual
whole months, to one decimal. The reference SHALL be 3–6 months. With fewer than 3 whole months, or a zero median, the
reserve SHALL be absent. It SHALL NOT depend on the shown month being finished.

#### Scenario: Three and a half months
- **WHEN** own money is 70 000 ₴ and the usual essential month 20 000 ₴
- **THEN** the reserve reads 3.5 months, within the guide

#### Scenario: Too little history
- **WHEN** the data covers 2 whole months
- **THEN** there is no reserve
