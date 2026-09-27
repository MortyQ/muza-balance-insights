# Десктоп: импорт, токены, люди и подключения в main

Перенесено из корневого `CLAUDE.md` (27.09.2026). Область: apps/desktop.

- Импорт возобновляется при запуске автоматически, если токен в Keychain; если токен был только в памяти — UI просит ввести.
- Отмена импорта — `signal` в `SyncContext` ядра + `kill()` через 10 с как запасной путь.
- Временные сбои импорта (сеть/таймаут, 5xx, 429 сверх повторов ядра) и падение worker пережидаются
  (`apps/desktop/src/shared/retry.ts`): первый повтор через 1 мин, дальше каждые 15 мин, до 4 ч сбоев подряд;
  закоммиченное окно сбрасывает серию. После повтора докачиваются только оставшиеся окна исходного плана.
  Worker сам не выходит после итогового сообщения — его закрывает main (иначе сообщение терялось).
  Сон компьютера во время паузы перед повтором в эти 4 ч не засчитывается (`sleptDuringPause`: пауза затянулась
  больше чем на 30 с — разница считается сном и сдвигает начало серии).
- Токены — `TokenVault` (`apps/desktop/src/main/token.ts`): файл на подключение `tokens/<connectionId>.bin` (safeStorage,
  0600), статус и «ввести заново» — по подключению. Старый `token.bin` при запуске переносится к подключению Monobank
  как есть, без расшифровки. Форма токена провайдера — `apps/desktop/src/net/providers.ts` (`DESKTOP_PROVIDERS`, запись на
  каждый провайдер ядра — `tests/providers.test.ts`).
- Импорт нескольких подключений — одна задача, один worker, один `import-job.json`: `start` несёт
  `connections: [{ connectionId, provider, token }]` (1–10), окна идут по кругу (`runPlans`). Всё, что worker знает о
  банке (клиент, разбор ошибок), — `apps/desktop/src/worker/providers.ts` (`WORKER_PROVIDERS`); сеть — таблица `FETCH` в
  `worker/import.ts`, у каждого провайдера `allowlistedFetch(net.fetch, [его сервисы])` буквально. Отклонённый токен
  (`auth`) или чужой / уже подключённый владелец (`connection`) выключает только своё подключение: итог — `done` с
  `failed`; если не прошло ни одно — `error` первого. Подключение без токена main пропускает и добавляет в `failed`.
  При запуске задача продолжается для подключений с токеном в Keychain; нет ни одного — `needs-token` с их id.
- IPC людей и подключений (`apps/desktop/src/main/people.ts`, `PeopleService`): `listPeople` (подпись участника — единственное
  имя, что уходит в renderer; без токена и `external_client_id`), `addConnection({ participant: { id } | { label } |
  { fromBank: true }, provider, token, remember })` (форма токена до записи; тот же токен второй раз — `duplicate`; токен не
  сохранился — подключение и новый участник откатываются; импорт не запускает), `renameParticipant`, `setConnectionToken`,
  `removeConnection` (во время импорта — `import-running` без диалога, затем системный диалог, токен, данные).
  `spendingSummary` / `getBalances` принимают `participantId`.
- **Живое обновление при импорте — реализовано** (`app/listeners.ts`): каждый новый `windowsDone` → `syncStatus.refresh()`
  не чаще раза в `LIVE_REFRESH_MS` (3 с, `throttle` из `shared/lib`, последний тик не теряется), конец импорта — ещё раз.
  Экраны перезагружаются по `version` «тихо» (`useAsyncData(…, { quiet })`: без `loading`, старые цифры до прихода новых);
  пока идёт импорт, в тратах строка «Идёт импорт — цифры дополняются». Тесты renderer с алиасами — `tests/renderer/`
  (типы проверяет `tsconfig.web.json`).
