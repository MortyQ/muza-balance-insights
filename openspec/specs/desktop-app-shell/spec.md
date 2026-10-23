# desktop-app-shell Specification

## Purpose
The frame around the app's data screens: how the user moves between screens, where the global filters sit, and how
the screens use the window's width as it grows or shrinks.

## Requirements

### Requirement: App navigation at the window's edge

Every data screen (the default layout) SHALL show the app navigation as a sidebar at the window's left edge, under the
title bar, spanning the layout's full height. It SHALL list the screens that have a menu entry in their route order and
SHALL mark the current one for sight and for screen readers. A screen without its own entry SHALL mark the entry it
belongs to.

#### Scenario: Current screen is marked
- **WHEN** the user opens «Analytics»
- **THEN** the «Analytics» entry is highlighted and exposed as the current page, and no other entry is

#### Scenario: Screen without its own entry
- **WHEN** the user opens a category screen from home
- **THEN** the «General» entry is marked as current

#### Scenario: Navigation does not scroll away
- **WHEN** the user scrolls a long screen
- **THEN** the sidebar stays in place and only the content scrolls

### Requirement: Collapsible sidebar

The sidebar SHALL fold to icons only and unfold again with a toggle. The choice SHALL be remembered on this computer
and restored at the next launch; if it cannot be read, the sidebar SHALL start unfolded. A folded entry SHALL keep its
accessible name and show its name in a tooltip on hover or focus.

#### Scenario: Fold and relaunch
- **WHEN** the user folds the sidebar and restarts the app
- **THEN** the sidebar opens folded

#### Scenario: Folded entry name
- **WHEN** the sidebar is folded and the user focuses the «Planning» icon
- **THEN** its name is shown in a tooltip and read by a screen reader

### Requirement: Width steps

The shell SHALL adapt to the window's width: at 64rem and wider the sidebar follows the user's choice; from 45rem up
to 64rem it SHALL show icons only, whatever the choice; below 45rem it SHALL be hidden and a menu button in the header
SHALL open it as a drawer over the content. The drawer SHALL close when an entry is picked, on Escape, and on a click
outside it.

#### Scenario: Medium window
- **WHEN** the window is 60rem wide and the user's choice is unfolded
- **THEN** the sidebar shows icons only, and widening the window past 64rem unfolds it again

#### Scenario: Narrow window
- **WHEN** the window is narrower than 45rem and the user presses the menu button and picks «Analytics»
- **THEN** the drawer opens, «Analytics» opens, and the drawer closes

### Requirement: Keyboard navigation of the menu

The sidebar entries SHALL be reachable with Tab, and the arrow keys SHALL move between the entries and open the one
moved to, as the side menu did before this change.

#### Scenario: Arrow keys
- **WHEN** focus is on «General» and the user presses the down arrow
- **THEN** «Analytics» opens and receives focus

### Requirement: Header with title and global filters

Every data screen SHALL show a header above the content with the current menu entry's name as the screen title,
followed by the global filters (the screen's period filter, the currency, the people) and the sync status, with the
same behaviour as before this change. The header SHALL stay in place while the content scrolls.

#### Scenario: Header on home
- **WHEN** the user opens home
- **THEN** the header shows «General», the month, the currency, the people and the sync status, and stays visible while
  home scrolls

### Requirement: Content uses the window's width

The content next to the sidebar SHALL fill the available width up to 100rem; on a wider window the extra space SHALL be
shared equally on both sides of the content. No fixed narrower column SHALL remain.

#### Scenario: Wide window
- **WHEN** the window is 1440px wide with the sidebar unfolded
- **THEN** the home blocks span the whole width next to the sidebar, minus the content padding

### Requirement: Home keeps its blocks and order

Home SHALL show, in this order: the balances (the card stack with the month panel), the «Now» strip at full width
directly under them, then «Spending». Each block SHALL behave as before this change.

#### Scenario: First view of home
- **WHEN** the user opens home on any window width
- **THEN** the card stack is the first block of the content

### Requirement: Settings keep their own menu

The settings screen SHALL keep its own section menu and layout; the app navigation sidebar SHALL NOT appear there.
«Settings» SHALL be reachable from the sidebar's footer and with CmdOrCtrl+,.

#### Scenario: Open settings from the sidebar
- **WHEN** the user picks «Settings» in the sidebar's footer
- **THEN** the settings screen opens with its own section menu and no app navigation sidebar

### Requirement: App name in the sidebar

The sidebar's header SHALL show the app's logo and name; folded, it SHALL show the logo alone, which unfolds the sidebar
unless the window's width forces icons. The title bar SHALL be an empty strip that drags the window, with no name, logo
or controls of its own.

#### Scenario: Unfolded sidebar
- **WHEN** the sidebar is unfolded
- **THEN** its header shows the logo and «Balance Insights», and the title bar above shows neither

#### Scenario: Folded sidebar
- **WHEN** the user folds the sidebar and presses the logo
- **THEN** the sidebar unfolds
