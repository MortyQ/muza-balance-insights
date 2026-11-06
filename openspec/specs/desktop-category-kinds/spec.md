# desktop-category-kinds Specification

## Purpose
Defines the «Categories» section of the settings screen, where the user sees and changes each spending category's
kind and fixed flag.

## Requirements

### Requirement: Categories section
The settings screen SHALL have a «Categories» section listing every spending category with its icon and name, a
three-way choice «Essential / Wants / Savings» and a «Fixed» switch, in the order of the category list. A category
changed from its default SHALL be marked so. A change SHALL apply at once and the screens that use kinds SHALL show it
without a restart. «Reset to defaults» SHALL be offered only while something is changed.

#### Scenario: Changing a kind
- **WHEN** the user picks «Essential» for «Одежда»
- **THEN** the row is marked as changed and the Insights screen's budget counts clothing as essential

#### Scenario: Reset
- **WHEN** the user presses «Reset to defaults»
- **THEN** every row shows its default and the button is gone

#### Scenario: A failed save
- **WHEN** a choice cannot be saved
- **THEN** the row returns to what is stored and a message says it was not saved

### Requirement: Link from the budget
The Insights screen's «Budget structure» card SHALL link to the section.

#### Scenario: Following the link
- **WHEN** the user clicks «Change category kinds»
- **THEN** the settings screen opens on the «Categories» section

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
