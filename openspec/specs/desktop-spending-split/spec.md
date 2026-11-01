# desktop-spending-split Specification

## Purpose
Says how the home «Spending» bars and the «Analytics» chart split spending — together, by people or by banks — when
each split is offered, and which colour each bank is drawn in.

## Requirements

### Requirement: Each bank has its own colour

Every bank SHALL be drawn in one colour of its own wherever spending is split by bank: Monobank in the theme's
foreground colour, PrivatBank in green, A-Bank in blue, Slovenská sporiteľňa in red; every bank's colour SHALL differ
from the others'. A bank the app does not know SHALL be drawn in a neutral grey.
The colours SHALL stay readable in both themes.

#### Scenario: Dark theme

- **WHEN** the dark theme is on and spending is split by bank
- **THEN** Monobank's segments are drawn in the light foreground colour, not black

### Requirement: The «Spending» bars split together, by people or by banks

The «Spending» block's bars menu SHALL offer one choice of how a category's bar is split: «Together» (the category's
colour), «By people» or «By banks». «By banks» SHALL draw one segment per bank with spending in that category, in the
bank's colour, in proportion to its part; hovering a segment SHALL name the bank and its amount.

#### Scenario: By banks

- **WHEN** «By banks» is chosen and a category's spending is on Monobank and PrivatBank
- **THEN** the category's bar shows a Monobank and a PrivatBank segment, each as long as its part of the category

#### Scenario: Together

- **WHEN** «Together» is chosen
- **THEN** every bar is one segment in its category's colour

### Requirement: A split is offered only where it applies

«By people» SHALL be offered only in the family view with two or more people; «By banks» only while two or more banks
are on in the bank filter. When the chosen split is not offered, the bars SHALL be drawn «Together» and the choice SHALL
be kept for when it applies again.

#### Scenario: One bank on

- **WHEN** «By banks» was chosen and the user turns every bank but one off
- **THEN** the bars are drawn together, «By banks» is not offered, and turning a second bank on brings the split back

#### Scenario: A person picked in the block

- **WHEN** «By banks» is chosen and the user picks a person in the block's people list
- **THEN** that person's bars are drawn together, since the bank parts are the whole view's

### Requirement: The «Spending» choice carries over and is remembered

The choice SHALL be remembered on this computer. A choice stored before this change SHALL carry over: the former
«Who spent how much» switch on SHALL read as «By people», off as «Together».

#### Scenario: An earlier choice

- **WHEN** the user had «Who spent how much» on and opens the new version
- **THEN** «By people» is chosen

### Requirement: The «Analytics» chart splits spending by banks

The «Analytics» income and spending chart SHALL offer «Together» and «By banks» while two or more banks are on in the
bank filter. «By banks» SHALL draw spending as stacked areas, one per bank in its colour, whose top edge is the total
spending; income SHALL stay one line. The choice SHALL be remembered on this computer; with fewer than two banks on the
chart SHALL be drawn together.

#### Scenario: A month by banks

- **WHEN** one month is shown, «By banks» is chosen and spending is on two banks
- **THEN** the chart shows two stacked areas of running spending from the 1st, whose top edge equals the «Together»
  spending line, and the income line

#### Scenario: A range of months

- **WHEN** a range of months is shown by banks
- **THEN** each month's spending is split into the banks' areas, stacked to the month's total

### Requirement: Bank parts add up to the whole

A bank's part of a category or of a day or month SHALL count that bank's own spending under the bank view's rules (an
own transfer between banks is in no bank's part; a transfer fee is in the sending bank's part). The parts of one bar or
one point SHALL add up to its total, give or take a kopeck of rounding per currency.

#### Scenario: Parts of a category

- **WHEN** a category has spending and a refund on one bank and spending on another
- **THEN** each bank's segment is its spending minus its refunds, and the segments add up to the category's amount

### Requirement: «Month pace» splits spending by banks
The «Month pace» panel SHALL have a menu with «Together» and «By banks», «Together» by default, offered only while two or
more banks are on in the bank filter. «By banks» SHALL draw the month's running spending as stacked areas, one per bank
in its colour, whose top edge is the «Together» line; the usual month SHALL stay a dashed line.

#### Scenario: Two banks
- **WHEN** «By banks» is chosen and the month's spending is on Monobank and PrivatBank
- **THEN** the chart shows a Monobank and a PrivatBank area stacked from the 1st, their top edge equal to the
  «Together» line, and the dashed usual line

#### Scenario: One bank on
- **WHEN** «By banks» was chosen and the user turns every bank but one off
- **THEN** the chart is drawn together, the menu offers no split, and turning a second bank on brings the split back

#### Scenario: Figures stay
- **WHEN** «By banks» is chosen
- **THEN** the figures under the chart are the same as with «Together»

### Requirement: The «Month pace» tooltip names each bank's part
By banks, pointing at a day SHALL show, besides the tooltip's usual lines, each bank's spending up to that day, in the
banks' order, in the home's currency choice.

#### Scenario: A day by banks
- **WHEN** «By banks» is chosen and the user points at a day with spending on two banks
- **THEN** the tooltip shows the date, the spending up to that day, each bank's part of it and the usual

### Requirement: The «Month pace» legend names the banks
By banks, a legend under the chart SHALL list each bank drawn, in the chart's order: a swatch in the bank's colour, the
bank's name and its spending up to the last day with data, in the home's currency choice. «Together» SHALL show no
legend.

#### Scenario: Legend by banks
- **WHEN** «By banks» is chosen and the month's spending is on Monobank and PrivatBank
- **THEN** under the chart a Monobank and a PrivatBank item each show the bank's colour, name and amount so far, and
  the amounts add up to «Spent»

#### Scenario: Together
- **WHEN** «Together» is chosen
- **THEN** no legend is shown under the chart

### Requirement: The «Month pace» choice is remembered
The «Month pace» choice SHALL be remembered on this computer, apart from the «Spending» and «Analytics» choices.

#### Scenario: Restart
- **WHEN** the user chooses «By banks» for the pace and restarts the app
- **THEN** the pace opens by banks while «Spending» keeps its own choice
