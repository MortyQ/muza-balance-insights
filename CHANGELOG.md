# Changelog

All notable changes to Balance Insights will be documented here.

Format: [Keep a Changelog](https://keepachangelog.com/), versions: [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### Added

- Automatic updates on Windows and Linux (AppImage): downloaded in the background, installed on restart or quit.
- macOS: «new version» notice; the verified `.dmg` is saved to Downloads.
- Settings → Updates: version, «check now», automatic checks on/off (on by default).

### Security

- Every update is verified with the author's ed25519 signature (the public key is inside the app) and its size and sha512
  before it is installed or saved.
- Network access is a list of trusted services (GitHub for updates, Monobank for the import); each part of the app may use
  only its own.

## [0.1.1] — 2026-09-25

### Added

- First start: choose your bank (Monobank; more banks marked «coming soon»), then paste the token.
- Settings screen: connected bank (replace the token, disconnect — data stays), «Delete all data», about.
  Opens from the gear on the home screen or with Cmd+, / Ctrl+, (menu «Настройки…»); Esc goes back.
- With data but no token the home screen stays and shows a «connect your bank» notice.

### Changed

- Home screen shows only spending, balances and import; the token and data cards moved to settings.
- Internal: the interface code is split into layers with automatic checks of their boundaries.

## [0.1.0] — 2026-09-25

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
