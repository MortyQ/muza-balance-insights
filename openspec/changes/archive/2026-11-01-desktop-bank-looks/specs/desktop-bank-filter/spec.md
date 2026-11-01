# Spec Delta

## MODIFIED Requirements

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
