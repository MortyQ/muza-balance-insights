# Design

## Context

Follows `.agents/project/core-providers.md`, `core-layout.md`, `domain-rules.md`, the «Add a bank» procedure of
`.agents/skills/core-architecture` and the specs `core-provider-modules`, `core-statement-readers`,
`core-cross-bank-transfers`. Updates none of them except a line in `core-providers.md` listing PrivatBank.

The format below was taken from one real Privat24 statement, analysed by a script that printed only masked shapes and
counts (digits → 9, letters → a). Nothing from it goes into the repository: fixtures are fictional.

Observed layout (first sheet, ~250 operations of one card, ~720 empty formatted rows after them):

| Row | Content |
|---|---|
| 1 | `A1:J1` merged: `Історія операцій за період dd.MM.yyyy - dd.MM.yyyy` |
| 2 | `Дата`, `Категорія`, `Картка`, `Опис операції`, `Сума в валюті картки`, `Валюта картки`, `Сума в валюті транзакції`, `Валюта транзакції`, `Залишок на кінець періоду`, `Валюта залишку` |
| 3… | `dd.MM.yyyy HH:mm:ss` (string cell), category, `9999 **** **** 9999`, description, signed number, `UAH`, unsigned number, ISO alpha, number, ISO alpha |

Facts from the masked analysis:
- rows are newest first; the date is a string cell, not an Excel serial;
- card amount (E) is signed; the operation amount (G) is always positive;
- same-currency rows with |E| ≠ G are transfers only: incoming transfers lose 0.5 % (capped), outgoing ones carry a
  fixed fee on top; the difference is the bank's fee;
- the balance column is the balance after the operation; it follows E for most consecutive rows but not all (some
  operations are not in the file), so it is not used to validate rows;
- no IBAN anywhere; one masked card per row.

## Goals / Non-Goals

**Goals:** read the Ukrainian Privat24 card statement exactly; PrivatBank rules good enough that transfers, own
transfers, fees and categories come out right; nothing domain-side changes.

**Non-Goals:** other languages and formats of PrivatBank statements; FOP; the API.

## Decisions

1. **Provider info.** `privatbank`, name `PrivatBank`, `access: { token: null, file: true }`, `ids: 'prefixed'`,
   `cardTypes: ['card']`, `defaultCardType: 'card'`. The statement does not state the product (Універсальна, Зелена…),
   so one neutral type; a richer list can come when a file states it. Alternative — guessing a type from the card's
   BIN: rejected, a guess stored as fact.

2. **Detection.** `detect` = 2 when sheet 1, row 1 matches `^Історія операцій за період \d\d\.\d\d\.\d{4} - \d\d\.\d\d\.\d{4}$`
   and row 2 equals the ten headers (normalised as Monobank's `norm`); 1 when only the headers match (a re-saved file
   without the title); else 0. Columns are found by header, not by position.

3. **Rows.** Time: `dd.MM.yyyy HH:mm:ss` string in Kyiv time (as Monobank's `parseTime`); a number cell is read as an
   Excel serial in Kyiv time too, since the backlog notes that the decoder keeps serials. Amount = E in minor units of
   F; `currencyCode` = H; `operationAmount` = G with E's sign; `balance` = I (in J's currency, which must equal F);
   `bankCategory` = B; `description` = D; no `mcc`. `commissionRate` = |E| − G for a debit when F = H and |E| > G, in F's minor
   units; a credit gets none (a withheld fee on a transfer from another bank of the user is the cross-bank pairing's
   `transfer_fee`; a commission on the credit too would count it twice). `raw` = the row as an object keyed by header, as Monobank does. A row with all cells empty is skipped;
   any other unreadable row → `bad-row` with its sheet row number.

4. **Grouping.** Rows grouped by C; each group is one `ParsedStatement` (`account: { iban: null, cards: [C], type:
   null }`), rows oldest first, `closingBalance` = the newest row's balance. Alternative — one statement for the
   file: rejected, `core-statement-readers` requires one per account and a Privat card is its own account.

5. **Rules** (`privatbank/rules.ts`, texts in `descriptions.ts`).
   - transfer-like: bank category in {`Перекази`, `Зарахування переказу`, `Переказ на свою картку`,
     `Зарахування зі своєї картки`, `Заощадження`, `Платежі за реквізитами`};
   - own transfer text: `На свою картку *NNNN`, `Зі своєї картки *NNNN`, `Скарбничка`; counterpart: a card of
     PrivatBank type `card` for the first two, null for the jar;
   - auto top-up: none known — `false`;
   - refund credit: a positive non-transfer row (purchases returned keep their merchant category);
   - treasury: description containing `КАЗНАЧЕЙСЬК` or `УДКСУ` (bank-category `Платежі до бюджету` also hints taxes);
   - named sender: `від <name>` → `{ label: 'від', name }`; income source: named sender → `named_sender`, other
     transfer → `transfer`, else `other`;
   - business account: never;
   - category hint: table from bank categories — `Супермаркети та продукти`→groceries, `Ресторани, кафе, бари`→cafes,
     `Транспорт`/`Таксі`→transport, `Аптеки`→health, `Краса`→beauty, `Одяг та взуття`→clothing,
     `Дім та ремонт`/`Побутова техніка`→home, `Поповнення мобільного`→telecom, `Комуналка та Інтернет`→utilities,
     `Розваги`/`Цифрові товари`→entertainment, `Інтернет-магазини`→marketplaces, `Зняття готівки`→cash,
     `Освіта`→education, `Квіти`→gifts, `Фонди та організації`→charity, `Платежі до бюджету`→taxes; transfer
     categories → income / p2p by sign (own transfers are re-set by the derivation, as for Monobank); `Зарахування`→
     income; anything else → null.
   Alternative — a keyword table on descriptions: rejected, the bank's category is already the bank's own judgment
   and descriptions are free text.

6. **Masking** (needs the user's ok). Kept verbatim as `service`: `Скарбничка`, `Зняття готівки в банкоматі`;
   `На свою картку *NNNN` / `Зі своєї картки *NNNN` kept with the digits replaced (`*9999`) — the last four digits are
   not needed in the analysis copy. Everything else, phone numbers of top-ups included, → `[other]` with the existing
   shape classes; no new class.

7. **Desktop.** `entities/bank/looks/privatbank.ts` (monogram `П`, green), `entities.bank.cardType.privatbank.card` in
   the three dictionaries; no skin card, no form (generic file flow). Nothing reaches the renderer beyond what the
   statement flow already passes (counts, dates, currency, card type, last 4 digits); no new IPC, host or file.

8. **Category tables.** `providers/<id>/categories.ts` exports `BANK_CATEGORIES: ReadonlyMap<string, CategoryHint |
   null>` — every bank category the bank is known to use, `null` = known, no hint (transfer categories, decided by
   shape in the rules). The rules' `categoryHint` reads it; `ProviderRules` gains `knowsBankCategory(name): boolean`
   (Monobank: its API sends no bank category, so its table is empty and every name is unknown — never reached, its
   rows have none). The derivation's report adds `Unknown bank categories:` lines `<provider> «<name>» <n>` from one
   `GROUP BY provider, bank_category` query over rows whose name the table does not know. Alternative — a single
   global table across banks: rejected, two banks can use one word differently; per-bank keys stay unambiguous while
   the targets are the common list.

9. **Statement kit.** `providers/statement-kit.ts` (layer `providers`, pure): `gridOf(doc)` (CSV text or the first
   sheet → `string[][]` with typed cells kept), `columnsByHeader(header, spec)`, `kyivTime(cell)` (text
   `dd.MM.yyyy HH:mm[:ss]` or an Excel serial through `shared/excel-date.ts`), `isEmptyRow`. The Monobank reader
   moves onto it in its own task with its tests unchanged. Alternative — a generic table-driven reader: rejected for
   now, two banks are too few to fix its shape.

## Risks / Trade-offs

- [The format is known from one file of one card in UAH] → fixtures cover two cards and a foreign-currency row; the
  backlog item «Real PrivatBank `.xlsx`» stays open for a check with more files (multi-currency card, two cards).
- [Category names may change or grow] → unknown ones import with no hint; the table lives in one file.
- [Statement in English or Russian is not recognised] → it is refused as an unknown format, not misread.
- [Excel serial dates are assumed, not seen] → covered by a fixture; a wrong guess only refuses such a file.

## Open Questions

- The headers of the English / Russian Privat24 statement: once seen (masked), they become `language` refusals or a
  second reader.
