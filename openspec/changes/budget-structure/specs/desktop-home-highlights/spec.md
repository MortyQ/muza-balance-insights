## MODIFIED Requirements

### Requirement: Two slides in one tile
The third place of the «Today» / «This week» row SHALL be one tile holding «What's unusual», «Recent operations» and
«Limits» as slides. Swipe, Shift + wheel, a mouse drag and the dots under the tile SHALL move between them, snapping to
whole slides. The dots SHALL be shown only with two or more slides and SHALL work from the keyboard. «Limits» SHALL
list only limits in attention or exceeded, with a link to «Limits and goals», and SHALL be a slide only when it has
such limits and the shown month is the current one.

#### Scenario: Both have content
- **WHEN** the month has unusual lines and operations and no limit needs attention
- **THEN** the tile opens on «What's unusual», shows two dots, and a swipe or a dot shows «Recent operations»

#### Scenario: A limit needs attention
- **WHEN** a limit is in attention and the month has unusual lines and operations
- **THEN** the tile has three slides and dots

### Requirement: Slide order and single content
«Limits» SHALL be the first slide when one of its limits is exceeded; otherwise «What's unusual» SHALL be first when it
has lines, then «Recent operations», then «Limits». When only one slide has content, the tile SHALL show that one
alone, with no dots and nothing to swipe.

#### Scenario: Early in the month
- **WHEN** nothing is unusual yet, no limit needs attention and the month has operations
- **THEN** the tile shows «Recent operations» alone

#### Scenario: An exceeded limit
- **WHEN** a limit is exceeded
- **THEN** the tile opens on «Limits»
