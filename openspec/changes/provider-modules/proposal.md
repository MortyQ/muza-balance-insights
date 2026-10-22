# Proposal

## Why

The app's purpose is one combined view of a person's or family's money across every bank. Today only Monobank is
wired in: its API and its CSV card statement. Another team will add PrivatBank and A-Bank after the refactor. Both
come in by statement upload only:

- PrivatBank as `.xlsx`;
- A-Bank as `.pdf`.

Adding a bank has to be a contained task: one provider folder plus its reader, with no edits to the domain.

## What Changes

- **Provider modules.** A provider declares its halves in one place: rules, an optional API client, optional statement
  readers, and desktop metadata (access method, credential shape, network services). Core, worker, main and renderer
  read the provider from one registry instead of naming Monobank. This removes `ProviderKey`, the default provider
  and the renderer's fallbacks to Monobank. What is Monobank's by nature stays: the database file name, the rates
  source and the legacy token file (design, decision 9).
- **Statement readers with automatic detection.**
  - One reader contract. Every reader says how sure it is that a document is its own, and reads it into statements.
  - A registry picks the reader from the file itself (format signature, then column or header signature), not from
    the extension or the user's bank choice.
  - Binary formats are decoded at the platform edge into a neutral document: CSV becomes text, XLSX becomes a cell
    grid, PDF becomes positioned text. The core stays free of zip and PDF code.
  - Decoding untrusted PDF/XLSX runs outside the Electron main process. That is a security decision for the design.
- **Several cards in one statement.** A PrivatBank or A-Bank file may hold several cards. The reader splits rows by
  card. An A-Bank statement names one account (IBAN) with several cards on it.
- **Operations without an MCC.** `NormalizedTx.mcc` becomes optional, and the domain rules become NULL-aware.
  Category then comes from the provider's own hint, such as PrivatBank's category column mapped by the provider.
  Storage already allows NULL from change 1, migration 16.
- **Own transfers between banks.** A transfer from an account in one bank to the same person's account in another
  bank is internal: neither spending nor income. Transfers between different people stay family transfers.
  - **Time:** the two halves are at most **3 minutes** apart. A-Bank states time to the minute.
  - **Fee:** the debit may exceed the credit by the transfer fee, up to **5 %** of the amount.
    - Published tariffs are not a fixed table: they vary by card, by own versus credit funds and by card network, and
      PrivatBank has a minimum fee.
    - So the rule is a tolerance, not a tariff. Whether small transfers also need an absolute floor is decided in the
      design.
  - **Explicit fee:** when the sending row carries its own commission, as Monobank's API and A-Bank's PDF do, that
    commission is the fee.
  - **Implicit fee:** otherwise the difference between the debit and the credit is the fee, counted as spending in its
    own category for inter-bank transfer fees. It is separate from «Bank fees».
  - Same currency only. Same-bank pairs keep their current 20-second rules.
- **Re-uploads add only what is new**, as the Monobank CSV does, for every provider's files.
- **Namespaced ids.** Account and operation ids carry the provider, so two banks can never collide. Statement row ids
  include this too.
- **Provider conformance tests.** Every provider passes the same contract suite on fictional fixtures.

## Capabilities

### New Capabilities

- `core-provider-modules`: one registry of bank providers and what each declares; namespaced ids; operations without
  an MCC and the bank's own category; the conformance suite every provider passes.
- `core-statement-readers`: one reader contract over a neutral document; the reader picked from the file itself;
  several accounts in one file; re-uploads add only what is new.
- `core-cross-bank-transfers`: own and family transfers between accounts in different banks, with the time and fee
  tolerance and the implicit fee as its own spending category.
- `desktop-statement-decoding`: binary statement files are decoded into the neutral document outside the main process,
  with no network, no database key and fixed limits.

### Modified Capabilities

- `core-derived-data`: the implicit inter-bank fee joins the derived values stored per operation.

## Impact

- **Affected:**
  - `packages/core`: providers, statement import, transfers, categories, scope, connections;
  - `apps/desktop`: `integrations/`, `net/`, `worker/`, `main/statements.ts`, renderer `entities/bank`,
    `features/integrations`.
  - A PDF text extractor and an XLSX reader become new dependencies of the desktop app (`pdfjs-dist`, `fflate`,
    `fast-xml-parser`; design, decision 8).
  - Migration 17: two nullable columns on `transactions`, no rebuild.
  - `apps/mcp`: only what the contract changes require to compile; its Monobank wiring stays.
- **Trust anchors:** expected none. The network allowlist test changes only if a provider brings an API host, and
  these two banks do not.
- **User-visible:** not yet. With Monobank alone no figure changes; the bank picker loses the «soon» tiles. New banks
  by file, transfers between banks and the transfer-fee category become visible when the first new bank's reader
  lands, and that change writes the `CHANGELOG.md` entries.
- **Out of scope:** the PrivatBank and A-Bank readers themselves (the other team's work on top of this contract),
  open banking / OAuth, and new API providers.
