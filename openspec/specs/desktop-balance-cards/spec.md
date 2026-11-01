# desktop-balance-cards Specification

## Purpose

The home screen's balance block: the stack of balance cards and the row it opens into, the total and account cards,
how the open row is scrolled and paged, and how the block adapts to its width.

## Requirements

### Requirement: Total card looks like a summary, not a bank card

The total of the view (the family, a picked person, and each person in the family view) SHALL be shown on a summary
card that does not use any bank's look and keeps the card's size. Its header SHALL be a band tinted with the colours of
the people it adds up, holding a summary icon, the title, a «Total» label and the people as coloured dots. Under it the
card SHALL show the caption, the amount and the account count under it. The conversions of the amount to the other
picked currencies SHALL be shown in a column on the right, one row per currency with its symbol, amount and code; with
no other currency picked there SHALL be no column. In the middle, the family card with two or more people SHALL show
their shares: a bar in their colours and each person's free amount; one person's card with reserves SHALL show a meter
of the free share against the reserved share. At the bottom it SHALL show tiles: own funds («Actually») and the reserved amount when reserves
are set against the card, and the month's net. It SHALL NOT show the foreign-currency rate line. Negative figures (the
amount, own funds, the month's net) SHALL be drawn in a soft red that tells a minus apart without the full danger
colour, in both themes.

#### Scenario: Family view

- **WHEN** the family view is shown
- **THEN** the front card is the summary card with a dot per person and a header band in their colours, and each person's card in the row is a summary card in their colour

#### Scenario: One person

- **WHEN** a person is picked
- **THEN** the front card is their summary card, and every card after it is an account card

#### Scenario: Reserves set

- **WHEN** reserves are set against the card
- **THEN** the amount is what is free, and the tiles show own funds, the reserved amount and the month's net

#### Scenario: No reserves

- **WHEN** no reserve is set against the card
- **THEN** only the month's net tile is shown, with no empty tiles

#### Scenario: Foreign currency held

- **WHEN** the view holds money in another currency
- **THEN** it is counted in the amount, and no «incl. … at the rate …» line is shown on the card

#### Scenario: Other currencies picked

- **WHEN** the currency switch has other currencies picked beside the main one
- **THEN** the card shows a column on the right with the amount converted to each of them, one row per currency

#### Scenario: No other currency picked

- **WHEN** only the main currency is picked
- **THEN** the card shows no conversions column and the amount takes the full width

#### Scenario: The family's shares

- **WHEN** the family card adds up two or more people
- **THEN** its middle shows a bar in the people's colours sized by their free amounts and a line with each person's first name and free amount in whole units, as their own cards show it

#### Scenario: A person below zero in the shares

- **WHEN** some people's free amounts are above zero and others' are below
- **THEN** every person with a non-zero amount has a part of the bar sized by the amount's size, a minus hatched in the person's colour, and the amount in the line is drawn in the soft red

#### Scenario: Nobody above zero

- **WHEN** every person's free amount is zero, or every one is below zero
- **THEN** the card shows no bar, only the line with each person's amount

#### Scenario: Many people

- **WHEN** the family has more than three people
- **THEN** the line names the three with the largest free amounts and «+N» for the rest, the full list in its tooltip, while the bar keeps a part for everyone whose amount is not zero

#### Scenario: Many people in the header

- **WHEN** the family has more than five people
- **THEN** the header shows five dots and «+N» for the rest, and its band keeps every person's colour

#### Scenario: One person's reserves

- **WHEN** a person's card (picked, or in the family row) has reserves set against it and their own funds are above zero
- **THEN** its middle shows a meter of the free share and the reserved share in whole percent that add up to 100

#### Scenario: One person without reserves

- **WHEN** a person's card has no reserves set against it
- **THEN** its middle shows no meter

#### Scenario: A minus

- **WHEN** the amount or the month's net is below zero
- **THEN** that figure is drawn in the soft red, and the month's tile is tinted the soft red instead of green

#### Scenario: A month at zero

- **WHEN** the month's net is exactly zero
- **THEN** the month's tile is neutral, with no arrow and no sign

### Requirement: Account cards take their bank's look

An account card SHALL be drawn as the account's bank's physical card: its colours, its wordmark set in the app's font,
a chip, a contactless mark and a soft sheen; a Monobank card SHALL follow its card type (black, white, iron, platinum,
children's yellow; other types black). A bank without a look SHALL get a neutral card. No bank logo file SHALL be
copied. The card SHALL keep today's content, people dots and dimmed state, readable on its own colours in both themes.

#### Scenario: Monobank account

- **WHEN** a person's row lists their Monobank black card
- **THEN** it is shown as a matte black card with the «monobank» wordmark

#### Scenario: Monobank white card

- **WHEN** a person's row lists their Monobank white card
- **THEN** it is shown as a light card with dark text

#### Scenario: Other banks

- **WHEN** a person's row lists a PrivatBank, an A-Bank and a Slovenská sporiteľňa account
- **THEN** they are shown as a blue card with a green brand tag, a green card and a blue card with a large arc

#### Scenario: Without data on the date

- **WHEN** an account has no data on the shown date
- **THEN** its card keeps its bank's look and is dimmed

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

### Requirement: Month pace

The balances block SHALL show the shown month's spending added up day by day, for the view's person or family, against
the usual month's running spending by day (the mean of up to 3 whole months before), and today's point while the month
runs. With no data for the month the pace panel SHALL NOT be shown.

#### Scenario: Chart of a running month

- **WHEN** the current month is shown and a usual month is known
- **THEN** the chart shows the month's line and the dashed usual line up to today, with today's point

#### Scenario: Month without data

- **WHEN** a month before the first data is picked
- **THEN** the pace panel is not shown

### Requirement: Month pace figures

Under the pace chart the block SHALL show the spending so far (the whole month for a past month), the usual spending by
the same day, and, for the current month only, the amount available per day, in the home's currency choice. With fewer
than 3 covered months before, the usual line and figure SHALL be left out and a note SHALL say so.

#### Scenario: Running month above usual

- **WHEN** the current month is shown and the spending so far is above the usual by the same day
- **THEN** the chart shows both lines up to today, the point for today, and the three figures

#### Scenario: Past month

- **WHEN** a past month is shown
- **THEN** the line covers the whole month, «spent» is the month's total, and «available per day» is not shown

#### Scenario: Not enough history

- **WHEN** fewer than 3 whole months before the shown one have data
- **THEN** only the month's line and «spent» are shown, with a note that the usual month needs three months of history

#### Scenario: Person picked

- **WHEN** a person is picked in the global filters
- **THEN** the pace panel shows that person's spending and usual

### Requirement: Month pace tooltip

Pointing at a day of the month pace chart SHALL show a tooltip for that day, in the style of the app's other charts: the
date; the month's spending up to that day when the day has data; the usual month's spending up to that day when a usual
month is known; and, when both are shown, how much more or less than usual the month is. Amounts SHALL follow the
home's currency choice.

#### Scenario: A past day of a running month

- **WHEN** the current month is shown with a usual month and the user points at a day before today
- **THEN** the tooltip shows the date, the spending up to that day, the usual up to that day and the difference

#### Scenario: A day after today

- **WHEN** the user points at a day after today in the current month
- **THEN** the tooltip shows the date and the usual up to that day only

#### Scenario: No usual month

- **WHEN** fewer than 3 whole months before the shown one have data and the user points at a day
- **THEN** the tooltip shows the date and the spending up to that day only

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
