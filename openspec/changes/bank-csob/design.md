# Design

## Context

The layout below comes from a masked look (digits → 9, letters → a/A) at one ČSOB export the user received from an
acquaintance. Its format is real, but its amounts were edited: they are unsigned integers and never reconcile with the
balances (0 of 900 adjacent pairs, by sign or by type). No value from it enters the repository: fixtures and tests are
fictional.

- **File.** UTF-8, CRLF, comma-separated, quoted fields.
  - Line 1: `Payment history 999999999/9999 on 99.99.9999 99:99:99.`
  - Line 2: empty.
  - Line 3: the 24-column header: `account number, due date, amount, currency, balance, counter account, counter
    account bank code, counter account name, counterparty address, constant symbol, variable symbol, specific symbol,
    transaction type, standing order name, personal note, note, category, original transaction, rate, <an end-to-end
    reference column>, payer reference, original payer, the final beneficiary, ID transakce`.
- **Rows.** 901 operations of one account, all in CZK, newest first (`dd.mm.yyyy`, no time). Then 17 rows that fill
  only `balance`.
- **Columns:**
  - the account number is the same on every row;
  - counter accounts have the shapes `9999999`…`999999999999`, `99-9999999999`, `999-9999999999`, or empty;
  - counter bank codes are 3 or 4 digits, a BIC, or empty;
  - `original transaction` is `999,99 CZK`, or in ALL, EUR, JPY, PLN, USD;
  - `rate` is `99,999` or empty;
  - `ID transakce` is unique on every row.
- **Types:** «Debit card transaction», «Outgoing instant payment», «Incoming instant payment», «Outgoing payment»,
  «Incoming payment», «Outgoing payment - Payment button», «El. banking standing order <number>», «Foreign payment -
  fee», «Incoming foreign payment», «Card transaction - refund», «Cash deposit through cash deposit ATM».
- **Categories (20):** Groceries, Outgoing unclassified, Restaurants, Income, Bank transactions, Shopping and services,
  Taxes, Fuel, Drugstore goods, Transportation, Leisure time and entertainment, TV, internet, phone, ATM Withdrawals,
  Clothing and shoes, Vacation, Health, Car, Insurance, Sports and equipment, Home equipment.
- **Notes.** Card rows: `Amount: …, Place: <merchant>`. Some transfers start with `Prijemce`. No card number anywhere.

Followed: `.agents/project/core-providers.md`, `core-layout.md`, `domain-rules.md` and the «Add a bank» procedure of
`.agents/skills/core-architecture`. Updated: `core-providers.md` (a ČSOB section). The renderer part is one look file in
`entities/bank/looks/` and three dictionary keys; no new slice.

Not security-relevant: no network, IPC, storage or token change. The reader is pure and gets decoded text only.

## Decisions

### 1. Provider info

`csobInfo`: id `csob`, name «ČSOB», `access: { token: null, file: true }`, `ids: 'prefixed'`, `cardTypes: ['card']`.
The export does not name a card or a product, as with SLSP.

### 2. Detect and read

`csob-account-csv-en` (`extensions: ['csv']`), on `gridOf` and `columnsByHeader` of the statement kit.

- `detect`: 0 without the header, 1 with the header found on any of the first lines, 2 with the header and the title
  line. A Czech export (`číslo účtu, datum splatnosti, …`) is not claimed. Recognising it and refusing it as `language`
  is left until a real one is seen.
- Rows are taken from the header down. A row with an empty `due date` is skipped (the trailing balance rows). The
  list is reversed so the rows are oldest first.
- Amounts go through one helper: an optional sign, digits with optional thousands spaces, an optional decimal comma or
  dot with 1–2 digits, then `toMinor`.

Alternative considered: refuse the file unless the amounts reconcile with the balances, as SLSP does. Rejected for
now. The only sample has edited amounts, so the check could not be tested against a real file, and a wrong guess would
refuse every real upload. Backlog: check the arithmetic on the first real upload and add the check then.

### 3. Direction

`descriptions.ts` holds `CREDIT_TYPES` and `DEBIT_TYPES`, plus the standing order pattern
`/^El\. banking standing order(?: .*)?$/` (a number after it, with or without brackets). A sign in the amount wins over the type, because a real export may well be
signed. An unsigned amount with an unknown type is `bad-row`. A guess would put money on the wrong side of the balance.

### 4. IBAN from the account number

`iban.ts` (pure, in the provider): `czIban(prefix, number, bankCode)` → `CZkk BBBB PPPPPP NNNNNNNNNN` with mod 97-10
check digits (computed on the digit string with `BigInt` or in chunks; no float). It is used for the file's own
account, and for counter accounts whose bank code is 4 digits. A BIC bank code means a foreign account: it gets no IBAN,
only its name. The helper stays in `providers/csob/` until a second Czech bank needs it.

### 5. Bank category and hints

The rules see one `bankCategory`. Storing only the type (as SLSP does) would lose the bank's own classification, for
example a utility paid by transfer. Storing only the category would lose the transfer signal: an incoming payment's
category is «Income», whether it is salary or money from the user's other bank. So:

- `bankCategory = category`, except for a transfer type whose category is generic (`Income`, `Outgoing unclassified`,
  `Bank transactions`, empty), where it is the type, with the standing order number dropped.
- `rules.ts`: a transfer type is transfer-like; income when credited, `p2p` when debited, `incomeSource: 'transfer'`.
  Refund credits: «Card transaction - refund» and any other credit that is not a transfer, income or a cash deposit.

| ČSOB category | Hint |
|---|---|
| Groceries | groceries |
| Restaurants | cafes |
| Income | income |
| Taxes | taxes |
| Fuel, Car | car |
| Drugstore goods | beauty |
| Transportation | transport |
| Leisure time and entertainment | entertainment |
| TV, internet, phone | telecom |
| ATM Withdrawals | cash |
| Clothing and shoes | clothing |
| Vacation | travel |
| Health | health |
| Insurance | insurance |
| Sports and equipment | sport |
| Home equipment | home |
| Shopping and services, Outgoing unclassified, Bank transactions | null (known, no hint) |
| each transfer type, «Cash deposit through cash deposit ATM» | null / income, by the rules |

«Foreign payment - fee» is stored with its category, usually «Bank transactions»: known, no hint. Making it the
commission of the payment before it is out of scope.

### 6. Rows

- `time`: `wallTime(<due date> 00:00, 'Europe/Prague')`.
- `amount` / `currencyCode`: the account amount and currency.
- `operationAmount` / `operationCurrency`: from `original transaction` only when its currency differs.
- `description`: the `Place:` part of `note`, else `counter account name`, else the type.
- `counterIban`: from §4, else null. `counterName`: `counter account name` or null.
- `mcc: null`. The comment and the symbols are not read.

Row ids use the shared rule (account, second, amount, order), so a re-upload adds only new rows. `ID transakce` is
not used for the id, because the domain's id rule is the same for every bank.

### 7. Masking

`maskDescription` → `[other]` for every row, as SLSP does. No new template; nothing new reaches the analysis copy.

### 8. Desktop

`entities/bank/looks/csob.ts`: monogram `Č`, `bg-info text-info-foreground` with a series colour not used by the other
looks. Dictionary keys `entities.bank.cardType.csob.card` in the three languages. No `PROVIDER_FORMS` entry.

## Risks

- **The real amounts may differ from the sample** (a sign, decimals). The reader accepts both forms. The first real
  upload is a live check (backlog).
- **Midnight dates** pair poorly with another bank's transfers by time. Own transfers still pair by IBAN.
- **A Czech-language export** is not claimed and is refused as an unknown format. That is honest, and the fix is
  another reader.
