# Spec Delta

## Purpose

Defines the reserves of the planning screen: money set aside that «Free» and «Available per day» take off while the
reserve is active.

## ADDED Requirements

### Requirement: A reserve can be marked done
Each reserve row SHALL have a «Done» checkbox with a tooltip saying a done reserve no longer reduces «Free». A done
reserve SHALL NOT be taken off «Free» or «Available per day», SHALL stay listed dimmed, and SHALL count again when
unmarked. The mark SHALL be stored with the reserve and survive a restart.

#### Scenario: Paid reserve
- **WHEN** the user ticks «Done» on a 5 000 ₴ reserve
- **THEN** «Free» and «Available per day» grow by it at once and the row stays in the list, dimmed

#### Scenario: Unmarked again
- **WHEN** the user unticks «Done»
- **THEN** the reserve is taken off again
