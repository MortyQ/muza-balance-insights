# desktop-bank-filter Specification

## Purpose
Lets the user narrow every data screen to some of their banks — one, two or all — next to the person switch, while the
combined view of all banks stays the default.

## Requirements

### Requirement: The filter offers the banks in view
The header SHALL show one bank filter control, opening a panel with one row per bank that has at least one imported,
enabled account, in the registry's order: the bank's mark, its name and a switch. The control SHALL show the marks of
the banks that are on and say «All banks» while every offered bank is on, else how many of them are on. The filter
SHALL be shown only when there are at least two such banks.

#### Scenario: Three banks
- **WHEN** Monobank, PrivatBank and A-Bank each have imported, enabled accounts
- **THEN** the header shows one bank filter control with three marks and «All banks», and its panel lists three banks

#### Scenario: Some banks on
- **WHEN** four banks are offered and the user leaves two of them on
- **THEN** the control shows those two banks' marks and says two of four

#### Scenario: One bank
- **WHEN** only Monobank has imported accounts
- **THEN** no bank filter is shown and every screen shows Monobank's figures as before

#### Scenario: A bank with every account off
- **WHEN** every PrivatBank account is turned off in «People and banks»
- **THEN** PrivatBank has no row in the panel

### Requirement: All banks by default, never none
Every offered bank SHALL be on by default. The user SHALL be able to turn any bank off and on, but the last bank that is
on SHALL NOT turn off.

#### Scenario: First start
- **WHEN** the user has never used the filter
- **THEN** every offered bank is on and the screens show the combined figures

#### Scenario: The last bank
- **WHEN** only A-Bank is on and the user presses its toggle
- **THEN** A-Bank stays on

### Requirement: The choice is remembered on this computer
The chosen banks SHALL be remembered on this computer, like the chosen person, and SHALL be applied at the next start.
A remembered bank that is no longer offered SHALL be dropped; when none of the remembered banks is offered, every
offered bank SHALL be on.

#### Scenario: Restart
- **WHEN** the user leaves only PrivatBank on and restarts the app
- **THEN** the screens open with PrivatBank only

#### Scenario: A remembered bank disappears
- **WHEN** the remembered choice is A-Bank only and the A-Bank connection is removed
- **THEN** every offered bank is on

### Requirement: Every data screen follows the filter
Home (balances and account cards, the month panel, «Now», spending, the pace), analytics, the category and income
screens, regular payments and planning SHALL show the figures of the chosen banks only, combined with the chosen person.
A change of the chosen banks SHALL reload them, as a change of person does. With every offered bank on, each screen
SHALL ask for and show exactly what it showed before this change.

#### Scenario: Home with one bank
- **WHEN** the user leaves only Monobank on
- **THEN** home shows Monobank's account cards, balance, income, spending and pace only

#### Scenario: Person and bank
- **WHEN** the person switch is on one person and only PrivatBank is on
- **THEN** every data screen shows that person's PrivatBank figures

#### Scenario: Planning
- **WHEN** only Monobank is on
- **THEN** «Available per day» uses Monobank's card money and the regular income and mandatory payments of Monobank,
  and the reserves of the chosen person as before

### Requirement: The filter is reachable by keyboard and screen readers
The control SHALL be a button reachable by Tab whose accessible name contains its visible text, opening the panel with
Space and Enter and closing it with Esc. Each bank's switch SHALL be labelled by the bank's name and announced as on or
off. A switch that cannot turn off SHALL say why.

#### Scenario: Keyboard
- **WHEN** the user tabs to the bank filter, presses Enter, tabs to the PrivatBank switch and presses Space
- **THEN** PrivatBank turns off and its switch is announced as off

#### Scenario: The last bank
- **WHEN** only A-Bank is on and the user opens the panel
- **THEN** A-Bank's switch cannot be turned off and says that at least one bank stays on
