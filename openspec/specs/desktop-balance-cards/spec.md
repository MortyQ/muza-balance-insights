# desktop-balance-cards Specification

## Purpose

The home screen's balance block: the stack of balance cards and the row it opens into, the total and account cards,
how the open row is scrolled and paged, and how the block adapts to its width.

## Requirements

### Requirement: Stack and month panel never overlap

While the row is folded, the block SHALL show the card stack and the month panel («In» / «Out», jars, reserves) side by
side when both fit at their minimum widths, and the panel under the stack otherwise. No card SHALL cover any part of the
panel at any block width.

#### Scenario: Wide block

- **WHEN** the block is wide enough for the stack and the panel at its minimum width
- **THEN** the panel sits to the right of the stack and takes the remaining width, up to its full width

#### Scenario: Narrow block

- **WHEN** the window is narrowed until the stack and the panel no longer fit side by side
- **THEN** the panel moves under the stack, and the block grows to hold both

#### Scenario: Row open in a narrow block

- **WHEN** the row is open while the panel is under the stack
- **THEN** the panel is hidden and leaves no empty space under the row

### Requirement: Total card looks like a summary, not a bank card

The total of the view (the family, a picked person, and each person in the family view) SHALL be shown on a summary
card that does not use any bank's look: no bank mark, a summary icon, a «Total» label next to the title, the view's
people as coloured dots. It SHALL keep the card's size and the same figures as before (amount, other currencies, free
and reserved, net of the month, counts).

#### Scenario: Family view

- **WHEN** the family view is shown
- **THEN** the front card is the summary card with a dot per person, and each person's card in the row is a summary card in their colour

#### Scenario: One person

- **WHEN** a person is picked
- **THEN** the front card is their summary card, and every card after it is an account card

### Requirement: Account cards take their bank's look

An account card SHALL be drawn in the look of the account's bank. Every account SHALL be shown in the Monobank look
until accounts carry their bank. The account card SHALL keep today's content (name, kind, balance, limit, net of the
month, dimmed without data on the date).

#### Scenario: Monobank account

- **WHEN** a person's row lists their Monobank card
- **THEN** it is shown as today's dark card with the Monobank mark

### Requirement: Open row scrolls by swipe and by arrows

The open row SHALL scroll horizontally by trackpad and touch swipes, Shift + wheel and mouse drag, and come to rest on
a whole card. The header arrows SHALL scroll by one card and be disabled at either end. A vertical mouse wheel SHALL keep
scrolling the page.

#### Scenario: Trackpad swipe

- **WHEN** the user swipes sideways on the open row
- **THEN** the row scrolls and settles with a card's left edge at the row's start

#### Scenario: Arrows

- **WHEN** the user presses the next arrow
- **THEN** the row scrolls by one card, and the arrow is disabled once the last card is fully in view

#### Scenario: Drag does not toggle

- **WHEN** the user drags the row with the mouse and releases it over a card
- **THEN** the row scrolls and the click does not fold the row

#### Scenario: Vertical wheel

- **WHEN** the user turns a mouse wheel over the open row without Shift
- **THEN** the page scrolls, not the row

### Requirement: Row position is shown without a scroll bar

The open row SHALL show no scroll bar on any OS. It SHALL show its position by fading the edge where more cards lie and
by a row of dots, one per card, with the cards in view marked. A dot SHALL scroll the row to its card and have an
accessible name.

#### Scenario: More cards to the right

- **WHEN** the row is at its start and has more cards than fit
- **THEN** the right edge fades, the left does not, and the first dots are marked

#### Scenario: Dot

- **WHEN** the user activates the dot of the fifth card
- **THEN** the row scrolls so the fifth card is in view

#### Scenario: Everything fits

- **WHEN** all cards fit in the row
- **THEN** no edge fades and no dots are shown

### Requirement: Keyboard reaches every card of the open row

Every card of the open row SHALL be reachable by Tab, and a focused card SHALL be scrolled into view. Escape SHALL fold
the row as today.

#### Scenario: Tab past the visible cards

- **WHEN** focus moves by Tab to a card outside the row's view
- **THEN** the row scrolls to show that card

### Requirement: Folding returns the row to its start

Folding the row SHALL scroll it back to its start before the cards stack, and a new month or person SHALL bring the open
row back to its start. Under reduced motion the row SHALL jump without smooth scrolling.

#### Scenario: Fold from the middle

- **WHEN** the row is scrolled to its fourth card and the user folds it
- **THEN** the row scrolls back to the first card and then the cards stack, the front card on top

#### Scenario: New month

- **WHEN** the month changes while the row is open and scrolled
- **THEN** the row shows the new month's cards from the first one
