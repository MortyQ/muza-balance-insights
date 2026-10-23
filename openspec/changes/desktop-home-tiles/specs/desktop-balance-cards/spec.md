## REMOVED Requirements

### Requirement: Stack and month panel never overlap

**Reason**: the stack, the month panel and the pace panel are no longer arranged inside one block.
**Migration**: replaced by «Balance tiles never overlap» below and spec `desktop-home-tiles`.

## ADDED Requirements

### Requirement: Balance tiles never overlap

The card stack, the month panel («In» / «Out», the month's result) and the pace panel SHALL be separate tiles on home
(spec `desktop-home-tiles`). While the row is folded, the three tiles SHALL sit in one row when they fit at their
minimum widths and reflow into fewer columns otherwise. Opening the row SHALL widen the stack's tile to the whole row and
hide the other two. No card SHALL cover any part of another tile at any width.

#### Scenario: Wide window

- **WHEN** the window is wide enough for the three tiles at their minimum widths
- **THEN** the stack, the month panel and the pace panel stand side by side as three tiles

#### Scenario: Narrow window

- **WHEN** the window is narrowed until the three tiles no longer fit in one row
- **THEN** the tiles move under one another, and no card covers another tile

#### Scenario: Row open

- **WHEN** the row is opened
- **THEN** the stack's tile takes the whole row, and the month and pace tiles are hidden and leave no empty space
