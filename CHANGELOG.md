# Changelog

All notable changes to Balance Insights will be documented here.

Format: [Keep a Changelog](https://keepachangelog.com/), versions: [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

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
