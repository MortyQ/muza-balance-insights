## MODIFIED Requirements

### Requirement: Slide order and single content
The slides SHALL always go in this order: «What's unusual», then «Limits», then «Recent transactions», each present only
when it has content. When only one slide has content, the tile SHALL show that one alone, with no dots and nothing to
swipe.

#### Scenario: Early in the month
- **WHEN** nothing is unusual yet, no limit needs attention and the month has operations
- **THEN** the tile shows «Recent transactions» alone

#### Scenario: An exceeded limit
- **WHEN** a limit is exceeded and the month has unusual lines and operations
- **THEN** the tile opens on «What's unusual», and the slides are «What's unusual», «Limits», «Recent transactions»

#### Scenario: A limit needs attention, nothing unusual
- **WHEN** a limit is in attention, nothing is unusual and the month has operations
- **THEN** the tile opens on «Limits», and «Recent transactions» is the second slide
