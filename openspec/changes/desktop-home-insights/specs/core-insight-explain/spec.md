## ADDED Requirements

### Requirement: Main driver of a category's change
For a category whose shown month differs from its usual, the main driver SHALL be the payee whose own difference
(the shown month's net minus its median over the same whole months, a month without it counting as zero) is the largest
in the direction of the category's change. Its share SHALL be its difference over the category's difference, as a whole
percent, at most 100. Equal differences SHALL be ordered by the payee's name.

#### Scenario: One payee explains most of the growth
- **WHEN** a category is 2 000 ₴ over its usual and one payee is 1 500 ₴ over its own usual
- **THEN** that payee is the driver with 1 500 ₴ and 75%

#### Scenario: A drop
- **WHEN** a category is below its usual
- **THEN** the driver is the payee that fell the most, and a payee that grew is never the driver

### Requirement: Driver threshold
A driver SHALL be reported only when its share is at least 30%; otherwise the category SHALL have none.

#### Scenario: The change is spread thin
- **WHEN** no payee accounts for 30% of the category's difference
- **THEN** the category has no driver

### Requirement: Savings rate
The savings rate of a month SHALL be (income − net spending) / income as a whole percent, and only for a month with
income above zero. The usual rate SHALL be the median of the rates of the whole months behind the usual that have
income, and SHALL exist only with at least 3 such months. A running month SHALL have no savings rate.

#### Scenario: Spent more than earned
- **WHEN** a finished month's spending is above its income
- **THEN** its rate is negative

#### Scenario: Too few months with income
- **WHEN** only two of the usual months had income
- **THEN** there is no usual rate and no savings rate is reported
