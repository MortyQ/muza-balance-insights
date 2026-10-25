# desktop-read-cache Specification

## Purpose

Defines how the renderer reuses answers of the data screens: a screen opened again with the same inputs shows its
numbers at once, and never shows numbers that a newer import or write has changed for longer than one quiet reload.

## Requirements

### Requirement: Answers of the data screens are reused
The renderer SHALL keep the answers of the data reads it caches, keyed by the method and its arguments. A screen whose
key has a fresh answer SHALL show it without asking main. An answer SHALL be fresh while no data change happened since
it arrived and it is younger than one minute.

#### Scenario: Switching a month back
- **WHEN** the user goes from one month to another and back within a minute, with no import or write in between
- **THEN** the first month's numbers appear at once, and main receives no new request for them

#### Scenario: Another person
- **WHEN** the user picks another person with the same month
- **THEN** the key differs, and the answer is asked for, not taken from the other person's

### Requirement: Stale answers are shown and replaced
An answer that is no longer fresh SHALL be shown at once while the screen asks main again in the background, without
the loading state. The new answer SHALL replace it when it arrives. An answer to an older request SHALL never replace
a newer one.

#### Scenario: After an import window
- **WHEN** an imported window arrives and the user opens a month seen before
- **THEN** the earlier numbers appear at once and are replaced by the new ones, without a loading state in between

#### Scenario: Today's numbers later in the day
- **WHEN** the user returns to the home screen more than a minute after its last answer
- **THEN** it shows that answer and asks main again

### Requirement: Every data change invalidates
A data change SHALL make every kept answer stale. Data changes are: a successful call of any method that writes, a
refresh of the data status (an imported window, the end of an import), and «Delete all data».

#### Scenario: A reserve is added
- **WHEN** the user adds a reserve and then opens the home screen
- **THEN** the month overview is asked for again, not served fresh from before the reserve

#### Scenario: An account is turned off
- **WHEN** the user turns an account off and opens a screen seen before
- **THEN** that screen's kept answer is stale and is replaced

### Requirement: The cache stays in memory and is bounded
Kept answers SHALL live only in the renderer's memory. They SHALL never be written to storage. The cache SHALL hold a
bounded number of answers and drop the least recently used one first. A failed call SHALL never be kept. The lock's
reload SHALL leave nothing behind.

#### Scenario: Many screens
- **WHEN** more distinct reads are made than the cache holds
- **THEN** the least recently used answers are dropped, and they are asked for again when needed

#### Scenario: The app locks
- **WHEN** the app locks
- **THEN** the renderer reloads and no kept answer survives, including any line with the bank's text

#### Scenario: A failed read
- **WHEN** a read fails
- **THEN** nothing is kept for its key, and the screen shows the error as it does today
