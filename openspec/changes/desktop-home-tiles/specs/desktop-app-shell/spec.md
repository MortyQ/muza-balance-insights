## MODIFIED Requirements

### Requirement: Home keeps its blocks and order

Home SHALL show its content as the tiles of spec `desktop-home-tiles`, in their order, with the card stack first. The
blocks' data and their own controls SHALL behave as before this change.

#### Scenario: First view of home
- **WHEN** the user opens home on any window width
- **THEN** the card stack is the first tile of the content

## ADDED Requirements

### Requirement: Data screens sit on the window's background

The default layout SHALL NOT wrap the header and the content in a shared panel. The sidebar, the header and the content
SHALL share the window's background; only a screen's own blocks SHALL be set off. While the content is scrolled, the
pinned header SHALL keep the background colour and show a hairline under it.

#### Scenario: Scrolled content
- **WHEN** the user scrolls home down
- **THEN** the tiles pass under the header, and a hairline appears under the header
