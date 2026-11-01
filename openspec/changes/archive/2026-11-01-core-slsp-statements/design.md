# Design

## Context

The format below comes from the masked layout of three real SLSP statements (consecutive months of one account, about
300 rows). No value from them enters the repository: fixtures and tests are fictional.

- **Page.** A4 PDF made by Compart. Page 1 has a heading: the holder's name and address, then a two-column block with
  these fields:
  - `Názov Účtu`, `Číslo Účtu` (IBAN `SK…`), `BIC GIBASKBX`, `Mena` (currency);
  - `Dátum vyhotovenia výpisu`, `Účtovné obdobie`;
  - `Počiatočný stav Účtu`, `Vklady spolu`, `Výbery spolu`, `Konečný stav Účtu`.

  Later pages repeat one line (number, currency, period). Every page ends with a footer (the bank's contacts, `Strana
  x/y`). The last page carries a note on deposit insurance.
- **Table.** The header is two lines on every page: `Dátum valuty | Dátum zúčtovania | Popis transakcie | Suma
  transakcie | Suma poplatku | Zostatok po transakcii`. Rows run oldest first. A row's first line holds both dates,
  the type, the amount, an optional fee and the balance. The detail lines below hold only the description column. The
  two dates are one text item spanning both date columns (`dd.mm.yyyy dd.mm.yyyy`, sometimes without the space), so
  the column nearest its centre, the booking date, holds both.
- **Details by type:**
  - card types: `Č. k. 4999 99** **** 9999`, the merchant with its city and `dd. mm. yyyy hh:mm:ss` (sometimes
    wrapped onto the next line), an optional `Transakcia prostredníctvom GooglePay | Token <id>`, an optional foreign
    amount `1 234,56UAH` and `Výmenný kurz: 99,9999`;
  - transfers: `<IBAN>: <BIC>` or `<IBAN> BIC: <BIC>`, then `Názov protiúčtu: <name>`.
- **After the last booked row** there may be `Nezrealizované transakcie:` with rows in the same shape, plus the amount
  with its currency and a reason line. In the samples there was one rejected transfer.
- **Checks on the samples, all true:**
  - the running balance row by row (amount plus fee);
  - credits add up to `Vklady spolu`, and debits plus fees to `Výbery spolu`;
  - opening plus totals equals closing, which equals the last row's balance;
  - each month's closing balance equals the next month's opening balance.
- **Types seen:** `Platba kartou` 251, `Prijatá Okamžitá platba` 26, `Vklad cez ATM` 12, `Okamžitá platba
  (elektronicky)` 5, `SEPA platba (elektronicky)` 3, `Prijatá SEPA platba` 1, `Výber kartou` 1 (the only fee),
  `Návrat tovaru` 1. One card per account.
- **Merchants.** Card rows have 78 distinct merchants: the top 10 cover 57% of the rows, the top 20 72% and the top 40
  85%. 46 merchants appear only once.

Followed: `.agents/project/core-providers.md`, `core-layout.md`, `domain-rules.md` and the «Add a bank» procedure of
`.agents/skills/core-architecture`. Updated: `core-providers.md` (an SLSP section; the keyword hint and the new
`pdfTable` options in «Statement files») and the skill's mention of `pdfTable`.

## Goals / Non-Goals

**Goals:**
- An SLSP account statement imports like an A-Bank one: one account per file, re-uploads add only new rows.
- A misread file never reaches the database (the self-check).
- Most card spending gets a category, although the bank states no code.

**Non-Goals:**
- Making every merchant categorised. A merchant seen once stays «other» until the user overrides it.
- Rules shared across banks: everything stays in `providers/slsp/`.

## Decisions

1. **Provider `slsp`, name «Slovenská sporiteľňa», file only, `ids: 'prefixed'`, card types `['card']`.**
   - The statement is an account statement, but the account has one card, and the app's statement kind is `card`
     only.
   - Reading it as `card`, with its IBAN and masked card, fits the existing matching (`statement-import.ts`) without a
     new kind.
   - Alternative: a new `StatementKind 'account'`. Rejected: no code would treat it differently today.

2. **The table through `pdfTable`, with three options.** All of them default to today's behaviour.
   - `rowBand: 'around' | 'below'`. `around` is the current behaviour: each row runs from midpoint to midpoint between
     anchors, which fits A-Bank's date above its time. `below` runs from the anchor line down to the next anchor, which
     fits SLSP's details under the first line. Midpoints would hand a row's lower details to the next row.
   - `pageEndRe`: a line matching it ends the table on that page. This covers the footer and the insurance note.
     `tableEndRe`: a line matching it ends the table for the rest of the document. This covers `Nezrealizované
     transakcie`.
   - The table also returns `lines: Array<Record<F, string[]>>`, parallel to `rows`: each cell's lines top down. `rows`
     stays as it is. SLSP needs the description's lines apart: the type, the card, the merchant, the wallet, the
     foreign amount and the rate.
   - Anchor: the booking-date column matching both dates (`^\d{2}\.\d{2}\.\d{4} ?\d{2}\.\d{2}\.\d{4}$`). The header is
     found by its six Slovak column names (two lines). Page end: the footer's document code line and the bank's
     contacts, and the deposit-insurance note. Table end: `Nezrealizované transakcie:`.
   - Alternative: an SLSP-only line parser on the text layer. Rejected: the glued dates and wrapped merchants are a
     position problem, and the kit already solves positions.

3. **Reading a row.**
   - The type is the first description line.
   - Card rows: the card from the `Č. k.` line. The merchant text is the rest of the detail lines joined, without the
     card line, the wallet line, the foreign amount line, the rate line and the trailing `dd. mm. yyyy hh:mm:ss`. That
     date and time is the row's time (`wallTime` in `Europe/Bratislava`); a wrapped date is joined first. When the
     details state no time, the booking date at 00:00 Europe/Bratislava is used.
   - Transfer rows: the counterparty's IBAN (`counterIban`, spaces removed) and name (`counterName`). The description
     is the name, as Monobank's transfers carry the person's name.
   - Amounts: `localAmount` → `toMinor` in the heading's currency. `amount = sum + fee` (both are signed and the fee is
     negative), and `commissionRate = |fee|` when there is a fee.
   - Foreign currency: `operationAmount` with the sign of `amount`, `currencyCode` the stated currency. Otherwise the
     account currency and `operationAmount = amount`.
   - `bankCategory` is the type; `mcc` is absent; `balance` is the balance column. `raw` holds the joined cells.
   - Order: the file's order, then a stable sort by time (as A-Bank). Card rows may move before date-only rows of the
     same day; the self-check runs on the file's order before the sort.

4. **The self-check refuses.**
   - Per row in file order: `previous balance + sum + fee = balance`, starting from the heading's opening balance.
   - Then: the credits' sum equals `Vklady spolu`, the debits' and fees' sum equals `Výbery spolu`, and the closing
     balance equals the last balance.
   - Any break → `{ ok: false, problem: 'bad-row', row }`, the first row that breaks; the totals → the last row.
   - This guards the position-based reading, which has no column names per row to fall back on.
   - Alternative: warn and import. Rejected: a wrong amount in the database is worse than a refused file the user can
     report.

5. **Detect.** Score 2 when the heading holds `Výpis z Účtu` and `GIBASKBX`; score 1 with the table header alone;
   otherwise 0.

6. **The type as the bank category (`providers/slsp/categories.ts`).**
   - `BANK_CATEGORIES`:
     - the four transfer types → `null` (decided by the rules);
     - `Výber kartou` → `cash`;
     - `Vklad cez ATM` → `income`;
     - `Návrat tovaru` → `null` (a refund by the rules);
     - `Platba kartou` → `null` (the keywords decide).
   - The rules work like PrivatBank's:
     - `isTransferLike`, `isPersonTransfer`: the transfer types;
     - `categoryHint`: transfers → `income` / `p2p` by sign, else the table, else the merchant keywords (`null` when
       none match);
     - `isRefundCredit`: a credit that is not a transfer and not a deposit;
     - `incomeSource`: transfers → `transfer`, else `other`;
     - `namedSender`: none;
     - own-transfer texts: none (own transfers come from the IBAN rule).
   - **A cash deposit is income.** Decided here and open to the review. A deposit of the user's own cash is not
     earned money, but the app has no «cash in» category, and leaving it out would break the balance view.

7. **Merchant keywords (`providers/slsp/merchants.ts`).**
   - An ordered `Array<{ words: string; hint: CategoryHint | null; first?: true }>`.
   - Normalisation: NFKD with the diacritics stripped, upper case, every run of non-letters and non-digits → one space.
   - An entry matches when its words are a whole-word sequence of the text (`first`: at the start).
   - The first match wins. `hint: null` = known, no category (kiosks before `BILLA`).
   - The list is the table in the proposal, approved in its review.
   - It is applied only by SLSP's `categoryHint` and only to rows its type leaves open, so rows with an MCC or a mapped
     category of any bank never reach it.
   - Alternative: a shared `providers/merchant-keywords.ts` for every bank without an MCC. Deferred: a shared module
     needs a boundary-test allowance and has one user today.

8. **Masking: no new template.** `maskDescription` returns `[other]` with `descClass: 'other'` for every description:
   a merchant, or a person's name. The type is not in the description, and `bank_category` never reaches the copy.
   So the copy cannot tell SLSP's types apart. That is accepted, since adding them would be a new template and need
   its own ok.

9. **Desktop.**
   - `entities/bank/looks/slsp.ts` with monogram `S`. No logo: no trademark file is shipped.
   - Card type name `entities.bank.cardType.slsp.card` in the three dictionaries.
   - The generic file flow. The open dialog's filter is `pdf`.

## Risks / Trade-offs

- **The time zone of card times.** The stated time is assumed to be Bratislava time, including for purchases abroad
  (seen for purchases in Ukraine). If the bank writes the merchant's local time, such a row may land an hour off. It
  matters only near midnight. The check against a matching Monobank operation goes to `docs/backlog.md`.
- **`BOLT`.** The texts show two forms (`BOLT.EU/O/…` and `BOLT.EU/P/…`), and which of them is ride-hailing and which
  something else (food, scooters) is unknown. Both map to transport until real data shows otherwise.
- **Transfers have no time,** so the cross-bank pass (0–180 s) never pairs them. Own transfers rely on the IBAN rule.
  One to a bank whose IBAN the app does not hold counts as a payment to a person or as income. The user can override.
- **Keywords can misfire** on a merchant that shares a word with a chain. Whole-word matching and the order limit
  this; the safe failure is a wrong category the user can override, never a lost row.
- **The self-check refuses a file** where a layout change shifts one cell. That is intended. The refusal names the row.
- **A layout change across years** (other column names, an English statement) gives `unknown-format`. A new reader is
  then a small addition.

## Open Questions

- None that block the tasks. The review may change the answer in decision 6 (cash deposit = income) and the keyword
  list. Both are data in one file each.
