# Бэклог

Перенесено из корневого `CLAUDE.md` (27.09.2026).

## Обязательно до MVP

- **Выбор счетов: переводы без пары на выключенный счёт** — остаются внутренними, если текст банка не называет счёт
  однозначно: автопополнение банки («10%», «До 10₴») с выключенной карты, «З Чорної картки» при двух чёрных картах,
  одна из которых включена. Нужны данные о том, как банк подписывает такие строки, прежде чем ловить их иначе.

- **Проверка безопасности для OAuth и open banking** (решение пользователя 27.09.2026: делаем обязательно; токен API
  банка — не самый надёжный способ доступа, цель — перейти на open banking). Сейчас сетевые правила запрещают редиректы
  и любые адреса вне `TRUSTED_SERVICES` (`apps/desktop/src/net/allowlist.ts`, `.agents/project/desktop-security.md`),
  а OAuth требует и того и другого. Отдельная спека и ревью до кода:
  - как проходит вход: системный браузер + loopback / свой протокол, PKCE, `state`; обработка редиректа только в main,
    renderer не видит ни кода, ни токенов;
  - какие хосты банка и провайдера open banking добавляются в список доверенных, редиректы — только по точному списку
    (правка `allowlist.test.ts` отдельным шагом);
  - хранение access / refresh токенов (safeStorage, как `TokenVault`), срок жизни, обновление и отзыв, «Удалить все данные»
    и «Начать заново» их тоже стирают;
  - CSP и fuses не ослабляются; что меняется в `wipe.ts`, `start-over.ts`, импорте под замком.
  Подготовка уже есть: домен `integrations` (папка на банк), `auth: 'token' | 'oauth' | 'file'` у банка в `entities/bank`.
  Следом — общий тип доступа вместо строки-токена (этап 5 плана `docs/superpowers/plans/2026-09-27-integrations-domain.md`).

- **Шифрование базы: не проверено вживую** — шифр в бинарниках libsql win32/linux (первый прогон release на Windows),
  darwin-x64; тексты ошибок `decryptStringAsync` и что «Запретить» даёт «temporarily unavailable»; «Всегда разрешать» на
  ad-hoc-сборке; префиксы `v10`/`v11` на живом Linux. Смоук-чек-лист — `reports/2026-09-27-db-encryption-smoke.md`.
- **Автосинхронизация: не проверено вживую** — сон и пробуждение (`resume` + 60 с), 4 часа при открытом приложении,
  «Загрузить» поверх автосинхронизации (worker останавливается, ручной импорт идёт с начала), выключенный переключатель,
  запуск под замком. Холды, завершённые позже 3 дней, после автосинхронизации перестают быть холдами.
- **Токены и ключ базы на Linux без keyring — проверить вживую** (VM или `--password-store=basic`): по коду async API без
  keyring шифрует встроенным ключом (`v10`), и `SecureStore` должен счесть это `insecure` (токены в памяти, база открыта с
  `no-secure-storage`).
- Когда приложение станет MCP-сервером — замок должен закрывать и MCP-доступ. Windows Hello — отдельным шагом (нативный модуль).
- Веб-версия (Nuxt SPA) снята с плана: вместо неё десктоп на Electron (этап 1). Веб — возможная будущая версия.
- **Приложение как MCP-сервер для Claude Desktop**: данные в приложении, вопросы в Claude по подписке пользователя,
  без API-ключа. Главная будущая фича.
- **Единая база**: когда десктоп станет MCP-сервером, Claude Desktop читает базу десктопа (userData «Balance Insights»),
  а `apps/mcp` остаётся инструментом разработчика.
- Трей: импорт продолжается при закрытом окне.
- Распространение (бесплатно): публичный репо, сборка electron-builder в GitHub Actions по тегу (mac .dmg, win .exe,
  linux AppImage), публикация в GitHub Releases с SHA-256 и build provenance attestations. Страница установки
  со скриншотами обхода Gatekeeper и SmartScreen. Windows: заявка в SignPath Foundation на бесплатную подпись.
  macOS: без подписи, пока не решено иначе.
- Остальные экраны: сравнение месяцев, поездки по валюте операции, доходы, поиск операций.
- AI-режим со своим API-ключом: ключ в main через safeStorage, модель выбирает график из белого списка компонентов,
  код не генерирует.
- Погода (Open-Meteo): запросы из main по списку разрешённых адресов.
- Обновление Node с 22.

## Not checked on a live system: banks

- The bank select in the global filters and the «Refresh» popover next to the sync status are hidden until a second
  bank is connected, so neither has been seen in the running app: only their tests cover them. Check both (layout in a
  narrow window on Windows, macOS and Linux, the select inside the popover, a refresh of one bank) once a second
  provider exists. The same goes for the bank select of «Connections» in settings and its «Connections shown: X of N»
  line.
- «Refresh» in «Connections» (settings) shows with one bank, but has not been checked in the running app either: the
  toolbar in a narrow window, the status line while an import or «Auto-sync» runs, the refusal under the row.
- After a refresh of one bank, «last synced» is still the newest sync of any account (`DataService.lastSyncSec`,
  `status().lastSyncAt`): auto-sync waits its 30 minutes / 4 hours although the other bank was not refreshed, and the
  status tooltip «Updated at …» says more than is true of that bank. Decide with the second bank: the oldest of the
  connections' latest syncs, or per-bank thresholds.
- A bank connected later than the first: in its own view the compared period and the months before its data read as
  zero, not as «no data» (coverage and `dataFrom` are family-wide, as for a person).
- «Refresh»: the button stays on while an unfinished import waits for a token (main answers `running`); the «no saved
  token for this bank» text also shows for «All banks»; a refusal stays on screen after the bank changes. In
  «Connections» the button is off before the click when the selection has no token; the popover of the global filters
  still learns it from main's refusal.
- `GlobalFilters` is mounted in `tests/renderer/sync-status.test.ts` with one bank only: add a two-bank case that finds
  the bank select and the refresh button in the row.

## Later: currencies

- PLN (or other currencies) as a main / «≈» currency: one entry in `CURRENCIES` (`entities/currency-display`) and the
  dictionaries; the rate is already in the Monobank answer.
- The `CurrencyToggle` popover and the «Spending» gear popover have no accessible name for the dialog itself: give
  `VPopover` a `title` / `aria-labelledby` option.
- `pendingHolds` ignores the participant and scope filters, in «Spending» and in the «Now» strip alike.

## Later: analytics

- Open the category screen from analytics: that screen is one scope and one month, analytics is all scopes over a range,
  so the figures would not match. Needs a scope filter on analytics or a range on the category screen.
- A personal / business switch on analytics; weeks or quarters as the unit of a range; keeping the period between
  launches.
- Not checked on a live system: the analytics screen (layout, the charts' look, the period picker's hover preview).

## Later: home screen

- «Spending»: show today's categories too — most likely a switch right by the category bars (month / today), so the
  block answers «what did I spend on today» without a separate view.
