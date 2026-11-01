## ADDED Requirements

### Requirement: Two slides in one tile
The third place of the «Today» / «This week» row SHALL be one tile holding «What's unusual» and «Recent operations» as
slides. Swipe, Shift + wheel, a mouse drag and the dots under the tile SHALL move between them, snapping to whole
slides. The dots SHALL be shown only with two slides and SHALL work from the keyboard.

#### Scenario: Both have content
- **WHEN** the month has unusual lines and operations
- **THEN** the tile opens on «What's unusual», shows two dots, and a swipe or a dot shows «Recent operations»

### Requirement: Slide order and single content
«What's unusual» SHALL be the first slide when it has lines. When only one of the two has content, the tile SHALL show
that one alone, with no dots and nothing to swipe.

#### Scenario: Early in the month
- **WHEN** nothing is unusual yet and the month has operations
- **THEN** the tile shows «Recent operations» alone

### Requirement: Never empty
When neither has content, the tile SHALL stay in its place and say the month has no operations yet.

#### Scenario: A month without operations
- **WHEN** the shown month has no spending lines
- **THEN** the tile shows the no-operations text, and the row has no hole

### Requirement: Past months
«Recent operations» SHALL be shown for the current month only and SHALL NOT be requested for a past month. In a past
month, where «Today» and «This week» are not shown either, the tile SHALL hold «What's unusual» alone over the whole
row, and SHALL NOT be shown when that month has nothing unusual.

#### Scenario: A past month with unusual lines
- **WHEN** the user picks a past month that has unusual lines
- **THEN** the tile shows «What's unusual» alone across the row, with no dots

#### Scenario: A past month with nothing unusual
- **WHEN** the user picks a past month with nothing unusual
- **THEN** home shows no highlights tile and no empty text

### Requirement: Hidden with the period details
While the «Now» details are open, the tile SHALL be hidden together with «Today» and «This week».

#### Scenario: Details open
- **WHEN** the user opens the week's details
- **THEN** the details tile takes the whole row and the carousel is not shown
