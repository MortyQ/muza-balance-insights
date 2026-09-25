# Balance Insights

Desktop app that shows where your money goes, from your Monobank statement — on your computer, not in someone's cloud.

> **Unofficial app, not affiliated with Monobank.** Неофициальное приложение, не связано с Monobank.

**Status:** early development, first release `0.1.0` in preparation. macOS, Windows, Linux.

## What it does

- Imports your statement with your personal Monobank API token (you create it at [api.monobank.ua](https://api.monobank.ua/)).
- Spending by category for a month: gross, refunds, net. Personal and business (FOP) apart. Currencies are never summed.
- Balances: own funds, credit limit, jars.
- Transfers between your own accounts and refunds are recognised, so they are not counted as spending.

## Privacy

- Data stays on your computer: a local SQLite database in the app folder.
- The token is kept in the system keychain (macOS Keychain, Windows DPAPI, Linux Secret Service or KWallet). If there is no secure store, it is kept in memory only and never written to disk.
- The only network destination is `api.monobank.ua`. No analytics, no telemetry, no update checks (yet).
- «Delete all data» in the app removes the database, the token and any unfinished import.

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
