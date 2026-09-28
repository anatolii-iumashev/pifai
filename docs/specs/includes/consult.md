# Consult: консультации в Trigger.dev

`includes/consult` — самостоятельный проект Trigger.dev. Задача `consult-telegram` читает подготовленный индекс wiki, ищет релевантные материалы, вызывает OpenRouter, хранит историю в Postgres и отправляет ответ в Telegram. Источники в ответе берутся из индекса, ссылки ведут на существующий сайт GitHub Pages.

Основные файлы: [задача](../../../includes/consult/src/trigger/consult-telegram.ts), [обработка](../../../includes/consult/src/processor.ts), [сборка знаний](../../../includes/consult/scripts/build-knowledge.mjs), [миграция БД](../../../includes/consult/migrations/001_dialogues.sql). Для исполнения нужны `DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `OPENROUTER_API_KEY` и `OPENROUTER_MODEL`; `TRIGGER_PROJECT_REF` задаёт проект Trigger.dev. Дополнительные настройки модели перечислены в [openrouter.ts](../../../includes/consult/src/openrouter.ts).

## Команды

Из `includes/consult`:

```sh
npm ci
npm run build:knowledge
npm run check
npm test
npm run eval
npm run dev
npm run deploy
```

`npm test` уже включает сборку знаний и `npm run eval`. `npm run dev` запускает локальный Trigger.dev; `npm run deploy` публикует задачу и требует авторизации Trigger.dev. SQL-миграцию применяют к выбранной БД до обработки сообщений:

```sh
psql "$DATABASE_URL" -f migrations/001_dialogues.sql
```

Секреты задачи задаются в серверном окружении Trigger.dev. Текущее состояние миграции — в [RFC](../../rfc/260928-pifai-bunny-trigger-openrouter.md).
