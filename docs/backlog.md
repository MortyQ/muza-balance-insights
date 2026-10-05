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

## Later: currencies

- PLN (or other currencies) as a main / «≈» currency: one entry in `CURRENCIES` (`entities/currency-display`) and the
  dictionaries; the rate is already in the Monobank answer.
- The `CurrencyToggle` popover and the «Spending» gear popover have no accessible name for the dialog itself: give
  `VPopover` a `title` / `aria-labelledby` option.
- `pendingHolds` ignores the participant and scope filters, in «Spending» and in the «Now» strip alike.

## Later: home screen

- «Spending»: show today's categories too — most likely a switch right by the category bars (month / today), so the
  block answers «what did I spend on today» without a separate view.
