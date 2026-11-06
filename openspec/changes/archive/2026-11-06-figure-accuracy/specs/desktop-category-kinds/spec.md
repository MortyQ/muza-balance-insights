## ADDED Requirements

### Requirement: Cash withdrawals switch
The «Categories» section SHALL have a «Count cash withdrawals as spending» switch above the list, on by default, with a
hint of what off does. A change SHALL apply at once on every screen that shows spending, without a restart. While it
is off, the «Cash» row SHALL stay in the list, marked as not counted. A failed save SHALL return the switch to what is
stored with a message.

#### Scenario: Turning cash off
- **WHEN** the user turns the switch off
- **THEN** home's spending, the budget and Insights drop cash withdrawals without a restart

#### Scenario: A failed save
- **WHEN** the switch cannot be saved
- **THEN** it returns to what is stored and a message says it was not saved
