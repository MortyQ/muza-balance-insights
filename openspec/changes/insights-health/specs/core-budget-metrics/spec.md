## ADDED Requirements

### Requirement: Shares by month
For each whole month of the usual and for the shown month when it is finished, the system SHALL give the left share
(income − essential − wants, as for the split) and the wants share of that month's income, whole per cent, by the same
fold and kinds as the split. A month without income SHALL have no shares.

#### Scenario: One month
- **WHEN** a month has 50 000 ₴ of income, 22 000 ₴ essential and 16 000 ₴ wants
- **THEN** its left share is 24% and its wants share 32%

#### Scenario: No income
- **WHEN** a usual month has no income
- **THEN** it has no shares

### Requirement: Standing against a guide
The system SHALL place a figure against its guide as `within`, `near` or `outside`: a share is near when it is beyond
its guide by at most 5 percentage points (left 15–19% for ≥ 20%; essential 51–55%, wants 31–35%, fixed 61–65%, loan
payments 31–35%) and outside beyond that; the reserve is near from 2 months up to 3 and outside below 2; the monthly
limits are outside with any exceeded, near with none exceeded but one forecast over, within otherwise.

#### Scenario: Left share
- **WHEN** the left share is 18%
- **THEN** it is near the guide

#### Scenario: Reserve
- **WHEN** the reserve is 1.5 months
- **THEN** it is outside the guide

#### Scenario: Limits ahead
- **WHEN** no monthly limit is exceeded and one is forecast over
- **THEN** the limits are near the guide
