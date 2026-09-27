# Balance Insights

Desktop app that shows where your money goes, from your Monobank statement — on your computer, not in someone's cloud.

> **Unofficial app, not affiliated with Monobank.** Неофициальное приложение, не связано с Monobank.

**Status:** early development (`0.1.x`, pre-release). macOS, Windows, Linux.

## Install

Download from [Releases](https://github.com/MortyQ/muza-balance-insights/releases/latest) and follow [the install steps](docs/INSTALL.md): the installers are not signed, so macOS and Windows warn you the first time.

## What it does

- Imports your statement with your personal Monobank API token (you create it at [api.monobank.ua](https://api.monobank.ua/)).
- Spending by category for a month: gross, refunds, net. Personal and business (FOP) apart. Currencies are never summed.
- Balances: own funds, credit limit, jars.
- Transfers between your own accounts and refunds are recognised, so they are not counted as spending.

## Privacy

- Data stays on your computer: a local SQLite database in the app folder.
- The database is encrypted (AES-256) with a random key kept in the system keychain, like the token. A copy of the files — on
  another computer or user account, in a backup or a cloud folder — can't be opened. Programs running under your own
  account can get the key (on Windows, DPAPI opens it for any program of the same user). On Linux without a keyring the
  database stays unencrypted until one appears, and the app says so in Settings.
- The app folder is readable only by your user account (macOS, Linux). Disk encryption — FileVault on macOS, BitLocker or
  Device Encryption on Windows, LUKS on Linux — is still worth turning on.
- The token is kept in the system keychain (macOS Keychain, Windows DPAPI, Linux Secret Service or KWallet). If there is no secure store, it is kept in memory only and never written to disk.
- Network only to trusted services: `api.monobank.ua` (your statement) and GitHub (update checks — every few hours the app asks
  whether a new version is out; you can switch this off in Settings). No analytics, no telemetry.
- Updates are installed only if they are signed by the author and the file matches the signed description.
- «Delete all data» in the app removes the database and its key, the token, the app lock and any unfinished import.

## Code signing policy

Free code signing provided by [SignPath.io](https://about.signpath.io/), certificate by [SignPath Foundation](https://signpath.org/).
Windows builds will be signed this way once the project is set up with SignPath; until then the Windows installers are unsigned
(see [Install](#install)). macOS builds are not signed with an Apple Developer ID.

- Only builds made by the [release workflow](.github/workflows/release.yml) on GitHub-hosted runners from this repository's
  source are signed, and each release is approved manually.
- Committers and reviewers: [MortyQ](https://github.com/MortyQ)
- Approvers: [MortyQ](https://github.com/MortyQ)
- Privacy: see [Privacy](#privacy). The app sends nothing except your statement requests to `api.monobank.ua` (with the token
  you enter) and update checks and downloads to GitHub, which you can switch off in Settings.

## Repository

| Path | What |
|---|---|
| `packages/core` | platform-independent core: API client, import, categories, transfers, aggregates |
| `packages/db-libsql` | Node adapter for libsql (SQLite) |
| `apps/desktop` | the Electron app |
| `apps/mcp` | a local MCP server over the same core (developer tool) |

## Development

Requires Node 22 (`.nvmrc`) and pnpm 12.

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm --filter @mono/desktop dev
```

`dev` downloads the Electron binary on first run if it is missing.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Security issues: [SECURITY.md](SECURITY.md) — please do not open public issues for them.

## License

[MIT](LICENSE) © 2026 MortyQ
