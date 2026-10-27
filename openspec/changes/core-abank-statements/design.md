# Design

## Context

This change follows:
- `.agents/project/core-providers.md`, `core-layout.md` and `domain-rules.md`;
- the «Add a bank» procedure of `.agents/skills/core-architecture`;
- the specs `core-provider-modules`, `core-statement-readers` and `core-cross-bank-transfers`;
- the PrivatBank change (`core-privatbank-statements`), which this one mirrors where the banks agree.

It updates `core-providers.md` (A-Bank in the list of banks, the credit limit of a statement) and the «Add a bank»
procedure (the PDF helpers of the kit).

The layout below was taken from two A-Bank statements the user shared in chat: a spreadsheet re-saved in Apple Numbers
and a PDF re-saved by macOS (originally made by Apache FOP), with the client block blanked out. Nothing from them goes
into the repository: fixtures use the layout with fictional values.

Spreadsheet (first sheet «Рух коштів по картці»):

| Rows | Content |
|---|---|
| top | free-text lines in column A, some with a second one in column H: «Клієнт: …», «Інформація по картці: <mask>», «Рахунок: <IBAN>», «Період: dd.MM.yyyy – dd.MM.yyyy», «Кредитний ліміт (станом на dd.MM.yyyy): N UAH», «Заборгованість (…)», «Баланс на початок / кінець періоду: N UAH», «Сума витрат / зарахувань / комісій / кешбеку за період: N UAH» |
| header | `Дата i час операції`, `Номер картки`, `Деталі операції`, `MCC`, `Сума в валюті картки (UAH)`, `Сума в валюті операції`, `Валюта`, `Курс`, `Сума комісій (UAH)`, `Сума кешбеку (UAH)`, `Залишок після операції` |
| rows | `dd.MM.yyyy HH:mm`, `9999****9999` or `-`, details, MCC or empty, signed `-9 999,99`, signed operation amount, ISO alpha, `-` or `99.99`, fee, cashback or `-`, balance |

PDF: A4 landscape. Every page has the bank's header block, the date and number of the statement and «Сторінка N з M».
Page 1 also has the title «Виписка по картці», the client block and the same summary lines. The table header repeats
on every page, set over up to five lines. Its spellings differ from the spreadsheet: `Дата і час` (Cyrillic «і»),
`Сума у валюті карти (UAH)`, `МСС` (Cyrillic), `після операціЇ`. A row is three lines: the date, then the middle line
with every other cell, then the time. Details are centred in their column, amounts are right-aligned.

What the masked analysis found:
- the balance after each operation follows the card amount on every consecutive row, and the period's start and end
  balances close the chain;
- the balance includes the credit limit (end balance = limit − debt);
- the card amount of a cash withdrawal = operation amount + fee;
- the spreadsheet's «Сума витрат» is the sum of debits, without refunds;
- the cashback credit carries MCC 4829, and so does a `MONO*<name>` credit;
- a «Скасування.» row may have a card number or «-»;
- one refund has neither the prefix nor an MCC;
- a purchase may have «-» as its card.

## Goals / Non-Goals

**Goals:**
- read A-Bank's Ukrainian card statement from `.xlsx` and `.pdf` exactly;
- read the credit limit so own funds are right;
- rules good enough that transfers, cashback, refunds and fees come out right;
- nothing domain-side changes beyond the credit limit of a statement.

**Non-Goals:**
- other languages, products or formats (`.numbers`, CSV);
- the API;
- changes to the MCC table or to the pairing.

## Decisions

1. **Provider info.** `abank`, name `A-Bank`, `access: { token: null, file: true }`, `ids: 'prefixed'`,
   `cardTypes: ['card']`, `defaultCardType: 'card'`. The file says neither the product nor whether it is a credit card,
   so the type is one neutral entry.
   - Alternative: `credit` whenever a limit is stated. Rejected: the type is the product, and the limit is stored
     anyway.

2. **Columns.** One column spec for both readers, matched by `columnsByHeader` on headers normalised by `normHeader`:
   - the regexes allow both spellings (`/^дата [іi] час операції$/`, `/^сума [ву] валюті карт(ки|и) \((\w{3})\)$/`
     capturing the account currency, `/^(mcc|мсс)$/`, `/^залишок після операції$/` after lower-casing);
   - the spec is the same for both: there is no second «language».
   - Alternative: a homoglyph-folding step in `normHeader`. Rejected: it changes the matching of the existing readers
     for one bank.

3. **Spreadsheet reader** (`abank-card-xlsx`, extensions `xlsx`):
   - finding the table: the header row is the first row of the grid whose cells match the spec; the lines above it
     are the heading;
   - detection: 2 when the heading has a line `^Рахунок: UA\d{27}$` or `^Інформація по картці: `, else 1, and 0 when
     no header row matches;
   - IBAN from the «Рахунок:» line; credit limit from `^Кредитний ліміт \(станом на \d\d\.\d\d\.\d{4}\): (.+) (\w{3})$`
     (that currency must equal the account currency, else `bad-row` on that line);
   - the rows go through the shared row reader (decision 5).

4. **PDF reader** (`abank-card-pdf`, extensions `pdf`) on new kit helpers (decision 6):
   - detection: 2 when page 1 has a line «Виписка по картці» or one containing «АКЦЕНТ-БАНК» and every page with rows
     has the header; 1 with the header only; 0 otherwise;
   - heading lines (IBAN, credit limit) as in the spreadsheet: page 1's lines above the first header, each read as
     text;
   - when the PDF states no IBAN (the analysed file's client block was blanked, so whether the real one states it
     is not known), the account has `iban: null` and is matched by its cards;
   - a `bad-row` number is the operation's position in the file, from 1.

5. **Rows** (shared by both readers):
   - time: `wallTime(date + ' ' + time)`, Kyiv, to the minute; row ids already handle minute times
     (`core-statement-readers`);
   - card: `-` → none;
   - MCC: empty → absent, else an integer;
   - amounts through `localAmount` (decision 6), into minor units of the account currency (card amount) and of the
     operation currency;
   - `operationAmount` keeps its sign as stated and must match the card amount's sign;
   - `commissionRate` = fee when > 0;
   - `cashbackAmount` = cashback when not `-` (may be negative on a reversal);
   - `balance` = balance after the operation;
   - the rate is not stored (Monobank stores none either);
   - `raw` = the row keyed by header, as the other readers do.

   The statement:
   - `{ kind: 'card', currencyCode, account: { iban, cards: distinct row cards, type: null } }`;
   - rows oldest first (reverse, then stable sort by time);
   - `closingBalance` = the newest row's balance;
   - `creditLimit` from the heading, else null.

6. **Statement kit additions** (`providers/statement-kit.ts`, pure):
   - `localAmount(text)`: `-1 234,56` with a space, no-break or narrow no-break space between thousands and a decimal
     comma, or the plain stored number `-1234.56`, to the `toMinor` form; `-` → null.
   - `pdfLines(page, tolerance)`: items grouped into lines by baseline `y` within a tolerance, sorted by `x`.
   - `pdfTable(doc, spec)`. On each page it finds the header: the band of lines whose items, joined top to bottom per
     column, match every field of the spec. Each column is given the horizontal span of its header items; an item
     belongs to the column whose span its centre is nearest to.
   - Below the header, a **row anchor** is a line with a value in an anchor column (the card amount). A row's band is
     the space between the midpoints to the neighbouring anchors, and its cells are that band's items per column,
     joined top to bottom with a space.
   - So the date + time pair, and a description that wraps, both read as one cell. Lines outside the header and the
     bands (page header, «Сторінка N з M») are not read.
   - Alternatives:
     - fixed x positions: rejected, a different font or a re-saved file moves them;
     - "the line above / below" without bands: rejected, a wrapped description breaks it.

7. **Credit limit of a statement.**
   - `ParsedStatement` gains `creditLimit?: number | null` (absent = not stated, so the existing readers need no
     change).
   - `ingest/statement-import.ts` writes `credit_limit` when inserting a new account, and in the same `UPDATE` as the
     balance, under the same «newer than the account» condition.
   - `read/status.ts` already gives `own_funds = balance − credit_limit`.
   - Alternative: the reader subtracts the limit from every balance. Rejected: the balance column means the same as
     Monobank's API balance, which includes the limit, and the app already knows how to show that.

8. **Rules** (`abank/rules.ts`, texts in `descriptions.ts`, empty `categories.ts`):
   - `isTransferLike`: `mcc === 4829`, and not the cashback text;
   - own-transfer texts, auto top-ups, the treasury and business accounts: none known, so `false` / `null`. Taxes paid
     by card carry MCC 9311 / 9399 from the table;
   - `isRefundCredit`: `amount > 0`, not transfer-like, not the cashback text, `mcc !== 6012`. This covers
     «Скасування.» and the prefix-less refund;
   - `categoryHint`: transfer → `income` / `p2p` by sign; cashback text → `income`; MCC 6012 → `income` for a credit,
     null for a debit (no debit was seen); else null, so the MCC table decides;
   - `incomeSource`: 6012 → `other_bank`; `MONO*` → `named_sender`; other transfer → `transfer`; else `other`;
   - `namedSender`: `^MONO\*(.+)$` → `{ label: 'MONO*', name }`;
   - `isPersonTransfer`: transfer-like and not the cashback text;
   - `knowsBankCategory`: the table is empty, and A-Bank rows have no bank category.
   - Alternatives:
     - 6012 credits as transfers, so a top-up from PrivatBank pairs. Rejected: MCC decides (the user's rule), and
       Monobank reads 6012 the same way. It stays an open question in the risks;
     - a merchant-name table. Rejected: MCC decides.

9. **Masking** (needs the user's ok, proposal):
   - kept as `service`: `Зарахування кешбеку на картку` and `Зняття готівки`;
   - `Скасування. <merchant>` → `Скасування. [other]`, `service`;
   - `MONO*<name>` → `MONO*[other]`, `from_prefix`;
   - everything else → `[other]` with the shape classes; no new class.

10. **Desktop.**
    - `entities/bank/looks/abank.ts`: monogram `A`. The colour is the closest existing theme token to the brand, picked
      in the task and shown to the user.
    - `entities.bank.cardType.abank.card` in the three dictionaries.
    - No skin, no form: the generic file flow. No new IPC, host or file.

## Risks / Trade-offs

- [The spreadsheet seen was re-saved by Numbers, which keeps every cell as text] → the reader takes both text and
  stored numbers (decision 6) and Excel serial dates (`wallTime`). The backlog item «Real A-Bank files» covers an
  original `.xlsx`.
- [The PDF seen was re-saved by macOS, and its client block and three pages were blank] → the band-based reading does
  not depend on exact positions; an IBAN that is not found leaves `iban: null`. The backlog item covers an original
  PDF with several pages and wrapped descriptions.
- [A top-up from another bank with MCC 6012 does not pair with that bank's debit] → it counts as income here and
  spending there, the safe failure of the pairing rules. Revisit once real pairs are seen.
- [The cashback credit is recognised by its exact text] → a renamed text becomes a transfer: income, no pair, close to
  right. It stays in one constant.

## Open Questions

- Does the original PDF state the IBAN and the credit limit in its client block? If yes, they are read as in the
  spreadsheet; if no, PDF accounts are matched by card only.
