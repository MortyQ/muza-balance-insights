# Подключение к Claude Desktop

## 1. Конфиг

Открой `~/Library/Application Support/Claude/claude_desktop_config.json`: Claude Desktop → Settings → Developer → Edit Config. Добавь сервер в `mcpServers`. Если там уже есть другие серверы, не удаляй их.

```json
{
  "mcpServers": {
    "monobank": {
      "command": "/Users/serhii/.nvm/versions/node/v22.14.0/bin/node",
      "args": [
        "--import",
        "file:///Users/serhii/Desktop/Mine/mcp/monobank-mcp/apps/mcp/node_modules/tsx/dist/loader.mjs",
        "/Users/serhii/Desktop/Mine/mcp/monobank-mcp/apps/mcp/src/server.ts"
      ]
    }
  }
}
```

Почему пути абсолютные:
- Claude Desktop не видит `nvm` в своём `PATH`, поэтому `node` указан полным путём.
- Процесс запускается из произвольной папки, поэтому загрузчик `tsx` тоже задан полным путём.
- Токен и путь к базе сервер берёт сам из `/Users/serhii/Desktop/Mine/mcp/monobank-mcp/.env` в корне репозитория (путь считается от файла сервера, а не от cwd). Поэтому блок `env` в конфиге не нужен.

Если обновишь Node через nvm, путь в `command` поменяется. Узнать новый: `which node`.

`apps/mcp/node_modules/tsx` в pnpm — симлинк в `node_modules/.pnpm/…`; Node идёт по нему, путь в конфиге не меняется при обновлении tsx.

## 2. Перезапуск

Полностью закрой Claude Desktop (⌘Q) и открой заново. В новом чате, в меню инструментов (значок ползунков), должен появиться сервер `monobank` с семью тулами:

| Тул | Для чего |
|---|---|
| `spending_summary` | траты за период по категориям, месяцам, счетам, MCC, scope или валюте операции |
| `compare_periods` | сравнение трат двух периодов |
| `income_summary` | поступления по источнику, месяцу, счёту или scope |
| `search_transactions` | отдельные операции: по валюте операции, тексту, сумме, категории; имена — инициалами |
| `get_balances` | собственные средства, лимит, доступно |
| `get_sync_status` | сегодняшняя дата, свежесть данных, диагностика |
| `sync_recent` | подтянуть новые операции: один запрос к Monobank в минуту |

## 3. Если сервер не появился

- Лог сервера: `~/Library/Logs/Claude/mcp-server-monobank.log`. Сервер пишет туда только служебные сообщения, без сумм и имён.
- Частые причины:
  - неверный путь к `node`;
  - не выполнен `pnpm install` в корне репозитория;
  - синтаксическая ошибка в JSON конфига.
- Проверка без Claude Desktop: `pnpm --filter @mono/mcp dev:mcp` в терминале должен написать «сервер запущен (stdio)». Выйти: Ctrl+C.
- MCP Inspector (по желанию, работает с реальными данными, запускать только самому):
  `npx @modelcontextprotocol/inspector /Users/serhii/.nvm/versions/node/v22.14.0/bin/node --import file:///Users/serhii/Desktop/Mine/mcp/monobank-mcp/apps/mcp/node_modules/tsx/dist/loader.mjs /Users/serhii/Desktop/Mine/mcp/monobank-mcp/apps/mcp/src/server.ts`

## 4. Первые вопросы

- «Сколько я потратил в августе и на что?»
- «Сравни траты в сентябре с августом».
- «Сколько у меня собственных денег сейчас?»
- «Какой доход ФОП в долларах с начала года?»
- «Сколько я потратил в Албании?» (валюта операции ALL + даты поездки)
- «Насколько свежие данные?» Если данные старше суток, модель сама предложит `sync_recent`.
