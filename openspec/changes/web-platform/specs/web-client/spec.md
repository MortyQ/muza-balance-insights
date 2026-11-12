# Spec Delta

## Purpose

Describes the browser edition of the app: its screens over the server's API, installable on a phone,
usable at phone width, updated live, and keeping nothing financial on the device.

## ADDED Requirements

### Requirement: The figures equal the reference on the same data

For the same data, person, bank, period and currency choice, every figure and list the web client shows SHALL equal
what the desktop's core computes. The web client's screens SHALL be its own and free to differ from the desktop's.

#### Scenario: One fictional data set on both

- **WHEN** the same generated data is loaded into the desktop's core and into a household on the web
- **THEN** home, the category and income screens, analytics, insights, budget, regular payments and planning show
  the values the core computes

### Requirement: The web client has its own account and space screens

The web client SHALL show sign-in, the household switcher, «Space» (members and invites) and «Devices», and SHALL
NOT show the desktop's PIN lock, database encryption and recovery, or app update sections.

#### Scenario: Settings on the web

- **WHEN** settings are opened in the web client
- **THEN** there is no «Updates» or database encryption row, and «Space» and «Devices» are listed

### Requirement: Screens have addresses

Every screen of the web client SHALL have its own address that names the household, so that a reload, a bookmark
and the browser's back button work. An address SHALL carry no amount, search text or other household data.

#### Scenario: Reloading a category screen

- **WHEN** the category screen of a month is reloaded
- **THEN** the same household, category and month are shown

#### Scenario: An address of a household the user is not in

- **WHEN** a signed-in user opens another household's address
- **THEN** they land on their own household list with no detail of the other one

### Requirement: Today and periods follow the user's time zone

The web client SHALL tell the server the device's time zone, and «today», weeks and months SHALL be computed in it
for that user.

#### Scenario: Just after midnight

- **WHEN** a user whose zone is two hours ahead of the server's opens «Today» at 00:30 their time
- **THEN** the new day is shown, not the server's previous day

### Requirement: Nothing financial is kept on the device

The web client SHALL keep amounts, operations, names and bank text in memory only. It SHALL NOT write them to local
storage, a browser database or a cache, and the service worker SHALL NOT handle or store API answers. Device storage
SHALL hold interface choices only.

#### Scenario: Inspecting a shared computer after sign-out

- **WHEN** a user signs out and the browser's stored data for the site is inspected
- **THEN** it holds the app's files and interface choices, and no figure, name or operation

#### Scenario: Sign-out clears the device

- **WHEN** a user signs out
- **THEN** the server asks the browser to clear the site's stored data, and the back button shows no earlier screen
  with data

### Requirement: The app installs and opens without a network, but shows data only online

The web client SHALL be installable to a phone's or a computer's home screen and SHALL open its shell without a
network. Without a connection it SHALL say so and show no stale figures as if current.

#### Scenario: Opening the installed app offline

- **WHEN** the installed app is opened with no connection
- **THEN** the shell appears with an «offline» notice and a retry, and no numbers

#### Scenario: A new version

- **WHEN** a new version was deployed while the app is open
- **THEN** the user is offered a reload, and no screen mixes old code with new answers

### Requirement: Every screen works at phone width

Every screen SHALL be usable at a width of 360 px with touch: no horizontal page scroll, navigation reachable with
one hand, targets large enough to tap, sheets and dialogs within the screen, and the system's safe areas respected.

#### Scenario: Home on a phone

- **WHEN** home is opened at 360 px
- **THEN** its blocks stack in one column, the filters fit or fold into a sheet, and nothing is cut or overlaps

#### Scenario: Uploading from a phone

- **WHEN** a member picks a statement from the phone's files
- **THEN** it is parsed on the phone and the upload sheet fits the screen

### Requirement: Changes arrive without a reload

While a household is open, the web client SHALL refresh its figures when another device or member changes the data
and while an import commits windows, quietly: the old figures stay until the new ones arrive. When the stream drops,
it SHALL reconnect and refresh once.

#### Scenario: An import on another device

- **WHEN** an import started on a laptop is running and the phone shows home
- **THEN** the phone's figures fill in as windows are committed and the import line is shown

#### Scenario: The connection returns

- **WHEN** the phone was offline for a minute and reconnects
- **THEN** the screens refresh once and the «offline» notice goes

### Requirement: The session's state is always visible and honoured

The web client SHALL show sign-in when there is no session, the lock screen when the session is locked, and the
passkey prompt when the server asks for a fresh confirmation, then repeat the refused action once.

#### Scenario: A sensitive action with an old confirmation

- **WHEN** a member removes a connection and the server answers `stale-auth`
- **THEN** the passkey prompt appears, and after it the removal goes through without the member starting over

### Requirement: Destructive actions are confirmed in the app's own dialog

Before removing a connection or deleting a household the web client SHALL
ask in its own dialog, naming what will be removed, and the destructive button SHALL NOT be the default.

#### Scenario: Deleting a household

- **WHEN** an owner chooses to delete the household
- **THEN** a dialog names the household, asks to type its name, and only then enables the delete button

### Requirement: Every text is translated

Every text the web client adds SHALL exist in the Ukrainian, English and Russian dictionaries, and no literal text
SHALL appear in a template or in script code.

#### Scenario: Switching the language on the sign-in screen

- **WHEN** the language is switched to each of the three
- **THEN** every text of sign-in, invites, «Space» and «Devices» changes, and none is left in another language
