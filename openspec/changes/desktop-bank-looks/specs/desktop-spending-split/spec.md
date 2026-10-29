# Spec Delta

## ADDED Requirements

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

### Requirement: The «Month pace» choice is remembered
The «Month pace» choice SHALL be remembered on this computer, apart from the «Spending» and «Analytics» choices.

#### Scenario: Restart
- **WHEN** the user chooses «By banks» for the pace and restarts the app
- **THEN** the pace opens by banks while «Spending» keeps its own choice
