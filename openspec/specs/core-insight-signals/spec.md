# core-insight-signals Specification

## Purpose
TBD - created by archiving change desktop-insights-page. Update Purpose after archive.

## Requirements

### Requirement: Insight severity
An insight's severity SHALL be its difference in money over the usual month's total spending: high from 10%, medium
from 4%, low below. Without a usual total above zero it SHALL be low.

#### Scenario: A large change
- **WHEN** a category is 3 000 ₴ over its usual and a usual month's spending is 20 000 ₴
- **THEN** the insight is high

#### Scenario: A small change
- **WHEN** the difference is 500 ₴ against a usual month of 20 000 ₴
- **THEN** the insight is low

### Requirement: New payees
A payee SHALL be new when it has at least 500 ₴ of net spending in the shown month and none in every usual month.
New payees SHALL be ordered by the shown month's spending, largest first, ties by name, and SHALL be at most 10.

#### Scenario: A payee seen before
- **WHEN** a payee spent anything in one of the usual months
- **THEN** it is not new

#### Scenario: A small new payee
- **WHEN** a payee first appears with 300 ₴
- **THEN** it is not listed

### Requirement: Large one-off operations
A spending operation of the shown month SHALL be a large one-off when its amount is at least 500 ₴ and at least 10% of
the usual month's total spending, and its payee's usual monthly spending (the median over the usual months) is below
half of that amount. One-offs SHALL be ordered by amount, largest first, ties by key, and SHALL be at most 10.

#### Scenario: Rent every month
- **WHEN** a large operation goes to a payee that is paid about as much every usual month
- **THEN** it is not a one-off

#### Scenario: A one-time purchase
- **WHEN** an operation of 4 000 ₴ goes to a payee with no usual spending and a usual month is 20 000 ₴
- **THEN** it is a one-off
