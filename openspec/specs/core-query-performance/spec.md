# core-query-performance Specification

## Purpose

Sets the read-path guarantees of the core and the desktop's data service: what statistics scan, how many queries a
screen costs, and the measured budgets a synthetic dataset must meet, so speed does not erode as banks are added.

## Requirements

### Requirement: The bank's original payload is kept apart
The bank's original item of each operation SHALL be stored outside the table that statistics scan, keyed by the
operation. It SHALL be kept for re-processing and SHALL be written in the same transaction as its operation, and it
SHALL NOT be read by any statistic.

#### Scenario: Import keeps the payload
- **WHEN** an import window is committed, or a statement file is uploaded
- **THEN** every upserted operation has its original item stored alongside it, written atomically with the operation

#### Scenario: Existing data after the update
- **WHEN** a database created before this change is opened
- **THEN** every operation keeps its original item and its derived values, and the figures of every statistic are unchanged

### Requirement: Period queries do not scan every operation
A statistic over a period SHALL use an index on operation time to read only rows in that period. Checks of query
plans SHALL fail when such a statistic falls back to a full scan of the operations table.

#### Scenario: One month of spending
- **WHEN** spending for one month is asked for
- **THEN** the query plan reads operations through an index on time and contains no full scan of the operations table

### Requirement: Grouping by day or month is one pass
Grouping a period by days or months of a time zone SHALL be done in one query whose cost grows with the rows and the
buckets added together, not multiplied, and it SHALL stay right across daylight-saving changes.

#### Scenario: A year by day
- **WHEN** spending for twelve months is grouped by day
- **THEN** one query answers it, and each row is matched to its bucket without a per-row scan of all buckets

### Requirement: Screens ask for grouped results
The desktop's overviews SHALL get multi-month, multi-day, multi-person and multi-account figures from grouped queries.
The number of statistic queries a screen runs SHALL NOT grow with the months of history, the people or the accounts.

#### Scenario: The usual month of the «Spending» block
- **WHEN** the «Spending» block needs up to six whole months before the shown one
- **THEN** their spending by category and their income come from one grouped query each, not one per month

#### Scenario: Balances of a family
- **WHEN** the month overview needs the balances of every account at two instants
- **THEN** each instant is answered for all accounts by one query, not by queries per account

### Requirement: Figures do not change
The changes to the read path SHALL NOT change any figure, label or list that the desktop screens, the MCP tools or
the analysis copy show for the same database.

#### Scenario: Same answers before and after
- **WHEN** the existing tests of statistics, overviews and MCP tools run against the new read path
- **THEN** they pass without changing their expected values

### Requirement: Performance budgets on synthetic data
The core SHALL ship a generator of fictional operations and a benchmark that measures the main statistics on an
encrypted file database with a disabled account. Each measured case SHALL have a budget. The benchmark SHALL report a
failure when a case exceeds its budget. The generator SHALL NOT use any real data.

#### Scenario: Budget exceeded
- **WHEN** a change makes a measured case slower than its budget on the reference dataset
- **THEN** the benchmark run fails and names the case, its time and its budget
