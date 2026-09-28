# Десктоп: приложение, сборка, релиз, обновления

Перенесено из корневого `CLAUDE.md` (27.09.2026). Область: apps/desktop.

## Этап 1: десктоп (решения)

- Имя приложения — «Balance Insights» (без «mono»: читается как бренд банка). В README и в окне «О программе» —
  «неофициальное приложение, не связано с Monobank». API в renderer — `window.balance`, каналы IPC — `balance:*`.
- Имя и `userData` задаются явно до `ready` (`app.setName` / `app.setPath`): prod —
  `~/Library/Application Support/Balance Insights/`, dev — `~/Library/Application Support/Balance Insights Dev/`.
  Тест проверяет, что путь ровно такой. Агент эти папки не читает и приложение не запускает (deny + sandbox).
- **Имя «Balance Insights» и `appId` `io.github.mortyq.balanceinsights` после первого релиза не меняются.**
  От имени зависят папка userData и запись Keychain, которой safeStorage шифрует токен (по поведению Chromium —
  «<имя> Safe Storage»). От `appId` — bundle id на macOS, установка и идентичность приложения на Windows, автообновление.
  Смена = пользователи теряют токен и данные или получают второе приложение. `appId` проверяет `tests/package.test.ts`
  (конфиг и `CFBundleIdentifier` в бинарнике).
- Бинарник Electron: `dev` и `build` первым шагом запускают `scripts/ensure-electron.mjs` (inline, без
  postinstall и других lifecycle-хуков). Нет бинарника — вызывает `install.js` пакета Electron, есть — ничего не делает,
  нет сети — ошибка с командой `binary:install`, которую выполняет пользователь.
- Репозиторий — публичный `github.com/MortyQ/muza-balance-insights` (`muza` — бренд автора). Лицензия MIT,
  `author: MortyQ` без email. Файлы для GitHub-сообщества (README, SECURITY, CONTRIBUTING, шаблоны) — на английском,
  везде запрет выкладывать токен, выписки, суммы, имена, скриншоты с данными. Уязвимости — через private reporting.
- Меню приложения — своё (`apps/desktop/src/main/menu.ts`): стандартное меню Electron даёт Reload/DevTools и Help-ссылки
  через `shell.openExternal`. В prod — без reload, DevTools и роли `help`; «О программе» — нативная панель на macOS,
  диалог на Windows/Linux. Дисклеймер — текст словаря `common.disclaimer` (панель и экран), репозиторий
  в «О программе» — текстом, не ссылкой.
- Иконка — `apps/desktop/build/` (`icon.icns` до 1024, `icon.ico` до 256, `icon.png` 512, исходник `icon.svg`),
  electron-builder берёт её оттуда сам. `package.test.ts` / `dmg.test.ts` проверяют размеры и что в `.app` своя иконка.
  Образы `.dmg` монтируются только в `test:dmg` (у пользователя): `hdiutil` в sandbox агента не работает.
- Установщики (этап 2): mac `.dmg` arm64 и x64, win `nsis` x64 (per-user, `oneClick`, данные при удалении
  остаются), linux `AppImage` x64, имена `Balance-Insights-<версия>-<os>-<arch>.<ext>`. Скрипты `package:mac|win|linux`
  всегда с `--publish never` (иначе electron-builder на теге в CI публикует сам). Кэш загрузок Electron —
  `apps/desktop/node_modules/.cache/electron` (`electronDownload.cache`, `electron_config_cache`).
  libsql для обеих архитектур Mac — `supportedArchitectures` в `pnpm-workspace.yaml`.
- Релиз — `.github/workflows/release.yml`: тег `vX.Y.Z` (= версия `apps/desktop/package.json`) → тесты на Linux,
  macOS и Windows (на Windows обязательны только тесты `db-libsql` — шифр базы; полный набор пока информационно) → сборка на своём раннере каждой ОС + проверки бинарника (`PACKAGE_CHECK`, `DMG_CHECK`) → draft-релиз с
  `SHA256SUMS.txt` и attestations. Публикует draft пользователь руками. Ручной запуск — только артефакты, без релиза.
- Описание релиза — раздел этой версии из `CHANGELOG.md` (по-английски, для пользователей) плюс постоянный текст про
  проверку файлов и установку: `apps/desktop/scripts/release-notes.mjs` (`check` в job тестов — тег без раздела с датой
  не собирается; `notes` → `notes.md` → `gh release create --notes-file`). Как пополнять и когда `unreleased` меняется
  на дату — правило в корневом `CLAUDE.md`, раздел «Process»; `tests/release-notes.test.ts` проверяет, что верхний
  раздел — следующая версия (`unreleased`) или версия `package.json` с датой.
- Обновление без Developer ID (проверено 25.09.2026): macOS один раз спрашивает пароль к Keychain, токен сохраняется.
- Прежнее имя до 25.09.2026 — «Balans Insights». Его пути остаются в deny и sandbox `.claude/settings.json`, пока
  пользователь не удалит старые папки (Application Support, Caches, Logs, в том числе Dev).
- E2E на Electron в этапе 1 нет: ручной смоук пользователя по чек-листу из отчёта.
- Локальная сборка (шаг 8): `pnpm --filter @mono/desktop package:dir` → `apps/desktop/dist/` (в `.gitignore`), конфиг
  `apps/desktop/electron-builder.json`: fuses по таблице плана этапа 1, `asar` + `asarUnpack: **/*.node`, без rebuild,
  Electron из `node_modules`, без подписи (ad-hoc после fuses). `test:package` собирает и проверяет бинарник
  (`apps/desktop/tests/package.test.ts`: fuse wire, содержимое asar, `codesign --verify`); без `dist/` бинарная часть пропускается.
  `@mono/*` в devDependencies десктопа: их вшивает electron-vite, в asar они не попадают.
- Этап 1 закрыт 25.09.2026: Electron Security Checklist 20/20 (таблица — `reports/2026-09-25-stage1-step9-security-checklist.md`,
  пункты 15 и 16 — `apps/desktop/tests/checklist.test.ts`), итоги трат месяца на экране совпали с MCP.
- **Автообновление — реализовано** (`apps/desktop/src/main/update/`):
  - новая версия предлагается только через подписанный манифест `update.json` + `.sig` (ed25519, `manifest.ts`):
    подпись проверяется до разбора, дальше — appId, версия строго выше текущей (без отката), имена файлов по шаблону;
    файл перед установкой или сохранением сверяется по размеру и sha512;
  - Windows и Linux AppImage — `electron-updater` (фид `latest*.yml` того же релиза, версия должна совпасть с манифестом),
    скачивание в фоне, `autoInstallOnAppQuit` включается только после проверки файла; «Перезапустить и обновить»
    не во время импорта. macOS и Linux без `$APPIMAGE` — проверенный файл в «Загрузки», `shell` не используется (#15);
  - сеть — только сессия `electron-updater` (одна на его запросы и наши) с фильтром сервиса `github`, в том числе на каждом
    редиректе (`session.ts`); `fromPartition` и `electron-updater` — только в `update/electron.ts`;
  - проверка через 10 с после запуска и раз в 6 ч; выключатель в настройках (`userData/preferences.json`, по умолчанию вкл.);
    в dev не проверяется. Релизы публикуются обычными, не pre-release (`/releases/latest`).
  - Ключ: `scripts/update-keygen.mjs` (только автор), подпись — `scripts/update-sign.mjs` в release job.
  - Не проверено на живом обновлении: фильтр сессии на редиректах GitHub, SmartScreen при тихой установке, карантин `.dmg`.
