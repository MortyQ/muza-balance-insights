# What's new in Balance Insights

What changed in each version of the app, newest first. Screen and button names are quoted as they appear in the
English interface.

## 0.1.7 — unreleased

### Spending

- The «Spending» block is new: a ring of categories with the month's total, and for each category its share, the
  number of operations and how much more or less it is than last month. While a month is in progress it is compared
  with the same days of last month.
- For the whole family the block shows who spent how much: click a person to see their part of the family's spending,
  or click a category to see each person's amount and operations in it.
- Under the ring the block names what it compares with: last month, or its first days while this month is in progress.
- The «Block settings» gear in the block's corner chooses what the bars show: «Who spent how much» and «Last month's
  mark».
- Whether an amount went up or down against last month no longer rests on colour alone: differences carry a «+» or
  «−» sign, and screen readers say the direction.
- Spending on dollar and euro cards is now counted at today's Monobank sell rate, instead of a separate table per
  currency.

### Home screen

- A thin strip between the balances and «Spending» shows how today and this week are going: «Today» — today's
  spending against a usual day, «This week» — the week so far against the same days of last week, with a bar for each
  day, and «Most this week» — the category you spent the most on. It follows the people filter, updates with every
  sync, and is shown while the current month is selected.
- **Main currency.** Pick hryvnia, dollars or euros in the currency menu next to the filters, and every amount on the
  home screen — balances, «In / Out», the «Now» strip and «Spending» — is shown in it. The other currencies can still
  be added as «≈» lines.
- Amounts in other currencies are now converted at today's Monobank sell rate, not at the rate of your own exchanges.
  The app asks Monobank for its public rates at launch and every few hours; nothing about you is sent. Without a
  connection it uses the last rates it got, and the menu says so.
- Next to the filters at the top of the home screen you now see how the data is syncing: a spinner with «Syncing…» and
  how far along a download is, «Updating the data…» while «Auto-sync» runs, and when the next attempt is due if the bank
  could not be reached. When it is done, the line says what the data covers and when it was last updated. If the
  download or one of the connections failed, a warning sign appears; hover over it to see why.
- In the people filter, hover over a name to see when that person's data was last updated. A person whose connection
  did not update gets a small warning dot, and the hint says which connection and why.
- With reduced motion turned on in your system settings, loading spinners no longer spin.

## 0.1.6 — 2026-09-29

### Languages

- The app now speaks Ukrainian. It starts in your system's language when that is Ukrainian, English or Russian, and in
  English otherwise; choose another in «Settings» → «Language and time». The app menu, confirmation dialogs, the Touch
  ID prompt, spending categories, account names and import and update errors follow the language.

### Fixes

- With only one person in the app, the home screen no longer shows a «Whole family» card that repeats
  theirs: it shows that person's card and a card for each of their accounts.

## 0.1.5 — 2026-09-27

### People and connections

- Every person now has their own colour, so people are easy to tell apart (and, later, on charts). Pick a new
  person's colour when you add their connection, or change it any time with «Изменить цвет» (change colour) in
  Settings → «Люди» (people). No two people can share a colour.
- Choose which accounts count: in Settings → «Подключения» (connections), «Счета» (accounts) under a connection lists
  its cards and jars, each with a switch. A switched-off account is no longer downloaded and is left out of every
  balance, total and search. A transfer between it and your other accounts is counted as ordinary spending or income
  where the app can tell which account it went to. Its transactions already downloaded stay on your computer: switch
  it back on and they count again at once. If every account is switched off, the home screen says so and takes you to
  «Подключения».
- The people switch at the top of the home screen shows each person's colour next to their name, and everyone's
  colours on «Вся семья» (the whole family), so you always know whose colour is whose.
- «Взять имя из банка» (use the name from the bank) now also works after you have renamed someone: tick it in
  «Переименовать» (rename) and the name from the bank comes back at once.

### Balances

- Balances on the home screen are now a bank card with this month's income and spending; click it to see a card for
  every person (or, for one person, every account).
- Pick a month: the cards show the balance at the end of that month, and income and spending for it. The spending
  block below follows the same month.
- Income and spending in other currencies — for example, dollars on a sole-proprietor account or cash withdrawn in
  euros — now count in «Пришло» and «Ушло» in hryvnia, at the rate of your own currency exchanges that month. Such
  sums are marked «≈», and the rate is shown under the bars.
- The month is now chosen once, at the top of the home screen, next to the people switch; it applies to both
  balances and spending. The people switch and the month stay at the top while you scroll.

### Fixes

- Drop-down lists and the month and date pickers are no longer see-through, so their text is easy to read. The date
  field now looks the same as the other fields next to it. Fields, drop-downs and buttons now share the same shadows.

## 0.1.4 — 2026-09-27

Balance Insights shows where your money goes, from your Monobank statement, right on your computer rather than in
someone else's cloud. New in this version: the app fetches new transactions by itself, it can be locked with a PIN or
Touch ID, the database on your computer is now encrypted, and the app has a new look: its own window title bar,
redesigned settings and a light or dark theme.

### Connecting your bank

- On first launch, choose your bank and paste your personal Monobank token (issued at api.monobank.ua). The token only
  allows reading your statement and balances. Other banks are marked «Скоро» (coming soon).
- «Запомнить на этом компьютере» (remember on this computer) keeps the token in the system key store: Keychain on macOS,
  the Windows credential store, the keyring on Linux. If there is no such store, the token is kept in memory only until
  the app is closed, and the app tells you so.
- Enter a token again or remove a connection in Settings → «Подключения» (connections).
- Settings open from the gear in the window's title bar or with Cmd+, / Ctrl+,. Esc goes back.

### Loading your statement

- The «Импорт» card on the home screen: pick the «Глубина» (depth — 1, 3, 12, 24 or 36 months) and press «Загрузить»
  (load).
- The current month of every account comes first, then the history. Spending and balances fill in while it loads.
- Monobank gives out a statement at most once a minute, so a long history takes a while — about a minute per month of
  each account. You can stop with «Остановить» and continue later. If you close the app, the import continues by itself
  on the next launch when the token is remembered on this computer.
- If the network drops or Monobank is temporarily unavailable, the app waits and retries by itself. Whatever has been
  loaded is kept.
- The home screen header shows how recent your data is («Данные до …» — data up to …).

### Automatic sync

- New: the app fetches new transactions of all connections by itself — at launch, after the computer wakes from sleep,
  and every 4 hours while it is open. Not more often than once every 30 minutes.
- Each time, the last 31 days are read again, so transactions that were pending and have since completed or been
  cancelled are updated.
- While it runs, the home screen shows just one line: «Обновляю данные…» (updating data).
- The «Загрузить» button is still there to load a deeper history, and it takes over from a refresh in progress.
- Settings → «Автосинхронизация»: a main switch «Обновлять данные автоматически» and a switch for each occasion under
  «Когда обновлять».
- Automatic refresh starts once your statement has been loaded at least once: you choose the depth of the first load
  yourself.
- It also runs while the app is locked.

### Spending

- The «Траты» card shows a month's spending by category, with three amounts each: gross (all charges), refunds, and net
  (gross minus refunds).
- Arrows switch months; «Текущий месяц» returns to the current one.
- «Личное» (personal) and «Бизнес» (business, sole-proprietor accounts) are counted separately.
- Different currencies are never added together: each currency has its own table.
- Transfers between your own accounts and incoming money are not counted as spending.
- Refunds are recognised even when the bank books them as a separate transaction, and go to the category of the purchase.
- Bank fees have their own category, «комиссии банка».
- The average spending per day is shown at the bottom.
- If some transactions are still pending at the bank, you see how many: their amounts may still change.

### Balances

- The «Балансы» card shows how much of your own money is on each card. The credit limit is not included, and a minus
  means credit card debt. The credit limit itself is shown separately.
- It also shows jars («Банки») and «Всего своих денег» (your own money in total) per currency.

### Family: several people and connections

- Settings → «Люди» (people) and «Подключения» (connections): one app can hold several people, for example you and your partner, each with their
  own Monobank connections and tokens. Buttons: «Добавить подключение», «Переименовать», «Ввести токен заново»,
  «Удалить».
- A new person's name can be typed or taken from the bank: it is filled in on the first load.
- Add another person's token only with their consent: they issue the token in their own Monobank and give it to you.
- «Загрузить» loads all connections at once, and different people's connections load in parallel. If someone's token is
  rejected, the others still load, and the app shows which connection did not.
- The home screen has a «Чьи деньги» (whose money) switch: «Вся семья» (the whole family) or one person. Spending and
  balances follow it.
- Transfers within the family are not spending of the whole family. When you look at one person, such transfers are in
  their «семье» (to family) category.
- «Удалить» removes the connection, its token and the loaded transactions of its accounts in this app. Nothing changes
  at the bank.

### Look and settings

- New: the app has its own window title bar with the app name and the settings gear. On Windows and Linux the window
  buttons sit on it; on macOS, the usual traffic lights.
- New: redesigned settings. A menu on the left — «Пользователи» (users), «Безопасность» (security), «Приложение» (the
  app) — and one section at a time on the right. Arrow keys move through the menu.
- New sections: «Хранение и токены» (where your statement and tokens are kept and who can read them) and «Сеть»
  (network: the only services the app talks to).
- New: Settings → «Оформление» (appearance): «Как в системе» (follow the system), light or dark. The window frame, menus
  and system dialogs follow the choice too.
- The home screen buttons «Ввести токен» (enter token) and «Включить» (turn on the lock) open the right settings section.

### Security and privacy

- Your data stays on your computer. The app talks only to Monobank (for the statement) and GitHub (for updates). No
  analytics, no telemetry.
- New: the database is encrypted with a random key, and the key is kept in the system key store, like the tokens. A copy
  of the files — on another computer or user account, in a backup or a cloud folder — can't be opened.
- An existing database is encrypted by itself on the first launch of the new version. Check it in Settings →
  «Хранение и токены» (storage and tokens) → «Шифрование базы».
- New: app lock. Turn it on in Settings → «Блокировка» → «Включить блокировку». It needs a PIN of 4–8 digits; on a Mac
  you can also unlock with Touch ID.
- Under «Когда блокировать», choose when the app locks by itself: at launch, after 60 minutes of inactivity, when the
  screen locks, when the computer goes to sleep.
- Lock by hand with «Заблокировать сейчас» or Cmd+L / Ctrl+L (menu «Файл» → «Заблокировать»).
- After several wrong PINs in a row, the next attempt opens only after a pause.
- A forgotten PIN can't be recovered. «Забыли PIN?» deletes all data; after that you can load your statement again.
- Import and automatic refresh keep going while the app is locked.
- If the database can't be opened, for example because its key is not available, the app offers: «Перезапустить»
  (restart), «Начать заново» (start over), «Удалить все данные» (delete all data) or «Выйти» (quit). «Начать заново»
  creates a new empty database, and your transactions are loaded from the bank again.
- «Удалить все данные» (Settings → «Данные») erases the database and its key, saved tokens, the lock
  and an unfinished import. The app asks for confirmation first.
- The app's data folder is open to your user account only (macOS, Linux).

### App updates

- Every few hours the app checks whether a new version is out.
- On Windows and Linux (AppImage), the new version downloads in the background. The app then offers «Перезапустить и
  обновить» (restart and update); otherwise it installs when you quit.
- On macOS, «Скачать» (download) saves the verified file to Downloads. Open it and drag Balance Insights into
  Applications, replacing the old one.
- An update is installed only if it is signed by the author and the file matches the signed description.
- Settings → «Обновления»: the version number, «Проверить сейчас» (check now) and «Проверять автоматически»
  (check automatically).

### Installation

- Available for macOS (Apple Silicon and Intel), Windows 10/11 (64-bit) and Linux (64-bit, AppImage).
- The installers are not signed with an Apple or Microsoft certificate, so the system warns you on first launch.
  How to get past it: the [installation guide](https://github.com/MortyQ/muza-balance-insights/blob/main/docs/INSTALL.md).
- If you have 0.1.0 or 0.1.1, install the new version by hand once. Starting with 0.1.2, updates arrive by themselves.
- This is an unofficial app, not affiliated with Monobank.

## 0.1.3 — 2026-09-26

Several people in one app: for example your own Monobank and your partner's, each with their own token.

### Added

- Settings → «Люди и подключения»: people and their bank connections — rename, enter a token again, remove, add a
  connection for an existing or a new person. A new person's name can be typed or taken from the bank on the first import.
- Home: a «Вся семья / names» switch (when there is more than one person); spending and balances follow it.
- One import for all connections: their requests go in parallel (the bank's limit is per token). A rejected token stops
  only its own connection; the import shows which connections did not load.
- Transfers between people of the family: not spending for the whole family, «семье» for the sender when one person is
  viewed.
- Spending and balances refresh while an import runs.

### Changed

- Tokens are stored per connection. The token of an earlier version moves to its connection by itself on the first
  launch (the database is upgraded too, so keep a copy of the app's data folder before updating).
- Removing a connection deletes its accounts and operations in the app (nothing changes at the bank).

## 0.1.2 — 2026-09-25

First version with automatic updates: install it by hand once, later versions come by themselves.

### Added

- Automatic updates on Windows and Linux (AppImage): downloaded in the background, installed on restart or quit.
- macOS: «new version» notice; the verified `.dmg` is saved to Downloads.
- Settings → Updates: version, «check now», automatic checks on/off (on by default).

### Security

- Every update is verified with the author's ed25519 signature (the public key is inside the app) and its size and sha512
  before it is installed or saved.
- Network access is a list of trusted services (GitHub for updates, Monobank for the import); each part of the app may use
  only its own.

## 0.1.1 — 2026-09-25

### Added

- First start: choose your bank (Monobank; more banks marked «coming soon»), then paste the token.
- Settings screen: connected bank (replace the token, disconnect — data stays), «Delete all data», about.
  Opens from the gear on the home screen or with Cmd+, / Ctrl+, (menu «Настройки…»); Esc goes back.
- With data but no token the home screen stays and shows a «connect your bank» notice.

### Changed

- Home screen shows only spending, balances and import; the token and data cards moved to settings.
- Internal: the interface code is split into layers with automatic checks of their boundaries.

## 0.1.0 — 2026-09-25

First release. Installers: macOS (Apple Silicon, Intel), Windows x64, Linux x64 AppImage — not signed, see [INSTALL](docs/INSTALL.md).

### Added

- Desktop app (Electron) for macOS, Windows and Linux.
- Statement import with a Monobank API token: 1, 3, 12, 24 or 36 months, resumable, survives sleep and network drops.
- Spending by category for a month: gross, refunds, net; personal and business apart; currencies never summed.
- Balances: own funds, credit limit, jars.
- Token in the system keychain, or in memory only when there is no secure store.
- «Delete all data».
- About window with the disclaimer: unofficial app, not affiliated with Monobank.

### Security

- Renderer sandboxed and isolated, strict CSP (`connect-src 'none'`), IPC checks the sender and validates every argument.
- Network only to `api.monobank.ua`.
- Electron fuses: no `ELECTRON_RUN_AS_NODE`, no `NODE_OPTIONS`, no `--inspect`, code only from a checked `app.asar`.
- Own application menu: no DevTools in release builds, no external links.
