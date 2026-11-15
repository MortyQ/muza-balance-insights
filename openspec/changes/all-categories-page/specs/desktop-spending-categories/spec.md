# Spec Delta

## Purpose

The «All categories» screen: every spending category of the month by name, with the figures home's «Spending» block
shows for its biggest ones, and the way home leads to it.

## ADDED Requirements

### Requirement: Every category of the month

The «All categories» screen SHALL list every category with spending in the month the global filter shows, biggest
first, each as its own row. It SHALL NOT fold any of them into a combined row.

#### Scenario: A month with fifteen categories
- **WHEN** the month has spending in 15 categories
- **THEN** the screen lists 15 rows, the biggest first, and no «more categories» row

#### Scenario: Another month
- **WHEN** the user picks another month in the global filter
- **THEN** the screen lists that month's categories

### Requirement: The same figures as home

A row SHALL show what home's «Spending» row shows for the same category, month and filters: the amount, its share,
the number of transactions, the change against the previous month and the bar. The rows' amounts SHALL add up to the
month's total shown on the screen.

#### Scenario: A category in both places
- **WHEN** «Groceries» is among home's seven named categories
- **THEN** its row on the screen shows the same amount, share and change as on home

#### Scenario: A category home did not name
- **WHEN** a category was inside home's «8 more categories» row
- **THEN** the screen shows it by name with its own amount, share, transactions and change

### Requirement: The same filters and settings as home

The screen SHALL follow the person and bank filters, the «Personal / Business» choice, the currency choice and the
«Spending» block's view settings, and SHALL offer the «Personal / Business» switch itself.

#### Scenario: One person
- **WHEN** a person is picked in the global filter
- **THEN** the screen lists that person's categories and amounts

#### Scenario: Business
- **WHEN** the user switches the screen to «Business»
- **THEN** it lists business spending, and home shows «Business» too

### Requirement: Rows open the category

A row SHALL open that category's screen for the same month and scope.

#### Scenario: Open a small category
- **WHEN** the user clicks the row of the month's twelfth category
- **THEN** that category's screen opens with the month's transactions

### Requirement: Reached from home

Home's «N more categories» row SHALL open the screen. The screen SHALL keep «General» current in the menu and offer a
way back to home.

#### Scenario: From home
- **WHEN** the user clicks «8 more categories» on home
- **THEN** the «All categories» screen opens for the same month, with «General» still current in the menu

### Requirement: The month's state

The screen SHALL say when the month has no spending, and SHALL show the notices home's block shows: a failed read, a
month that is not complete, transactions still pending and currencies left out for lack of a rate.

#### Scenario: Nothing spent
- **WHEN** the picked month has no spending
- **THEN** the screen says so instead of a list
