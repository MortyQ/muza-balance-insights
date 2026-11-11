# Spec Delta

## Purpose

Defines the regular income part of the income screen: what the user can count on each month, from which sources, and
what is expected next.

## ADDED Requirements

### Requirement: Regular income figure
The income screen for a month SHALL show the regular income a month (the usual amounts of the active regular income
sources at today's rates) and the share of it the active regular payments take; without a regular source it SHALL say
none was found.

#### Scenario: Salary and payments
- **WHEN** one source pays about 40 000 ₴ monthly and regular payments come to 12 000 ₴ a month
- **THEN** the header reads «Regular income: 40 000 ₴ a month» and «≈ 30% of it goes to regular payments»

### Requirement: Regular sources table
The screen SHALL list each active regular income source with its typical amount, «about monthly», the last date
received, the next expected date and a mark: «late by N days» once the expected date has passed, «amount changed by
N%» when the last amount differs from the usual by more than 10%, else «on time».

#### Scenario: A late source
- **WHEN** a source expected on the 5th has not paid by the 9th
- **THEN** its row says «late by 4 days»

### Requirement: Expected in the next 30 days
The screen SHALL list the sources expected within the next 30 days with their typical amounts and a tooltip saying the
dates come from how often each source paid before.

#### Scenario: Nothing due
- **WHEN** no source is expected in the next 30 days
- **THEN** the block says nothing is expected
