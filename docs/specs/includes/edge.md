# Edge: Telegram webhook

`includes/edge` — самостоятельный Bunny Edge Script на Deno/JavaScript. Он принимает `POST /webhook`, проверяет секретный заголовок Telegram и передаёт личные текстовые сообщения в задачу `consult-telegram` на Trigger.dev. `GET /health` возвращает состояние HTTP-обработчика. Консультация и обращение к модели здесь не выполняются.

Основные файлы: [обработчик](../../../includes/edge/src/handler.ts), [точка входа](../../../includes/edge/src/index.ts), [тесты](../../../includes/edge/test/handler.test.ts). Для работы в Bunny нужны секреты `TELEGRAM_WEBHOOK_SECRET` и `TRIGGER_SECRET_KEY`.

## Команды

Проект нативный для Deno 2.4+: зависимости и задачи описаны в [deno.json](../../../includes/edge/deno.json), версии зафиксированы в `deno.lock`. Из `includes/edge`:

```sh
deno task test    # deno test
deno task check   # deno check + deno lint
deno task build   # deno bundle
```

Сборка создаёт самодостаточный `dist/index.js` с встроенным `@bunny.net/edgescript-sdk`. Публикацию выполняет [bot-v2.yml](../../../.github/workflows/bot-v2.yml) вручную через GitHub Actions; для неё нужны `BUNNYNET_API_KEY` и ID Edge Script в `BUNNY_EDGE_SCRIPT_ID`. Локальная команда деплоя после сборки:

```sh
npx @bunny.net/cli scripts deploy dist/index.js "$BUNNY_EDGE_SCRIPT_ID"
```

Рабочий webhook Telegram не переключается одним деплоем скрипта. Порядок проверки и переключения описан в [RFC](../../rfc/260928-pifai-bunny-trigger-openrouter.md).
